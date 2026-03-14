"use client";

import type { Route } from "next";
import Link from "next/link";
import { buildAuthPageHref } from "@/lib/auth-shared";

type AuthModeSwitcherProps = {
  activeMode: "login" | "signup";
  nextPath: string;
};

export function AuthModeSwitcher({
  activeMode,
  nextPath,
}: AuthModeSwitcherProps) {
  return (
    <div className="rounded-[18px] border border-[rgba(148,163,184,0.12)] bg-[rgba(255,255,255,0.015)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid grid-cols-2 gap-1">
        <Link
          href={buildAuthPageHref("/login", nextPath) as Route}
          className={`focus-ring rounded-[14px] px-4 py-3 text-center text-sm font-medium transition ${
            activeMode === "login"
              ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(237,243,255,0.88))] text-[#090c14] shadow-[0_14px_30px_rgba(255,255,255,0.08)]"
              : "text-[rgba(209,218,235,0.6)] hover:bg-white/5 hover:text-white"
          }`}
        >
          Sign in
        </Link>
        <Link
          href={buildAuthPageHref("/signup", nextPath) as Route}
          className={`focus-ring rounded-[14px] px-4 py-3 text-center text-sm font-medium transition ${
            activeMode === "signup"
              ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(237,243,255,0.88))] text-[#090c14] shadow-[0_14px_30px_rgba(255,255,255,0.08)]"
              : "text-[rgba(209,218,235,0.6)] hover:bg-white/5 hover:text-white"
          }`}
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
