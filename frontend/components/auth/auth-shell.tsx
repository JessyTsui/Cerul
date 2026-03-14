import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

type AuthShellProps = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  highlights: readonly string[];
  children: ReactNode;
};

export function AuthShell({
  heroEyebrow,
  heroTitle,
  heroDescription,
  formEyebrow,
  formTitle,
  formDescription,
  highlights,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto min-h-[calc(100vh-2rem)] max-w-[1560px] overflow-hidden rounded-[36px] border border-[rgba(148,163,184,0.14)] bg-[#05070d] shadow-[0_40px_140px_rgba(2,6,18,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(69,122,255,0.18),transparent_20%),radial-gradient(circle_at_38%_50%,rgba(73,67,185,0.18),transparent_26%),radial-gradient(circle_at_72%_72%,rgba(34,211,238,0.12),transparent_20%),linear-gradient(180deg,#08101d_0%,#060912_55%,#05070d_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02),transparent_18%,transparent_82%,rgba(255,255,255,0.02))]" />
        <div className="pointer-events-none absolute inset-y-[8%] left-[56%] hidden w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.06),transparent)] lg:block" />

        <div className="relative grid min-h-[calc(100vh-2rem)] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative flex min-h-[340px] flex-col justify-between overflow-hidden px-8 py-8 sm:px-10 lg:px-14 lg:py-14">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_28%,transparent_72%,rgba(255,255,255,0.015))]" />

            <div className="relative">
              <BrandMark />
            </div>

            <div className="relative max-w-[560px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[rgba(194,208,255,0.76)]">
                {heroEyebrow}
              </p>
              <h1 className="mt-6 max-w-[11ch] text-5xl font-semibold tracking-[-0.07em] text-white sm:text-6xl lg:text-7xl">
                {heroTitle}
              </h1>
              <p className="mt-6 max-w-[520px] text-lg leading-9 text-[rgba(209,218,235,0.72)]">
                {heroDescription}
              </p>
            </div>

            <div className="relative mt-10 grid gap-3 border-t border-[rgba(148,163,184,0.12)] pt-6 sm:grid-cols-3">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(8,13,23,0.44)] px-4 py-4 text-sm text-[rgba(209,218,235,0.78)] backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--brand-bright)]">
                    <span className="h-2 w-2 rounded-full bg-current" />
                  </span>
                  <span className="mt-4 block">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="relative flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.03),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.05),transparent_34%)]" />

            <div className="relative w-full max-w-[510px] rounded-[34px] border border-[rgba(148,163,184,0.14)] bg-[linear-gradient(180deg,rgba(4,7,12,0.82),rgba(7,10,16,0.92))] px-6 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:px-8 sm:py-9">
              <div className="pointer-events-none absolute inset-0 rounded-[34px] border border-[rgba(255,255,255,0.03)]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[rgba(194,208,255,0.7)]">
                {formEyebrow}
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {formTitle}
              </h2>
              <p className="mt-4 max-w-[38ch] text-base leading-8 text-[rgba(209,218,235,0.66)]">
                {formDescription}
              </p>

              <div className="mt-8">{children}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
