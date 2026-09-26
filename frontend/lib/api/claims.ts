import { apiFetch } from "./client";

export type ClaimStatus =
  | "pending"
  | "voting"
  | "approved"
  | "rejected"
  | "paid";

export interface Claim {
  id: string;
  policyId: string;
  policyName?: string;
  claimant: string;
  amount: number;
  asset: string;
  status: ClaimStatus;
  votesFor: number;
  votesAgainst: number;
  votesRequired: number;
  deadline: string;
  createdAt: string;
  needsMyVote?: boolean;
}

export interface ClaimsQuery {
  tab?: "mine" | "community";
  status?: ClaimStatus | "all";
  asset?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ClaimsPage {
  items: Claim[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function buildQuery(params: ClaimsQuery): string {
  const search = new URLSearchParams();
  if (params.tab) search.set("tab", params.tab);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.asset) search.set("asset", params.asset);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function fetchClaims(
  params: ClaimsQuery = {},
  signal?: AbortSignal,
): Promise<ClaimsPage> {
  return apiFetch<ClaimsPage>(`/claims${buildQuery(params)}`, { signal });
}

export function fetchClaim(id: string, signal?: AbortSignal): Promise<Claim> {
  return apiFetch<Claim>(`/claims/${id}`, { signal });
}

export function castClaimVote(
  id: string,
  vote: "for" | "against",
): Promise<Claim> {
  return apiFetch<Claim>(`/claims/${id}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote }),
  });
}
