"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { billing, getApiErrorMessage, type BillingCatalog } from "@/lib/api";
import { useConsoleViewer } from "@/components/console/console-viewer-context";
import { formatNumber } from "@/lib/dashboard";
import { AccountProfilePanel } from "./account-profile-panel";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardSkeleton, DashboardState } from "./dashboard-state";
import { useMonthlyUsage } from "./use-monthly-usage";

type BootstrapAdminStatus = "loading" | "available" | "already_admin" | "disabled" | "managed_by_emails" | "admin_exists" | "unavailable";

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

export function DashboardSettingsScreen() {
  const router = useRouter();
  const viewer = useConsoleViewer();
  const { data, error, isLoading, refresh } = useMonthlyUsage();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [referralInput, setReferralInput] = useState("");
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState<string | null>(null);
  const [isRedeemingReferral, setIsRedeemingReferral] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapAdminStatus>(
    () => (viewer.isAdmin ? "already_admin" : "loading"),
  );

  useEffect(() => { void billing.getCatalog().then(setCatalog).catch(() => {}); }, []);

  useEffect(() => {
    if (viewer.isAdmin) { setBootstrapStatus("already_admin"); return; }
    let cancelled = false;
    void fetch("/api/console/bootstrap-admin/status", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) { setBootstrapStatus("unavailable"); return; }
        const p = await res.json() as { eligible?: boolean; reason?: BootstrapAdminStatus };
        setBootstrapStatus(p.eligible === true ? "available" : (p.reason ?? "unavailable"));
      })
      .catch(() => { if (!cancelled) setBootstrapStatus("unavailable"); });
    return () => { cancelled = true; };
  }, [viewer.isAdmin]);

  async function handleRedeemReferral() {
    const code = referralInput.trim();
    if (!code) { setReferralError("Enter a code."); return; }
    setIsRedeemingReferral(true); setReferralError(null); setReferralSuccess(null);
    try {
      const r = await billing.redeemReferral(code);
      setReferralSuccess(`Applied. Status: ${r.status ?? "pending"}.`);
      setReferralInput("");
      void billing.getCatalog().then(setCatalog).catch(() => {});
    } catch (e) { setReferralError(getApiErrorMessage(e, "Failed to redeem.")); }
    finally { setIsRedeemingReferral(false); }
  }

  async function handleBootstrapAdmin() {
    const secret = bootstrapSecret.trim();
    if (!secret) { setBootstrapError("Secret required."); return; }
    setIsPromotingAdmin(true); setBootstrapError(null);
    try {
      const res = await fetch("/api/console/bootstrap-admin", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) });
      const payload = await res.json().catch(() => null) as { detail?: string } | null;
      if (!res.ok) { setBootstrapError(payload?.detail ?? "Failed."); return; }
      router.replace("/admin"); router.refresh();
    } catch { setBootstrapError("Failed."); }
    finally { setIsPromotingAdmin(false); }
  }

  function handleCopyCode() {
    const code = catalog?.referral.code;
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <DashboardLayout currentPath="/dashboard/settings" title="Settings" actions={null}>
      {isLoading && !data ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <DashboardState title="Could not load settings" description={error} tone="error"
          action={<button className="button-primary" onClick={() => void refresh()} type="button">Retry</button>} />
      ) : data ? (
        <div className="space-y-5">
          {/* ── Profile ───────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Profile</h2>
            <AccountProfilePanel />
          </section>

          {/* ── Referral ──────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Referral</h2>
            <div className="rounded-[18px] border border-[var(--border)] bg-white/60 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--foreground-tertiary)]">Your referral code</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tracking-[0.06em] text-[var(--foreground)]">
                    {catalog?.referral.code || "—"}
                  </p>
                </div>
                {catalog?.referral.code && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-xs text-[var(--foreground-secondary)] transition hover:bg-white hover:text-[var(--foreground)]"
                  >
                    <IconCopy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
                Both sides get {formatNumber(catalog?.referral.bonusCredits ?? 0)} bonus credits after first paid order.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value)}
                  placeholder="Enter a referral code"
                  className="h-9 flex-1 rounded-[10px] border border-[var(--border)] bg-white/78 px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--border-brand)]"
                />
                <button
                  className="button-secondary h-9 shrink-0 px-4 text-sm"
                  disabled={isRedeemingReferral || Boolean(catalog?.referral.redeemedCode)}
                  onClick={() => void handleRedeemReferral()}
                  type="button"
                >
                  {isRedeemingReferral ? "..." : "Redeem"}
                </button>
              </div>
              {catalog?.referral.redeemedCode && (
                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Redeemed: <span className="font-mono text-[var(--foreground)]">{catalog.referral.redeemedCode}</span>
                  {catalog.referral.status ? ` · ${catalog.referral.status}` : ""}
                </p>
              )}
              {referralError && <p className="mt-2 text-sm text-[var(--error)]">{referralError}</p>}
              {referralSuccess && <p className="mt-2 text-sm text-[var(--success)]">{referralSuccess}</p>}
            </div>
          </section>

          {/* ── Bootstrap admin ────────────────────────── */}
          {!viewer.isAdmin && bootstrapStatus === "available" && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Admin</h2>
              <div className="rounded-[18px] border border-[var(--border)] bg-white/60 px-5 py-4">
                <p className="text-xs text-[var(--foreground-tertiary)]">No admin exists yet. Enter bootstrap secret to promote this account.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="password"
                    value={bootstrapSecret}
                    onChange={(e) => setBootstrapSecret(e.target.value)}
                    placeholder="Bootstrap secret"
                    autoComplete="off"
                    className="h-9 flex-1 rounded-[10px] border border-[var(--border)] bg-white/78 px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--border-brand)]"
                  />
                  <button className="button-primary h-9 shrink-0 px-4 text-sm" type="button" disabled={isPromotingAdmin} onClick={() => void handleBootstrapAdmin()}>
                    {isPromotingAdmin ? "..." : "Promote"}
                  </button>
                </div>
                {bootstrapError && <p className="mt-2 text-sm text-[var(--error)]">{bootstrapError}</p>}
              </div>
            </section>
          )}

          {/* ── Workspace info ─────────────────────────── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Workspace</h2>
            <div className="rounded-[18px] border border-[var(--border)] bg-white/60 px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--foreground)]">Role</p>
                <span className="rounded-full border border-[var(--border)] bg-white/72 px-2.5 py-0.5 text-[11px] text-[var(--foreground-secondary)]">
                  {viewer.isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <DashboardState title="No data" description="Settings could not be loaded." />
      )}
    </DashboardLayout>
  );
}
