"use client";

import { useRef, useState } from "react";
import type { DashboardApiKey } from "@/lib/api";
import { formatDashboardDateTime } from "@/lib/dashboard";

type ApiKeyRowProps = {
  apiKey: DashboardApiKey;
  isPending: boolean;
  onRevoke: (apiKey: DashboardApiKey) => void;
  compact?: boolean;
  isLastKey?: boolean;
};

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.334a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  );
}

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
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const visibleTimerRef = useRef<number | null>(null);

  const fullKey = apiKey.rawKey ?? `${apiKey.prefix}${"*".repeat(26)}`;
  const maskedDisplay = `${apiKey.prefix.slice(0, 10)}${"*".repeat(30)}`;
  const displayKey = visible ? fullKey : maskedDisplay;

  function handleToggleVisible() {
    if (visibleTimerRef.current) {
      window.clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
    if (!visible) {
      setVisible(true);
      visibleTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        visibleTimerRef.current = null;
      }, 5000);
    } else {
      setVisible(false);
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
          <code className="font-mono text-[13px] text-[var(--foreground)]">{displayKey}</code>
        </div>
      </td>
      <td className="px-5 py-4 text-sm">{formatDashboardDateTime(apiKey.createdAt)}</td>
      <td className="px-5 py-4 text-sm">{formatDashboardDateTime(apiKey.lastUsedAt)}</td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {/* Eye toggle */}
          <button
            type="button"
            onClick={handleToggleVisible}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground-tertiary)] transition hover:bg-white/72 hover:text-[var(--foreground)]"
            title={visible ? "Hide key" : "Show key"}
          >
            {visible ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground-tertiary)] transition hover:bg-white/72 hover:text-[var(--foreground)]"
            title={copied ? "Copied!" : "Copy key"}
          >
            {copied ? (
              <svg className="h-[18px] w-[18px] text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="m4.5 12.75 6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            ) : (
              <IconCopy className="h-[18px] w-[18px]" />
            )}
          </button>

          {/* Revoke/Delete */}
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
