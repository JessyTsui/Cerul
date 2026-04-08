"use client";

import type { Route } from "next";
import Link from "next/link";
import { formatNumber, type UsageChartPoint } from "@/lib/dashboard";
import { DashboardLayout } from "./dashboard-layout";
import {
  DashboardNotice,
  DashboardSkeleton,
  DashboardState,
} from "./dashboard-state";
import { UsageChart } from "./usage-chart";
import { useMonthlyUsage } from "./use-monthly-usage";

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M13.5 2.75 6.75 13.5h4.5l-.75 7.75 6.75-10.75h-4.5l.75-7.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function buildRecentQueryLogsHref(): Route {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return `/dashboard/query-logs?from=${encodeURIComponent(from)}` as Route;
}

export function DashboardUsageScreen() {
  const { data: usageData, error, isLoading, refresh } = useMonthlyUsage();

  const chartData: UsageChartPoint[] = (() => {
    if (!usageData) return [];
    const byDate = new Map(usageData.dailyBreakdown.map((entry) => [entry.date, entry]));
    const days: UsageChartPoint[] = [];
    const shortFormatter = new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
    const fullFormatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

    for (let index = 29; index >= 0; index -= 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - index);
      const key = date.toISOString().slice(0, 10);
      const entry = byDate.get(key);
      days.push({
        date: key,
        shortLabel: shortFormatter.format(date),
        fullLabel: fullFormatter.format(date),
        creditsUsed: entry?.creditsUsed ?? 0,
        requestCount: entry?.requestCount ?? 0,
      });
    }

    return days;
  })();

  if (isLoading && !usageData) {
    return (
      <DashboardLayout
        currentPath="/dashboard/usage"
        title="Usage"
        description="Credit consumption and request activity."
        actions={null}
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (error && !usageData) {
    return (
      <DashboardLayout
        currentPath="/dashboard/usage"
        title="Usage"
        description="Credit consumption and request activity."
        actions={null}
      >
        <DashboardState
          title="Usage data could not be loaded"
          description={error}
          tone="error"
          action={
            <button className="button-primary" onClick={() => void refresh()} type="button">
              Retry
            </button>
          }
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      currentPath="/dashboard/usage"
      title="Usage"
      description="Credit consumption and request activity."
      actions={null}
    >
      {error ? (
        <DashboardNotice
          title="Showing the last successful usage snapshot"
          description={error}
          tone="error"
        />
      ) : null}

      {usageData ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-elevated dashboard-card flex items-center gap-3 rounded-[20px] px-5 py-4">
              <IconBolt className="h-5 w-5 shrink-0 text-[var(--brand-bright)]" />
              <div>
                <p className="text-xs text-[var(--foreground-tertiary)]">Credits used</p>
                <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">
                  {formatNumber(usageData.creditsUsed)}
                </p>
              </div>
            </div>

            <div className="surface-elevated dashboard-card flex items-center gap-3 rounded-[20px] px-5 py-4">
              <IconSearch className="h-5 w-5 shrink-0 text-[var(--accent-bright)]" />
              <div>
                <p className="text-xs text-[var(--foreground-tertiary)]">Total queries</p>
                <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">
                  {formatNumber(usageData.requestCount)}
                </p>
              </div>
            </div>

            <div className="surface-elevated dashboard-card flex items-center gap-3 rounded-[20px] px-5 py-4">
              <IconSparkles className="h-5 w-5 shrink-0 text-[var(--foreground-tertiary)]" />
              <div>
                <p className="text-xs text-[var(--foreground-tertiary)]">Spendable credits</p>
                <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">
                  {formatNumber(usageData.walletBalance)}
                </p>
                <p className="text-xs text-[var(--foreground-tertiary)]">
                  Free today: {formatNumber(usageData.dailyFreeRemaining)} / {formatNumber(usageData.dailyFreeLimit)}
                </p>
              </div>
            </div>
          </div>

          {chartData.length > 0 ? (
            <UsageChart
              title="Daily Activity"
              description="Credit consumption over the current billing period."
              data={chartData}
            />
          ) : null}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
            <article className="surface-elevated rounded-[28px] px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                    Query logs
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    Detailed request history now lives in its own workspace
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">
                    Search by request ID, query text, client source, search surface, or a custom date window.
                    The selected request stays in the URL, so you can share a filtered list or reopen a specific
                    drawer later without losing context.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={"/dashboard/query-logs" as Route} className="button-secondary">
                    Open query logs
                  </Link>
                  <Link href={buildRecentQueryLogsHref()} className="button-primary">
                    View recent activity
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-[20px] border border-[var(--border)] bg-white/72 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">
                    URL state
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                    Filters, pagination, and the selected request are deep-linkable.
                  </p>
                </div>

                <div className="rounded-[20px] border border-[var(--border)] bg-white/72 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">
                    Better filters
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                    Use partial query search, surface filters, and request IDs without crowding this page.
                  </p>
                </div>

                <div className="rounded-[20px] border border-[var(--border)] bg-white/72 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">
                    Rich detail
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                    Open a drawer for answer text, result previews, metadata, and request-level diagnostics.
                  </p>
                </div>
              </div>
            </article>

            <aside className="surface rounded-[28px] px-5 py-5">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">
                This period
              </p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs text-[var(--foreground-tertiary)]">Request count</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                    {formatNumber(usageData.requestCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--foreground-tertiary)]">Billing window</dt>
                  <dd className="mt-1 text-sm text-[var(--foreground-secondary)]">
                    {usageData.periodStart} to {usageData.periodEnd}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--foreground-tertiary)]">Daily free searches left</dt>
                  <dd className="mt-1 text-sm text-[var(--foreground-secondary)]">
                    {formatNumber(usageData.dailyFreeRemaining)} of {formatNumber(usageData.dailyFreeLimit)}
                  </dd>
                </div>
              </dl>
            </aside>
          </section>
        </>
      ) : (
        <DashboardState
          title="Usage data is not available yet"
          description="Once requests start flowing, this page will show your billing-period activity and link into the detailed query log explorer."
        />
      )}
    </DashboardLayout>
  );
}
