export default function DashboardQueryLogsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 space-y-3 border-b border-[var(--border)] pb-4">
        <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(36,29,21,0.08)]" />
        <div className="h-10 w-44 animate-pulse rounded-full bg-[rgba(36,29,21,0.08)]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-[rgba(36,29,21,0.08)]" />
      </div>
      <div className="space-y-5">
        <div className="h-52 animate-pulse rounded-[30px] border border-[var(--border)] bg-[rgba(36,29,21,0.08)]" />
        <div className="h-[420px] animate-pulse rounded-[30px] border border-[var(--border)] bg-[rgba(36,29,21,0.08)]" />
      </div>
    </div>
  );
}
