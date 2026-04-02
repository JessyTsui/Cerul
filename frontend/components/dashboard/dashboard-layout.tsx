"use client";

import type { ReactNode } from "react";

type DashboardLayoutProps = {
  currentPath: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function DashboardLayout({
  title,
  description,
  actions,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      {/* Minimal header */}
      <div className="animate-fade-in mb-8 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-lg font-medium text-[var(--foreground)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--foreground-tertiary)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="dashboard-stagger space-y-6">{children}</div>
    </div>
  );
}
