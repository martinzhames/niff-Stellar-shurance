'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';

export type ClaimStatus =
  | 'pending'
  | 'voting'
  | 'approved'
  | 'rejected'
  | 'paid';

export interface ClaimRowData {
  id: string;
  policyId: string;
  policyName?: string;
  amount: number;
  asset: string;
  status: ClaimStatus;
  votesFor: number;
  votesAgainst: number;
  votesRequired: number;
  deadline: string;
  needsMyVote?: boolean;
}

interface ClaimRowProps {
  claim: ClaimRowData;
  onVote?: (claimId: string) => void;
}

const STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: 'Pending',
  voting: 'Voting',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

const STATUS_VARIANTS: Record<
  ClaimStatus,
  'default' | 'secondary' | 'success' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  voting: 'default',
  approved: 'success',
  rejected: 'destructive',
  paid: 'success',
};

function formatAmount(amount: number, asset: string): string {
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${asset}`;
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ClaimRow({ claim, onVote }: ClaimRowProps) {
  const totalVotes = claim.votesFor + claim.votesAgainst;
  const progress = useMemo(() => {
    if (claim.votesRequired <= 0) return 0;
    return Math.min(100, Math.round((totalVotes / claim.votesRequired) * 100));
  }, [totalVotes, claim.votesRequired]);

  const isVoting = claim.status === 'voting' || claim.status === 'pending';
  const needsVote = Boolean(claim.needsMyVote) && isVoting;

  return (
    <div
      data-testid={`claim-row-${claim.id}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
        needsVote
          ? 'border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10'
          : 'border-border bg-card',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/claims/${claim.id}`}
            className="truncate font-medium hover:underline"
          >
            Claim #{claim.id}
          </Link>
          <Badge variant={STATUS_VARIANTS[claim.status]}>
            {STATUS_LABELS[claim.status]}
          </Badge>
          {needsVote && (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
              Vote needed
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <Link
            href={`/policies/${claim.policyId}`}
            className="truncate hover:underline"
          >
            {claim.policyName ?? `Policy #${claim.policyId}`}
          </Link>
          <span aria-hidden>·</span>
          <span className="font-medium text-foreground">
            {formatAmount(claim.amount, claim.asset)}
          </span>
          <span aria-hidden>·</span>
          <span>Deadline {formatDeadline(claim.deadline)}</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-56">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {totalVotes} / {claim.votesRequired} votes
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} aria-label={`Vote progress for claim ${claim.id}`} />
        {needsVote && onVote && (
          <button
            type="button"
            onClick={() => onVote(claim.id)}
            className="mt-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Vote now
          </button>
        )}
      </div>
    </div>
  );
}

export default ClaimRow;
