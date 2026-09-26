import Big from 'big.js';

export interface AssetLike {
  code?: string;
  symbol?: string;
  decimals?: number;
}

export interface ToDisplayOptions {
  /** Trim trailing zeros in the fractional part. Defaults to true. */
  trim?: boolean;
  /** Use compact notation (K, M, B, T) for large magnitudes. Defaults to false. */
  compact?: boolean;
  /** Locale used for grouping/separators. Defaults to 'en-US'. */
  locale?: string;
  /** Minimum fraction digits to render. Defaults to 0. */
  minFractionDigits?: number;
  /** Maximum fraction digits to render. Defaults to `decimals`. */
  maxFractionDigits?: number;
}

const COMPACT_UNITS: Array<{ value: Big; suffix: string }> = [
  { value: new Big('1000000000000'), suffix: 'T' },
  { value: new Big('1000000000'), suffix: 'B' },
  { value: new Big('1000000'), suffix: 'M' },
  { value: new Big('1000'), suffix: 'K' },
];

function toBig(raw: string | bigint): Big {
  if (typeof raw === 'bigint') {
    return new Big(raw.toString());
  }
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid raw amount: ${raw}`);
  }
  return new Big(trimmed);
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }
}

/**
 * Convert an on-chain integer amount (smallest unit) into a display string.
 * Uses big.js exclusively so no floating-point precision is lost.
 */
export function toDisplay(
  raw: string | bigint,
  decimals: number,
  opts: ToDisplayOptions = {},
): string {
  assertDecimals(decimals);
  const {
    trim = true,
    compact = false,
    locale = 'en-US',
    minFractionDigits = 0,
    maxFractionDigits = decimals,
  } = opts;

  const value = toBig(raw).div(new Big(10).pow(decimals));
  const negative = value.lt(0);
  const abs = value.abs();

  if (compact) {
    for (const unit of COMPACT_UNITS) {
      if (abs.gte(unit.value)) {
        const scaled = abs.div(unit.value);
        const digits = scaled.gte(100) ? 0 : scaled.gte(10) ? 1 : 2;
        const rounded = scaled.toFixed(digits, Big.roundHalfUp);
        const formatted = formatNumberString(rounded, locale, trim);
        return `${negative ? '-' : ''}${formatted}${unit.suffix}`;
      }
    }
  }

  const fixed = abs.toFixed(maxFractionDigits, Big.roundHalfUp);
  const formatted = formatNumberString(fixed, locale, trim, minFractionDigits);
  return `${negative ? '-' : ''}${formatted}`;
}

function formatNumberString(
  value: string,
  locale: string,
  trim: boolean,
  minFractionDigits = 0,
): string {
  const [intPart, fracPart = ''] = value.split('.');
  let frac = fracPart;
  if (trim) {
    frac = frac.replace(/0+$/, '');
  }
  while (frac.length < minFractionDigits) {
    frac += '0';
  }

  const grouped = groupInteger(intPart, locale);
  if (!frac) {
    return grouped;
  }
  const separator = decimalSeparator(locale);
  return `${grouped}${separator}${frac}`;
}

function groupInteger(intPart: string, locale: string): string {
  const groupSeparator = locale.startsWith('de') || locale.startsWith('fr') || locale.startsWith('es')
    ? '.'
    : ',';
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  return `${sign}${grouped}`;
}

function decimalSeparator(locale: string): string {
  return locale.startsWith('de') || locale.startsWith('fr') || locale.startsWith('es') ? ',' : '.';
}

/**
 * Strictly parse a user-entered display string into an on-chain integer amount.
 * Rejects malformed input and values with more decimals than the asset allows.
 */
export function toRaw(input: string, decimals: number): string {
  assertDecimals(decimals);
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new Error('Amount is required');
  }
  if (!/^-?\d*(\.\d*)?$/.test(trimmed) || trimmed === '.' || trimmed === '-.' || trimmed === '-') {
    throw new Error(`Invalid amount: ${input}`);
  }

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart = '', fracPart = ''] = unsigned.split('.');

  if (fracPart.length > decimals) {
    throw new Error(`Too many decimals: max ${decimals}`);
  }

  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${intPart || '0'}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  const result = new Big(combined || '0');
  return negative && result.gt(0) ? `-${result.toFixed(0)}` : result.toFixed(0);
}

/**
 * Format a raw amount for a given asset, resolving decimals from the asset.
 */
export function formatAsset(
  raw: string | bigint,
  asset: AssetLike,
  locale = 'en-US',
  opts: ToDisplayOptions = {},
): string {
  const decimals = asset.decimals ?? 7;
  const display = toDisplay(raw, decimals, { ...opts, locale });
  const code = asset.code ?? asset.symbol;
  return code ? `${display} ${code}` : display;
}
