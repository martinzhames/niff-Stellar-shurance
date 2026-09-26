'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * RenewalFlow
 *
 * Client component for the policy renewal page (/policies/[id]/renew).
 * Renders a fresh renewal quote (which may differ from the original premium),
 * the new coverage period, an explanation of any price change, a grace period
 * warning when applicable, and a sign-and-pay flow that ends in a success
 * state linking back to the policy.
 *
 * Renewal is blocked with a clear message when the policy has an open claim
 * or is otherwise not eligible.
 */

export type RenewalQuote = {
  policyId: string;
  policyNumber: string;
  /** Premium on the existing policy, in minor units (e.g. cents). */
  oldPremium: number;
  /** Fresh renewal premium, in minor units (e.g. cents). */
  newPremium: number;
  currency: string;
  /** ISO date strings for the new coverage period. */
  coverageStart: string;
  coverageEnd: string;
  /** Reason the premium changed, e.g. "Rate table updated 2024-01". */
  priceChangeReason?: string;
  /** Whether the policy is eligible for renewal. */
  eligible: boolean;
  /** Human-readable reason when the policy is not eligible. */
  ineligibleReason?: string;
  /** Whether the policy has an open claim blocking renewal. */
  hasOpenClaim?: boolean;
  /** Days remaining in the grace period, when applicable. */
  gracePeriodDays?: number;
};

type RenewalFlowProps = {
  quote: RenewalQuote;
  /** Called with the signed payment payload when the user confirms. */
  onSignAndPay?: (payload: { policyId: string; premium: number; currency: string }) => Promise<void> | void;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function RenewalFlow({ quote, onSignAndPay }: RenewalFlowProps) {
  const [status, setStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const premiumDelta = quote.newPremium - quote.oldPremium;
  const premiumChanged = premiumDelta !== 0;

  const deltaLabel = useMemo(() => {
    if (!premiumChanged) return 'No change';
    const sign = premiumDelta > 0 ? '+' : '-';
    return `${sign}${formatMoney(Math.abs(premiumDelta), quote.currency)}`;
  }, [premiumChanged, premiumDelta, quote.currency]);

  const blocked = !quote.eligible || quote.hasOpenClaim === true;
  const blockReason = quote.hasOpenClaim
    ? 'This policy has an open claim and cannot be renewed until the claim is resolved.'
    : quote.ineligibleReason ?? 'This policy is not eligible for renewal.';

  async function handleSignAndPay() {
    setError(null);
    setStatus('signing');
    try {
      await onSignAndPay?.({
        policyId: quote.policyId,
        premium: quote.newPremium,
        currency: quote.currency,
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Payment could not be completed. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="renewal-flow renewal-flow--success" role="status" aria-live="polite">
        <h2>Renewal complete</h2>
        <p>
          Your policy {quote.policyNumber} has been renewed for{' '}
          {formatDate(quote.coverageStart)} – {formatDate(quote.coverageEnd)}.
        </p>
        <Link href={`/policies/${quote.policyId}`} className="renewal-flow__back-link">
          Back to policy
        </Link>
      </div>
    );
  }

  return (
    <div className="renewal-flow">
      <header className="renewal-flow__header">
        <h1>Renew policy {quote.policyNumber}</h1>
        <p className="renewal-flow__subtitle">Review your renewal quote before signing and paying.</p>
      </header>

      {blocked && (
        <div className="renewal-flow__blocked" role="alert">
          <strong>Renewal unavailable.</strong> {blockReason}
        </div>
      )}

      {!blocked && typeof quote.gracePeriodDays === 'number' && quote.gracePeriodDays > 0 && (
        <div className="renewal-flow__grace" role="alert">
          <strong>Grace period:</strong> you have {quote.gracePeriodDays}{' '}
          {quote.gracePeriodDays === 1 ? 'day' : 'days'} left to renew before coverage lapses.
        </div>
      )}

      <section className="renewal-flow__quote" aria-label="Renewal quote">
        <h2>Renewal quote</h2>
        <dl className="renewal-flow__premiums">
          <div>
            <dt>Previous premium</dt>
            <dd>{formatMoney(quote.oldPremium, quote.currency)}</dd>
          </div>
          <div>
            <dt>New premium</dt>
            <dd>{formatMoney(quote.newPremium, quote.currency)}</dd>
          </div>
          <div>
            <dt>Change</dt>
            <dd className={premiumDelta > 0 ? 'is-increase' : premiumDelta < 0 ? 'is-decrease' : ''}>
              {deltaLabel}
            </dd>
          </div>
        </dl>

        {premiumChanged && (
          <p className="renewal-flow__explanation">
            {quote.priceChangeReason
              ? `Why the price changed: ${quote.priceChangeReason}.`
              : 'Why the price changed: the rate table used to price this policy was updated.'}
          </p>
        )}

        <p className="renewal-flow__period">
          New coverage period: {formatDate(quote.coverageStart)} – {formatDate(quote.coverageEnd)}
        </p>
      </section>

      {error && (
        <p className="renewal-flow__error" role="alert">
          {error}
        </p>
      )}

      <div className="renewal-flow__actions">
        <button
          type="button"
          className="renewal-flow__pay"
          onClick={handleSignAndPay}
          disabled={blocked || status === 'signing'}
        >
          {status === 'signing' ? 'Signing…' : `Sign & pay ${formatMoney(quote.newPremium, quote.currency)}`}
        </button>
        <Link href={`/policies/${quote.policyId}`} className="renewal-flow__cancel">
          Cancel
        </Link>
      </div>
    </div>
  );
}
