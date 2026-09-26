'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface RenewalQuote {
  policyId: string;
  policyNumber: string;
  oldPremium: number;
  newPremium: number;
  currency: string;
  oldPeriodStart: string;
  oldPeriodEnd: string;
  newPeriodStart: string;
  newPeriodEnd: string;
  priceChangeReason: string;
  gracePeriodDays: number | null;
  gracePeriodEndsAt: string | null;
  eligible: boolean;
  ineligibilityReason: string | null;
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; quote: RenewalQuote }
  | { status: 'success'; policyId: string; policyNumber: string };

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

export default function PolicyRenewPage() {
  const params = useParams<{ id: string }>();
  const policyId = params?.id;

  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!policyId) return;
    let cancelled = false;

    async function loadQuote() {
      try {
        const res = await fetch(`/api/policies/${policyId}/renewal-quote`);
        if (!res.ok) {
          throw new Error('Unable to load the renewal quote.');
        }
        const quote: RenewalQuote = await res.json();
        if (!cancelled) setState({ status: 'ready', quote });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              err instanceof Error ? err.message : 'Unable to load the renewal quote.',
          });
        }
      }
    }

    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  const premiumDelta = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { oldPremium, newPremium } = state.quote;
    return newPremium - oldPremium;
  }, [state]);

  async function handleSignAndPay() {
    if (state.status !== 'ready') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: state.quote.policyId }),
      });
      if (!res.ok) {
        throw new Error('Renewal could not be completed. Please try again.');
      }
      setState({
        status: 'success',
        policyId: state.quote.policyId,
        policyNumber: state.quote.policyNumber,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Renewal could not be completed.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-gray-500">Loading renewal quote…</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-gray-900">Renew policy</h1>
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
        <Link
          href={`/policies/${policyId}`}
          className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Back to policy
        </Link>
      </main>
    );
  }

  if (state.status === 'success') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
          <h1 className="text-xl font-semibold text-green-800">
            Policy renewed
          </h1>
          <p className="mt-2 text-sm text-green-700">
            Policy {state.policyNumber} has been renewed successfully.
          </p>
          <Link
            href={`/policies/${state.policyId}`}
            className="mt-6 inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            View policy
          </Link>
        </div>
      </main>
    );
  }

  const { quote } = state;
  const delta = premiumDelta ?? 0;
  const priceIncreased = delta > 0;
  const priceDecreased = delta < 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Renew policy</h1>
      <p className="mt-1 text-sm text-gray-500">
        Policy {quote.policyNumber}
      </p>

      {!quote.eligible && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            This policy cannot be renewed.
          </p>
          <p className="mt-1 text-sm text-red-700">
            {quote.ineligibilityReason ??
              'The policy is not eligible for renewal at this time.'}
          </p>
        </div>
      )}

      {quote.eligible && quote.gracePeriodDays != null && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Grace period</p>
          <p className="mt-1 text-sm text-amber-700">
            Your coverage ended on {formatDate(quote.oldPeriodEnd)}. You have a{' '}
            {quote.gracePeriodDays}-day grace period
            {quote.gracePeriodEndsAt
              ? ` ending ${formatDate(quote.gracePeriodEndsAt)}`
              : ''}
            . Renew now to avoid a lapse in coverage.
          </p>
        </div>
      )}

      <section className="mt-6 rounded-lg border border-gray-200 px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-900">Renewal quote</h2>

        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Previous premium</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {formatCurrency(quote.oldPremium, quote.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">New premium</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {formatCurrency(quote.newPremium, quote.currency)}
            </dd>
          </div>
        </dl>

        <p
          className={`mt-4 text-sm ${
            priceIncreased
              ? 'text-red-700'
              : priceDecreased
                ? 'text-green-700'
                : 'text-gray-600'
          }`}
        >
          {priceIncreased
            ? `Your premium increased by ${formatCurrency(delta, quote.currency)}.`
            : priceDecreased
              ? `Your premium decreased by ${formatCurrency(Math.abs(delta), quote.currency)}.`
              : 'Your premium is unchanged.'}
        </p>
        <p className="mt-1 text-sm text-gray-600">{quote.priceChangeReason}</p>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">
            New coverage period
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            {formatDate(quote.newPeriodStart)} – {formatDate(quote.newPeriodEnd)}
          </p>
        </div>
      </section>

      {submitError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSignAndPay}
          disabled={!quote.eligible || submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitting ? 'Processing…' : 'Sign and pay'}
        </button>
        <Link
          href={`/policies/${policyId}`}
          className="text-sm font-medium text-gray-600 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
