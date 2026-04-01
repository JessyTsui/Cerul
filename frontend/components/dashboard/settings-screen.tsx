"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  billing,
  getApiErrorMessage,
  type BillingCatalog,
} from "@/lib/api";
import { useConsoleViewer } from "@/components/console/console-viewer-context";
import { formatNumber } from "@/lib/dashboard";
import { AccountProfilePanel } from "./account-profile-panel";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardNotice, DashboardSkeleton, DashboardState } from "./dashboard-state";
import { useMonthlyUsage } from "./use-monthly-usage";

type BootstrapAdminStatus =
  | "loading"
  | "available"
  | "already_admin"
  | "disabled"
  | "managed_by_emails"
  | "admin_exists"
  | "unavailable";

export function DashboardSettingsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewer = useConsoleViewer();
  const { data, error, isLoading, refresh } = useMonthlyUsage();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [referralInput, setReferralInput] = useState("");
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState<string | null>(null);
  const [isRedeemingReferral, setIsRedeemingReferral] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapAdminStatus>(
    () => (viewer.isAdmin ? "already_admin" : "loading"),
  );

  async function loadCatalog() {
    setCatalogError(null);
    try {
      const nextCatalog = await billing.getCatalog();
      setCatalog(nextCatalog);
    } catch (nextError) {
      setCatalogError(getApiErrorMessage(nextError, "Failed to load billing catalog."));
    }
  }

  useEffect(() => {
    if (viewer.isAdmin) {
      setBootstrapStatus("already_admin");
      return;
    }
    let cancelled = false;
    void fetch("/api/console/bootstrap-admin/status", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setBootstrapStatus("unavailable");
          return;
        }
        const payload = await res.json() as { eligible?: boolean; reason?: BootstrapAdminStatus };
        setBootstrapStatus(payload.eligible === true ? "available" : (payload.reason ?? "unavailable"));
      })
      .catch(() => {
        if (!cancelled) setBootstrapStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [viewer.isAdmin]);

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function handleRedeemReferral() {
    const trimmedCode = referralInput.trim();
    if (!trimmedCode) {
      setReferralError("Referral code is required.");
      return;
    }

    setIsRedeemingReferral(true);
    setReferralError(null);
    setReferralSuccess(null);
    try {
      const referral = await billing.redeemReferral(trimmedCode);
      setReferralSuccess(`Referral code applied. Status: ${referral.status ?? "pending"}.`);
      setReferralInput("");
      await loadCatalog();
    } catch (nextError) {
      setReferralError(getApiErrorMessage(nextError, "Failed to redeem referral code."));
    } finally {
      setIsRedeemingReferral(false);
    }
  }

  async function handleBootstrapAdmin() {
    const trimmedSecret = bootstrapSecret.trim();
    if (!trimmedSecret) {
      setBootstrapError("Bootstrap admin secret is required.");
      return;
    }
    setIsPromotingAdmin(true);
    setBootstrapError(null);
    try {
      const response = await fetch("/api/console/bootstrap-admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: trimmedSecret }),
      });
      const payload = await response.json().catch(() => null) as { detail?: string } | null;
      if (!response.ok) {
        setBootstrapError(payload?.detail ?? "Unable to promote this account.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setBootstrapError("Unable to promote this account.");
    } finally {
      setIsPromotingAdmin(false);
    }
  }

  const bootstrapPanel =
    !viewer.isAdmin && bootstrapStatus === "available" ? (
      <article className="surface-elevated rounded-[30px] px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--brand-bright)]">
              Bootstrap admin
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
              Promote this account to administrator
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground-secondary)]">
              Enter the <span className="font-mono text-[var(--foreground)]">BOOTSTRAP_ADMIN_SECRET</span>{" "}
              from your environment to elevate this account.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border-brand)] bg-[var(--brand-subtle)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--brand-bright)]">
            No admin yet
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            type="password"
            value={bootstrapSecret}
            onChange={(e) => setBootstrapSecret(e.target.value)}
            placeholder="Bootstrap secret"
            className="h-12 w-full rounded-[16px] border border-[var(--border)] bg-white/78 px-4 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--border-brand)] sm:max-w-xs"
            autoComplete="off"
          />
          <button
            className="button-primary shrink-0"
            type="button"
            disabled={isPromotingAdmin}
            onClick={() => void handleBootstrapAdmin()}
          >
            {isPromotingAdmin ? "Promoting..." : "Promote account"}
          </button>
        </div>
        {bootstrapError ? (
          <div className="mt-3 rounded-[16px] border border-[rgba(191,91,70,0.2)] bg-[rgba(191,91,70,0.08)] px-4 py-3 text-sm text-[var(--error)]">
            {bootstrapError}
          </div>
        ) : null}
      </article>
    ) : null;

  return (
    <DashboardLayout
      currentPath="/dashboard/settings"
      title="Settings"
      description="Account profile and API keys management."
      actions={
        <Link className="button-secondary" href={"/dashboard/usage" as Route}>
          Usage & billing
        </Link>
      }
    >
      {isLoading && !data ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <DashboardState
          title="Plan data could not be loaded"
          description={error}
          tone="error"
          action={
            <button className="button-primary" onClick={() => void refresh()} type="button">
              Retry
            </button>
          }
        />
      ) : data ? (
        <>
          {error ? (
            <DashboardNotice
              title="Showing last successful snapshot."
              description={error}
              tone="error"
            />
          ) : null}

          <AccountProfilePanel />

          {/* Referral Section */}
          <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
              Referral
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
              Share credits, not spreadsheets.
            </h2>
            <div className="mt-5 rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
              <p className="text-xs text-[var(--foreground-tertiary)]">Your code</p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.08em] text-[var(--foreground)]">
                {catalog?.referral.code || "—"}
              </p>
              <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                Both sides get {formatNumber(catalog?.referral.bonusCredits ?? 0)} bonus credits after the first paid order clears for {catalog?.referral.rewardDelayDays ?? 0} days.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={referralInput}
                onChange={(event) => setReferralInput(event.target.value)}
                placeholder="Enter a referral code"
                className="h-12 w-full rounded-[16px] border border-[var(--border)] bg-white/78 px-4 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--border-brand)]"
              />
              <button
                className="button-secondary shrink-0"
                disabled={isRedeemingReferral || Boolean(catalog?.referral.redeemedCode)}
                onClick={() => void handleRedeemReferral()}
                type="button"
              >
                {isRedeemingReferral ? "Redeeming..." : "Redeem"}
              </button>
            </div>
            {catalog?.referral.redeemedCode ? (
              <p className="mt-3 text-sm text-[var(--foreground-secondary)]">
                Redeemed code: <span className="font-mono text-[var(--foreground)]">{catalog.referral.redeemedCode}</span>
                {catalog.referral.status ? ` · ${catalog.referral.status}` : ""}
              </p>
            ) : null}
            {referralError ? (
              <div className="mt-3 rounded-[16px] border border-[rgba(191,91,70,0.2)] bg-[rgba(191,91,70,0.08)] px-4 py-3 text-sm text-[var(--error)]">
                {referralError}
              </div>
            ) : null}
            {referralSuccess ? (
              <div className="mt-3 rounded-[16px] border border-[rgba(62,118,100,0.2)] bg-[rgba(62,118,100,0.08)] px-4 py-3 text-sm text-[var(--success)]">
                {referralSuccess}
              </div>
            ) : null}
          </article>

          {bootstrapPanel}
        </>
      ) : (
        <DashboardState
          title="No plan data available"
          description="The dashboard API returned no plan payload."
          action={
            <button className="button-primary" onClick={() => void refresh()} type="button">
              Retry
            </button>
          }
        />
      )}
    </DashboardLayout>
  );
}
