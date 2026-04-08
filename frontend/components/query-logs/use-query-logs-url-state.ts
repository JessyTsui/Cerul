"use client";

import type { Route } from "next";
import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createDefaultQueryLogFilters,
  DEFAULT_QUERY_LOG_LIMIT,
  type QueryLogFilters,
  type QueryLogSearchSurface,
} from "./types";

type SearchParamsLike = Pick<URLSearchParams, "get">;

export type QueryLogsUrlState = {
  urlFilters: QueryLogFilters;
  selectedRequestId: string | null;
  commitFilter: (next: Partial<QueryLogFilters>) => void;
  selectRequest: (requestId: string | null, nextFilters?: Partial<QueryLogFilters>) => void;
  setOffset: (offset: number) => void;
  resetFilters: () => void;
};

function normalizeString(value: string | null): string | undefined {
  const normalized = (value ?? "").trim();
  return normalized || undefined;
}

function normalizeSurface(value: string | null): QueryLogSearchSurface | undefined {
  return value === "api" || value === "playground" || value === "mcp"
    ? value
    : undefined;
}

function normalizeBoundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum?: number,
): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < minimum) {
    return minimum;
  }
  if (maximum != null && parsed > maximum) {
    return maximum;
  }
  return parsed;
}

function withOffsetReset(
  current: QueryLogFilters,
  next: Partial<QueryLogFilters>,
): QueryLogFilters {
  const merged = {
    ...current,
    ...next,
  };

  const shouldResetOffset =
    ("requestId" in next)
    || ("userId" in next)
    || ("query" in next)
    || ("surface" in next)
    || ("clientSource" in next)
    || ("from" in next)
    || ("to" in next);

  if (shouldResetOffset) {
    merged.offset = 0;
  }

  return merged;
}

export function parseQueryLogFiltersFromSearchParams(
  searchParams: SearchParamsLike,
): QueryLogFilters {
  return {
    requestId: normalizeString(searchParams.get("requestId")),
    userId: normalizeString(searchParams.get("userId")),
    query: normalizeString(searchParams.get("query")),
    surface: normalizeSurface(searchParams.get("surface")),
    clientSource: normalizeString(searchParams.get("clientSource")),
    from: normalizeString(searchParams.get("from")),
    to: normalizeString(searchParams.get("to")),
    limit: normalizeBoundedInteger(searchParams.get("limit"), DEFAULT_QUERY_LOG_LIMIT, 1, 100),
    offset: normalizeBoundedInteger(searchParams.get("offset"), 0, 0),
  };
}

export function serializeQueryLogFiltersToSearchParams(
  filters: QueryLogFilters,
  selectedRequestId: string | null,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.requestId) params.set("requestId", filters.requestId);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.query) params.set("query", filters.query);
  if (filters.surface) params.set("surface", filters.surface);
  if (filters.clientSource) params.set("clientSource", filters.clientSource);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit !== createDefaultQueryLogFilters().limit) params.set("limit", String(filters.limit));
  if (filters.offset > 0) params.set("offset", String(filters.offset));
  if (selectedRequestId) params.set("selected", selectedRequestId);

  return params;
}

function replaceUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  filters: QueryLogFilters,
  selectedRequestId: string | null,
) {
  const params = serializeQueryLogFiltersToSearchParams(filters, selectedRequestId);
  const query = params.toString();
  const href = query ? `${pathname}?${query}` : pathname;
  startTransition(() => {
    router.replace(href as Route, { scroll: false });
  });
}

export function useQueryLogsUrlState(basePath: string): QueryLogsUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activePath = pathname || basePath;
  const urlFilters = parseQueryLogFiltersFromSearchParams(searchParams);
  const selectedRequestId = normalizeString(searchParams.get("selected")) ?? null;

  function commitFilter(next: Partial<QueryLogFilters>) {
    const merged = withOffsetReset(urlFilters, next);
    replaceUrl(router, activePath, merged, selectedRequestId);
  }

  function selectRequest(requestId: string | null, nextFilters?: Partial<QueryLogFilters>) {
    const merged = nextFilters ? withOffsetReset(urlFilters, nextFilters) : urlFilters;
    replaceUrl(router, activePath, merged, requestId);
  }

  function setOffset(offset: number) {
    commitFilter({ offset });
  }

  function resetFilters() {
    const reset = createDefaultQueryLogFilters();
    replaceUrl(router, activePath, reset, null);
  }

  return {
    urlFilters,
    selectedRequestId,
    commitFilter,
    selectRequest,
    setOffset,
    resetFilters,
  };
}
