'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTransactionFlow } from '@/hooks/useTransactionFlow';
import { isValidStellarAddress } from '@/lib/stellar';

interface Policy {
  id: string;
  holder: string;
  type: string;
  region: string;
  coverage: string;
  premium: string;
  deductible: string;
  beneficiary: string | null;
  asset: string;
  startLedger: number;
  endLedger: number;
  startDate: string;
  endDate: string;
  termsUrl: string;
  termsHash: string;
  status: 'active' | 'expired' | 'terminated' | 'pending';
}

interface Claim {
  id: string;
  amount: string;
  status: string;
  filedAt: string;
}

const RENEWAL_WINDOW_DAYS = 30;

function daysUntil(date: string): number {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  const policyId = params?.id;
  const { run, pending } = useTransactionFlow();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [beneficiaryInput, setBeneficiaryInput] = useState('');
  const [beneficiaryError, setBeneficiaryError] = useState<string | null>(null);
  const [transferInput, setTransferInput] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'beneficiary' | 'transfer' | 'terminate'>(null);

  useEffect(() => {
    if (!policyId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/policies/${policyId}`).then((r) => r.json()),
      fetch(`/api/policies/${policyId}/claims`).then((r) => r.json()),
    ])
      .then(([p, c]) => {
        if (cancelled) return;
        setPolicy(p);
        setClaims(Array.isArray(c) ? c : []);
      })
      .catch(() => !cancelled && setError('Failed to load policy.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  const daysToExpiry = useMemo(() => (policy ? daysUntil(policy.endDate) : 0), [policy]);

  const actions = useMemo(() => {
    if (!policy) return [];
    const active = policy.status === 'active';
    const renewable = active && daysToExpiry <= RENEWAL_WINDOW_DAYS && daysToExpiry >= 0;
    return [
      {
        key: 'claim',
        label: 'File claim',
        allowed: active,
        reason: active ? undefined : 'Claims can only be filed on active policies.',
      },
      {
        key: 'renew',
        label: 'Renew',
        allowed: renewable,
        reason: renewable
          ? undefined
          : `Renewal opens ${RENEWAL_WINDOW_DAYS} days before expiry.`,
      },
      {
        key: 'transfer',
        label: 'Transfer',
        allowed: active,
        reason: active ? undefined : 'Only active policies can be transferred.',
      },
      {
        key: 'beneficiary',
        label: 'Set beneficiary',
        allowed: active,
        reason: active ? undefined : 'Beneficiary can only be set on active policies.',
      },
      {
        key: 'terminate',
        label: 'Terminate',
        allowed: active,
        reason: active ? undefined : 'This policy is no longer active.',
      },
    ];
  }, [policy, daysToExpiry]);

  const submitBeneficiary = useCallback(() => {
    if (!isValidStellarAddress(beneficiaryInput)) {
      setBeneficiaryError('Enter a valid Stellar address.');
      return;
    }
    setBeneficiaryError(null);
    setConfirm('beneficiary');
  }, [beneficiaryInput]);

  const submitTransfer = useCallback(() => {
    if (!isValidStellarAddress(transferInput)) {
      setTransferError('Enter a valid Stellar address.');
      return;
    }
    setTransferError(null);
    setConfirm('transfer');
  }, [transferInput]);

  const confirmAction = useCallback(async () => {
    if (!policy || !confirm) return;
    const payload =
      confirm === 'beneficiary'
        ? { beneficiary: beneficiaryInput }
        : confirm === 'transfer'
          ? { newHolder: transferInput }
          : {};
    await run({
      type: confirm === 'terminate' ? 'terminatePolicy' : `policy.${confirm}`,
      policyId: policy.id,
      payload,
    });
    setConfirm(null);
  }, [policy, confirm, beneficiaryInput, transferInput, run]);

  if (loading) return <p className="p-6">Loading policy…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!policy) return <p className="p-6">Policy not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Policy {policy.id}</h1>
        <span className="rounded bg-gray-100 px-2 py-1 text-sm capitalize">{policy.status}</span>
      </header>

      <section className="grid grid-cols-2 gap-4 rounded border p-4">
        <Detail label="Holder" value={policy.holder} />
        <Detail label="Type" value={policy.type} />
        <Detail label="Region" value={policy.region} />
        <Detail label="Coverage" value={policy.coverage} />
        <Detail label="Premium" value={policy.premium} />
        <Detail label="Deductible" value={policy.deductible} />
        <Detail label="Beneficiary" value={policy.beneficiary ?? '—'} />
        <Detail label="Asset" value={policy.asset} />
        <Detail label="Start" value={`${policy.startDate} (ledger ${policy.startLedger})`} />
        <Detail label="End" value={`${policy.endDate} (ledger ${policy.endLedger})`} />
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-medium">Terms</h2>
        <a className="text-blue-600 underline" href={policy.termsUrl} target="_blank" rel="noreferrer">
          View terms document
        </a>
        <p className="mt-1 break-all text-xs text-gray-500">Hash: {policy.termsHash}</p>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-medium">Claim history</h2>
        {claims.length === 0 ? (
          <p className="text-sm text-gray-500">No claims filed.</p>
        ) : (
          <ul className="divide-y">
            {claims.map((c) => (
              <li key={c.id} className="flex justify-between py-2 text-sm">
                <span>{c.filedAt}</span>
                <span>{c.amount}</span>
                <span className="capitalize">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <div key={a.key} className="flex flex-col">
              {a.key === 'claim' ? (
                <Link
                  href={`/policies/${policy.id}/claims/new`}
                  aria-disabled={!a.allowed}
                  className={`rounded px-3 py-2 text-sm ${a.allowed ? 'bg-blue-600 text-white' : 'cursor-not-allowed bg-gray-200 text-gray-500'}`}
                >
                  {a.label}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={!a.allowed || pending}
                  onClick={() => {
                    if (a.key === 'beneficiary') setConfirm('beneficiary');
                    else if (a.key === 'transfer') setConfirm('transfer');
                    else if (a.key === 'terminate') setConfirm('terminate');
                    else if (a.key === 'renew') run({ type: 'renewPolicy', policyId: policy.id });
                  }}
                  className={`rounded px-3 py-2 text-sm ${a.allowed ? 'bg-blue-600 text-white' : 'cursor-not-allowed bg-gray-200 text-gray-500'}`}
                >
                  {a.label}
                </button>
              )}
              {!a.allowed && a.reason && (
                <span className="mt-1 max-w-[12rem] text-xs text-gray-500">{a.reason}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {confirm === 'beneficiary' && (
        <ConfirmDialog
          title="Set beneficiary"
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
          pending={pending}
        >
          <p className="text-sm">
            The beneficiary will receive the payout on claim approval. This replaces any existing
            beneficiary.
          </p>
          <input
            className="mt-2 w-full rounded border p-2 text-sm"
            placeholder="Beneficiary Stellar address"
            value={beneficiaryInput}
            onChange={(e) => setBeneficiaryInput(e.target.value)}
          />
          {beneficiaryError && <p className="mt-1 text-xs text-red-600">{beneficiaryError}</p>}
        </ConfirmDialog>
      )}

      {confirm === 'transfer' && (
        <ConfirmDialog
          title="Transfer policy"
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
          pending={pending}
        >
          <p className="text-sm">
            Transferring moves ownership and all future obligations to the new holder. You will no
            longer be able to file claims on this policy.
          </p>
          <input
            className="mt-2 w-full rounded border p-2 text-sm"
            placeholder="New holder Stellar address"
            value={transferInput}
            onChange={(e) => setTransferInput(e.target.value)}
          />
          {transferError && <p className="mt-1 text-xs text-red-600">{transferError}</p>}
        </ConfirmDialog>
      )}

      {confirm === 'terminate' && (
        <ConfirmDialog
          title="Terminate policy"
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
          pending={pending}
        >
          <p className="text-sm">
            Terminating ends coverage immediately. Unused premium is refunded pro-rata for the
            remaining term; the deductible is not refunded and any open claims are closed.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-gray-500">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function ConfirmDialog({
  title,
  children,
  onCancel,
  onConfirm,
  pending,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded bg-white p-4">
        <h3 className="font-medium">{title}</h3>
        {children}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
            disabled={pending}
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
