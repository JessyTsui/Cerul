"use client";

import { useState } from "react";
import { ApiClientError, billing, getApiErrorMessage } from "@/lib/api";
import { buildAuthPageHref } from "@/lib/auth-shared";

type BillingCheckoutButtonProps = {
  productCode: string;
  idleLabel: string;
  pendingLabel: string;
  className: string;
  loginNextPath?: string;
};

export function BillingCheckoutButton({
  productCode,
  idleLabel,
  pendingLabel,
  className,
  loginNextPath = "/pricing",
}: BillingCheckoutButtonProps) {
  void productCode;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const redirect = await billing.createCheckout();
      window.location.assign(redirect.url);
    } catch (nextError) {
      if (nextError instanceof ApiClientError && nextError.status === 401) {
        window.location.assign(buildAuthPageHref("/signup", loginNextPath));
        return;
      }
      if (nextError instanceof ApiClientError && nextError.status === 409) {
        window.location.assign("/dashboard/settings");
        return;
      }

      setError(getApiErrorMessage(nextError, "Failed to start checkout."));
      setIsPending(false);
    }
  }

  return (
    <div className="mt-6">
      <button className={className} disabled={isPending} onClick={() => void handleClick()} type="button">
        {isPending ? pendingLabel : idleLabel}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
