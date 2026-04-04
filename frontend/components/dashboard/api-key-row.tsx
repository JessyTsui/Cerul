"use client";

import type { DashboardApiKey } from "@/lib/api";
import { formatDashboardDateTime } from "@/lib/dashboard";

type ApiKeyRowProps = {
  apiKey: DashboardApiKey;
  isPending: boolean;
  onRevoke: (apiKey: DashboardApiKey) => void;
  compact?: boolean;
  isLastKey?: boolean;
};

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function maskedKey(prefix: string): string {
  return `${prefix}${"*".repeat(28)}`;
}

export function ApiKeyRow({
  apiKey,
  isPending,
  onRevoke,
  compact,
  isLastKey,
}: ApiKeyRowProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{apiKey.name}</p>
          <p className="text-xs text-[var(--foreground-tertiary)]">{maskedKey(apiKey.prefix)}</p>
        </div>
        <button
          type="button"
          onClick={() => onRevoke(apiKey)}
          disabled={isPending || !apiKey.isActive || isLastKey}
          className="ml-2 text-xs text-[var(--foreground-tertiary)] hover:text-[var(--error)] disabled:opacity-50"
        >
          {isPending ? "..." : apiKey.isActive ? "Revoke" : "Revoked"}
        </button>
      </div>
    );
  }

  return (
    <tr className="border-t border-[var(--border)] text-[var(--foreground-secondary)]">
      <td className="px-5 py-4">
        <p className="font-medium text-[var(--foreground)]">{apiKey.name}</p>
      </td>
      <td className="px-5 py-4">
        <div className="inline-flex items-center gap-0.5 rounded-[10px] border border-[var(--border)] bg-[var(--background-elevated,rgba(255,250,242,1))] px-3 py-1.5">
          <code className="font-mono text-[13px] text-[var(--foreground)]">{maskedKey(apiKey.prefix)}</code>
        </div>
      </td>
      <td className="px-5 py-4 text-sm">{formatDashboardDateTime(apiKey.createdAt)}</td>
      <td className="px-5 py-4 text-sm">{formatDashboardDateTime(apiKey.lastUsedAt)}</td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onRevoke(apiKey)}
            disabled={isPending || !apiKey.isActive || isLastKey}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground-tertiary)] transition hover:bg-[rgba(191,91,70,0.08)] hover:text-[var(--error,#bf5b46)] disabled:cursor-not-allowed disabled:opacity-30"
            title={isLastKey ? "Cannot delete last key" : isPending ? "Revoking..." : apiKey.isActive ? "Delete key" : "Already revoked"}
          >
            <IconTrash className="h-[18px] w-[18px]" />
          </button>
        </div>
      </td>
    </tr>
  );
}
