"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  billing,
  getApiErrorMessage,
  type AutoRechargeSettings,
  type BillingCatalog,
} from "@/lib/api";
import {
  formatNumber,
  getTierLabel,
  resolveDashboardBillingAction,
} from "@/lib/dashboard";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardNotice, DashboardSkeleton, DashboardState } from "./dashboard-state";
import { useMonthlyUsage } from "./use-monthly-usage";

const TOPUP_UNIT_PRICE_USD = 0.008;
const QUICK_TOPUP_OPTIONS = [1000, 2500, 5000, 10000] as const;

function normalizeCreditQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1000;
  }
  return Math.max(Math.round(value / 100) * 100, 1000);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M13.5 2.75 6.75 13.5h4.5l-.75 7.75 6.75-10.75h-4.5l.75-7.75Z" fill="currentColor" />
    </svg>
  );
}

function IconCreditCard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M2.25 8.25h19.5M2.25 9h19.5m-1.5 10.5V7.5a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v12a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function IconGift({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5V11.25m18 0A1.5 1.5 0 0 0 21 9.75V8.25A2.25 2.25 0 0 0 18.75 6H18a3 3 0 0 0-3-3c-.86 0-1.637.366-2.182.952A3.001 3.001 0 0 0 10.5 3 3 3 0 0 0 7.5 6h-.75A2.25 2.25 0 0 0 4.5 8.25v1.5A1.5 1.5 0 0 0 6 11.25m15 0H6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

export function DashboardBillingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, error, isLoading, refresh } = useMonthlyUsage();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [billingAction, setBillingAction] = useState<"checkout" | "portal" | "topup" | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [topupQuantity, setTopupQuantity] = useState(1000);
  const [isCreatingTopup, setIsCreatingTopup] = useState(false);
  const [autoRecharge, setAutoRecharge] = useState<AutoRechargeSettings>({
    enabled: false,
    threshold: 100,
    quantity: 1000,
  });
  const [autoRechargeError, setAutoRechargeError] = useState<string | null>(null);
  const [autoRechargeSuccess, setAutoRechargeSuccess] = useState<string | null>(null);
  const [isAutoRechargeLoading, setIsAutoRechargeLoading] = useState(false);
  const [isSavingAutoRecharge, setIsSavingAutoRecharge] = useState(false);

  const availableBillingAction = data
    ? resolveDashboardBillingAction(data.tier, data.hasStripeCustomer)
    : null;
  const canUpgrade = availableBillingAction === "checkout";
  const canManageSubscription = availableBillingAction === "portal";
  const usesManualBilling = data !== null && availableBillingAction === null && data.tier.toLowerCase() !== "free";
  const normalizedTopupQuantity = normalizeCreditQuantity(topupQuantity);
  const topupPrice = normalizedTopupQuantity * TOPUP_UNIT_PRICE_USD;
  const projectedPurchasedBalance = (data?.creditBreakdown.paidRemaining ?? 0) + normalizedTopupQuantity;
  const projectedSpendableBalance = (data?.walletBalance ?? 0) + normalizedTopupQuantity;

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
    void loadCatalog();
  }, []);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const checkoutSessionId = searchParams.get("session_id");

    if (checkoutState !== "success") {
      return;
    }

    const clearCheckoutParams = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("checkout");
      nextUrl.searchParams.delete("session_id");
      nextUrl.searchParams.delete("type");
      const query = nextUrl.searchParams.toString();
      window.history.replaceState({}, "", `${nextUrl.pathname}${query ? `?${query}` : ""}`);
    };

    if (!checkoutSessionId) {
      setCheckoutNotice("Payment completed. Refresh the page in a moment if your wallet does not update immediately.");
      clearCheckoutParams();
      return;
    }

    let cancelled = false;
    void billing.reconcileCheckout(checkoutSessionId)
      .then(async (result) => {
        if (cancelled) {
          return;
        }
        await Promise.all([refresh(), loadCatalog()]);
        setCheckoutNotice(
          result.mode === "payment"
            ? `Credits added successfully${result.creditsGranted > 0 ? `: ${formatNumber(result.creditsGranted)} credits.` : "."}`
            : "Billing synced successfully.",
        );
        clearCheckoutParams();
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setCheckoutNotice(getApiErrorMessage(nextError, "Payment completed, but settings still need a manual refresh."));
      });

    return () => {
      cancelled = true;
    };
  }, [refresh, searchParams]);

  useEffect(() => {
    if (!data?.hasStripeCustomer) {
      setAutoRecharge({
        enabled: false,
        threshold: 100,
        quantity: 1000,
      });
      setAutoRechargeError(null);
      setAutoRechargeSuccess(null);
      setIsAutoRechargeLoading(false);
      return;
    }

    let cancelled = false;
    setIsAutoRechargeLoading(true);
    setAutoRechargeError(null);
    void billing.getAutoRecharge()
      .then((settings) => {
        if (!cancelled) {
          setAutoRecharge(settings);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setAutoRechargeError(getApiErrorMessage(nextError, "Failed to load auto-recharge settings."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAutoRechargeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data?.hasStripeCustomer]);

  async function handleCheckout() {
    setBillingAction("checkout");
    setBillingError(null);
    try {
      const redirect = await billing.createCheckout();
      window.location.assign(redirect.url);
    } catch (nextError) {
      setBillingError(getApiErrorMessage(nextError, "Failed to start checkout."));
      setBillingAction(null);
    }
  }

  async function handlePortal() {
    setBillingAction("portal");
    setBillingError(null);
    try {
      const redirect = await billing.createPortal();
      window.location.assign(redirect.url);
    } catch (nextError) {
      setBillingError(getApiErrorMessage(nextError, "Failed to open billing portal."));
      setBillingAction(null);
    }
  }

  async function handleTopup() {
    setIsCreatingTopup(true);
    setBillingError(null);
    try {
      const redirect = await billing.createTopup(normalizeCreditQuantity(topupQuantity));
      window.location.assign(redirect.url);
    } catch (nextError) {
      setBillingError(getApiErrorMessage(nextError, "Failed to start the credit purchase."));
      setIsCreatingTopup(false);
    }
  }

  async function handleSaveAutoRecharge() {
    setIsSavingAutoRecharge(true);
    setAutoRechargeError(null);
    setAutoRechargeSuccess(null);
    try {
      const nextSettings = await billing.updateAutoRecharge({
        enabled: autoRecharge.enabled,
        threshold: Math.max(Math.round(autoRecharge.threshold), 0),
        quantity: normalizeCreditQuantity(autoRecharge.quantity),
      });
      setAutoRecharge(nextSettings);
      setAutoRechargeSuccess("Auto-recharge settings saved.");
    } catch (nextError) {
      setAutoRechargeError(getApiErrorMessage(nextError, "Failed to save auto-recharge settings."));
    } finally {
      setIsSavingAutoRecharge(false);
    }
  }

  if (isLoading && !data) {
    return (
      <DashboardLayout
        currentPath="/dashboard/billing"
        title="Billing"
        description="Manage credits, subscriptions, and payments."
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (error && !data) {
    return (
      <DashboardLayout
        currentPath="/dashboard/billing"
        title="Billing"
        description="Manage credits, subscriptions, and payments."
      >
        <DashboardState
          title="Billing data could not be loaded"
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
        currentPath="/dashboard/billing"
        title="Billing"
        description="Manage credits, subscriptions, and payments."
      >
        <DashboardState title="No billing data available" description="The dashboard API returned no billing payload." />
      </DashboardLayout>
    );
  }

  const remainingCredits = data.walletBalance;

  return (
    <DashboardLayout
      currentPath="/dashboard/billing"
      title="Billing"
      description={`${getTierLabel(data.tier)} plan · Manage credits and subscription`}
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
      {billingError && (
        <DashboardNotice title="Billing action failed" description={billingError} tone="error" />
      )}
      {checkoutNotice && (
        <DashboardNotice title="Billing updated" description={checkoutNotice} tone="success" />
      )}
      {catalogError && (
        <DashboardNotice title="Catalog load failed" description={catalogError} tone="error" />
      )}

      {/* Credit Balance Overview */}
      <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
          Available Credits
        </p>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {formatNumber(remainingCredits)}
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
              Credits available for your next search
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canUpgrade ? (
              <button
                className="button-primary"
                disabled={billingAction !== null || data.billingHold}
                onClick={() => void handleCheckout()}
                type="button"
              >
                {billingAction === "checkout" ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            ) : null}
            {canManageSubscription ? (
              <button
                className="button-secondary"
                disabled={billingAction !== null}
                onClick={() => void handlePortal()}
                type="button"
              >
                {billingAction === "portal" ? "Opening portal..." : "Manage subscription"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Credit breakdown */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
            <div className="flex items-center gap-2">
              <IconBolt className="h-4 w-4 text-[var(--brand)]" />
              <p className="text-xs text-[var(--foreground-tertiary)]">Included</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatNumber(data.creditBreakdown.includedRemaining)}
            </p>
            <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
              Monthly plan credits
            </p>
          </div>

          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
            <div className="flex items-center gap-2">
              <IconCreditCard className="h-4 w-4 text-[var(--accent)]" />
              <p className="text-xs text-[var(--foreground-tertiary)]">Purchased</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatNumber(data.creditBreakdown.paidRemaining)}
            </p>
            <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
              PAYG top-up credits
            </p>
          </div>

          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
            <div className="flex items-center gap-2">
              <IconGift className="h-4 w-4 text-[var(--success)]" />
              <p className="text-xs text-[var(--foreground-tertiary)]">Bonus</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatNumber(data.creditBreakdown.bonusRemaining)}
            </p>
            <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
              Referral & promo credits
            </p>
          </div>

          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
            <div className="flex items-center gap-2">
              <IconBolt className="h-4 w-4 text-[var(--foreground-tertiary)]" />
              <p className="text-xs text-[var(--foreground-tertiary)]">Free today</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatNumber(data.dailyFreeRemaining)}
            </p>
            <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
              / {formatNumber(data.dailyFreeLimit)} daily free
            </p>
          </div>
        </div>

        {/* Spend order explanation */}
        <div className="mt-5 rounded-[20px] border border-[var(--border)] bg-white/72 px-4 py-4">
          <p className="text-sm text-[var(--foreground-secondary)]">
            <span className="font-medium text-[var(--foreground)]">How credits are used:</span>{" "}
            Free searches first, then Bonus credits, then Included monthly credits, then Purchased credits.
          </p>
        </div>

        {data.billingHold ? (
          <div className="mt-5 rounded-[20px] border border-[rgba(191,91,70,0.2)] bg-[rgba(191,91,70,0.08)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--error)]">
              Billing hold
            </p>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              Payments or credits need manual review before more self-serve checkout is allowed.
            </p>
          </div>
        ) : null}
      </article>

      {/* Buy Credits */}
      <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6" id="buy-credits">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
          Buy Credits
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
          Top up anytime
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
          Minimum 1,000 credits, adjustable in steps of 100. Credits never expire.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--background-elevated)] px-5 py-5">
            <label className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]" htmlFor="topup-quantity">
              Credits to buy
            </label>
            <input
              id="topup-quantity"
              type="number"
              min={1000}
              step={100}
              value={topupQuantity}
              onChange={(event) => setTopupQuantity(Number.parseInt(event.target.value || "1000", 10) || 1000)}
              className="mt-3 h-12 w-full rounded-[18px] border border-[var(--border)] bg-white/82 px-4 text-lg text-[var(--foreground)] outline-none transition focus:border-[var(--border-brand)]"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_TOPUP_OPTIONS.map((option) => {
                const active = normalizedTopupQuantity === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTopupQuantity(option)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-[var(--border-brand)] bg-[var(--brand-subtle)] text-[var(--brand-bright)]"
                        : "border-[var(--border)] bg-white/70 text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {formatNumber(option)}
                  </button>
                );
              })}
            </div>
            <p className="mt-5 text-sm text-[var(--foreground-secondary)]">
              {formatNumber(normalizedTopupQuantity)} credits · {formatUsd(topupPrice)}
            </p>
            <button
              className="button-primary mt-5 w-full"
              disabled={isCreatingTopup || data.billingHold}
              onClick={() => void handleTopup()}
              type="button"
            >
              {isCreatingTopup ? "Redirecting..." : "Buy credits"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                label: "Current purchased",
                value: formatNumber(data.creditBreakdown.paidRemaining),
                note: "PAYG credits already in wallet",
              },
              {
                label: "After checkout",
                value: formatNumber(projectedPurchasedBalance),
                note: "PAYG bucket after this order",
              },
              {
                label: "Total after",
                value: formatNumber(projectedSpendableBalance),
                note: "All credits available",
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
        </div>
      </article>

      {/* Plan & Subscription */}
      <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
          Plan & Subscription
        </p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              {getTierLabel(data.tier)} plan
            </h2>
            {data.tier.toLowerCase() === "pro" && (
              <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                5,000 included credits per month
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {canUpgrade ? (
              <button
                className="button-primary"
                disabled={billingAction !== null || data.billingHold}
                onClick={() => void handleCheckout()}
                type="button"
              >
                {billingAction === "checkout" ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            ) : null}
            {canManageSubscription ? (
              <button
                className="button-secondary"
                disabled={billingAction !== null}
                onClick={() => void handlePortal()}
                type="button"
              >
                {billingAction === "portal" ? "Opening portal..." : "Manage subscription"}
              </button>
            ) : null}
            {usesManualBilling ? (
              <div className="rounded-[20px] border border-[var(--border-brand)] bg-[var(--brand-subtle)] px-4 py-3">
                <p className="text-sm text-[var(--foreground)]">
                  Managed billing. Contact Cerul for changes.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {/* Auto-recharge */}
      {data.hasStripeCustomer ? (
        <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            Auto-recharge
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
            Refill before balance runs low
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
            When enabled, Cerul charges your saved payment method off-session once the wallet drops below your threshold.
          </p>

          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Enable auto-recharge</p>
                <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
                  Uses your saved Stripe payment method.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoRecharge.enabled}
                disabled={isAutoRechargeLoading}
                onChange={(event) => setAutoRecharge((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))}
                className="h-5 w-5 accent-[var(--brand)]"
              />
            </label>

            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
              <label className="text-xs text-[var(--foreground-tertiary)]" htmlFor="auto-recharge-threshold">
                Recharge when balance drops below
              </label>
              <input
                id="auto-recharge-threshold"
                type="number"
                min={0}
                step={1}
                value={autoRecharge.threshold}
                disabled={isAutoRechargeLoading}
                onChange={(event) => setAutoRecharge((current) => ({
                  ...current,
                  threshold: Number.parseInt(event.target.value || "0", 10) || 0,
                }))}
                className="mt-2 h-12 w-full rounded-[16px] border border-[var(--border)] bg-white/78 px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--border-brand)]"
              />
            </div>

            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
              <label className="text-xs text-[var(--foreground-tertiary)]" htmlFor="auto-recharge-quantity">
                Add credits each time
              </label>
              <input
                id="auto-recharge-quantity"
                type="number"
                min={1000}
                step={100}
                value={autoRecharge.quantity}
                disabled={isAutoRechargeLoading}
                onChange={(event) => setAutoRecharge((current) => ({
                  ...current,
                  quantity: Number.parseInt(event.target.value || "1000", 10) || 1000,
                }))}
                className="mt-2 h-12 w-full rounded-[16px] border border-[var(--border)] bg-white/78 px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--border-brand)]"
              />
            </div>
          </div>

          {autoRechargeError ? (
            <div className="mt-4 rounded-[16px] border border-[rgba(191,91,70,0.2)] bg-[rgba(191,91,70,0.08)] px-4 py-3 text-sm text-[var(--error)]">
              {autoRechargeError}
            </div>
          ) : null}
          {autoRechargeSuccess ? (
            <div className="mt-4 rounded-[16px] border border-[rgba(62,118,100,0.2)] bg-[rgba(62,118,100,0.08)] px-4 py-3 text-sm text-[var(--success)]">
              {autoRechargeSuccess}
            </div>
          ) : null}

          <button
            className="button-secondary mt-5"
            disabled={isAutoRechargeLoading || isSavingAutoRecharge}
            onClick={() => void handleSaveAutoRecharge()}
            type="button"
          >
            {isSavingAutoRecharge ? "Saving..." : "Save auto-recharge settings"}
          </button>
        </article>
      ) : null}

      {/* Expiring Credits */}
      {data.expiringCredits.length > 0 ? (
        <article className="surface-elevated dashboard-card rounded-[32px] px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            Expiring Soon
          </p>
          <div className="mt-4 space-y-2">
            {data.expiringCredits.map((entry) => (
              <p key={`${entry.grantType}-${entry.expiresAt}`} className="text-sm leading-6 text-[var(--foreground-secondary)]">
                {formatNumber(entry.credits)} {entry.grantType.replaceAll("_", " ")} credits expire on {entry.expiresAt.slice(0, 10)}
              </p>
            ))}
          </div>
        </article>
      ) : null}
    </DashboardLayout>
  );
}
