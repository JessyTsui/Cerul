"use client";

import { useEffect, useState } from "react";
import { queryLogs, type QueryLogEntry } from "@/lib/api";
import { buildUsageChartData, formatNumber } from "@/lib/dashboard";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardSkeleton, DashboardState } from "./dashboard-state";
import { UsageChart } from "./usage-chart";
import { useMonthlyUsage } from "./use-monthly-usage";

/* ── Icons ────────────────────────────────────────────── */

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

function IconChevron({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg className={`${className ?? ""} transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
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
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function scorePercent(score: number | null): number {
  if (score == null) return 0;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "var(--success)";
  if (pct >= 50) return "var(--brand-bright)";
  return "var(--foreground-tertiary)";
}

/* ── Query Row ─────────────────────────────────────────── */

function QueryRow({ log }: { log: QueryLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.answerText || log.results.length > 0;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      {/* Header row */}
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`flex w-full items-start gap-3 px-5 py-4 text-left transition ${hasDetails ? "cursor-pointer hover:bg-white/40" : "cursor-default"}`}
      >
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(136,165,242,0.1)]">
          <IconSearch className="h-3.5 w-3.5 text-[var(--brand-bright)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-[var(--foreground)]">{log.queryText}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--foreground-tertiary)]">
            <span>{formatRelativeTime(log.createdAt)}</span>
            <span className="flex items-center gap-0.5">
              <IconBolt className="h-3 w-3" />{log.creditsUsed}
            </span>
            <span>{log.resultCount} result{log.resultCount !== 1 ? "s" : ""}</span>
            {log.latencyMs != null && <span>{log.latencyMs}ms</span>}
            {log.answerText && (
              <span className="flex items-center gap-0.5 text-[var(--brand-bright)]">
                <IconSparkles className="h-3 w-3" />Answer
              </span>
            )}
          </div>
        </div>
        <span className="mt-1 shrink-0 text-[11px] tabular-nums text-[var(--foreground-tertiary)]">
          {formatTimestamp(log.createdAt)}
        </span>
        {hasDetails && <IconChevron className="mt-1 h-4 w-4 shrink-0 text-[var(--foreground-tertiary)]" open={open} />}
      </button>

      {/* Expanded details */}
      {open && hasDetails && (
        <div className="animate-fade-in space-y-3 border-t border-[var(--border)] bg-[var(--background-elevated)] px-5 py-4">
          {/* Answer */}
          {log.answerText && (
            <div className="rounded-[14px] border border-[var(--border-brand)] bg-[var(--brand-subtle)] px-4 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--brand-bright)]">
                <IconSparkles className="h-3 w-3" />
                AI Answer
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--foreground)]">{log.answerText}</p>
            </div>
          )}

          {/* Results */}
          {log.results.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--foreground-tertiary)]">
                Sources
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {log.results.map((result) => {
                  const pct = scorePercent(result.score);
                  return (
                    <a
                      key={result.rank}
                      href={result.targetUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex gap-3 rounded-[12px] border border-[var(--border)] bg-white/60 p-2.5 transition hover:border-[var(--border-strong)] hover:bg-white/90"
                    >
                      {result.thumbnailUrl ? (
                        <img src={result.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded-[6px] object-cover" />
                      ) : (
                        <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-[6px] bg-[rgba(36,29,21,0.05)] text-sm font-semibold text-[var(--foreground-tertiary)]">
                          #{result.rank + 1}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--foreground)] group-hover:text-[var(--brand-bright)]">
                          {result.title || "Untitled"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--foreground-tertiary)]">{result.source}</p>
                        {result.score != null && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(36,29,21,0.06)]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.max(pct, 4)}%`, background: scoreColor(pct) }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums" style={{ color: scoreColor(pct) }}>
                              {pct}%
                            </span>
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main screen ──────────────────────────────────────── */

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

  const chartData = usageData ? buildUsageChartData(usageData) : [];
  const totalPages = Math.ceil(total / pageSize);

  return (
    <DashboardLayout
      currentPath="/dashboard/usage"
      title="Usage"
      description="Credit consumption and query history."
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
            <IconSparkles className="h-5 w-5 shrink-0 text-[var(--foreground-tertiary)]" />
            <div>
              <p className="text-xs text-[var(--foreground-tertiary)]">Available</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">
                {formatNumber(usageData.walletBalance + usageData.dailyFreeRemaining)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Chart ─────────────────────────────────────── */}
      {chartData.length > 0 && (
        <UsageChart
          title="Daily Activity"
          description="Credit consumption over the current billing period."
          data={chartData}
        />
      )}

      {/* ── Query history ─────────────────────────────── */}
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
            <span className="text-xs text-[var(--foreground-tertiary)]">{formatNumber(total)} total</span>
          </div>

          {logs.map((log) => (
            <QueryRow key={log.requestId} log={log} />
          ))}

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
              <span className="text-xs text-[var(--foreground-tertiary)]">Page {page + 1} of {totalPages}</span>
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
