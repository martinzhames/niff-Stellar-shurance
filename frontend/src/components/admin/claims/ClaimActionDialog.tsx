'use client';

import { useEffect, useMemo, useState } from 'react';

export type ClaimAction = 'dispute' | 'escalate' | 'payout';

export interface ClaimActionDialogProps {
  open: boolean;
  action: ClaimAction;
  claimIds: string[];
  onClose: () => void;
  onConfirm: (action: ClaimAction, claimIds: string[], reason?: string) => void | Promise<void>;
}

interface ActionCopy {
  title: string;
  description: string;
  consequences: string[];
  confirmLabel: string;
  destructive: boolean;
  requireReason: boolean;
  confirmationPhrase?: string;
}

const ACTION_COPY: Record<ClaimAction, ActionCopy> = {
  dispute: {
    title: 'Dispute claim',
    description: 'Mark the selected claim(s) as disputed and hand them back to the review queue.',
    consequences: [
      'The claim status changes to Disputed and leaves the payout pipeline.',
      'Reviewers are notified and must re-approve before any payout can run.',
      'A reason is recorded on the claim audit trail.',
    ],
    confirmLabel: 'Dispute claim',
    destructive: false,
    requireReason: true,
  },
  escalate: {
    title: 'Escalate claim',
    description: 'Escalate the selected claim(s) to a senior reviewer for a manual decision.',
    consequences: [
      'The claim is flagged for senior review and removed from automated processing.',
      'Escalation is logged and visible to compliance.',
      'Payouts are blocked until the escalation is resolved.',
    ],
    confirmLabel: 'Escalate claim',
    destructive: false,
    requireReason: true,
  },
  payout: {
    title: 'Process payout',
    description: 'Release funds for the selected approved claim(s).',
    consequences: [
      'Funds are transferred for every selected claim and cannot be reversed here.',
      'Each claim is processed independently; partial failures are reported per claim.',
      'Processed claims are marked as Paid and removed from the payout queue.',
    ],
    confirmLabel: 'Process payout',
    destructive: true,
    requireReason: false,
    confirmationPhrase: 'PAYOUT',
  },
};

export function ClaimActionDialog({
  open,
  action,
  claimIds,
  onClose,
  onConfirm,
}: ClaimActionDialogProps) {
  const copy = ACTION_COPY[action];
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setConfirmation('');
      setSubmitting(false);
    }
  }, [open, action]);

  const confirmationSatisfied = useMemo(() => {
    if (!copy.destructive || !copy.confirmationPhrase) return true;
    return confirmation.trim() === copy.confirmationPhrase;
  }, [confirmation, copy]);

  const reasonSatisfied = !copy.requireReason || reason.trim().length > 0;
  const canConfirm = claimIds.length > 0 && confirmationSatisfied && reasonSatisfied && !submitting;

  if (!open) return null;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(action, claimIds, copy.requireReason ? reason.trim() : undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-action-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 id="claim-action-title" className="text-lg font-semibold text-gray-900">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{copy.description}</p>

        <p className="mt-4 text-sm font-medium text-gray-700">
          {claimIds.length} claim{claimIds.length === 1 ? '' : 's'} selected
        </p>

        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Consequences</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {copy.consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {copy.requireReason && (
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Reason
            <textarea
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this action is being taken"
            />
          </label>
        )}

        {copy.destructive && copy.confirmationPhrase && (
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Type <span className="font-mono font-semibold">{copy.confirmationPhrase}</span> to confirm
            <input
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={copy.confirmationPhrase}
            />
          </label>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              copy.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {submitting ? 'Processing…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClaimActionDialog;
