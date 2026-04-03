import type { Metadata } from "next";
import { AdminAnalyticsScreen } from "@/components/admin/analytics-screen";

export const metadata: Metadata = {
  title: "Admin Analytics",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsScreen />;
}
