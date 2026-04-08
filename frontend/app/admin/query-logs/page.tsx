import type { Metadata } from "next";
import { QueryLogsExplorer } from "@/components/query-logs/query-logs-explorer";

export const metadata: Metadata = {
  title: "Admin Query Logs",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminQueryLogsPage() {
  return (
    <QueryLogsExplorer
      mode="admin"
      currentPath="/admin/query-logs"
      title="Query Logs"
      description="Search request history, open a deep-linked drawer, and trace individual request IDs without reaching for SQL."
      failedQueryBanner
    />
  );
}
