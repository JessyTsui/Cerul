"use client";

import { useEffect, useState } from "react";
import { usage } from "@/lib/api";
import { formatNumber } from "@/lib/dashboard";

type DailyFreeSearchNoteProps = {
  dailyFreeRemaining?: number;
  dailyFreeLimit?: number;
  title?: string;
  className?: string;
};

type LiveDailyFreeState = {
  remaining: number;
  limit: number;
} | null;

export function DailyFreeSearchNote({
  dailyFreeRemaining,
  dailyFreeLimit,
  title = "Daily free",
  className,
}: DailyFreeSearchNoteProps) {
  const hasProvidedCounts =
    typeof dailyFreeRemaining === "number"
    && typeof dailyFreeLimit === "number";
  const [liveState, setLiveState] = useState<LiveDailyFreeState>(null);

  useEffect(() => {
    if (hasProvidedCounts) {
      return;
    }

    let cancelled = false;

    void usage.getMonthly()
      .then((nextUsage) => {
        if (cancelled) {
          return;
        }

        setLiveState({
          remaining: nextUsage.dailyFreeRemaining,
          limit: nextUsage.dailyFreeLimit,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLiveState(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasProvidedCounts]);

  const state = hasProvidedCounts
    ? {
        remaining: dailyFreeRemaining,
        limit: dailyFreeLimit,
        source: "provided" as const,
      }
    : liveState
      ? {
          remaining: liveState.remaining,
          limit: liveState.limit,
          source: "live" as const,
        }
      : null;

  return (
    <div
      className={`rounded-[18px] border border-[rgba(97,125,233,0.16)] bg-[rgba(97,125,233,0.08)] px-4 py-4 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[rgb(72,98,198)]">
          {title}
        </p>
        {state?.source === "live" ? (
          <span className="rounded-full border border-[rgba(97,125,233,0.14)] bg-white/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[rgb(72,98,198)]">
            Live
          </span>
        ) : null}
      </div>

      {state ? (
        <>
          <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
            Today: {formatNumber(state.remaining)} / {formatNumber(state.limit)} free searches left
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
            These searches still deduct 0 credits even though the response continues to show{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">credits_used</code>
            {" "}and{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">credits_remaining</code>.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
            Today: 10 / 10 free searches reset every UTC day
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
            Sign in to see your live remaining count here. The first 10 searches each day still cost 0 credits.
          </p>
        </>
      )}
    </div>
  );
}
