'use client'

import { CheckCircle, XCircle, Lock, Eye, Clock, AlertTriangle, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useWallet } from '@/features/wallet'
import { useLatestLedger } from '@/hooks/use-latest-ledger'
import { explorerUrl } from '@/lib/api/vote'
import { SECS_PER_LEDGER } from '@/lib/schemas/vote'
import type { VoteOption } from '@/lib/schemas/vote'
import { getConfig } from '@/config/env'

const { apiUrl: API_BASE } = getConfig()

type CommitRevealPhase = 'loading' | 'commit' | 'reveal' | 'ended' | 'not_configured'

interface PhaseInfo {
  commit_phase_end_ledger: number
  reveal_phase_end_ledger: number
}

interface CommitStatus {
  hasCommitted: boolean
  hasRevealed: boolean
}

type FlowState = 'idle' | 'selecting' | 'committing' | 'signing_commit' | 'committed' | 'revealing' | 'signing_reveal' | 'revealed'

interface CommitRevealVotePanelProps {
  claimId: string
}

function ledgersToTimeString(ledgers: number): string {
  const totalSeconds = ledgers * SECS_PER_LEDGER
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return `~${parts.join(' ')}`
}

function PhaseIndicator({ phase, currentLedger, phases }: {
  phase: CommitRevealPhase
  currentLedger: number
  phases: PhaseInfo | null
}) {
  const steps = [
    { key: 'commit', label: 'Commit Phase', icon: Lock },
    { key: 'reveal', label: 'Reveal Phase', icon: Eye },
    { key: 'ended', label: 'Voting Closed', icon: CheckCircle },
  ] as const

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Voting phase progress">
      {steps.map((step, i) => {
        const isActive = phase === step.key
        const isPast = (phase === 'reveal' && step.key === 'commit') ||
          (phase === 'ended' && (step.key === 'commit' || step.key === 'reveal'))
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-0.5 w-6 ${isPast || isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                isActive ? 'border-primary bg-primary text-primary-foreground' :
                isPast ? 'border-primary bg-primary/10 text-primary' :
                'border-muted-foreground/30 text-muted-foreground/50'
              }`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className={`text-xs whitespace-nowrap ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              {isActive && phases && (
                <span className="text-xs text-muted-foreground">
                  {phase === 'commit' && ledgersToTimeString(phases.commit_phase_end_ledger - currentLedger)} remaining
                  {phase === 'reveal' && ledgersToTimeString(phases.reveal_phase_end_ledger - currentLedger)} remaining
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CommitRevealVotePanel({ claimId }: CommitRevealVotePanelProps) {
  const { address: walletAddress, signTransaction } = useWallet()
  const latestLedger = useLatestLedger()
  const currentLedger = latestLedger ?? 0
  const { toast } = useToast()

  const [phases, setPhases] = useState<PhaseInfo | null>(null)
  const [commitStatus, setCommitStatus] = useState<CommitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedVote, setSelectedVote] = useState<VoteOption | null>(null)
  const [flowState, setFlowState] = useState<FlowState>('idle')
  const [commitTxHash, setCommitTxHash] = useState<string | null>(null)
  const [revealTxHash, setRevealTxHash] = useState<string | null>(null)

  const currentPhase: CommitRevealPhase = (() => {
    if (!phases) return loading ? 'loading' : 'not_configured'
    if (currentLedger <= phases.commit_phase_end_ledger) return 'commit'
    if (currentLedger <= phases.reveal_phase_end_ledger) return 'reveal'
    return 'ended'
  })()

  useEffect(() => {
    async function loadPhases() {
      try {
        const res = await fetch(`${API_BASE}/api/claims/${claimId}/commit-reveal/phases`)
        if (res.status === 404) {
          setPhases(null)
          return
        }
        if (!res.ok) throw new Error('Failed to load phases')
        const data = await res.json()
        setPhases(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load commit-reveal phases')
      } finally {
        setLoading(false)
      }
    }
    loadPhases()
  }, [claimId])

  useEffect(() => {
    if (!walletAddress || !phases) return
    async function loadStatus() {
      try {
        const res = await fetch(
          `${API_BASE}/api/claims/${claimId}/commit-reveal/status?wallet=${encodeURIComponent(walletAddress!)}`
        )
        if (!res.ok) return
        const data = await res.json()
        setCommitStatus(data)
        if (data.hasRevealed) setFlowState('revealed')
        else if (data.hasCommitted) setFlowState('committed')
      } catch { /* ignore */ }
    }
    loadStatus()
  }, [claimId, walletAddress, phases])

  const handleSelectVote = useCallback((vote: VoteOption) => {
    setSelectedVote(vote)
    setFlowState('selecting')
  }, [])

  const handleCommit = useCallback(async () => {
    if (!walletAddress || !selectedVote) return
    setFlowState('signing_commit')
    try {
      const signedXdr = await signTransaction(`commit:${claimId}:${selectedVote}`)
      setFlowState('committing')
      const res = await fetch(`${API_BASE}/api/claims/${claimId}/commit-reveal/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, vote: selectedVote, signedXdr }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Commit failed' }))
        throw new Error(err.message ?? 'Commit failed')
      }
      const result = await res.json()
      setCommitTxHash(result.transactionHash)
      setFlowState('committed')
      setCommitStatus(prev => prev ? { ...prev, hasCommitted: true } : { hasCommitted: true, hasRevealed: false })
      toast({ title: 'Vote committed', description: 'Your commitment hash has been recorded on-chain. Return during the reveal phase to disclose your vote.' })
    } catch (e) {
      toast({ title: 'Commit failed', description: e instanceof Error ? e.message : 'Failed to commit vote', variant: 'destructive' })
      setFlowState('selecting')
    }
  }, [claimId, walletAddress, selectedVote, signTransaction, toast])

  const handleReveal = useCallback(async () => {
    if (!walletAddress) return
    setFlowState('signing_reveal')
    try {
      const signedXdr = await signTransaction(`reveal:${claimId}`)
      setFlowState('revealing')
      const res = await fetch(`${API_BASE}/api/claims/${claimId}/commit-reveal/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signedXdr }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Reveal failed' }))
        throw new Error(err.message ?? 'Reveal failed')
      }
      const result = await res.json()
      setRevealTxHash(result.transactionHash)
      setFlowState('revealed')
      setCommitStatus(prev => prev ? { ...prev, hasRevealed: true } : { hasCommitted: true, hasRevealed: true })
      toast({ title: 'Vote revealed', description: 'Your vote has been disclosed and counted in the final tally.' })
    } catch (e) {
      toast({ title: 'Reveal failed', description: e instanceof Error ? e.message : 'Failed to reveal vote', variant: 'destructive' })
      setFlowState('committed')
    }
  }, [claimId, walletAddress, signTransaction, toast])

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!phases) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" aria-hidden="true" />
          Commit-Reveal Voting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PhaseIndicator phase={currentPhase} currentLedger={currentLedger} phases={phases} />

        {currentPhase === 'commit' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">Commit Phase</p>
              <p className="mt-1 text-xs">
                Select your vote and submit a cryptographic commitment. Your vote stays hidden until the reveal phase begins.
                No one — including other voters — can see how you voted until you reveal.
              </p>
            </div>

            {!walletAddress && (
              <p className="text-sm text-muted-foreground">Connect your wallet to participate in voting.</p>
            )}

            {walletAddress && commitStatus?.hasCommitted && (
              <div role="status" className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Commitment submitted. Return during the reveal phase to disclose your vote.</span>
                {commitTxHash && (
                  <a href={explorerUrl(commitTxHash)} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 underline underline-offset-2">
                    View tx <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {walletAddress && !commitStatus?.hasCommitted && (
              <>
                {flowState === 'idle' || flowState === 'selecting' ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Select your vote:</p>
                    <div className="flex gap-3">
                      <Button
                        className="flex-1"
                        variant={selectedVote === 'Approve' ? 'default' : 'outline'}
                        onClick={() => handleSelectVote('Approve')}
                        aria-pressed={selectedVote === 'Approve'}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                        Approve
                      </Button>
                      <Button
                        className="flex-1"
                        variant={selectedVote === 'Reject' ? 'destructive' : 'outline'}
                        onClick={() => handleSelectVote('Reject')}
                        aria-pressed={selectedVote === 'Reject'}
                      >
                        <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                    {selectedVote && (
                      <Button className="w-full" onClick={handleCommit}>
                        <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
                        Submit Commitment
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
                    <Clock className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {flowState === 'signing_commit' ? 'Waiting for wallet signature…' : 'Submitting commitment…'}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {currentPhase === 'reveal' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Reveal Phase</p>
              <p className="mt-1 text-xs">
                Disclose your vote to have it counted in the final tally.
                Unrevealed commitments are not counted — you must reveal before the phase ends.
              </p>
            </div>

            {!walletAddress && (
              <p className="text-sm text-muted-foreground">Connect your wallet to reveal your vote.</p>
            )}

            {walletAddress && !commitStatus?.hasCommitted && (
              <div role="note" className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                You did not submit a commitment during the commit phase.
              </div>
            )}

            {walletAddress && commitStatus?.hasCommitted && commitStatus?.hasRevealed && (
              <div role="status" className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Your vote has been revealed and counted.</span>
                {revealTxHash && (
                  <a href={explorerUrl(revealTxHash)} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 underline underline-offset-2">
                    View tx <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {walletAddress && commitStatus?.hasCommitted && !commitStatus?.hasRevealed && (
              <>
                {flowState === 'committed' || flowState === 'idle' ? (
                  <div className="space-y-3">
                    <Badge variant="info" className="text-xs">
                      <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
                      Commitment recorded
                    </Badge>
                    <Button className="w-full" onClick={handleReveal}>
                      <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                      Reveal My Vote
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
                    <Clock className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {flowState === 'signing_reveal' ? 'Waiting for wallet signature…' : 'Submitting reveal…'}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {currentPhase === 'ended' && (
          <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
            <p className="font-medium">Voting has ended</p>
            <p className="mt-1 text-xs">
              Both the commit and reveal phases have closed. The final tally is being processed.
            </p>
            {commitStatus?.hasCommitted && !commitStatus?.hasRevealed && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>You committed but did not reveal your vote. Unrevealed commitments are not counted in the final tally.</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-3 text-xs text-muted-foreground space-y-1">
          <p>Commit phase ends: ledger {phases.commit_phase_end_ledger}</p>
          <p>Reveal phase ends: ledger {phases.reveal_phase_end_ledger}</p>
          {currentLedger > 0 && <p>Current ledger: {currentLedger}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
