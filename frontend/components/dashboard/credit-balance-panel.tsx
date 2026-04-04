import { formatNumber } from "@/lib/dashboard";

type CreditBalancePanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  total: number;
  included: number;
  bonus: number;
  purchased: number;
  dailyFreeRemaining: number;
  dailyFreeLimit: number;
};

type SegmentTone = "included" | "bonus" | "purchased" | "other";

type Segment = {
  label: string;
  value: number;
  note: string;
  tone: SegmentTone;
};

const SEGMENT_STYLES: Record<SegmentTone, { barClassName: string; badgeClassName: string }> = {
  included: {
    barClassName: "bg-[linear-gradient(90deg,rgba(97,125,233,0.96),rgba(145,170,255,0.92))]",
    badgeClassName: "bg-[rgba(97,125,233,0.12)] text-[rgb(72,98,198)]",
  },
  bonus: {
    barClassName: "bg-[linear-gradient(90deg,rgba(81,154,123,0.94),rgba(136,204,166,0.9))]",
    badgeClassName: "bg-[rgba(81,154,123,0.12)] text-[rgb(53,118,89)]",
  },
  purchased: {
    barClassName: "bg-[linear-gradient(90deg,rgba(211,142,79,0.96),rgba(243,190,128,0.92))]",
    badgeClassName: "bg-[rgba(211,142,79,0.14)] text-[rgb(155,96,47)]",
  },
  other: {
    barClassName: "bg-[linear-gradient(90deg,rgba(122,110,98,0.72),rgba(174,163,150,0.72))]",
    badgeClassName: "bg-[rgba(122,110,98,0.1)] text-[rgb(96,84,74)]",
  },
};

export function CreditBalancePanel({
  eyebrow,
  title,
  description,
  total,
  included,
  bonus,
  purchased,
  dailyFreeRemaining,
  dailyFreeLimit,
}: CreditBalancePanelProps) {
  const segments: Segment[] = [
    {
      label: "Included",
      value: included,
      note: "Monthly plan credits that reset with your billing cycle.",
      tone: "included" as const,
    },
    {
      label: "Bonus",
      value: bonus,
      note: "Signup, referral, or other promotional credits.",
      tone: "bonus" as const,
    },
    {
      label: "Purchased",
      value: purchased,
      note: "PAYG credits you bought separately from the plan.",
      tone: "purchased" as const,
    },
  ].filter((segment) => segment.value > 0);

  const knownTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  const unclassified = Math.max(total - knownTotal, 0);
  if (unclassified > 0) {
    segments.push({
      label: "Other",
      value: unclassified,
      note: "Credits that do not fit the standard buckets.",
      tone: "other",
    });
  }

  const denominator = Math.max(total, segments.reduce((sum, segment) => sum + segment.value, 0), 1);
  const extraCredits = Math.max(bonus + purchased, 0);

  return (
    <article className="surface-elevated rounded-[32px] px-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground-secondary)]">
            {description}
          </p>
        </div>

        <div className="rounded-[24px] border border-[rgba(36,29,21,0.08)] bg-white/74 px-5 py-4 shadow-[0_16px_34px_rgba(36,29,21,0.05)] xl:min-w-[280px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
            Spendable now
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {formatNumber(total)}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">
            {formatNumber(dailyFreeRemaining)} of {formatNumber(dailyFreeLimit)} free searches still cost
            {" "}0 credits today.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-[var(--border)] bg-white/76 px-5 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Wallet composition</p>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                A total above your plan allowance is expected when bonus or PAYG credits are available.
              </p>
            </div>
            <p className="text-sm text-[var(--foreground-secondary)]">
              {formatNumber(total)} total credits ready
            </p>
          </div>

          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-[rgba(36,29,21,0.08)]">
            {segments.length > 0 ? (
              segments.map((segment) => (
                <span
                  key={segment.label}
                  className={SEGMENT_STYLES[segment.tone].barClassName}
                  style={{ width: `${Math.max((segment.value / denominator) * 100, 0)}%` }}
                />
              ))
            ) : (
              <span className="h-full w-full bg-[rgba(36,29,21,0.08)]" />
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {segments.length > 0 ? (
              segments.map((segment) => (
                <div
                  key={segment.label}
                  className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${SEGMENT_STYLES[segment.tone].badgeClassName}`}
                    >
                      {segment.label}
                    </span>
                    <span className="text-lg font-semibold text-[var(--foreground)]">
                      {formatNumber(segment.value)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">
                    {segment.note}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
                <p className="text-sm text-[var(--foreground-secondary)]">
                  No spendable credits are available right now.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground-tertiary)]">
              Charge order
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Requests draw from credits in a predictable order.
            </p>
          </div>

          <div className="rounded-[22px] border border-[var(--border)] bg-white/72 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">1. Free today</p>
            <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
              {formatNumber(dailyFreeRemaining)} free searches remain today
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
              These requests still count toward request volume, but they do not deduct credits.
            </p>
          </div>

          <div className="rounded-[22px] border border-[var(--border)] bg-white/72 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">2. Included plan bucket</p>
            <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
              {formatNumber(included)} included credits remain
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
              Your monthly plan allowance is consumed before extra credits kick in.
            </p>
          </div>

          <div className="rounded-[22px] border border-[var(--border)] bg-white/72 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-tertiary)]">3. Extra credits</p>
            <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
              {formatNumber(extraCredits)} bonus or purchased credits stay ready
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
              This is why your spendable balance can be higher than the monthly Pro allowance.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
