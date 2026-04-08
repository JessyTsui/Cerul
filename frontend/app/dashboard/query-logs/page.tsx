import type { Metadata } from "next";
import { QueryLogsExplorer } from "@/components/query-logs/query-logs-explorer";

export const metadata: Metadata = {
  title: "Dashboard Query Logs",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardQueryLogsPage() {
  return (
    <QueryLogsExplorer
      mode="user"
      currentPath="/dashboard/query-logs"
      title="Query Logs"
      description="Search your own request history, filter by query text or surface, and keep detail links stable in the URL."
      failedQueryBanner
    />
  );
}
