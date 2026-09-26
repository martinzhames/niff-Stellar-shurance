'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * RenewalQuote
 *
 * Renders the fresh renewal quote for a policy: the new premium compared
 * against the previous premium (with an explanation of why it changed),
 * the new coverage period, an optional grace-period warning, and a
 * sign-and-pay flow that ends in a success state linking back to the policy.
 *
 * Renewal is blocked with a clear message when the policy has an open claim
 * or is otherwise not eligible.
 */

export type RenewalEligibility =
  | { status: 'eligible' }
  | { status: 'ineligible'; reason: string }
  | { status: 'grace_period'; graceEndsOn: string };

export interface RenewalQuoteData {
  policyId: string;
  policyNumber: string;
  previousPremium: number;
  renewalPremium: number;
  currency: string;
  coverageStart: string;
  coverageEnd: string;
  /** Human-readable explanation of why the premium changed (e.g. table update). */
  priceChangeReason?: string;
  eligibility: RenewalEligibility;
}

interface RenewalQuoteProps {
  quote: RenewalQuoteData;
  /** Called when the user confirms sign-and-pay. Resolves on success. */
  onSignAndPay?: (quote: RenewalQuoteData) => Promise<void> | void;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
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

export default function RenewalQuote({ quote, onSignAndPay }: RenewalQuoteProps) {
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { previousPremium, renewalPremium, currency } = quote;

  const difference = useMemo(
    () => renewalPremium - previousPremium,
    [renewalPremium, previousPremium],
  );

  const percentChange = useMemo(() => {
    if (previousPremium === 0) return null;
    return (difference / previousPremium) * 100;
  }, [difference, previousPremium]);

  const priceChangeReason =
    quote.priceChangeReason ??
    (difference === 0
      ? 'Your premium is unchanged from the previous period.'
      : 'Your premium changed because the rate table used to price this policy was updated.');

  const isBlocked = quote.eligibility.status === 'ineligible';

  async function handleSignAndPay() {
    if (isBlocked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSignAndPay?.(quote);
      setSigned(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (signed) {
    return (
      <section className="renewal-quote renewal-quote--success" aria-live="polite">
        <h2>Renewal complete</h2>
        <p>
          Your policy <strong>{quote.policyNumber}</strong> has been renewed for{' '}
          {formatDate(quote.coverageStart)} – {formatDate(quote.coverageEnd)}.
        </p>
        <Link href={`/policies/${quote.policyId}`} className="renewal-quote__back-link">
          Back to policy
        </Link>
      </section>
    );
  }

  return (
    <section className="renewal-quote">
      <header className="renewal-quote__header">
        <h2>Renewal quote</h2>
        <p className="renewal-quote__policy-number">Policy {quote.policyNumber}</p>
      </header>

      {quote.eligibility.status === 'grace_period' && (
        <div className="renewal-quote__grace-warning" role="alert">
          <strong>Grace period active.</strong> Your coverage is in a grace period until{' '}
          {formatDate(quote.eligibility.graceEndsOn)}. Renew now to avoid a lapse in coverage.
        </div>
      )}

      {isBlocked && (
        <div className="renewal-quote__blocked" role="alert">
          <strong>Renewal unavailable.</strong> {quote.eligibility.reason}
        </div>
      )}

      <div className="renewal-quote__premiums">
        <div className="renewal-quote__premium">
          <span className="renewal-quote__premium-label">Previous premium</span>
          <span className="renewal-quote__premium-value">
            {formatCurrency(previousPremium, currency)}
          </span>
        </div>
        <div className="renewal-quote__premium renewal-quote__premium--new">
          <span className="renewal-quote__premium-label">New premium</span>
          <span className="renewal-quote__premium-value">
            {formatCurrency(renewalPremium, currency)}
          </span>
        </div>
      </div>

      <p className="renewal-quote__difference">
        {difference === 0 ? (
          'No change from your previous premium.'
        ) : (
          <>
            {difference > 0 ? 'Increase' : 'Decrease'} of{' '}
            {formatCurrency(Math.abs(difference), currency)}
            {percentChange !== null && ` (${Math.abs(percentChange).toFixed(1)}%)`} from your
            previous premium.
          </>
        )}
      </p>

      <p className="renewal-quote__reason">{priceChangeReason}</p>

      <div className="renewal-quote__coverage">
        <h3>New coverage period</h3>
        <p>
          {formatDate(quote.coverageStart)} – {formatDate(quote.coverageEnd)}
        </p>
      </div>

      {error && (
        <p className="renewal-quote__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="renewal-quote__sign-pay"
        onClick={handleSignAndPay}
        disabled={isBlocked || submitting}
      >
        {submitting ? 'Processing…' : 'Sign and pay'}
      </button>
    </section>
  );
}
