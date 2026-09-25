import { apiFetch } from "@/lib/api/client";

export type ClaimStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disputed"
  | "escalated"
  | "paid";

export interface Claim {
  id: string;
  claimant: string;
  asset: string;
  amount: number;
  status: ClaimStatus;
  fraudScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimFilters {
  status?: ClaimStatus | "all";
  fraudScoreMin?: number;
  fraudScoreMax?: number;
  asset?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ClaimListResponse {
  claims: Claim[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BulkPayoutResult {
  claimId: string;
  success: boolean;
  error?: string;
  transactionId?: string;
}

export interface BulkPayoutResponse {
  results: BulkPayoutResult[];
  succeeded: number;
  failed: number;
}

function buildQuery(filters: ClaimFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (typeof filters.fraudScoreMin === "number") {
    params.set("fraudScoreMin", String(filters.fraudScoreMin));
  }
  if (typeof filters.fraudScoreMax === "number") {
    params.set("fraudScoreMax", String(filters.fraudScoreMax));
  }
  if (filters.asset) {
    params.set("asset", filters.asset);
  }
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listClaims(
  filters: ClaimFilters = {},
  page = 1,
  pageSize = 25,
): Promise<ClaimListResponse> {
  const params = new URLSearchParams(buildQuery(filters).replace(/^\?/, ""));
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return apiFetch<ClaimListResponse>(`/admin/claims?${params.toString()}`);
}

export async function disputeClaim(id: string, reason: string): Promise<Claim> {
  return apiFetch<Claim>(`/admin/claims/${encodeURIComponent(id)}/dispute`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function escalateClaim(id: string, reason: string): Promise<Claim> {
  return apiFetch<Claim>(`/admin/claims/${encodeURIComponent(id)}/escalate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function processPayout(id: string): Promise<BulkPayoutResult> {
  return apiFetch<BulkPayoutResult>(
    `/admin/claims/${encodeURIComponent(id)}/payout`,
    { method: "POST" },
  );
}

export async function processBulkPayout(
  claimIds: string[],
): Promise<BulkPayoutResponse> {
  return apiFetch<BulkPayoutResponse>("/admin/claims/payouts", {
    method: "POST",
    body: JSON.stringify({ claimIds }),
  });
}

export function claimsExportUrl(filters: ClaimFilters = {}): string {
  return `/admin/claims/export${buildQuery(filters)}`;
}

export async function exportClaimsCsv(filters: ClaimFilters = {}): Promise<Blob> {
  const response = await fetch(claimsExportUrl(filters), {
    headers: { Accept: "text/csv" },
  });
  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }
  return response.blob();
}
