export const DEFAULT_QUERY_LOG_LIMIT = 50;

export type QueryLogScope = "admin" | "user";
export type QueryLogSearchSurface = "api" | "playground" | "mcp";

export type QueryLogPreview = {
  rank: number;
  resultId: string | null;
  shortId: string | null;
  videoId: string | null;
  title: string;
  source: string;
  thumbnailUrl: string | null;
  targetUrl: string | null;
  score: number | null;
};

export type QueryLogFilters = {
  requestId?: string;
  userId?: string;
  query?: string;
  surface?: QueryLogSearchSurface;
  clientSource?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

export type QueryLogListItem = {
  requestId: string;
  userId: string;
  userEmail: string | null;
  queryText: string;
  searchSurface: QueryLogSearchSurface | null;
  clientSource: string | null;
  resultCount: number;
  latencyMs: number | null;
  includeAnswer: boolean;
  createdAt: string;
};

export type QueryLogDetail = QueryLogListItem & {
  apiKeyId: string | null;
  filters: unknown;
  maxResults: number;
  answerText: string | null;
  resultsPreview: QueryLogPreview[];
  creditsUsed: number | null;
};

export type QueryLogListResult = {
  items: QueryLogListItem[];
  total: number;
  limit: number;
  offset: number;
  appliedDefaultWindow: boolean;
};

export function createDefaultQueryLogFilters(): QueryLogFilters {
  return {
    limit: DEFAULT_QUERY_LOG_LIMIT,
    offset: 0,
  };
}

export function hasActiveQueryLogFilters(filters: QueryLogFilters): boolean {
  return Boolean(
    filters.requestId
      || filters.userId
      || filters.query
      || filters.surface
      || filters.clientSource
      || filters.from
      || filters.to,
  );
}
