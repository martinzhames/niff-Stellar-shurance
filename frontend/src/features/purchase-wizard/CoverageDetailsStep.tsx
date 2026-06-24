'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Car, Heart, Home, Shield, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { QuoteFormSchema, type QuoteFormData } from '@/lib/schemas/quote'
import { useWallet } from '@/features/wallet'
import { getConfig } from '@/config/env'
import { cn } from '@/lib/utils'

interface Props {
  defaultValues: Partial<QuoteFormData>
  onNext: (data: QuoteFormData) => void
  onChange: (data: Partial<QuoteFormData>) => void
}

interface PolicyTypeOption {
  value: string
  label: string
  description: string
}

const POLICY_TYPE_ICONS: Record<string, React.ReactNode> = {
  Auto: <Car className="h-6 w-6" aria-hidden="true" />,
  Health: <Heart className="h-6 w-6" aria-hidden="true" />,
  Property: <Home className="h-6 w-6" aria-hidden="true" />,
}

const FALLBACK_POLICY_TYPES: PolicyTypeOption[] = [
  { value: 'Auto', label: 'Auto', description: 'Vehicle coverage' },
  { value: 'Health', label: 'Health', description: 'Medical coverage' },
  { value: 'Property', label: 'Property', description: 'Property coverage' },
]

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-sm text-destructive flex items-center gap-1 mt-1" role="alert">
      <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

function usePolicyTypes() {
  const [types, setTypes] = useState<PolicyTypeOption[]>(FALLBACK_POLICY_TYPES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { apiUrl } = getConfig()
    async function fetchTypes() {
      try {
        const res = await fetch(`${apiUrl}/api/assets/allowed`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (Array.isArray(data.policy_types) && data.policy_types.length > 0) {
          setTypes(data.policy_types.map((t: { value?: string; label?: string; description?: string } | string) => {
            if (typeof t === 'string') return { value: t, label: t, description: `${t} coverage` }
            return { value: t.value ?? t.label, label: t.label ?? t.value, description: t.description ?? `${t.label ?? t.value} coverage` }
          }))
        }
      } catch {
        // Use fallback types
      } finally {
        setLoading(false)
      }
    }
    fetchTypes()
  }, [])

  return { types, loading }
}

export function CoverageDetailsStep({ defaultValues, onNext, onChange }: Props) {
  const { address } = useWallet()
  const { types: policyTypes, loading: loadingTypes } = usePolicyTypes()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuoteFormData>({
    resolver: zodResolver(QuoteFormSchema),
    mode: 'onTouched',
    defaultValues: {
      policy_type: undefined,
      region: undefined,
      coverage_tier: undefined,
      age: undefined,
      risk_score: 5,
      source_account: '',
      ...defaultValues,
    },
  })

  const selectedPolicyType = watch('policy_type')

  // Pre-fill wallet address
  useEffect(() => {
    if (address && !defaultValues.source_account) {
      setValue('source_account', address)
    }
  }, [address, defaultValues.source_account, setValue])

  // Persist draft on every change
  const values = watch()
  useEffect(() => {
    onChange(values)
  }, [values, onChange])

  return (
    <form
      onSubmit={handleSubmit(onNext)}
      className="space-y-5"
      aria-label="Coverage details"
      noValidate
    >
      <div className="space-y-2">
        <Label>Policy Type</Label>
        <input type="hidden" {...register('policy_type')} />
        {loadingTypes ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" aria-busy="true">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading policy types…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Select policy type">
            {policyTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={selectedPolicyType === type.value}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedPolicyType === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-input',
                  errors.policy_type && !selectedPolicyType && 'border-destructive/50',
                )}
                onClick={() => setValue('policy_type', type.value as QuoteFormData['policy_type'], { shouldValidate: true })}
              >
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  selectedPolicyType === type.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {POLICY_TYPE_ICONS[type.value] ?? <Shield className="h-6 w-6" aria-hidden="true" />}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-xs text-muted-foreground text-center">{type.description}</span>
              </button>
            ))}
          </div>
        )}
        <FieldError message={errors.policy_type?.message} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="region">Region Risk Tier</Label>
        <select
          id="region"
          className={`w-full h-11 rounded-md border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.region ? 'border-destructive' : 'border-input'}`}
          {...register('region')}
        >
          <option value="">Select a region…</option>
          <option value="Low">Low Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="High">High Risk</option>
        </select>
        <FieldError message={errors.region?.message} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="coverage_tier">Coverage Tier</Label>
        <select
          id="coverage_tier"
          className={`w-full h-11 rounded-md border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.coverage_tier ? 'border-destructive' : 'border-input'}`}
          {...register('coverage_tier')}
        >
          <option value="">Select a tier…</option>
          <option value="Basic">Basic</option>
          <option value="Standard">Standard</option>
          <option value="Premium">Premium</option>
        </select>
        <FieldError message={errors.coverage_tier?.message} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="age">Your Age</Label>
        <input
          id="age"
          type="number"
          min={1}
          max={120}
          className={`w-full h-11 rounded-md border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.age ? 'border-destructive' : 'border-input'}`}
          {...register('age', { valueAsNumber: true })}
        />
        <FieldError message={errors.age?.message} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="risk_score">Risk Score (1–10)</Label>
        <input
          id="risk_score"
          type="number"
          min={1}
          max={10}
          className={`w-full h-11 rounded-md border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.risk_score ? 'border-destructive' : 'border-input'}`}
          {...register('risk_score', { valueAsNumber: true })}
        />
        <FieldError message={errors.risk_score?.message} />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">Get Quote</Button>
      </div>
    </form>
  )
}
