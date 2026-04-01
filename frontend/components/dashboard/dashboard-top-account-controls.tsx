"use client";

import type { Route } from "next";
import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/auth-shared";
import {
  formatNumber,
  getTierLabel,
  resolveDashboardBillingAction,
} from "@/lib/dashboard";
import { useConsoleViewer } from "@/components/console/console-viewer-context";
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

function IconBolt() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M13.5 2.75 6.75 13.5h4.5l-.75 7.75 6.75-10.75h-4.5l.75-7.75Z" fill="currentColor" />
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

type DashboardTopAccountControlsProps = {
  onOpenAccountCenter: (section: DashboardAccountCenterSection) => void;
  onOpenBillingModal: (view: DashboardBillingModalView) => void;
};

export function DashboardTopAccountControls({
  onOpenAccountCenter,
  onOpenBillingModal,
}: DashboardTopAccountControlsProps) {
  const viewer = useConsoleViewer();
  const { data } = useMonthlyUsage();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [openMenu, setOpenMenu] = useState<"wallet" | "account" | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const initials = getInitials(viewer.displayName, viewer.email);
  const planLabel = data ? getTierLabel(data.tier) : "Account";
  const billingAction = data
    ? resolveDashboardBillingAction(data.tier, data.hasStripeCustomer)
    : null;
  const triggerLabel = data?.tier.toLowerCase() === "free" ? "Upgrade" : planLabel;
  const primaryActionLabel =
    data?.tier.toLowerCase() === "free" || billingAction === "checkout"
      ? "Upgrade"
      : "Manage";

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function clearCloseTimer() {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openPanel(panel: "wallet" | "account") {
    clearCloseTimer();
    setOpenMenu(panel);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpenMenu(null);
      closeTimeoutRef.current = null;
    }, 140);
  }

  function togglePanel(panel: "wallet" | "account") {
    clearCloseTimer();
    setOpenMenu((current) => (current === panel ? null : panel));
  }

  function handlePrimaryBillingAction() {
    setOpenMenu(null);

    if (data?.tier.toLowerCase() === "free" || billingAction === "checkout") {
      onOpenBillingModal("pro");
      return;
    }

    onOpenAccountCenter("subscription");
  }

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError(getAuthErrorMessage(result.error, "Unable to sign out right now."));
        return;
      }

      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    } catch (error) {
      setSignOutError(getAuthErrorMessage(error, "Unable to sign out right now."));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div ref={containerRef} className="relative z-[110] flex items-center gap-3">
      <div
        className="relative"
        onMouseEnter={() => openPanel("wallet")}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          onClick={() => togglePanel("wallet")}
          className="inline-flex h-11 items-center overflow-hidden rounded-full border border-[rgba(31,26,21,0.08)] bg-[linear-gradient(180deg,rgba(31,28,24,0.98),rgba(20,18,16,0.98))] text-white shadow-[0_16px_42px_rgba(22,17,13,0.14)]"
        >
          <span className="px-4 text-sm font-semibold">{triggerLabel}</span>
          <span className="mr-1 flex h-[34px] items-center gap-1.5 rounded-full bg-white/[0.08] px-3 text-sm font-semibold text-white/92">
            <IconBolt />
            <span>{data ? formatNumber(data.walletBalance) : "—"}</span>
          </span>
        </button>

        {openMenu === "wallet" ? (
          <div
            className="absolute right-0 top-full z-[140] mt-3 w-[360px] rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,247,0.98)] p-4 shadow-[0_24px_70px_rgba(27,20,13,0.14)]"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="rounded-[24px] border border-[var(--border)] bg-white/88 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{planLabel} plan</p>
                  <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                    {data ? `${formatNumber(data.walletBalance)} credits spendable now` : "Wallet status will load here."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrimaryBillingAction}
                  className="rounded-full bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--foreground-secondary)]"
                >
                  {primaryActionLabel}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Included",
                    value: data ? formatNumber(data.creditBreakdown.includedRemaining) : "—",
                  },
                  {
                    label: "Purchased",
                    value: data ? formatNumber(data.creditBreakdown.paidRemaining) : "—",
                  },
                  {
                    label: "Bonus",
                    value: data ? formatNumber(data.creditBreakdown.bonusRemaining) : "—",
                  },
                  {
                    label: "Free today",
                    value: data ? `${formatNumber(data.dailyFreeRemaining)} / ${formatNumber(data.dailyFreeLimit)}` : "—",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[18px] border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenAccountCenter("usage");
                }}
                className="button-secondary flex-1"
              >
                Usage details
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenBillingModal("topup");
                }}
                className="button-primary flex-1"
              >
                Buy credits
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="relative"
        onMouseEnter={() => openPanel("account")}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          onClick={() => togglePanel("account")}
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-white/88 shadow-[0_12px_30px_rgba(49,36,22,0.08)] transition hover:border-[var(--border-strong)]"
        >
          {viewer.image ? (
            // Avatar hosts come from auth providers, so we intentionally avoid a global next/image allowlist here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewer.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-[var(--foreground-secondary)]">{initials}</span>
          )}
        </button>

        {openMenu === "account" ? (
          <div
            className="absolute right-0 top-full z-[140] mt-3 w-[340px] rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,247,0.98)] p-4 shadow-[0_24px_70px_rgba(27,20,13,0.14)]"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="rounded-[24px] border border-[var(--border)] bg-white/88 p-4">
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-[var(--foreground)]">
                    {viewer.displayName ?? "Personal"}
                  </p>
                  <p className="truncate text-sm text-[var(--foreground-secondary)]">{viewer.email ?? ""}</p>
                </div>
                <button
                  type="button"
                  onClick={handlePrimaryBillingAction}
                  className="rounded-[16px] bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--foreground-secondary)]"
                >
                  {primaryActionLabel}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenAccountCenter("usage");
                }}
                className="mt-4 flex w-full items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-3 text-left transition hover:border-[var(--border-strong)]"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Credits</p>
                  <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{data ? formatNumber(data.walletBalance) : "—"}</p>
                </div>
                <IconArrowRight className="h-4 w-4 text-[var(--foreground-tertiary)]" />
              </button>
            </div>

            <div className="mt-3 space-y-1">
              {[
                {
                  label: "Account center",
                  action: () => onOpenAccountCenter("profile"),
                },
                {
                  label: "Subscription",
                  action: () => onOpenAccountCenter("subscription"),
                },
                {
                  label: "Usage",
                  action: () => onOpenAccountCenter("usage"),
                },
                {
                  label: "Recharge",
                  action: () => onOpenBillingModal("topup"),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    item.action();
                  }}
                  className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left text-sm text-[var(--foreground-secondary)] transition hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
                >
                  <span>{item.label}</span>
                  <IconArrowRight className="h-4 w-4 text-[var(--foreground-tertiary)]" />
                </button>
              ))}
              <Link
                href={"/docs" as Route}
                onClick={() => setOpenMenu(null)}
                className="flex items-center justify-between rounded-[18px] px-3 py-3 text-sm text-[var(--foreground-secondary)] transition hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
              >
                <span>Docs</span>
                <IconArrowRight className="h-4 w-4 text-[var(--foreground-tertiary)]" />
              </Link>
            </div>

            {signOutError ? (
              <p className="mt-3 rounded-[16px] border border-[rgba(191,91,70,0.22)] bg-[rgba(191,91,70,0.08)] px-3 py-2 text-xs text-[var(--error)]">
                {signOutError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              className="mt-3 flex w-full items-center justify-between rounded-[18px] border border-[var(--border)] bg-white/84 px-3 py-3 text-sm font-medium text-[var(--foreground-secondary)] transition hover:text-[var(--foreground)] disabled:opacity-60"
            >
              <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
              <IconArrowRight className="h-4 w-4 text-[var(--foreground-tertiary)]" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
