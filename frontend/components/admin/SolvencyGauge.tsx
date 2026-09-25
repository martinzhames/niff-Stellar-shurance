import React from 'react';

export type SolvencyStatus = 'healthy' | 'warning' | 'critical';

export interface SolvencyGaugeProps {
  /** Solvency ratio as a percentage (e.g. 145 means 145%). */
  ratio: number;
  /** Optional warning threshold in percent. Defaults to 120. */
  warningThreshold?: number;
  /** Optional critical threshold in percent. Defaults to 100. */
  criticalThreshold?: number;
  /** Optional accessible label for the gauge. */
  label?: string;
}

const DEFAULT_WARNING = 120;
const DEFAULT_CRITICAL = 100;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function getSolvencyStatus(
  ratio: number,
  warningThreshold: number = DEFAULT_WARNING,
  criticalThreshold: number = DEFAULT_CRITICAL,
): SolvencyStatus {
  if (ratio < criticalThreshold) return 'critical';
  if (ratio < warningThreshold) return 'warning';
  return 'healthy';
}

const STATUS_STYLES: Record<SolvencyStatus, { color: string; text: string; label: string }> = {
  healthy: { color: '#16a34a', text: 'text-green-600', label: 'Healthy' },
  warning: { color: '#d97706', text: 'text-amber-600', label: 'Warning' },
  critical: { color: '#dc2626', text: 'text-red-600', label: 'Critical' },
};

/**
 * Accessible solvency ratio gauge.
 *
 * Renders a lightweight SVG arc (no charting dependency) with warning and
 * critical color bands plus a text label so the value is conveyed without
 * relying on color alone.
 */
export default function SolvencyGauge({
  ratio,
  warningThreshold = DEFAULT_WARNING,
  criticalThreshold = DEFAULT_CRITICAL,
  label = 'Solvency ratio',
}: SolvencyGaugeProps) {
  const status = getSolvencyStatus(ratio, warningThreshold, criticalThreshold);
  const style = STATUS_STYLES[status];

  // Map the ratio onto a 0..200% scale for the arc fill.
  const scaleMax = 200;
  const pct = clamp(ratio, 0, scaleMax) / scaleMax;
  const radius = 70;
  const circumference = Math.PI * radius; // half circle
  const dash = circumference * pct;

  const displayRatio = Number.isFinite(ratio) ? ratio.toFixed(1) : '—';

  return (
    <div className="flex flex-col items-center" role="group" aria-label={label}>
      <svg
        viewBox="0 0 180 100"
        className="w-48"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={style.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="mt-2 text-center">
        <div className="text-2xl font-semibold" data-testid="solvency-ratio">
          {displayRatio}%
        </div>
        <div className={`text-sm font-medium ${style.text}`} data-testid="solvency-status">
          {style.label}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Warning below {warningThreshold}% · Critical below {criticalThreshold}%
        </div>
      </div>
    </div>
  );
}
