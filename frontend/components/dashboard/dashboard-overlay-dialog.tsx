"use client";

import { useEffect, type ReactNode } from "react";

type DashboardOverlayDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  panelClassName?: string;
};

export function DashboardOverlayDialog({
  isOpen,
  onClose,
  children,
  labelledBy,
  panelClassName,
}: DashboardOverlayDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,13,11,0.46)] px-4 py-6 backdrop-blur-md"
      role="dialog"
      onClick={onClose}
    >
      <div
        className={`relative max-h-[calc(100vh-3rem)] w-full overflow-hidden rounded-[34px] border border-[rgba(59,47,35,0.12)] bg-[rgba(255,252,247,0.98)] shadow-[0_40px_120px_rgba(27,20,13,0.18)] ${panelClassName ?? "max-w-[1180px]"}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
