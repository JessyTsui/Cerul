"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardAccountCenterModal } from "./dashboard-account-center-modal";
import { DashboardBillingModal } from "./dashboard-billing-modal";
import { DashboardSidebar } from "./dashboard-sidebar";
import type {
  DashboardAccountCenterSection,
  DashboardBillingModalView,
} from "./dashboard-shell-controls";
import { DashboardTopNav } from "./dashboard-top-nav";

type DashboardAppShellProps = {
  children: ReactNode;
};

export function DashboardAppShell({ children }: DashboardAppShellProps) {
  const pathname = usePathname() ?? "/dashboard";
  const [accountCenterSection, setAccountCenterSection] = useState<DashboardAccountCenterSection | null>(null);
  const [billingModalView, setBillingModalView] = useState<DashboardBillingModalView | null>(null);

  function openAccountCenter(section: DashboardAccountCenterSection) {
    setBillingModalView(null);
    setAccountCenterSection(section);
  }

  function openBillingModal(view: DashboardBillingModalView) {
    setAccountCenterSection(null);
    setBillingModalView(view);
  }

  return (
    <div className="soft-theme flex min-h-screen">
      <DashboardSidebar
        currentPath={pathname}
        onOpenAccountCenter={openAccountCenter}
        onOpenBillingModal={openBillingModal}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopNav
          currentPath={pathname}
          onOpenAccountCenter={openAccountCenter}
          onOpenBillingModal={openBillingModal}
        />
        <main className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
      <DashboardAccountCenterModal
        key={accountCenterSection ?? "account-center-closed"}
        isOpen={accountCenterSection !== null}
        onClose={() => setAccountCenterSection(null)}
        initialSection={accountCenterSection ?? "profile"}
        onOpenBillingModal={openBillingModal}
      />
      <DashboardBillingModal
        key={billingModalView ?? "billing-modal-closed"}
        isOpen={billingModalView !== null}
        onClose={() => setBillingModalView(null)}
        initialView={billingModalView ?? "pro"}
        onOpenAccountCenter={openAccountCenter}
      />
    </div>
  );
}
