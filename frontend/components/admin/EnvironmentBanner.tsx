'use client';

/**
 * EnvironmentBanner
 *
 * Large, colored banner that clearly indicates whether the admin area is
 * running against TESTNET or MAINNET.
 *
 * Security note: this banner (and any client-side role gating in the admin
 * area) is purely presentational. Client-side hiding is NOT security. Every
 * admin API call is still authorized by the backend, which is the single
 * source of truth for access control.
 */

import { useMemo } from 'react';

type Environment = 'testnet' | 'mainnet';

interface EnvironmentBannerProps {
  /**
   * Explicit environment override. When omitted, the environment is derived
   * from the public NEXT_PUBLIC_ENVIRONMENT / NEXT_PUBLIC_NETWORK variables.
   */
  environment?: Environment;
  /** Optional additional class names. */
  className?: string;
}

function resolveEnvironment(explicit?: Environment): Environment {
  if (explicit) {
    return explicit;
  }

  const raw = (
    process.env.NEXT_PUBLIC_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_NETWORK ??
    ''
  ).toLowerCase();

  return raw.includes('main') ? 'mainnet' : 'testnet';
}

export function EnvironmentBanner({
  environment,
  className,
}: EnvironmentBannerProps) {
  const resolved = useMemo(() => resolveEnvironment(environment), [environment]);
  const isMainnet = resolved === 'mainnet';
  const label = isMainnet ? 'MAINNET' : 'TESTNET';

  return (
    <div
      role="status"
      aria-label={`Environment: ${label}`}
      className={[
        'w-full select-none px-4 py-3 text-center text-lg font-bold uppercase tracking-widest',
        isMainnet
          ? 'bg-red-600 text-white'
          : 'bg-amber-400 text-black',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </div>
  );
}

export default EnvironmentBanner;
