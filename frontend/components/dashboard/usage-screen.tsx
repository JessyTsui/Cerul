"use client";

import { useEffect, useState } from "react";
import { queryLogs, type QueryLogEntry } from "@/lib/api";
import { formatNumber } from "@/lib/dashboard";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardSkeleton, DashboardState } from "./dashboard-state";
import { useMonthlyUsage } from "./use-monthly-usage";

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M13.5 2.75 6.75 13.5h4.5l-.75 7.75 6.75-10.75h-4.5l.75-7.75Z" fill="currentColor" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function DashboardUsageScreen() {
  const { data: usageData } = useMonthlyUsage();
  const [logs, setLogs] = useState<QueryLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  async function loadLogs(offset: number) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await queryLogs.list({ limit: pageSize, offset });
      setLogs(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load query history.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs(page * pageSize);
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <DashboardLayout
      currentPath="/dashboard/usage"
      title="Usage"
      description="Recent API queries and credit consumption."
      actions={null}
    >
      {/* ── Summary strip ─────────────────────────────── */}
      {usageData && (
        <div className="grid grid-cols-3 gap-4">
          <div className="surface-elevated dashboard-card flex items-center gap-3 rounded-[20px] px-5 py-4">
            <IconBolt className="h-5 w-5 shrink-0 text-[var(--brand-bright)]" />
            <div>
              <p className="text-xs text-[var(--foreground-tertiary)]">Credits used</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(usageData.creditsUsed)}</p>
            </div>
          </div>
          <div className="surface-elevated dashboard-card flex items-center gap-3 rounded-[20px] px-5 py-4">
            <IconSearch className="h-5 w-5 shrink-0 text-[var(--accent-bright)]" />
            <div>
              <p className="text-xs text-[var(--foreground-tertiary)]">Total queries</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(total)}</p>
            </div>
          </div>
          <div className="surface-elevated dashboard-card flex items-center gap-3 rounded-[20px] px-5 py-4">
            <IconClock className="h-5 w-5 shrink-0 text-[var(--foreground-tertiary)]" />
            <div>
              <p className="text-xs text-[var(--foreground-tertiary)]">Free today</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">
                {formatNumber(usageData.dailyFreeRemaining)}<span className="text-sm font-normal text-[var(--foreground-tertiary)]"> / {formatNumber(usageData.dailyFreeLimit)}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Query log ─────────────────────────────────── */}
      {isLoading && logs.length === 0 ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardState
          title="Could not load query history"
          description={error}
          tone="error"
          action={<button className="button-primary" onClick={() => void loadLogs(page * pageSize)} type="button">Retry</button>}
        />
      ) : logs.length === 0 ? (
        <DashboardState
          title="No queries yet"
          description="Your API query history will appear here once you start making search requests."
        />
      ) : (
        <section className="surface-elevated dashboard-card overflow-hidden rounded-[24px]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <IconSearch className="h-4 w-4 text-[var(--foreground-tertiary)]" />
              <h2 className="text-base font-semibold text-[var(--foreground)]">Query History</h2>
            </div>
            <span className="text-xs text-[var(--foreground-tertiary)]">
              {formatNumber(total)} total
            </span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {logs.map((log) => (
              <div key={log.requestId} className="px-5 py-4 transition hover:bg-white/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {log.queryText}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--foreground-tertiary)]">
                      <span title={formatTimestamp(log.createdAt)}>
                        {formatRelativeTime(log.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconBolt className="h-3 w-3" />
                        {log.creditsUsed} credit{log.creditsUsed !== 1 ? "s" : ""}
                      </span>
                      <span>{log.resultCount} result{log.resultCount !== 1 ? "s" : ""}</span>
                      {log.latencyMs != null && (
                        <span>{log.latencyMs}ms</span>
                      )}
                      {log.includeAnswer && (
                        <span className="rounded-full border border-[var(--border-brand)] bg-[var(--brand-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-bright)]">
                          Answer
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--foreground-tertiary)]">
                    {formatTimestamp(log.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-[12px] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] transition hover:bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--foreground-tertiary)]">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-[12px] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] transition hover:bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
    </DashboardLayout>
  );
}
