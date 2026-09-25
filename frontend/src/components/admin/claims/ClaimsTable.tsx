'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type ClaimStatus =
  | 'pending'
  | 'approved'
  | 'disputed'
  | 'escalated'
  | 'paid';

export interface Claim {
  id: string;
  claimant: string;
  asset: string;
  amount: number;
  status: ClaimStatus;
  fraudScore: number;
  createdAt: string;
}

export interface BulkPayoutResult {
  claimId: string;
  ok: boolean;
  message?: string;
}

export interface ClaimsTableProps {
  claims: Claim[];
  onDispute?: (claim: Claim) => Promise<void> | void;
  onEscalate?: (claim: Claim) => Promise<void> | void;
  onProcessPayout?: (claim: Claim) => Promise<void> | void;
  onBulkPayout?: (claims: Claim[]) => Promise<BulkPayoutResult[]>;
  onExportCsv?: () => Promise<void> | void;
}

type ActionKind = 'dispute' | 'escalate' | 'payout';

const STATUS_OPTIONS: ClaimStatus[] = [
  'pending',
  'approved',
  'disputed',
  'escalated',
  'paid',
];

const ACTION_COPY: Record<
  ActionKind,
  { title: string; description: string; confirm: string; destructive: boolean }
> = {
  dispute: {
    title: 'Dispute claim',
    description:
      'Disputing this claim freezes the payout and notifies the claimant. The claim will be reviewed by the fraud team before any funds move.',
    confirm: 'DISPUTE',
    destructive: true,
  },
  escalate: {
    title: 'Escalate claim',
    description:
      'Escalating hands this claim to a senior reviewer and pauses automated processing. This action is recorded in the audit log.',
    confirm: 'ESCALATE',
    destructive: true,
  },
  payout: {
    title: 'Process payout',
    description:
      'Processing the payout releases funds to the claimant immediately. This cannot be undone once the transfer settles.',
    confirm: 'PAYOUT',
    destructive: true,
  },
};

function formatAmount(amount: number, asset: string): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${asset}`;
}

function fraudScoreClass(score: number): string {
  if (score >= 70) return 'text-red-600 font-semibold';
  if (score >= 40) return 'text-amber-600 font-semibold';
  return 'text-emerald-600';
}

export function ClaimsTable({
  claims,
  onDispute,
  onEscalate,
  onProcessPayout,
  onBulkPayout,
  onExportCsv,
}: ClaimsTableProps) {
  const [status, setStatus] = useState<ClaimStatus | 'all'>('all');
  const [asset, setAsset] = useState<string>('all');
  const [minFraud, setMinFraud] = useState('');
  const [maxFraud, setMaxFraud] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<{ kind: ActionKind; claim: Claim } | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkPayoutResult[] | null>(null);

  const assets = useMemo(
    () => Array.from(new Set(claims.map((c) => c.asset))).sort(),
    [claims],
  );

  const filtered = useMemo(() => {
    const min = minFraud === '' ? null : Number(minFraud);
    const max = maxFraud === '' ? null : Number(maxFraud);
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;

    return claims.filter((claim) => {
      if (status !== 'all' && claim.status !== status) return false;
      if (asset !== 'all' && claim.asset !== asset) return false;
      if (min !== null && claim.fraudScore < min) return false;
      if (max !== null && claim.fraudScore > max) return false;
      const created = new Date(claim.createdAt).getTime();
      if (from !== null && created < from) return false;
      if (to !== null && created > to) return false;
      return true;
    });
  }, [claims, status, asset, minFraud, maxFraud, fromDate, toDate]);

  const selectableClaims = useMemo(
    () => filtered.filter((c) => c.status === 'approved'),
    [filtered],
  );

  const allSelected =
    selectableClaims.length > 0 &&
    selectableClaims.every((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectableClaims.forEach((c) => next.delete(c.id));
      } else {
        selectableClaims.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAction(kind: ActionKind, claim: Claim) {
    setAction({ kind, claim });
    setConfirmation('');
  }

  function closeAction() {
    setAction(null);
    setConfirmation('');
  }

  async function confirmAction() {
    if (!action) return;
    const copy = ACTION_COPY[action.kind];
    if (copy.destructive && confirmation.trim() !== copy.confirm) return;
    setBusy(true);
    try {
      if (action.kind === 'dispute') await onDispute?.(action.claim);
      if (action.kind === 'escalate') await onEscalate?.(action.claim);
      if (action.kind === 'payout') await onProcessPayout?.(action.claim);
      closeAction();
    } finally {
      setBusy(false);
    }
  }

  async function runBulkPayout() {
    const targets = filtered.filter((c) => selected.has(c.id));
    if (targets.length === 0 || !onBulkPayout) return;
    setBusy(true);
    try {
      const results = await onBulkPayout(targets);
      setBulkResults(results);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const actionCopy = action ? ACTION_COPY[action.kind] : null;
  const confirmDisabled =
    busy || (actionCopy?.destructive === true && confirmation.trim() !== actionCopy.confirm);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="claim-status">
            Status
          </label>
          <Select value={status} onValueChange={(v) => setStatus(v as ClaimStatus | 'all')}>
            <SelectTrigger id="claim-status" className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="claim-asset">
            Asset
          </label>
          <Select value={asset} onValueChange={setAsset}>
            <SelectTrigger id="claim-asset" className="w-32">
              <SelectValue placeholder="All assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assets</SelectItem>
              {assets.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="claim-min-fraud">
            Fraud score min
          </label>
          <Input
            id="claim-min-fraud"
            type="number"
            min={0}
            max={100}
            value={minFraud}
            onChange={(e) => setMinFraud(e.target.value)}
            className="w-28"
            placeholder="0"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="claim-max-fraud">
            Fraud score max
          </label>
          <Input
            id="claim-max-fraud"
            type="number"
            min={0}
            max={100}
            value={maxFraud}
            onChange={(e) => setMaxFraud(e.target.value)}
            className="w-28"
            placeholder="100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="claim-from">
            From
          </label>
          <Input
            id="claim-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="claim-to">
            To
          </label>
          <Input
            id="claim-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void onExportCsv?.()}
            disabled={busy}
          >
            Export CSV
          </Button>
          <Button
            onClick={() => void runBulkPayout()}
            disabled={busy || selected.size === 0 || !onBulkPayout}
          >
            Process payout ({selected.size})
          </Button>
        </div>
      </div>

      {bulkResults && (
        <div className="rounded-md border p-3 text-sm" role="status">
          <p className="mb-2 font-medium">Bulk payout results</p>
          <ul className="space-y-1">
            {bulkResults.map((r) => (
              <li key={r.claimId} className="flex items-center gap-2">
                <span
                  className={
                    r.ok ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'
                  }
                >
                  {r.ok ? 'Paid' : 'Failed'}
                </span>
                <span className="font-mono text-xs">{r.claimId}</span>
                {r.message && <span className="text-muted-foreground">{r.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all approved claims"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableClaims.length === 0}
                />
              </TableHead>
              <TableHead>Claim</TableHead>
              <TableHead>Claimant</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fraud score</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No claims match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select claim ${claim.id}`}
                      checked={selected.has(claim.id)}
                      onChange={() => toggleOne(claim.id)}
                      disabled={claim.status !== 'approved'}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{claim.id}</TableCell>
                  <TableCell>{claim.claimant}</TableCell>
                  <TableCell>{claim.asset}</TableCell>
                  <TableCell>{formatAmount(claim.amount, claim.asset)}</TableCell>
                  <TableCell className="capitalize">{claim.status}</TableCell>
                  <TableCell className={fraudScoreClass(claim.fraudScore)}>
                    {claim.fraudScore}
                  </TableCell>
                  <TableCell>{new Date(claim.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAction('dispute', claim)}
                      >
                        Dispute
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAction('escalate', claim)}
                      >
                        Escalate
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openAction('payout', claim)}
                        disabled={claim.status !== 'approved'}
                      >
                        Process payout
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={action !== null} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent>
          {action && actionCopy && (
            <>
              <DialogHeader>
                <DialogTitle>{actionCopy.title}</DialogTitle>
                <DialogDescription>{actionCopy.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  Claim <span className="font-mono">{action.claim.id}</span> —{' '}
                  {formatAmount(action.claim.amount, action.claim.asset)}
                </p>
                {actionCopy.destructive && (
                  <div className="space-y-1">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="claim-confirm"
                    >
                      Type {actionCopy.confirm} to confirm
                    </label>
                    <Input
                      id="claim-confirm"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder={actionCopy.confirm}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeAction} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={() => void confirmAction()} disabled={confirmDisabled}>
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClaimsTable;
