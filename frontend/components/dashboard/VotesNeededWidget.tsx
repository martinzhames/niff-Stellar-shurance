'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { WidgetErrorBoundary } from './WidgetErrorBoundary';

export interface PendingVote {
  id: string;
  claimId: string;
  title: string;
  deadline: string;
}

interface VotesNeededWidgetProps {
  /**
   * Optional fetcher so the widget can be tested and reused with any data
   * source. Defaults to the dashboard votes endpoint.
   */
  fetchVotes?: () => Promise<PendingVote[]>;
}

async function defaultFetchVotes(): Promise<PendingVote[]> {
  const res = await fetch('/api/dashboard/votes-needed', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to load votes (${res.status})`);
  }
  const data = (await res.json()) as { votes?: PendingVote[] };
  return data.votes ?? [];
}

function formatCountdown(deadline: string, now: number): string {
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return 'No deadline';
  const diff = target - now;
  if (diff <= 0) return 'Voting closed';

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function VotesNeededContent({ fetchVotes }: VotesNeededWidgetProps) {
  const [votes, setVotes] = useState<PendingVote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetcher = fetchVotes ?? defaultFetchVotes;
      const result = await fetcher();
      setVotes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load votes');
    } finally {
      setLoading(false);
    }
  }, [fetchVotes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
        <p className="text-sm font-medium text-red-700">Could not load votes needed</p>
        <p className="mt-1 text-xs text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 text-xs font-medium text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!votes || votes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Votes needed</h2>
        <p className="mt-2 text-sm text-gray-500">No claims are awaiting your vote.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Votes needed</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {votes.length}
        </span>
      </div>
      <ul className="mt-3 space-y-3">
        {votes.map((vote) => (
          <li key={vote.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{vote.title}</p>
              <p className="text-xs text-gray-500">
                Deadline in {formatCountdown(vote.deadline, now)}
              </p>
            </div>
            <Link
              href={`/claims/${vote.claimId}/vote`}
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Vote
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VotesNeededWidget(props: VotesNeededWidgetProps) {
  return (
    <WidgetErrorBoundary title="Votes needed">
      <VotesNeededContent {...props} />
    </WidgetErrorBoundary>
  );
}

export default VotesNeededWidget;
