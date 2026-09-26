import React, { useCallback, useMemo, useState } from 'react';
import { toDisplay, toRaw } from '../lib/amount';

export interface AmountInputProps {
  value: string;
  onChange: (raw: string) => void;
  decimals: number;
  /** Balance in the smallest unit. */
  balance?: string | bigint;
  locale?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Input restricted to valid decimal amounts for a given asset precision.
 * Displays the available balance with a "max" button that fills the field.
 */
export function AmountInput({
  value,
  onChange,
  decimals,
  balance,
  locale = 'en-US',
  placeholder = '0',
  disabled = false,
  id,
  className,
}: AmountInputProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);

  const balanceDisplay = useMemo(() => {
    if (balance === undefined) return null;
    try {
      return toDisplay(balance, decimals, { locale });
    } catch {
      return null;
    }
  }, [balance, decimals, locale]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      if (next !== '' && !/^\d*(\.\d*)?$/.test(next)) {
        return;
      }
      const [, frac = ''] = next.split('.');
      if (frac.length > decimals) {
        return;
      }
      setError(null);
      try {
        onChange(toRaw(next === '' ? '0' : next, decimals));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid amount');
      }
    },
    [decimals, onChange],
  );

  const handleMax = useCallback(() => {
    if (balance === undefined) return;
    setError(null);
    onChange(typeof balance === 'bigint' ? balance.toString() : balance);
  }, [balance, onChange]);

  const displayValue = useMemo(() => {
    if (value === '' || value === '0') return '';
    try {
      return toDisplay(value, decimals, { locale, trim: false });
    } catch {
      return '';
    }
  }, [value, decimals, locale]);

  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
        />
        {balanceDisplay !== null && (
          <button type="button" onClick={handleMax} disabled={disabled}>
            max
          </button>
        )}
      </div>
      {balanceDisplay !== null && (
        <small>Balance: {balanceDisplay}</small>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export default AmountInput;
