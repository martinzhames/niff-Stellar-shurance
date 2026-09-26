import { useMemo, useState } from 'react';
import { useTransactionFlow } from '../../hooks/useTransactionFlow';

/**
 * Policy detail actions.
 *
 * Renders the available actions for a policy (file claim, renew, transfer,
 * set beneficiary, terminate). Each action is only shown when it is allowed
 * for the current policy state; otherwise it is rendered disabled with an
 * explanation. All actions run through the shared transaction flow.
 */

export type PolicyState =
  | 'active'
  | 'expired'
  | 'terminated'
  | 'pending';

export interface Policy {
  id: string;
  state: PolicyState;
  /** Unix seconds when the policy expires. */
  endTime: number;
  /** Unix seconds when the policy starts. */
  startTime: number;
  /** Whether the policy has an outstanding claim in progress. */
  hasOpenClaim?: boolean;
  /** Whether the policy has a designated beneficiary. */
  hasBeneficiary?: boolean;
  /** Whether the policy is transferable by its terms. */
  transferable?: boolean;
  /** Whether the policy can be renewed. */
  renewable?: boolean;
}

const RENEWAL_WINDOW_SECONDS = 30 * 24 * 60 * 60;

interface ActionDescriptor {
  key: string;
  label: string;
  allowed: boolean;
  reason?: string;
  run: () => void;
}

interface PolicyActionsProps {
  policy: Policy;
  /** Called after a transaction is submitted successfully. */
  onSubmitted?: (action: string) => void;
}

function isValidAddress(value: string): boolean {
  // Stellar-style public key: 56 chars, base32 alphabet, starts with G.
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

export default function PolicyActions({ policy, onSubmitted }: PolicyActionsProps) {
  const { submit, isSubmitting } = useTransactionFlow();

  const [beneficiary, setBeneficiary] = useState('');
  const [beneficiaryError, setBeneficiaryError] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    action: string;
    payload: Record<string, unknown>;
  }>(null);

  const now = Math.floor(Date.now() / 1000);

  const renewalOpensAt = policy.endTime - RENEWAL_WINDOW_SECONDS;
  const renewalOpen = now >= renewalOpensAt;
  const daysUntilRenewal = Math.max(
    0,
    Math.ceil((renewalOpensAt - now) / (24 * 60 * 60)),
  );

  const runAction = async (action: string, payload: Record<string, unknown>) => {
    await submit({ action, policyId: policy.id, ...payload });
    onSubmitted?.(action);
  };

  const actions = useMemo<ActionDescriptor[]>(() => {
    const active = policy.state === 'active';

    return [
      {
        key: 'file-claim',
        label: 'File claim',
        allowed: active && !policy.hasOpenClaim,
        reason: !active
          ? 'Claims can only be filed on an active policy.'
          : policy.hasOpenClaim
            ? 'A claim is already in progress for this policy.'
            : undefined,
        run: () =>
          setConfirm({
            title: 'File a claim',
            body: 'Filing a claim starts the review process. The policy remains active while the claim is assessed.',
            action: 'file-claim',
            payload: {},
          }),
      },
      {
        key: 'renew',
        label: 'Renew',
        allowed: active && policy.renewable !== false && renewalOpen,
        reason: !active
          ? 'Only active policies can be renewed.'
          : policy.renewable === false
            ? 'This policy is not renewable by its terms.'
            : !renewalOpen
              ? `Renewal opens 30 days before expiry (in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}).`
              : undefined,
        run: () =>
          setConfirm({
            title: 'Renew policy',
            body: 'Renewing extends coverage for another term and charges the premium again. The new term starts when the current one ends.',
            action: 'renew',
            payload: {},
          }),
      },
      {
        key: 'transfer',
        label: 'Transfer',
        allowed: active && policy.transferable !== false,
        reason: !active
          ? 'Only active policies can be transferred.'
          : policy.transferable === false
            ? 'This policy is not transferable by its terms.'
            : undefined,
        run: () => {
          if (!isValidAddress(transferTo)) {
            setTransferError('Enter a valid recipient address.');
            return;
          }
          setTransferError(null);
          setConfirm({
            title: 'Transfer policy',
            body: `You are about to transfer this policy to ${transferTo.trim()}. You will lose all rights to the policy and its coverage. This cannot be undone.`,
            action: 'transfer',
            payload: { to: transferTo.trim() },
          });
        },
      },
      {
        key: 'set-beneficiary',
        label: 'Set beneficiary',
        allowed: active,
        reason: !active ? 'Beneficiaries can only be set on an active policy.' : undefined,
        run: () => {
          if (!isValidAddress(beneficiary)) {
            setBeneficiaryError('Enter a valid beneficiary address.');
            return;
          }
          setBeneficiaryError(null);
          setConfirm({
            title: 'Set beneficiary',
            body: `The beneficiary ${beneficiary.trim()} will receive the payout if a claim is approved. This replaces any existing beneficiary.`,
            action: 'set-beneficiary',
            payload: { beneficiary: beneficiary.trim() },
          });
        },
      },
      {
        key: 'terminate',
        label: 'Terminate',
        allowed: active,
        reason: !active ? 'Only active policies can be terminated.' : undefined,
        run: () =>
          setConfirm({
            title: 'Terminate policy',
            body: 'Terminating ends coverage immediately. You are refunded the unused premium on a pro-rata basis; any open claim is cancelled and no payout will be made.',
            action: 'terminate',
            payload: {},
          }),
      },
    ];
  }, [policy, renewalOpen, daysUntilRenewal, beneficiary, transferTo]);

  const handleConfirm = async () => {
    if (!confirm) return;
    const { action, payload } = confirm;
    setConfirm(null);
    await runAction(action, payload);
  };

  return (
    <section className="policy-actions">
      <h2>Actions</h2>

      <div className="policy-actions__forms">
        <div className="policy-actions__form">
          <label htmlFor="beneficiary">Beneficiary address</label>
          <input
            id="beneficiary"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="G..."
            aria-invalid={beneficiaryError ? 'true' : undefined}
          />
          {beneficiaryError && (
            <p className="policy-actions__error" role="alert">
              {beneficiaryError}
            </p>
          )}
        </div>

        <div className="policy-actions__form">
          <label htmlFor="transfer-to">Transfer to address</label>
          <input
            id="transfer-to"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="G..."
            aria-invalid={transferError ? 'true' : undefined}
          />
          {transferError && (
            <p className="policy-actions__error" role="alert">
              {transferError}
            </p>
          )}
        </div>
      </div>

      <ul className="policy-actions__list">
        {actions.map((action) => (
          <li key={action.key} className="policy-actions__item">
            <button
              type="button"
              onClick={action.run}
              disabled={!action.allowed || isSubmitting}
              title={action.reason}
            >
              {action.label}
            </button>
            {!action.allowed && action.reason && (
              <span className="policy-actions__reason">{action.reason}</span>
            )}
          </li>
        ))}
      </ul>

      {confirm && (
        <div
          className="policy-actions__confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-confirm-title"
        >
          <h3 id="policy-confirm-title">{confirm.title}</h3>
          <p>{confirm.body}</p>
          <div className="policy-actions__confirm-buttons">
            <button type="button" onClick={() => setConfirm(null)} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="button" onClick={handleConfirm} disabled={isSubmitting}>
              Confirm
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
