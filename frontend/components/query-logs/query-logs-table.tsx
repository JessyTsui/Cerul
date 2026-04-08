import { QueryLogRow, QueryLogSurfaceBadge } from "./query-log-row";
import type { QueryLogListItem } from "./types";

type QueryLogsTableProps = {
  items: QueryLogListItem[];
  total: number;
  limit: number;
  offset: number;
  showUserColumn: boolean;
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
  onPageChange: (offset: number) => void;
};

function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function QueryLogsTable({
  items,
  total,
  limit,
  offset,
  showUserColumn,
  selectedRequestId,
  onSelectRequest,
  onPageChange,
}: QueryLogsTableProps) {
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, total);
  const canGoBack = offset > 0;
  const canGoForward = offset + limit < total;

  return (
    <section className="surface-elevated overflow-hidden rounded-[30px]">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            Matched queries
          </p>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            {rangeStart}-{rangeEnd} of {total}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-white/72 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] transition hover:border-[var(--border-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canGoBack}
            onClick={() => onPageChange(Math.max(offset - limit, 0))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-white/72 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] transition hover:border-[var(--border-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canGoForward}
            onClick={() => onPageChange(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full">
          <thead className="bg-[rgba(255,255,255,0.04)] text-xs uppercase tracking-[0.12em] text-[var(--foreground-tertiary)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Query</th>
              {showUserColumn ? <th className="px-4 py-3 text-left font-medium">User</th> : null}
              <th className="px-4 py-3 text-left font-medium">Surface</th>
              <th className="px-4 py-3 text-left font-medium">Results</th>
              <th className="px-4 py-3 text-left font-medium">Latency</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <QueryLogRow
                key={item.requestId}
                item={item}
                showUserColumn={showUserColumn}
                isSelected={selectedRequestId === item.requestId}
                onSelect={() => onSelectRequest(item.requestId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {items.map((item) => {
          const isSelected = selectedRequestId === item.requestId;
          return (
            <button
              key={item.requestId}
              type="button"
              onClick={() => onSelectRequest(item.requestId)}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                isSelected
                  ? "border-[var(--border-brand)] bg-[var(--brand-subtle)]"
                  : "border-[var(--border)] bg-white/68 hover:border-[var(--border-strong)] hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {item.queryText || "Untitled query"}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-tertiary)]">
                    {item.requestId}
                  </p>
                </div>
                <QueryLogSurfaceBadge surface={item.searchSurface} />
              </div>
              <div className="mt-4 grid gap-2 text-xs text-[var(--foreground-secondary)] sm:grid-cols-2">
                {showUserColumn ? (
                  <p className="truncate">User: {item.userEmail ?? item.userId}</p>
                ) : null}
                <p>Results: {item.resultCount}</p>
                <p>Latency: {item.latencyMs == null ? "—" : `${Math.round(item.latencyMs)}ms`}</p>
                <p>{formatAbsoluteTime(item.createdAt)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
