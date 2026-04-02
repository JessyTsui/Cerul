import type { Metadata } from "next";
import { DashboardBillingScreen } from "@/components/dashboard/billing-screen";

export const metadata: Metadata = {
  title: "Dashboard Billing",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardBillingPage() {
  return <DashboardBillingScreen />;
}
