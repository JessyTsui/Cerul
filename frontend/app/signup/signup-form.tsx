"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { AuthModeSwitcher } from "@/components/auth/auth-mode-switcher";
import { authClient } from "@/lib/auth";
import { buildAuthPageHref, getAuthErrorMessage } from "@/lib/auth-shared";

type SignupFormProps = {
  nextPath: string;
};

export function SignupForm({ nextPath }: SignupFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setError("First and last name are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authClient.signUp.email({
        name: `${trimmedFirstName} ${trimmedLastName}`.trim(),
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(
          getAuthErrorMessage(result.error, "Unable to create that account."),
        );
        return;
      }

      startTransition(() => {
        router.replace(nextPath as Route);
        router.refresh();
      });
    } catch (nextError) {
      setError(
        getAuthErrorMessage(nextError, "Unable to create an account right now."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
      <AuthModeSwitcher activeMode="signup" nextPath={nextPath} />

      <div className="rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.025)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="signup-first-name">
                First name
              </label>
              <input
                id="signup-first-name"
                className="auth-input px-4"
                type="text"
                placeholder="Jessy"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="signup-last-name">
                Last name
              </label>
              <input
                id="signup-last-name"
                className="auth-input px-4"
                type="text"
                placeholder="Tsui"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="signup-email">
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
                id="signup-email"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="signup-password">
                Password
              </label>
              <div className="auth-input-shell">
                <input
                  id="signup-password"
                  className="auth-input px-4 pr-14"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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

            <div className="grid gap-2">
              <label className="text-sm text-[var(--foreground-secondary)]" htmlFor="signup-confirm-password">
                Confirm password
              </label>
              <div className="auth-input-shell">
                <input
                  id="signup-confirm-password"
                  className="auth-input px-4 pr-14"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(209,218,235,0.48)] transition hover:text-white"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? (
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
          </div>

          <div className="rounded-[18px] border border-[rgba(148,163,184,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[rgba(194,208,255,0.58)]">
              What happens next
            </p>
            <p className="mt-2 text-sm leading-7 text-[rgba(209,218,235,0.62)]">
              Your web account lands in the dashboard immediately. Public integrations still use
              API keys you create after sign-up.
            </p>
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
            {isSubmitting ? "Creating account..." : "Create workspace"}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center text-sm text-[rgba(209,218,235,0.62)]">
        <p>
          Already have access?{" "}
          <Link
            href={buildAuthPageHref("/login", nextPath) as Route}
            className="font-medium text-white transition hover:text-[var(--brand-bright)]"
          >
            Sign in
          </Link>
        </p>
        <p>Accounts here manage the console. API keys are generated after onboarding.</p>
      </div>
    </form>
  );
}
