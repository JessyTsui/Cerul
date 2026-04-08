import type { QueryLogListItem } from "./types";

type QueryLogRowProps = {
  item: QueryLogListItem;
  showUserColumn: boolean;
  isSelected: boolean;
  onSelect: () => void;
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLatency(latencyMs: number | null): string {
  if (latencyMs == null) {
    return "—";
  }
  if (latencyMs < 1000) {
    return `${Math.round(latencyMs)}ms`;
  }
  return `${(latencyMs / 1000).toFixed(2)}s`;
}

export function QueryLogSurfaceBadge({ surface }: { surface: QueryLogListItem["searchSurface"] }) {
  if (!surface) {
    return <span className="badge">legacy</span>;
  }

  const tone =
    surface === "api"
      ? "badge-success"
      : surface === "mcp"
        ? "badge-warning"
        : "";

  return <span className={`badge ${tone}`.trim()}>{surface}</span>;
}

export function QueryLogRow({
  item,
  showUserColumn,
  isSelected,
  onSelect,
}: QueryLogRowProps) {
  return (
    <tr
      className={`border-t border-[var(--border)] transition ${
        isSelected ? "bg-[var(--brand-subtle)]" : "hover:bg-white/58"
      }`}
    >
      <td className="px-4 py-3">
        <button
          type="button"
          className="flex w-full flex-col items-start gap-1 text-left"
          onClick={onSelect}
        >
          <span className="max-w-[40ch] truncate text-sm font-medium text-[var(--foreground)]">
            {item.queryText || "Untitled query"}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-tertiary)]">
            {item.requestId}
          </span>
        </button>
      </td>
      {showUserColumn ? (
        <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
          <div className="max-w-[28ch] truncate">{item.userEmail ?? item.userId}</div>
        </td>
      ) : null}
      <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
        <QueryLogSurfaceBadge surface={item.searchSurface} />
      </td>
      <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
        {item.resultCount}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
        {formatLatency(item.latencyMs)}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
        {formatRelativeTime(item.createdAt)}
      </td>
    </tr>
  );
}
