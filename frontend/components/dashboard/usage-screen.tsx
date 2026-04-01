"use client";

import {
  buildUsageChartData,
  formatBillingPeriod,
  formatNumber,
  getIncludedCreditsUsed,
  getTierLabel,
} from "@/lib/dashboard";
import { CreditBalancePanel } from "./credit-balance-panel";
import { CreditUsageBar } from "./credit-usage-bar";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardNotice, DashboardSkeleton, DashboardState } from "./dashboard-state";
import { UsageChart } from "./usage-chart";
import { useMonthlyUsage } from "./use-monthly-usage";

export function DashboardUsageScreen() {
  const { data, error, isLoading, refresh } = useMonthlyUsage();

  if (isLoading && !data) {
    return (
      <DashboardLayout
        currentPath="/dashboard/usage"
        title="Usage"
        description="Volume, credits, and request cadence for the current billing window."
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (error && !data) {
    return (
      <DashboardLayout
        currentPath="/dashboard/usage"
        title="Usage"
        description="Volume, credits, and request cadence for the current billing window."
      >
        <DashboardState
          title="Usage metrics could not be loaded"
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

  if (!data) {
    return (
      <DashboardLayout
        currentPath="/dashboard/usage"
        title="Usage"
        description="Volume, credits, and request cadence for the current billing window."
      >
        <DashboardState title="No usage data available" description="The dashboard API returned no usage payload." />
      </DashboardLayout>
    );
  }

  const chartData = buildUsageChartData(data);
  const includedCreditsUsed = getIncludedCreditsUsed(data);
  const activeDays = chartData.filter((p) => p.requestCount > 0 || p.creditsUsed > 0);
  const averageDailyRequests = chartData.length === 0
    ? 0
    : Math.round(data.requestCount / chartData.length);
  const creditsPerRequest = data.requestCount === 0
    ? 0
    : Number((data.creditsUsed / data.requestCount).toFixed(2));
  const busiestDays = [...activeDays]
    .sort((a, b) => b.requestCount !== a.requestCount ? b.requestCount - a.requestCount : b.creditsUsed - a.creditsUsed)
    .slice(0, 5);
  const topCreditsDay = [...activeDays].sort((a, b) => b.creditsUsed - a.creditsUsed)[0] ?? null;
  const topRequestsDay = busiestDays[0] ?? null;
  const recentRows = [...chartData].slice(-14).reverse();
  const totalRequestValue = Math.max(1, ...busiestDays.map((d) => d.requestCount));

  // Calculate how many free searches were used
  const freeSearchesUsedToday = data.dailyFreeLimit - data.dailyFreeRemaining;
  // Calculate paid searches (total requests minus today's free searches, if positive)
  const paidSearches = Math.max(0, data.requestCount - freeSearchesUsedToday);

  return (
    <DashboardLayout
      currentPath="/dashboard/usage"
      title="Usage"
      description={`${getTierLabel(data.tier)} · ${formatBillingPeriod(data.periodStart, data.periodEnd)}`}
      actions={
        <button className="button-secondary" onClick={() => void refresh()} type="button">
          Refresh
        </button>
      }
    >
      {error && (
        <DashboardNotice
          title="Showing last successful snapshot."
          description={error}
          tone="error"
        />
      )}

      {/* Simplified credit overview - only show total remaining */}
      <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
              Credits remaining
            </p>
            <h2 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {formatNumber(data.walletBalance)}
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
              Available for your next search
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-[rgba(97,125,233,0.16)] bg-[rgba(97,125,233,0.08)] px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[rgb(72,98,198)]">
                Free today
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--foreground)]">
                {formatNumber(data.dailyFreeRemaining)} / {formatNumber(data.dailyFreeLimit)}
              </p>
            </div>
          </div>
        </div>

        {/* Credit usage breakdown bar */}
        <div className="mt-6">
          <CreditUsageBar
            label="Included credits this period"
            limit={data.creditsLimit}
            remaining={data.creditBreakdown.includedRemaining}
            used={includedCreditsUsed}
          />
          <p className="mt-2 px-1 text-sm leading-6 text-[var(--foreground-secondary)]">
            {formatNumber(includedCreditsUsed)} / {formatNumber(data.creditsLimit)} included credits used
            {data.creditBreakdown.paidRemaining > 0 || data.creditBreakdown.bonusRemaining > 0 ? (
              <>
                {" "}· plus {formatNumber(data.creditBreakdown.paidRemaining + data.creditBreakdown.bonusRemaining)} bonus/purchased credits
              </>
            ) : null}
          </p>
        </div>
      </article>

      {/* Request breakdown - clarify free vs paid */}
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            Request breakdown
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {formatNumber(data.requestCount)} total requests
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
            Free searches deduct 0 credits. Only searches after your daily free allowance consume credits.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
              <p className="text-xs text-[var(--foreground-tertiary)]">Free searches (today)</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {formatNumber(Math.min(freeSearchesUsedToday, data.dailyFreeLimit))}
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
                0 credits used
              </p>
            </div>
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
              <p className="text-xs text-[var(--foreground-tertiary)]">Paid searches</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {formatNumber(paidSearches)}
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
                {formatNumber(data.creditsUsed)} credits consumed
              </p>
            </div>
          </div>
        </article>

        <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            Current period
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Activity summary
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Requests", value: formatNumber(data.requestCount) },
              { label: "Charged credits", value: formatNumber(data.creditsUsed) },
              { label: "Active days", value: formatNumber(activeDays.length) },
              { label: "Avg requests/day", value: formatNumber(averageDailyRequests) },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4"
              >
                <p className="text-sm text-[var(--foreground-secondary)]">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  {item.value}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-5 rounded-[22px] border border-[var(--border)] bg-white/72 px-4 py-4">
            <p className="text-sm font-medium text-[var(--foreground)]">Today's free allowance</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {formatNumber(data.dailyFreeRemaining)} / {formatNumber(data.dailyFreeLimit)} remaining
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
              The first {formatNumber(data.dailyFreeLimit)} searches each UTC day deduct 0 credits,
              even though they still appear in request analytics.
            </p>
          </div>
        </article>
      </section>

      <UsageChart
        title="Daily Activity"
        description="Request volume and credit consumption for the current billing window."
        data={chartData}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface-elevated dashboard-card rounded-[28px] px-5 py-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Highlights</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Peak request day",
                value: topRequestsDay
                  ? `${topRequestsDay.fullLabel} · ${formatNumber(topRequestsDay.requestCount)}`
                  : "—",
              },
              {
                label: "Peak credit day",
                value: topCreditsDay
                  ? `${topCreditsDay.fullLabel} · ${formatNumber(topCreditsDay.creditsUsed)}`
                  : "—",
              },
              { label: "Avg requests / day", value: formatNumber(averageDailyRequests) },
              {
                label: "Credits / request",
                value: creditsPerRequest === 0 ? "0" : creditsPerRequest.toFixed(2),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[18px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4"
              >
                <p className="text-xs text-[var(--foreground-secondary)]">{item.label}</p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-elevated dashboard-card rounded-[28px] px-5 py-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Most active days</h2>
          <div className="mt-5 space-y-4">
            {busiestDays.length > 0 ? busiestDays.map((item) => (
              <div key={item.date} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_80px] sm:items-center">
                <div>
                  <span className="text-sm text-[var(--foreground)]">{item.fullLabel}</span>
                  <p className="text-xs text-[var(--foreground-tertiary)]">
                    {formatNumber(item.creditsUsed)} credits
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[rgba(36,29,21,0.08)]">
                  <div
                    className="animate-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--brand),var(--accent))]"
                    style={{ width: `${Math.max(12, (item.requestCount / totalRequestValue) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-sm text-[var(--foreground)]">
                  {formatNumber(item.requestCount)}
                </span>
              </div>
            )) : (
              <p className="text-sm text-[var(--foreground-tertiary)]">No activity yet this period.</p>
            )}
          </div>
        </article>
      </section>

      <section className="surface-elevated dashboard-card overflow-hidden rounded-[28px]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Daily Breakdown</h2>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">Last 14 days</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[rgba(255,255,255,0.03)] text-[var(--foreground-secondary)]">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Requests</th>
                <th className="px-5 py-3 font-medium">Charged credits</th>
                <th className="px-5 py-3 font-medium">Request share</th>
                <th className="px-5 py-3 font-medium">Credit share</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.date} className="border-t border-[var(--border)]">
                  <td className="px-5 py-3 text-[var(--foreground)]">{row.fullLabel}</td>
                  <td className="px-5 py-3 text-[var(--brand-bright)]">{formatNumber(row.requestCount)}</td>
                  <td className="px-5 py-3 text-[var(--foreground-secondary)]">{formatNumber(row.creditsUsed)}</td>
                  <td className="px-5 py-3 text-[var(--foreground-secondary)]">
                    {data.requestCount === 0 ? "0%" : `${Math.round((row.requestCount / data.requestCount) * 100)}%`}
                  </td>
                  <td className="px-5 py-3 text-[var(--foreground-secondary)]">
                    {data.creditsUsed === 0 ? "0%" : `${Math.round((row.creditsUsed / data.creditsUsed) * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
