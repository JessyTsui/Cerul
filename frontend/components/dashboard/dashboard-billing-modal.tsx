"use client";

import { useState } from "react";
import { billing, getApiErrorMessage } from "@/lib/api";
import {
  formatBillingPeriod,
  formatNumber,
  getTierLabel,
  resolveDashboardBillingAction,
} from "@/lib/dashboard";
import { DashboardOverlayDialog } from "./dashboard-overlay-dialog";
import type {
  DashboardAccountCenterSection,
  DashboardBillingModalView,
} from "./dashboard-shell-controls";
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
      <path
        d="M13.5 2.75 6.75 13.5h4.5l-.75 7.75 6.75-10.75h-4.5l.75-7.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  );
}

type DashboardBillingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialView: DashboardBillingModalView;
  onOpenAccountCenter: (section: DashboardAccountCenterSection) => void;
};

export function DashboardBillingModal({
  isOpen,
  onClose,
  initialView,
  onOpenAccountCenter,
}: DashboardBillingModalProps) {
  const { data, error, isLoading, refresh } = useMonthlyUsage();
  const [activeView, setActiveView] = useState<DashboardBillingModalView>(initialView);
  const [billingAction, setBillingAction] = useState<"checkout" | "portal" | "topup" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [topupQuantity, setTopupQuantity] = useState(1000);

  const normalizedTopupQuantity = normalizeCreditQuantity(topupQuantity);
  const topupPrice = normalizedTopupQuantity * TOPUP_UNIT_PRICE_USD;
  const billingActionType = data
    ? resolveDashboardBillingAction(data.tier, data.hasStripeCustomer)
    : null;
  const canUpgrade = billingActionType === "checkout";
  const canManageSubscription = billingActionType === "portal";
  const usesManualBilling = data !== null && billingActionType === null && data.tier.toLowerCase() !== "free";
  const projectedPurchasedBalance = (data?.creditBreakdown.paidRemaining ?? 0) + normalizedTopupQuantity;
  const projectedSpendableBalance = (data?.walletBalance ?? 0) + normalizedTopupQuantity;

  async function handleCheckout() {
    setBillingAction("checkout");
    setActionError(null);

    try {
      const redirect = await billing.createCheckout();
      window.location.assign(redirect.url);
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError, "Failed to start checkout."));
      setBillingAction(null);
    }
  }

  async function handlePortal() {
    setBillingAction("portal");
    setActionError(null);

    try {
      const redirect = await billing.createPortal();
      window.location.assign(redirect.url);
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError, "Failed to open billing portal."));
      setBillingAction(null);
    }
  }

  async function handleTopup() {
    setBillingAction("topup");
    setActionError(null);

    try {
      const redirect = await billing.createTopup(normalizedTopupQuantity);
      window.location.assign(redirect.url);
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError, "Failed to start the credit purchase."));
      setBillingAction(null);
    }
  }

  return (
    <DashboardOverlayDialog isOpen={isOpen} onClose={onClose} labelledBy="dashboard-billing-modal-title">
      <div className="grid max-h-[calc(100vh-3rem)] min-h-[620px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,20,17,0.98),rgba(34,30,27,0.96))] p-6 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Billing</p>
              <h2
                id="dashboard-billing-modal-title"
                className="mt-3 text-[2.2rem] font-semibold tracking-[-0.06em]"
              >
                Upgrade or top up without leaving the console
              </h2>
            </div>
            <button
              aria-label="Close billing modal"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/68 transition hover:bg-white/[0.08] hover:text-white"
              onClick={onClose}
              type="button"
            >
              <IconClose />
            </button>
          </div>

          <div className="mt-8 space-y-3">
            {[
              {
                id: "pro" as const,
                eyebrow: "Subscription",
                title: "Pro monthly",
                detail: "5,000 included credits every month and higher rate limits.",
              },
              {
                id: "topup" as const,
                eyebrow: "PAYG",
                title: "Buy credits on demand",
                detail: "One-time purchases in 100-credit steps, starting at 1,000 credits.",
              },
            ].map((item) => {
              const active = item.id === activeView;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                    active
                      ? "border-white/16 bg-white/[0.09]"
                      : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">{item.eyebrow}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">{item.detail}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Current wallet</p>
            <p className="mt-3 flex items-center gap-2 text-4xl font-semibold tracking-[-0.05em]">
              <IconBolt className="h-7 w-7 text-[#ffca65]" />
              <span>{data ? formatNumber(data.walletBalance) : "—"}</span>
            </p>
            <div className="mt-5 space-y-3 text-sm text-white/62">
              <p>{data ? `${formatNumber(data.creditBreakdown.includedRemaining)} included credits left` : "Included bucket will load here."}</p>
              <p>{data ? `${formatNumber(data.creditBreakdown.paidRemaining)} PAYG credits already in wallet` : "Purchased bucket will load here."}</p>
              <p>{data ? `${formatNumber(data.dailyFreeRemaining)} / ${formatNumber(data.dailyFreeLimit)} free searches left today` : "Daily free allowance will load here."}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAccountCenter("usage");
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.06] hover:text-white"
            >
              Open account center
            </button>
          </div>
        </aside>

        <div className="overflow-y-auto p-6 lg:p-8">
          {isLoading && !data ? (
            <div className="surface-elevated rounded-[30px] px-6 py-6">
              <p className="text-sm text-[var(--foreground-secondary)]">Loading billing options…</p>
            </div>
          ) : error && !data ? (
            <div className="surface-elevated rounded-[30px] px-6 py-6">
              <p className="text-lg font-semibold text-[var(--foreground)]">Billing data could not be loaded</p>
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

              {activeView === "pro" ? (
                <>
                  <article className="surface-elevated rounded-[32px] px-6 py-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                          Subscription
                        </p>
                        <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                          {data ? `${getTierLabel(data.tier)} today, Pro when you upgrade.` : "Pro monthly"}
                        </h3>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground-secondary)]">
                          Pro is the cleanest default if you want a predictable monthly allowance and a
                          dedicated place to manage renewal, payment method, and top-up.
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-[var(--border)] bg-white/78 px-5 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                          Current cycle
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                          {data ? formatBillingPeriod(data.periodStart, data.periodEnd) : "—"}
                        </p>
                        <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                          {data ? `${formatNumber(data.creditBreakdown.includedRemaining)} included credits still available` : "Included credits will appear here."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          label: "Included each month",
                          value: "5,000",
                          note: "Dedicated monthly bucket that resets with renewal.",
                        },
                        {
                          label: "Top up when needed",
                          value: "$8 / 1K",
                          note: "PAYG remains available without changing your plan.",
                        },
                        {
                          label: "Rate posture",
                          value: "Higher",
                          note: "A better default for regular product or agent workloads.",
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

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      {canUpgrade ? (
                        <button
                          className="button-primary"
                          disabled={billingAction !== null || data?.billingHold}
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
                      <button
                        className="button-secondary"
                        onClick={() => setActiveView("topup")}
                        type="button"
                      >
                        Buy PAYG credits
                      </button>
                    </div>

                    {usesManualBilling ? (
                      <div className="mt-5 rounded-[22px] border border-[var(--border-brand)] bg-[var(--brand-subtle)] px-4 py-4 text-sm leading-6 text-[var(--foreground)]">
                        This account uses managed billing. Contact Cerul if you need plan or invoice changes.
                      </div>
                    ) : null}
                    {data?.billingHold ? (
                      <div className="mt-5 rounded-[22px] border border-[rgba(191,91,70,0.22)] bg-[rgba(191,91,70,0.08)] px-4 py-4 text-sm leading-6 text-[var(--foreground)]">
                        Billing is currently on hold. New self-serve checkout is temporarily disabled until review is complete.
                      </div>
                    ) : null}
                  </article>

                  <article className="surface-elevated rounded-[32px] px-6 py-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                      Payment methods
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                      Subscription checkout does not expose the same methods as one-time top-up.
                    </h3>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                        <p className="text-sm font-medium text-[var(--foreground)]">Pro checkout</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                          Stripe treats Pro as a recurring subscription, so only payment methods that support future renewal appear there.
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                        <p className="text-sm font-medium text-[var(--foreground)]">PAYG checkout</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                          PAYG is a one-time payment flow, so Stripe can show methods like Alipay when your account and region are eligible.
                        </p>
                      </div>
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <article className="surface-elevated rounded-[32px] px-6 py-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
                      Pay as you go
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                      Add credits without touching your current plan
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground-secondary)]">
                      PAYG remains separate from the monthly Pro bucket. It is best for bursts, overflow, or teams that want predictable subscription plus manual top-up.
                    </p>

                    <div className="mt-5 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--background-elevated)] px-5 py-5">
                        <label className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]" htmlFor="dashboard-topup-quantity">
                          Credits to buy
                        </label>
                        <input
                          id="dashboard-topup-quantity"
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
                          disabled={billingAction !== null || data?.billingHold}
                          onClick={() => void handleTopup()}
                          type="button"
                        >
                          {billingAction === "topup" ? "Redirecting..." : "Buy credits"}
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {[
                          {
                            label: "Purchased now",
                            value: data ? formatNumber(data.creditBreakdown.paidRemaining) : "—",
                            note: "PAYG credits already waiting in your wallet.",
                          },
                          {
                            label: "Purchased after checkout",
                            value: formatNumber(projectedPurchasedBalance),
                            note: "Only the PAYG bucket grows after this order lands.",
                          },
                          {
                            label: "Spendable after checkout",
                            value: formatNumber(projectedSpendableBalance),
                            note: "This is your total usable balance once the credits settle.",
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

                  <article className="surface-elevated rounded-[32px] px-6 py-6">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                        <p className="text-sm font-medium text-[var(--foreground)]">Charge order stays the same</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                          Daily free searches still cost 0 credits first, then your plan bucket, then bonus or purchased credits.
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                        <p className="text-sm font-medium text-[var(--foreground)]">One-time checkout</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                          This flow does not create or change a subscription. It only adds more spendable PAYG credits.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        className="button-secondary"
                        onClick={() => {
                          onClose();
                          onOpenAccountCenter("billing");
                        }}
                        type="button"
                      >
                        Open billing settings
                      </button>
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
                  </article>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardOverlayDialog>
  );
}
