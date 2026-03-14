import type { Metadata } from "next";
import { AuthSessionRedirect } from "@/components/auth/auth-session-redirect";
import { AuthShell } from "@/components/auth/auth-shell";
import { normalizeAuthRedirectPath } from "@/lib/auth-shared";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/login",
  },
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextValue = Array.isArray(resolvedSearchParams.next)
    ? resolvedSearchParams.next[0]
    : resolvedSearchParams.next;
  const nextPath = normalizeAuthRedirectPath(nextValue);

  return (
    <AuthShell
      heroEyebrow="Console access"
      heroTitle="Search video evidence without losing operator clarity."
      heroDescription="Sign in to manage API keys, usage, and billing in one clean console while your production integrations keep using scoped bearer keys."
      formEyebrow="Welcome back"
      formTitle="Sign in"
      formDescription="Use your Cerul account to continue to the dashboard. Web sessions stay separate from public API key auth."
      highlights={["Operator console", "Scoped API keys", "Usage and billing"]}
    >
      <AuthSessionRedirect nextPath={nextPath} />
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
