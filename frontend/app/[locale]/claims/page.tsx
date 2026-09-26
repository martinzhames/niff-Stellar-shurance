'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ClaimRow, type Claim } from '@/components/claims/ClaimRow';

type Tab = 'mine' | 'community';

const STATUS_OPTIONS = ['all', 'pending', 'voting', 'approved', 'rejected', 'paid'] as const;
const PAGE_SIZE = 10;

interface ClaimsResponse {
  claims: Claim[];
  total: number;
}

function parseTab(value: string | null): Tab {
  return value === 'community' ? 'community' : 'mine';
}

export default function ClaimsPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = params?.locale ?? 'en';

  const tab = parseTab(searchParams.get('tab'));
  const status = searchParams.get('status') ?? 'all';
  const asset = searchParams.get('asset') ?? '';
  const date = searchParams.get('date') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const urlQuery = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(urlQuery);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      router.replace(`/${locale}/claims?${next.toString()}`);
    },
    [locale, router, searchParams],
  );

  // Debounced search that cancels in-flight requests.
  useEffect(() => {
    if (searchInput === urlQuery) return;
    const handle = setTimeout(() => {
      setParam({ q: searchInput || null, page: null });
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, urlQuery, setParam]);

  useEffect(() => {
    setSearchInput(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const query = new URLSearchParams({
      tab,
      status,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (asset) query.set('asset', asset);
    if (date) query.set('date', date);
    if (urlQuery) query.set('q', urlQuery);

    setLoading(true);
    setError(null);

    fetch(`/api/claims?${query.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load claims');
        return res.json() as Promise<ClaimsResponse>;
      })
      .then((data) => {
        setClaims(data.claims ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load claims');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [tab, status, asset, date, page, urlQuery]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Claims</h1>

      <div role="tablist" className="mt-4 flex gap-2 border-b">
        <button
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? 'border-b-2 border-blue-600 px-4 py-2 font-medium' : 'px-4 py-2'}
          onClick={() => setParam({ tab: 'mine', page: null })}
        >
          My claims
        </button>
        <button
          role="tab"
          aria-selected={tab === 'community'}
          className={tab === 'community' ? 'border-b-2 border-blue-600 px-4 py-2 font-medium' : 'px-4 py-2'}
          onClick={() => setParam({ tab: 'community', page: null })}
        >
          Community claims
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Search claims"
          placeholder="Search claims"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setParam({ status: e.target.value === 'all' ? null : e.target.value, page: null })}
          className="rounded border px-3 py-2"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Asset"
          placeholder="Asset"
          value={asset}
          onChange={(e) => setParam({ asset: e.target.value || null, page: null })}
          className="rounded border px-3 py-2"
        />
        <input
          type="date"
          aria-label="Date"
          value={date}
          onChange={(e) => setParam({ date: e.target.value || null, page: null })}
          className="rounded border px-3 py-2"
        />
      </div>

      <div className="mt-6 space-y-3">
        {loading && <p role="status">Loading claims…</p>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!loading && !error && claims.length === 0 && <p>No claims found.</p>}
        {claims.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          disabled={page <= 1}
          onClick={() => setParam({ page: String(page - 1) })}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setParam({ page: String(page + 1) })}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </main>
  );
}
