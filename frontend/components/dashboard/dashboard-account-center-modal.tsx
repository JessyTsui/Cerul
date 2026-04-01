"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { billing, getApiErrorMessage } from "@/lib/api";
import {
  buildUsageChartData,
  formatBillingPeriod,
  formatNumber,
  getIncludedCreditsUsed,
  getTierLabel,
  resolveDashboardBillingAction,
} from "@/lib/dashboard";
import { useConsoleViewer } from "@/components/console/console-viewer-context";
import { ACCOUNT_SETTINGS_ROUTE } from "@/lib/site";
import { DashboardOverlayDialog } from "./dashboard-overlay-dialog";
import type {
  DashboardAccountCenterSection,
  DashboardBillingModalView,
} from "./dashboard-shell-controls";
import { useMonthlyUsage } from "./use-monthly-usage";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase();
  }

  return email?.[0]?.toUpperCase() ?? "U";
}

function IconClose() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M4.5 12h15m0 0-5.25-5.25M19.5 12l-5.25 5.25" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

type DashboardAccountCenterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSection: DashboardAccountCenterSection;
  onOpenBillingModal: (view: DashboardBillingModalView) => void;
};

export function DashboardAccountCenterModal({
  isOpen,
  onClose,
  initialSection,
  onOpenBillingModal,
}: DashboardAccountCenterModalProps) {
  const viewer = useConsoleViewer();
  const { data, error, isLoading, refresh } = useMonthlyUsage();
  const [activeSection, setActiveSection] = useState<DashboardAccountCenterSection>(initialSection);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const initials = getInitials(viewer.displayName, viewer.email);
  const usageRows = data ? buildUsageChartData(data).slice(-8).reverse() : [];
  const includedUsed = data ? getIncludedCreditsUsed(data) : 0;
  const billingAction = data
    ? resolveDashboardBillingAction(data.tier, data.hasStripeCustomer)
    : null;
  const canUpgrade = billingAction === "checkout";
  const canManageSubscription = billingAction === "portal";

  async function handleOpenPortal() {
    setPortalLoading(true);
    setActionError(null);

    try {
      const redirect = await billing.createPortal();
      window.location.assign(redirect.url);
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError, "Failed to open billing portal."));
      setPortalLoading(false);
    }
  }

  const sections = [
    {
      id: "profile" as const,
      label: "Profile",
      detail: "Identity and common settings",
    },
    {
      id: "subscription" as const,
      label: "Subscription",
      detail: "Plan, renewal, and upgrades",
    },
    {
      id: "usage" as const,
      label: "Usage",
      detail: "Credits, daily free, and activity",
    },
    {
      id: "billing" as const,
      label: "Billing",
      detail: "Top-up, auto-recharge, and checkout",
    },
  ];

  return (
    <DashboardOverlayDialog isOpen={isOpen} onClose={onClose} labelledBy="dashboard-account-center-title">
      <div className="grid max-h-[calc(100vh-3rem)] min-h-[660px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border)] bg-[rgba(247,241,233,0.88)] p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-tertiary)]">
                Account center
              </p>
              <h2 id="dashboard-account-center-title" className="mt-3 text-[2.1rem] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                One place for profile, plan, usage, and credits
              </h2>
            </div>
            <button
              aria-label="Close account center"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white/82 text-[var(--foreground-secondary)] transition hover:text-[var(--foreground)]"
              onClick={onClose}
              type="button"
            >
              <IconClose />
            </button>
          </div>

          <div className="mt-8 rounded-[26px] border border-[var(--border)] bg-white/88 p-5 shadow-[0_20px_50px_rgba(49,36,22,0.06)]">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background-elevated)] text-base font-semibold text-[var(--foreground-secondary)]">
                {viewer.image ? (
                  // Avatar hosts come from auth providers, so we intentionally avoid a global next/image allowlist here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewer.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[var(--foreground)]">
                  {viewer.displayName ?? "Personal workspace"}
                </p>
                <p className="truncate text-sm text-[var(--foreground-secondary)]">{viewer.email ?? "Signed in"}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">Spendable</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  {data ? formatNumber(data.walletBalance) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenBillingModal("topup")}
                className="button-secondary"
              >
                Recharge
              </button>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {sections.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition ${
                    active
                      ? "border-[var(--border-brand)] bg-[var(--brand-subtle)]"
                      : "border-transparent bg-white/50 hover:border-[var(--border)] hover:bg-white/82"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{section.label}</p>
                    <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">{section.detail}</p>
                  </div>
                  <IconArrowRight className={`h-4 w-4 ${active ? "text-[var(--brand-bright)]" : "text-[var(--foreground-tertiary)]"}`} />
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="overflow-y-auto p-6 lg:p-8">
          {isLoading && !data ? (
            <div className="surface-elevated rounded-[30px] px-6 py-6">
              <p className="text-sm text-[var(--foreground-secondary)]">Loading account center…</p>
            </div>
          ) : error && !data ? (
            <div className="surface-elevated rounded-[30px] px-6 py-6">
              <p className="text-lg font-semibold text-[var(--foreground)]">Account data could not be loaded</p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{error}</p>
              <button className="button-primary mt-5" onClick={() => void refresh()} type="button">
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {actionError ? (
                <div className="rounded-[20px] border border-[rgba(191,91,70,0.22)] bg-[rgba(191,91,70,0.08)] px-4 py-3 text-sm text-[var(--error)]">
                  {actionError}
                </div>
              ) : null}

              {activeSection === "profile" ? (
                <>
                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                      Profile
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                      Keep the personal surface simple and easy to reach
                    </h3>
                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                      {[
                        {
                          label: "Display name",
                          value: viewer.displayName ?? "Not set",
                          note: "Shown anywhere your Cerul identity appears.",
                        },
                        {
                          label: "Email",
                          value: viewer.email ?? "No email",
                          note: "Used for sign-in and billing communication.",
                        },
                        {
                          label: "Workspace role",
                          value: viewer.isAdmin ? "Admin" : "Member",
                          note: viewer.isAdmin ? "Admin access is active for this workspace." : "Standard personal workspace access.",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4"
                        >
                          <p className="text-xs text-[var(--foreground-tertiary)]">{item.label}</p>
                          <p className="mt-2 truncate text-xl font-semibold text-[var(--foreground)]">{item.value}</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{item.note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={ACCOUNT_SETTINGS_ROUTE as Route}
                        onClick={onClose}
                        className="button-primary"
                      >
                        Open full account settings
                      </Link>
                      <button
                        type="button"
                        onClick={() => onOpenBillingModal("pro")}
                        className="button-secondary"
                      >
                        {canUpgrade ? "Upgrade plan" : "Open plan options"}
                      </button>
                    </div>
                  </section>

                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                      Shortcuts
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        {
                          label: "Subscription",
                          note: "Plan status, renewal, and monthly allowance.",
                          action: () => setActiveSection("subscription"),
                        },
                        {
                          label: "Usage",
                          note: "Spendable balance, daily free, and recent activity.",
                          action: () => setActiveSection("usage"),
                        },
                        {
                          label: "Billing",
                          note: "Recharge, portal access, and checkout notes.",
                          action: () => setActiveSection("billing"),
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.action}
                          className="rounded-[22px] border border-[var(--border)] bg-white/78 px-4 py-4 text-left transition hover:border-[var(--border-strong)]"
                        >
                          <p className="text-base font-semibold text-[var(--foreground)]">{item.label}</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{item.note}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeSection === "subscription" ? (
                <>
                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                          Subscription
                        </p>
                        <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                          {data ? getTierLabel(data.tier) : "Plan"} plan
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                          {data
                            ? `Billing window: ${formatBillingPeriod(data.periodStart, data.periodEnd)}`
                            : "Plan details will load here."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {canUpgrade ? (
                          <button type="button" onClick={() => onOpenBillingModal("pro")} className="button-primary">
                            Upgrade to Pro
                          </button>
                        ) : null}
                        {canManageSubscription ? (
                          <button
                            type="button"
                            onClick={() => void handleOpenPortal()}
                            disabled={portalLoading}
                            className="button-secondary"
                          >
                            {portalLoading ? "Opening portal..." : "Manage subscription"}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => onOpenBillingModal("topup")} className="button-secondary">
                          Buy credits
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                      {[
                        {
                          label: "Spendable now",
                          value: data ? formatNumber(data.walletBalance) : "—",
                          note: "Everything available for the next charged request.",
                        },
                        {
                          label: "Included remaining",
                          value: data ? formatNumber(data.creditBreakdown.includedRemaining) : "—",
                          note: "This is the current billing-cycle plan bucket.",
                        },
                        {
                          label: "Monthly allowance",
                          value: data ? formatNumber(data.creditsLimit) : "—",
                          note: "The denominator for monthly Pro usage.",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4"
                        >
                          <p className="text-xs text-[var(--foreground-tertiary)]">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                            {item.value}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                      Included usage
                    </p>
                    <div className="mt-4 h-4 overflow-hidden rounded-full bg-[rgba(36,29,21,0.08)]">
                      <span
                        className="block h-full rounded-full bg-[linear-gradient(90deg,rgba(97,125,233,0.96),rgba(145,170,255,0.92))]"
                        style={{
                          width: `${Math.max(
                            data && data.creditsLimit > 0
                              ? Math.round((includedUsed / data.creditsLimit) * 100)
                              : 0,
                            data && data.creditsLimit > 0 ? 6 : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--foreground-secondary)]">
                      {data
                        ? `${formatNumber(includedUsed)} / ${formatNumber(data.creditsLimit)} plan credits used this period. Bonus and PAYG stay outside this bar.`
                        : "Usage details will appear here."}
                    </p>
                  </section>
                </>
              ) : null}

              {activeSection === "usage" ? (
                <>
                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                      Usage
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                      Read balance, free searches, and charged activity without guessing
                    </h3>
                    <div className="mt-6 grid gap-3 md:grid-cols-4">
                      {[
                        {
                          label: "Spendable",
                          value: data ? formatNumber(data.walletBalance) : "—",
                          note: "Total usable balance right now.",
                        },
                        {
                          label: "Included",
                          value: data ? formatNumber(data.creditBreakdown.includedRemaining) : "—",
                          note: "Monthly plan bucket remaining.",
                        },
                        {
                          label: "Purchased",
                          value: data ? formatNumber(data.creditBreakdown.paidRemaining) : "—",
                          note: "PAYG credits bought separately.",
                        },
                        {
                          label: "Free today",
                          value: data ? `${formatNumber(data.dailyFreeRemaining)} / ${formatNumber(data.dailyFreeLimit)}` : "—",
                          note: "Requests that still cost 0 credits today.",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4"
                        >
                          <p className="text-xs text-[var(--foreground-tertiary)]">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                            {item.value}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="surface-elevated rounded-[32px] overflow-hidden">
                    <div className="border-b border-[var(--border)] px-6 py-5">
                      <p className="text-lg font-semibold text-[var(--foreground)]">Recent activity</p>
                      <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                        Requests and charged credits during the current billing window.
                      </p>
                    </div>
                    {usageRows.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-[rgba(255,255,255,0.04)] text-[var(--foreground-secondary)]">
                            <tr>
                              <th className="px-6 py-3 font-medium">Date</th>
                              <th className="px-6 py-3 font-medium">Requests</th>
                              <th className="px-6 py-3 font-medium">Charged credits</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageRows.map((row) => (
                              <tr key={row.date} className="border-t border-[var(--border)]">
                                <td className="px-6 py-4 text-[var(--foreground)]">{row.fullLabel}</td>
                                <td className="px-6 py-4 text-[var(--brand-bright)]">{formatNumber(row.requestCount)}</td>
                                <td className="px-6 py-4 text-[var(--foreground-secondary)]">{formatNumber(row.creditsUsed)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-6 py-6 text-sm text-[var(--foreground-secondary)]">
                        No activity yet this billing window.
                      </div>
                    )}
                  </section>

                  {data && data.expiringCredits.length > 0 ? (
                    <section className="surface-elevated rounded-[32px] px-6 py-6">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                        Expiring soon
                      </p>
                      <div className="mt-4 grid gap-3">
                        {data.expiringCredits.map((entry) => (
                          <div
                            key={`${entry.grantType}-${entry.expiresAt}`}
                            className="rounded-[20px] border border-[var(--border)] bg-white/78 px-4 py-4"
                          >
                            <p className="text-base font-semibold text-[var(--foreground)]">
                              {formatNumber(entry.credits)} credits
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                              {entry.grantType.replaceAll("_", " ")} expires on {entry.expiresAt.slice(0, 10)}.
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              {activeSection === "billing" ? (
                <>
                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                          Billing
                        </p>
                        <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                          Keep plan, top-up, and payment behavior in one calm place
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                          Use Pro for a predictable monthly bucket. Use PAYG for overflow or bursty demand. Both stay visible so the wallet total always has a reason.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => onOpenBillingModal("pro")} className="button-primary">
                          {canUpgrade ? "Upgrade to Pro" : "View plan options"}
                        </button>
                        <button type="button" onClick={() => onOpenBillingModal("topup")} className="button-secondary">
                          Buy PAYG credits
                        </button>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                        <p className="text-sm font-medium text-[var(--foreground)]">Recurring subscription</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                          Subscription checkout powers monthly renewal and usually shows only methods compatible with recurring charges.
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                        <p className="text-sm font-medium text-[var(--foreground)]">One-time PAYG checkout</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                          PAYG only adds purchased credits. It does not modify your subscription status or renewal schedule.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="surface-elevated rounded-[32px] px-6 py-6">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        {
                          label: "Spendable now",
                          value: data ? formatNumber(data.walletBalance) : "—",
                          note: "Total credits ready for the next charged request.",
                        },
                        {
                          label: "PAYG bucket",
                          value: data ? formatNumber(data.creditBreakdown.paidRemaining) : "—",
                          note: "Only grows after a successful top-up.",
                        },
                        {
                          label: "Daily free searches",
                          value: data ? `${formatNumber(data.dailyFreeRemaining)} / ${formatNumber(data.dailyFreeLimit)}` : "—",
                          note: "Still deducted before any credits are touched.",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[22px] border border-[var(--border)] bg-white/78 px-4 py-4"
                        >
                          <p className="text-xs text-[var(--foreground-tertiary)]">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                            {item.value}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{item.note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      {canManageSubscription ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenPortal()}
                          disabled={portalLoading}
                          className="button-secondary"
                        >
                          {portalLoading ? "Opening portal..." : "Manage in Stripe portal"}
                        </button>
                      ) : null}
                      <Link
                        href={"/dashboard/settings#buy-credits" as Route}
                        onClick={onClose}
                        className="button-secondary"
                      >
                        Open full billing page
                      </Link>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DashboardOverlayDialog>
  );
}
