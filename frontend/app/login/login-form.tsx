"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { AuthModeSwitcher } from "@/components/auth/auth-mode-switcher";
import { authClient } from "@/lib/auth";
import { buildAuthPageHref, getAuthErrorMessage } from "@/lib/auth-shared";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (result.error) {
        setError(
          getAuthErrorMessage(result.error, "Unable to sign in with that account."),
        );
        return;
      }

      startTransition(() => {
        router.replace(nextPath as Route);
        router.refresh();
      });
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError, "Unable to sign in right now."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
      <AuthModeSwitcher activeMode="login" nextPath={nextPath} />

      <div className="rounded-[22px] border border-[rgba(34,211,238,0.16)] bg-[rgba(34,211,238,0.06)] px-4 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--brand-bright)]">
          Session note
        </p>
        <p className="mt-2 text-sm leading-7 text-[rgba(224,236,255,0.74)]">
          Browser sign-in unlocks the console only. Your product requests still authenticate with
          bearer API keys created after login.
        </p>
      </div>

      <div className="rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.025)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="login-email">
              Work email
            </label>
            <div className="auth-input-shell">
              <span className="auth-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </span>
              <input
                id="login-email"
                className="auth-input pl-12 pr-4"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="login-password">
              Password
            </label>
            <div className="auth-input-shell">
              <span className="auth-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                </svg>
              </span>
              <input
                id="login-password"
                className="auth-input pl-12 pr-14"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(209,218,235,0.48)] transition hover:text-white"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3 21 21" />
                    <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                    <path d="M16.68 16.67A10.94 10.94 0 0 1 12 18C7 18 3.73 14.89 2 12c.92-1.55 2.14-3.01 3.65-4.16" />
                    <path d="M9.88 5.09A11 11 0 0 1 12 5c5 0 8.27 3.11 10 6-1.01 1.7-2.41 3.3-4.17 4.5" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] border border-[rgba(148,163,184,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm text-[rgba(209,218,235,0.68)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border border-[rgba(148,163,184,0.2)] bg-transparent accent-[var(--brand)]"
              />
              Remember this browser
            </label>
            <a
              href="mailto:team@cerul.ai?subject=Cerul%20password%20help"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-[rgba(194,208,255,0.64)] transition hover:text-white"
            >
              Password help
            </a>
          </div>

          {error ? (
            <p className="rounded-[16px] border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.22)] px-4 py-3 text-sm text-[rgb(254,202,202)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="h-14 w-full rounded-[18px] bg-white text-base font-semibold text-[#090c14] transition hover:bg-[rgba(255,255,255,0.92)] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center text-sm text-[rgba(209,218,235,0.62)]">
        <p>
          Need a new workspace?{" "}
          <Link
            href={buildAuthPageHref("/signup", nextPath) as Route}
            className="font-medium text-white transition hover:text-[var(--brand-bright)]"
          >
            Create an account
          </Link>
        </p>
        <p>Public API integrations still use API keys, not this browser session.</p>
      </div>
    </form>
  );
}
