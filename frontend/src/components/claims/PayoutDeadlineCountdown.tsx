'use client'

import { AlertTriangle, Clock, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const AVG_CLOSE_SECONDS = 5

interface PayoutDeadlineCountdownProps {
  payoutDeadlineLedger: number
  currentLedger: number
}

function formatCountdown(totalSeconds: number): { text: string; urgent: boolean } {
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`)
  if (days === 0) parts.push(`${seconds}s`)

  const urgent = totalSeconds < 86400
  return { text: parts.join(' '), urgent }
}

function computeProgress(currentLedger: number, deadlineLedger: number, startLedger: number): number {
  const total = deadlineLedger - startLedger
  if (total <= 0) return 100
  const elapsed = currentLedger - startLedger
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

export function PayoutDeadlineCountdown({ payoutDeadlineLedger, currentLedger }: PayoutDeadlineCountdownProps) {
  const [mounted, setMounted] = useState(false)
  const [ledger, setLedger] = useState(currentLedger)

  useEffect(() => {
    setMounted(true)
    setLedger(currentLedger)
  }, [currentLedger])

  useEffect(() => {
    if (!mounted) return
    const id = setInterval(() => {
      setLedger(prev => prev + 1)
    }, AVG_CLOSE_SECONDS * 1000)
    return () => clearInterval(id)
  }, [mounted])

  if (!mounted) {
    return (
      <Card>
        <CardContent className="p-4">
          <span className="text-sm text-muted-foreground">Loading payout deadline…</span>
        </CardContent>
      </Card>
    )
  }

  const remainingLedgers = payoutDeadlineLedger - ledger
  const expired = remainingLedgers <= 0
  const remainingSeconds = remainingLedgers * AVG_CLOSE_SECONDS

  if (expired) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-red-800 text-base">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Payout Deadline Expired
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-red-700">
            The payout deadline has passed. This claim may be subject to timeout processing.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { text, urgent } = formatCountdown(remainingSeconds)
  const approxProgressStart = payoutDeadlineLedger - Math.round(7 * 86400 / AVG_CLOSE_SECONDS)
  const progress = computeProgress(ledger, payoutDeadlineLedger, approxProgressStart)

  return (
    <Card className={urgent ? 'border-amber-300 bg-amber-50' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-base ${urgent ? 'text-amber-800' : ''}`}>
          <Timer className="h-5 w-5" aria-hidden="true" />
          Payout Deadline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${urgent ? 'text-amber-600' : 'text-muted-foreground'}`} aria-hidden="true" />
            <span
              className={`text-2xl font-bold tabular-nums ${urgent ? 'text-amber-700' : ''}`}
              data-testid="payout-countdown"
            >
              ~{text}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">remaining</span>
        </div>

        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                urgent ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Payout deadline progress"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Approved</span>
            <span>Timeout</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Deadline ledger</p>
            <p className="font-mono font-medium">{payoutDeadlineLedger.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ledgers remaining</p>
            <p className="font-mono font-medium">{remainingLedgers.toLocaleString()}</p>
          </div>
        </div>

        {urgent && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Less than 24 hours remain before the payout timeout is triggered. Ensure the payout is processed promptly.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
