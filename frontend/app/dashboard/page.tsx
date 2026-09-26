'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type WidgetState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function useWidget<T>(fetcher: () => Promise<T>): WidgetState<T> & {
  reload: () => void;
} {
  const [state, setState] = useState<WidgetState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Something went wrong',
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
}

function WidgetShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function WidgetLoading({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="text-sm text-gray-500">
      Loading {label}…
    </p>
  );
}

function WidgetEmpty({ label }: { label: string }) {
  return <p className="text-sm text-gray-500">{label}</p>;
}

function WidgetError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="text-sm text-red-600">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 text-xs font-medium text-red-700 underline"
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary — isolates each widget so one failure never breaks the page
// ---------------------------------------------------------------------------

import { Component, type ReactNode } from 'react';

class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="text-sm text-red-600">
          This widget failed to load.
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Policy = {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'expired';
  coverage: number;
  premium: number;
  renewalDate?: string;
};

type Claim = {
  id: string;
  policyId: string;
  title: string;
  status: 'in_progress' | 'awaiting_vote' | 'approved' | 'rejected';
  voteDeadline?: string;
};

type Notification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type OnboardingStep = {
  id: 'connect_wallet' | 'get_quote' | 'buy_policy';
  label: string;
  done: boolean;
  href: string;
};

// ---------------------------------------------------------------------------
// Data fetchers (each widget fetches independently)
// ---------------------------------------------------------------------------

async function fetchPolicies(): Promise<Policy[]> {
  const res = await fetch('/api/policies?status=active');
  if (!res.ok) throw new Error('Failed to load policies');
  return res.json();
}

async function fetchClaims(): Promise<Claim[]> {
  const res = await fetch('/api/claims?status=in_progress');
  if (!res.ok) throw new Error('Failed to load claims');
  return res.json();
}

async function fetchVotesNeeded(): Promise<Claim[]> {
  const res = await fetch('/api/claims?status=awaiting_vote');
  if (!res.ok) throw new Error('Failed to load votes');
  return res.json();
}

async function fetchRenewals(): Promise<Policy[]> {
  const res = await fetch('/api/policies?upcoming_renewal=true');
  if (!res.ok) throw new Error('Failed to load renewals');
  return res.json();
}

async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch('/api/notifications?limit=5');
  if (!res.ok) throw new Error('Failed to load notifications');
  return res.json();
}

async function fetchOnboarding(): Promise<OnboardingStep[]> {
  const res = await fetch('/api/onboarding');
  if (!res.ok) throw new Error('Failed to load onboarding');
  return res.json();
}

// ---------------------------------------------------------------------------
// Countdown helper
// ---------------------------------------------------------------------------

function useCountdown(deadline?: string) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const target = new Date(deadline).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (remaining === null) return null;
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, expired: remaining <= 0 };
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

function ActivePoliciesWidget() {
  const { data, loading, error, reload } = useWidget(fetchPolicies);

  return (
    <WidgetShell
      title="Active policies"
      action={
        <Link href="/policies" className="text-xs font-medium text-blue-600">
          View all
        </Link>
      }
    >
      {loading && <WidgetLoading label="policies" />}
      {error && <WidgetError message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <WidgetEmpty label="No active policies yet." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((policy) => (
            <li key={policy.id} className="flex items-center justify-between text-sm">
              <Link href={`/policies/${policy.id}`} className="text-gray-900 hover:underline">
                {policy.name}
              </Link>
              <span className="text-gray-500">
                ${policy.coverage.toLocaleString()} coverage
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function ClaimsInProgressWidget() {
  const { data, loading, error, reload } = useWidget(fetchClaims);

  return (
    <WidgetShell
      title="Claims in progress"
      action={
        <Link href="/claims" className="text-xs font-medium text-blue-600">
          View all
        </Link>
      }
    >
      {loading && <WidgetLoading label="claims" />}
      {error && <WidgetError message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <WidgetEmpty label="No claims in progress." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((claim) => (
            <li key={claim.id} className="flex items-center justify-between text-sm">
              <Link href={`/claims/${claim.id}`} className="text-gray-900 hover:underline">
                {claim.title}
              </Link>
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                In progress
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function VotesNeededWidget() {
  const { data, loading, error, reload } = useWidget(fetchVotesNeeded);
  const nextDeadline = data && data.length > 0 ? data[0].voteDeadline : undefined;
  const countdown = useCountdown(nextDeadline);

  return (
    <WidgetShell
      title="Votes needed"
      action={
        <Link href="/votes" className="text-xs font-medium text-blue-600">
          Vote panel
        </Link>
      }
    >
      {loading && <WidgetLoading label="votes" />}
      {error && <WidgetError message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <WidgetEmpty label="No votes needed right now." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-900">
            {data.length} claim{data.length === 1 ? '' : 's'} awaiting your vote
          </p>
          {countdown && (
            <p className="text-xs text-gray-500">
              {countdown.expired
                ? 'Deadline passed'
                : `Deadline in ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`}
            </p>
          )}
          <Link
            href="/votes"
            className="inline-block rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            Go to vote panel
          </Link>
        </div>
      )}
    </WidgetShell>
  );
}

function UpcomingRenewalsWidget() {
  const { data, loading, error, reload } = useWidget(fetchRenewals);

  return (
    <WidgetShell title="Upcoming renewals">
      {loading && <WidgetLoading label="renewals" />}
      {error && <WidgetError message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <WidgetEmpty label="No upcoming renewals." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((policy) => (
            <li key={policy.id} className="flex items-center justify-between text-sm">
              <Link
                href={`/policies/${policy.id}/renew`}
                className="text-gray-900 hover:underline"
              >
                {policy.name}
              </Link>
              <span className="text-gray-500">
                {policy.renewalDate
                  ? new Date(policy.renewalDate).toLocaleDateString()
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function RecentNotificationsWidget() {
  const { data, loading, error, reload } = useWidget(fetchNotifications);

  return (
    <WidgetShell
      title="Recent notifications"
      action={
        <Link href="/notifications" className="text-xs font-medium text-blue-600">
          View all
        </Link>
      }
    >
      {loading && <WidgetLoading label="notifications" />}
      {error && <WidgetError message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <WidgetEmpty label="No notifications." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((notification) => (
            <li key={notification.id} className="text-sm">
              <p className={notification.read ? 'text-gray-500' : 'text-gray-900'}>
                {notification.message}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function QuickActionsWidget() {
  const actions = [
    { label: 'Get a quote', href: '/quote' },
    { label: 'Buy a policy', href: '/policies/new' },
    { label: 'File a claim', href: '/claims/new' },
    { label: 'View votes', href: '/votes' },
  ];

  return (
    <WidgetShell title="Quick actions">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded border border-gray-200 px-3 py-2 text-center text-sm text-gray-900 hover:bg-gray-50"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </WidgetShell>
  );
}

function OnboardingChecklistWidget() {
  const { data, loading, error, reload } = useWidget(fetchOnboarding);

  return (
    <WidgetShell title="Get started">
      {loading && <WidgetLoading label="onboarding steps" />}
      {error && <WidgetError message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <WidgetEmpty label="You're all set." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                  step.done
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 text-transparent'
                }`}
              >
                ✓
              </span>
              {step.done ? (
                <span className="text-gray-500 line-through">{step.label}</span>
              ) : (
                <Link href={step.href} className="text-blue-600 hover:underline">
                  {step.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <WidgetErrorBoundary>
          <OnboardingChecklistWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <VotesNeededWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <ActivePoliciesWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <ClaimsInProgressWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <UpcomingRenewalsWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <RecentNotificationsWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <QuickActionsWidget />
        </WidgetErrorBoundary>
      </div>
    </main>
  );
}
