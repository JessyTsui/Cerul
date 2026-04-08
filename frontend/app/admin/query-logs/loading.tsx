export default function AdminQueryLogsLoading() {
  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-6 space-y-3 border-b border-[var(--border)] pb-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[rgba(36,29,21,0.08)]" />
        <div className="h-12 w-56 animate-pulse rounded-full bg-[rgba(36,29,21,0.08)]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-[rgba(36,29,21,0.08)]" />
      </div>
      <div className="space-y-5">
        <div className="h-56 animate-pulse rounded-[30px] border border-[var(--border)] bg-[rgba(36,29,21,0.08)]" />
        <div className="h-[420px] animate-pulse rounded-[30px] border border-[var(--border)] bg-[rgba(36,29,21,0.08)]" />
      </div>
    </div>
  );
}
