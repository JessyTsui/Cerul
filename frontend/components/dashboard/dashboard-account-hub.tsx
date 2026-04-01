"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/auth-shared";
import {
  formatNumber,
  getCreditsPercent,
  getIncludedCreditsUsed,
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-white/45 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
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

type DashboardAccountHubProps = {
  onOpenAccountCenter: (section: DashboardAccountCenterSection) => void;
  onOpenBillingModal: (view: DashboardBillingModalView) => void;
};

export function DashboardAccountHub({
  onOpenAccountCenter,
  onOpenBillingModal,
}: DashboardAccountHubProps) {
  const viewer = useConsoleViewer();
  const { data } = useMonthlyUsage();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const initials = getInitials(viewer.displayName, viewer.email);
  const planLabel = data ? getTierLabel(data.tier) : "Account";
  const planTitle = planLabel === "Enterprise" || planLabel === "Account"
    ? planLabel
    : `${planLabel} Plan`;
  const usageLimit = data?.creditsLimit ?? 0;
  const includedCreditsUsed = data ? getIncludedCreditsUsed(data) : 0;
  const usagePercent = getCreditsPercent(includedCreditsUsed, usageLimit);
  const spendableBalance = data ? formatNumber(data.walletBalance) : "—";
  const freeToday = data ? `${formatNumber(data.dailyFreeRemaining)} / ${formatNumber(data.dailyFreeLimit)}` : "—";
  const purchasedBalance = data ? formatNumber(data.creditBreakdown.paidRemaining) : "—";
  const billingAction = data
    ? resolveDashboardBillingAction(data.tier, data.hasStripeCustomer)
    : null;
  const primaryActionLabel = billingAction === "checkout" || data?.tier.toLowerCase() === "free"
    ? "Upgrade"
    : "Manage";

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handlePrimaryAction() {
    if (billingAction === "checkout" || data?.tier.toLowerCase() === "free") {
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

  const quickActions = [
    {
      key: "profile" as const,
      label: "Account",
      detail: "Profile and common settings",
      action: () => onOpenAccountCenter("profile"),
    },
    {
      key: "usage" as const,
      label: "Usage",
      detail: "Credits and request activity",
      action: () => onOpenAccountCenter("usage"),
    },
    {
      key: "topup" as const,
      label: "Recharge",
      detail: "Buy PAYG credits",
      action: () => onOpenBillingModal("topup"),
    },
  ];

  return (
    <div ref={containerRef} className="mt-auto pt-5">
      <div className="overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(29,29,31,0.98),rgba(22,22,24,0.98))] p-3 text-white shadow-[0_24px_60px_rgba(20,16,12,0.28)]">
        <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Plan</p>
              <h3 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-white">
                {planTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void handlePrimaryAction()}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#2ec8ff] transition hover:bg-white/6 disabled:opacity-60"
            >
              {primaryActionLabel}
            </button>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-white/48">
                {usageLimit > 0 ? "Credits Used" : "Spendable Credits"}
              </p>
              <p className="mt-1 text-sm text-white/78">
                {usageLimit > 0
                  ? `${formatNumber(includedCreditsUsed)} / ${formatNumber(usageLimit)}`
                  : `${spendableBalance} ready`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Free today</p>
              <p className="mt-1 text-sm text-white/76">{freeToday}</p>
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.08]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,rgba(77,189,255,0.98),rgba(124,219,255,0.92))] transition-all"
              style={{ width: `${Math.max(usageLimit > 0 ? usagePercent : 18, 6)}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/52">
            <span>Spendable {spendableBalance}</span>
            <span>PAYG {purchasedBalance}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-3 flex w-full items-center justify-between rounded-[20px] border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.05]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-semibold text-white/92">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {viewer.displayName ?? "Personal"}
              </p>
              <p className="truncate text-xs text-white/48">{viewer.email ?? "Signed in"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">More</span>
            <IconChevron open={open} />
          </div>
        </button>

        {open ? (
          <div className="mt-3 space-y-2">
            {quickActions.map((action) => {
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    action.action();
                  }}
                  className="flex w-full items-center justify-between rounded-[18px] border border-transparent bg-white/[0.03] px-3 py-3 text-left transition hover:border-white/8 hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{action.label}</p>
                    <p className="mt-1 text-xs text-white/45">{action.detail}</p>
                  </div>
                  <IconArrowRight className="h-4 w-4 text-white/40" />
                </button>
              );
            })}
            {signOutError ? (
              <p className="rounded-[16px] border border-[rgba(191,91,70,0.35)] bg-[rgba(191,91,70,0.12)] px-3 py-2 text-xs text-[#ffb2a3]">
                {signOutError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm font-medium text-white/78 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
            >
              <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
              <IconArrowRight className="h-4 w-4 text-white/40" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
