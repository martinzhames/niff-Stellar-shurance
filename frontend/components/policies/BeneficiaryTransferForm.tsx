import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTransactionFlow } from '@/hooks/useTransactionFlow';
import { isValidStellarAddress } from '@/lib/stellar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export type BeneficiaryTransferMode = 'beneficiary' | 'transfer';

export interface BeneficiaryTransferFormProps {
  policyId: string;
  mode: BeneficiaryTransferMode;
  currentBeneficiary?: string;
  onSuccess?: () => void;
}

interface FormValues {
  address: string;
}

const COPY: Record<BeneficiaryTransferMode, { title: string; label: string; submit: string; consequence: string }> = {
  beneficiary: {
    title: 'Set beneficiary',
    label: 'Beneficiary address',
    submit: 'Set beneficiary',
    consequence:
      'The new beneficiary will receive the payout if the policy is claimed. This replaces the current beneficiary immediately.',
  },
  transfer: {
    title: 'Transfer policy',
    label: 'Recipient address',
    submit: 'Transfer policy',
    consequence:
      'Ownership of this policy, including all rights and obligations, will be transferred to the recipient. You will no longer be able to manage or claim this policy.',
  },
};

export function BeneficiaryTransferForm({
  policyId,
  mode,
  currentBeneficiary,
  onSuccess,
}: BeneficiaryTransferFormProps) {
  const copy = COPY[mode];
  const [confirming, setConfirming] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const { run, isPending } = useTransactionFlow();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { address: '' } });

  const onSubmit = (values: FormValues) => {
    setPendingAddress(values.address.trim());
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (!pendingAddress) return;
    await run({
      action: mode === 'beneficiary' ? 'set_beneficiary' : 'transfer_policy',
      policyId,
      payload: { address: pendingAddress },
    });
    setConfirming(false);
    setPendingAddress(null);
    reset();
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="text-lg font-semibold">{copy.title}</h3>

      {currentBeneficiary && mode === 'beneficiary' && (
        <p className="text-sm text-gray-500">
          Current beneficiary: <span className="font-mono">{currentBeneficiary}</span>
        </p>
      )}

      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          {copy.label}
        </label>
        <Input
          id="address"
          placeholder="G..."
          {...register('address', {
            required: 'Address is required',
            validate: (value) =>
              isValidStellarAddress(value.trim()) || 'Enter a valid Stellar address',
          })}
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {copy.submit}
      </Button>

      <ConfirmDialog
        open={confirming}
        title={`Confirm ${copy.title.toLowerCase()}`}
        description={copy.consequence}
        confirmLabel={copy.submit}
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => {
          setConfirming(false);
          setPendingAddress(null);
        }}
      >
        {pendingAddress && (
          <p className="text-sm">
            {mode === 'beneficiary' ? 'New beneficiary' : 'Recipient'}:{' '}
            <span className="font-mono">{pendingAddress}</span>
          </p>
        )}
      </ConfirmDialog>
    </form>
  );
}
