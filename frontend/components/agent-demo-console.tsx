"use client";

import Link from "next/link";
import {
  simulateDemoSearch,
} from "@/lib/demo-api";

export function AgentDemoConsole() {
  const response = simulateDemoSearch({
    mode: "knowledge",
    query: "Sam Altman views on AI video generation tools",
  });
  const [primaryResult, secondaryResult] = response.results;
  const visualCards = [
    {
      title: primaryResult?.title ?? "Grounded video segment",
      source: primaryResult?.source ?? "Cerul match",
      detail:
        primaryResult?.detail
        ?? "Timestamped segment with visible slide evidence and source context.",
      badge: "Primary clip",
      chrome: "00:13:32 - 00:14:14",
      surface:
        "bg-[linear-gradient(135deg,rgba(14,165,233,0.38),rgba(8,15,33,0.84)_54%,rgba(56,189,248,0.16))]",
      accent:
        "bg-[radial-gradient(circle_at_62%_32%,rgba(255,255,255,0.32),transparent_18%),radial-gradient(circle_at_28%_68%,rgba(34,211,238,0.36),transparent_28%)]",
    },
    {
      title: secondaryResult?.title ?? "Supporting visual match",
      source: secondaryResult?.source ?? "Cerul match",
      detail:
        secondaryResult?.detail
        ?? "Follow-up frame evidence with source metadata kept visible for review.",
      badge: "Supporting frame",
      chrome: "Chart + spoken context",
      surface:
        "bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(22,78,99,0.74)_58%,rgba(34,211,238,0.18))]",
      accent:
        "bg-[radial-gradient(circle_at_35%_35%,rgba(103,232,249,0.3),transparent_18%),radial-gradient(circle_at_75%_72%,rgba(14,165,233,0.28),transparent_24%)]",
    },
    {
      title: "Answer-ready result surface",
      source: "Returned without raw JSON",
      detail:
        response.answer
        ?? "Summaries remain grounded in the returned clips, not detached from the media layer.",
      badge: "Answer layer",
      chrome: `${response.latencyMs}ms`,
      surface:
        "bg-[linear-gradient(135deg,rgba(8,15,28,0.98),rgba(15,23,42,0.92)_55%,rgba(34,211,238,0.14))]",
      accent:
        "bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.16),transparent_16%),radial-gradient(circle_at_50%_80%,rgba(34,211,238,0.22),transparent_26%)]",
    },
  ];

  return (
    <section className="surface-elevated overflow-hidden rounded-[36px]">
      <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(6,10,17,0.96),rgba(7,10,16,0.98))] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col px-6 py-7 sm:px-8 lg:px-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-brand)] bg-[var(--brand-subtle)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--brand-bright)]">
                cURL request
              </span>
              <span className="rounded-full border border-[var(--border)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-secondary)]">
                POST /v1/search
              </span>
            </div>

            <div className="mt-8 max-w-[34rem]">
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                One API call on the left. Returned video results on the right.
              </h2>
              <p className="mt-4 text-base leading-8 text-[var(--foreground-secondary)]">
                Keep the homepage obvious: paste a key, send one request, and immediately see the
                kind of grounded media result Cerul returns.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-[rgba(103,232,249,0.18)] bg-[rgba(4,8,15,0.96)] shadow-[0_26px_70px_rgba(2,6,18,0.34)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--brand-bright)]">
                  search.sh
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-5 font-mono text-sm leading-7 text-[#d9fafe] sm:px-5">
                <code>{`curl "https://api.cerul.ai/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Sam Altman views on AI video generation tools",
    "search_type": "knowledge",
    "max_results": 3,
    "include_answer": true
  }'`}</code>
              </pre>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/search-api" className="button-primary">
                Open docs
              </Link>
              <Link href="/signup" className="button-secondary">
                Get API key
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--foreground-secondary)]">
              <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5">
                Bearer auth
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5">
                {response.creditsUsed} credit sample
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5">
                {response.latencyMs}ms demo response
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,rgba(8,13,22,0.96),rgba(6,10,17,0.98))] px-6 py-7 sm:px-8 lg:px-9">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--brand-bright)]">
                Returned media
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Show the effect, not the implementation categories.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-secondary)]">
              {response.results.length} visible matches
            </span>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-[30px] border border-[rgba(103,232,249,0.18)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className={`relative overflow-hidden rounded-[24px] border border-white/10 ${visualCards[0].surface}`}>
                <div className={`absolute inset-0 ${visualCards[0].accent}`} />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_28%,rgba(3,8,18,0.68))]" />
                <div className="relative flex min-h-[320px] flex-col justify-between p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/88">
                      {visualCards[0].badge}
                    </span>
                    <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/72">
                      {visualCards[0].chrome}
                    </span>
                  </div>

                  <div className="flex items-center justify-center py-8">
                    <div className="flex h-18 w-18 items-center justify-center rounded-full border border-white/18 bg-black/28 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="white" />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <p className="text-xl font-semibold text-white sm:text-2xl">
                      {visualCards[0].title}
                    </p>
                    <p className="mt-2 text-sm uppercase tracking-[0.16em] text-white/70">
                      {visualCards[0].source}
                    </p>
                    <p className="mt-4 max-w-[34rem] text-sm leading-7 text-white/82">
                      {visualCards[0].detail}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-4">
              {visualCards.slice(1).map((card, index) => (
                <article
                  key={card.title}
                  className="rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4"
                >
                  <div className={`relative overflow-hidden rounded-[22px] border border-white/8 ${card.surface}`}>
                    <div className={`absolute inset-0 ${card.accent}`} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%,rgba(4,8,15,0.72))]" />
                    <div className="relative flex min-h-[180px] flex-col justify-between p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-full border border-white/12 bg-black/18 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/86">
                          {card.badge}
                        </span>
                        <span className="rounded-full border border-white/12 bg-black/18 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/68">
                          {card.chrome}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-bright)]" />
                          <span className="text-xs uppercase tracking-[0.16em] text-white/70">
                            {index === 0 ? "Secondary evidence" : "Readable summary"}
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-white">{card.title}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/66">
                          {card.source}
                        </p>
                        <p className="text-sm leading-6 text-white/78">{card.detail}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
            <div className="flex flex-wrap gap-2 text-sm text-[var(--foreground-secondary)]">
              <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                Request ID: {response.requestId}
              </span>
              <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                {response.creditsRemaining} credits remaining
              </span>
            </div>
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--brand-bright)] transition hover:text-white"
            >
              Open console →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
