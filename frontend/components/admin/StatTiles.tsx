import React from 'react';

export interface AdminStats {
  totalPolicies: number;
  activePolicies: number;
  activeCoverage: number;
  premiumsCollected: number;
  claimsByStatus: Record<string, number>;
  payouts: number;
  solvencyRatio: number;
  indexerLag: number;
}

export interface StatTile {
  key: string;
  label: string;
  value: string;
  hint?: string;
}

const numberFormat = new Intl.NumberFormat('en-US');
const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return numberFormat.format(value);
}

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return currencyFormat.format(value);
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatLag(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${numberFormat.format(value)} blocks`;
}

function formatClaims(claims: Record<string, number> | undefined | null): string {
  if (!claims) return '—';
  const entries = Object.entries(claims);
  if (entries.length === 0) return '0';
  return entries.map(([status, count]) => `${status}: ${numberFormat.format(count)}`).join(' · ');
}

export function buildStatTiles(stats: AdminStats | null | undefined): StatTile[] {
  if (!stats) return [];
  return [
    { key: 'totalPolicies', label: 'Total policies', value: formatNumber(stats.totalPolicies) },
    { key: 'activePolicies', label: 'Active policies', value: formatNumber(stats.activePolicies) },
    { key: 'activeCoverage', label: 'Active coverage', value: formatCurrency(stats.activeCoverage) },
    { key: 'premiumsCollected', label: 'Premiums collected', value: formatCurrency(stats.premiumsCollected) },
    { key: 'claimsByStatus', label: 'Claims by status', value: formatClaims(stats.claimsByStatus) },
    { key: 'payouts', label: 'Payouts', value: formatCurrency(stats.payouts) },
    { key: 'solvencyRatio', label: 'Solvency ratio', value: formatPercent(stats.solvencyRatio) },
    { key: 'indexerLag', label: 'Indexer lag', value: formatLag(stats.indexerLag) },
  ];
}

export interface StatTilesProps {
  stats: AdminStats | null | undefined;
  loading?: boolean;
  error?: string | null;
}

export default function StatTiles({ stats, loading = false, error = null }: StatTilesProps) {
  if (loading) {
    return (
      <div className="admin-stat-tiles" role="status" aria-live="polite">
        <p>Loading protocol stats…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-stat-tiles" role="alert">
        <p>Unable to load protocol stats: {error}</p>
      </div>
    );
  }

  const tiles = buildStatTiles(stats);

  if (tiles.length === 0) {
    return (
      <div className="admin-stat-tiles" role="status">
        <p>No protocol stats available.</p>
      </div>
    );
  }

  return (
    <section className="admin-stat-tiles" aria-label="Protocol statistics">
      <ul className="admin-stat-tiles__list">
        {tiles.map((tile) => (
          <li key={tile.key} className="admin-stat-tiles__tile">
            <span className="admin-stat-tiles__label">{tile.label}</span>
            <span className="admin-stat-tiles__value">{tile.value}</span>
            {tile.hint ? <span className="admin-stat-tiles__hint">{tile.hint}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
