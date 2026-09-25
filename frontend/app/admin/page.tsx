"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const RANGES = ["7", "30", "90", "all"] as const;
type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number | null> = {
  "7": 7,
  "30": 30,
  "90": 90,
  all: null,
};

const RANGE_LABELS: Record<Range, string> = {
  "7": "7 days",
  "30": "30 days",
  "90": "90 days",
  all: "All time",
};

const SOLVENCY_WARNING = 1.1;
const SOLVENCY_CRITICAL = 1.0;

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface AdminStats {
  totalPolicies: number;
  activePolicies: number;
  activeCoverage: number;
  premiumsCollected: number;
  claimsByStatus: Record<string, number>;
  payouts: number;
  solvencyRatio: number;
  indexerLag: number;
  series: {
    premiums: TimeSeriesPoint[];
    payouts: TimeSeriesPoint[];
    activePolicies: TimeSeriesPoint[];
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLag(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function solvencyLevel(ratio: number): "ok" | "warning" | "critical" {
  if (ratio < SOLVENCY_CRITICAL) return "critical";
  if (ratio < SOLVENCY_WARNING) return "warning";
  return "ok";
}

const SOLVENCY_COLORS: Record<"ok" | "warning" | "critical", string> = {
  ok: "#16a34a",
  warning: "#d97706",
  critical: "#dc2626",
};

const SOLVENCY_TEXT: Record<"ok" | "warning" | "critical", string> = {
  ok: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

function SolvencyGauge({ ratio }: { ratio: number }) {
  const level = solvencyLevel(ratio);
  const color = SOLVENCY_COLORS[level];
  const pct = Math.max(0, Math.min(100, (ratio / 2) * 100));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">Solvency ratio</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color }}>
        {ratio.toFixed(2)}x
      </p>
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-100"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={ratio}
        aria-valuetext={`${ratio.toFixed(2)}x, ${SOLVENCY_TEXT[level]}`}
        aria-label="Solvency ratio"
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 text-xs font-medium" style={{ color }}>
        {SOLVENCY_TEXT[level]} — warning below {SOLVENCY_WARNING.toFixed(2)}x, critical below{" "}
        {SOLVENCY_CRITICAL.toFixed(2)}x
      </p>
    </div>
  );
}

function TimeSeriesChart({
  title,
  points,
  format,
}: {
  title: string;
  points: TimeSeriesPoint[];
  format: (value: number) => string;
}) {
  const width = 600;
  const height = 160;
  const padding = 8;

  const { path, max } = useMemo(() => {
    if (points.length === 0) return { path: "", max: 0 };
    const values = points.map((p) => p.value);
    const maxValue = Math.max(...values, 1);
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
    const d = points
      .map((p, i) => {
        const x = padding + i * stepX;
        const y = height - padding - (p.value / maxValue) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { path: d, max: maxValue };
  }, [points]);

  return (
    <figure className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <figcaption className="text-sm font-medium text-gray-700">{title}</figcaption>
      {points.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No data for this range.</p>
      ) : (
        <svg
          className="mt-2 w-full"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} line chart`}
          preserveAspectRatio="none"
        >
          <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} />
        </svg>
      )}
      <table className="mt-3 w-full text-left text-xs text-gray-600">
        <caption className="sr-only">{title} data table</caption>
        <thead>
          <tr>
            <th scope="col" className="py-1 font-medium">
              Date
            </th>
            <th scope="col" className="py-1 font-medium">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td className="py-0.5">{p.date}</td>
              <td className="py-0.5">{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {max > 0 ? <span className="sr-only">Peak value {format(max)}</span> : null}
    </figure>
  );
}

function filterSeries(points: TimeSeriesPoint[], range: Range): TimeSeriesPoint[] {
  const days = RANGE_DAYS[range];
  if (days === null) return points;
  return points.slice(-days);
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rangeParam = searchParams.get("range");
  const range: Range = (RANGES as readonly string[]).includes(rangeParam ?? "")
    ? (rangeParam as Range)
    : "30";

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setRange = useCallback(
    (next: Range) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/stats?range=${range}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: AdminStats) => {
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const claims = stats ? Object.entries(stats.claimsByStatus) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Admin dashboard</h1>
        <div role="group" aria-label="Time range" className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                range === option ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {RANGE_LABELS[option]}
            </button>
          ))}
        </div>
      </header>

      {loading ? <p className="mt-6 text-sm text-gray-500">Loading protocol health…</p> : null}
      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-600">
          Failed to load stats: {error}
        </p>
      ) : null}

      {stats ? (
        <>
          <section aria-label="Protocol statistics" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total policies" value={formatNumber(stats.totalPolicies)} />
            <StatTile label="Active policies" value={formatNumber(stats.activePolicies)} />
            <StatTile label="Active coverage" value={formatCurrency(stats.activeCoverage)} />
            <StatTile label="Premiums collected" value={formatCurrency(stats.premiumsCollected)} />
            <StatTile label="Payouts" value={formatCurrency(stats.payouts)} />
            <StatTile label="Indexer lag" value={formatLag(stats.indexerLag)} hint="Behind chain head" />
            <SolvencyGauge ratio={stats.solvencyRatio} />
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Claims by status</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {claims.length === 0 ? <li className="text-gray-400">No claims</li> : null}
                {claims.map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span className="capitalize">{status}</span>
                    <span className="font-medium">{formatNumber(count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-label="Time series charts" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Premiums collected"
              points={filterSeries(stats.series.premiums, range)}
              format={formatCurrency}
            />
            <TimeSeriesChart
              title="Payouts"
              points={filterSeries(stats.series.payouts, range)}
              format={formatCurrency}
            />
            <TimeSeriesChart
              title="Active policies"
              points={filterSeries(stats.series.activePolicies, range)}
              format={formatNumber}
            />
          </section>
        </>
      ) : null}
    </main>
  );
}
