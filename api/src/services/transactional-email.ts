import type { AppConfig } from "../types";

const DEFAULT_SITE_LABEL = "Cerul";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export type BillingEmailNotification =
  | {
      kind: "subscription_activated";
      to: string;
      includedCredits: number;
      amountCents: number;
      periodStart: string;
      periodEnd: string;
    }
  | {
      kind: "topup_received";
      to: string;
      credits: number;
      amountCents: number;
    }
  | {
      kind: "auto_recharge_received";
      to: string;
      credits: number;
      amountCents: number;
    };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUsd(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amountCents / 100);
}

function renderEmail(input: {
  title: string;
  intro: string;
  body: string[];
  ctaHref: string;
  ctaLabel: string;
  footer: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#faf8f5;color:#2c2418;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e0d4;border-radius:16px;overflow:hidden;">
      <div style="height:4px;background:linear-gradient(135deg,#88a5f2,#c5a55a);"></div>
      <div style="padding:32px;">
        <p style="margin:0 0 12px;color:#6b5d4f;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">${DEFAULT_SITE_LABEL}</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#2c2418;">${escapeHtml(input.title)}</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#6b5d4f;">${escapeHtml(input.intro)}</p>
        ${input.body.map((paragraph) => `
          <p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:#6b5d4f;">${escapeHtml(paragraph)}</p>
        `).join("")}
        <div style="padding:16px 0 6px;">
          <a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#88a5f2;color:#ffffff;text-decoration:none;font-weight:600;">${escapeHtml(input.ctaLabel)}</a>
        </div>
        <p style="margin:20px 0 0;padding-top:20px;border-top:1px solid #e8e0d4;font-size:13px;line-height:1.7;color:#6b5d4f;">${escapeHtml(input.footer)}</p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function buildBillingEmail(config: AppConfig, notification: BillingEmailNotification): EmailPayload {
  const dashboardUrl = `${config.public.webBaseUrl.replace(/\/+$/, "")}/dashboard`;
  const settingsUrl = `${config.public.webBaseUrl.replace(/\/+$/, "")}/dashboard/settings`;

  if (notification.kind === "subscription_activated") {
    return {
      to: notification.to,
      subject: "Your Cerul Pro subscription is active",
      html: renderEmail({
        title: "Cerul Pro is now active",
        intro: "Your subscription payment cleared successfully.",
        body: [
          `We added ${notification.includedCredits.toLocaleString("en-US")} included credits for ${notification.periodStart} to ${notification.periodEnd}.`,
          `Amount charged: ${formatUsd(notification.amountCents)}.`,
          "You can start using the higher Pro allowance right away."
        ],
        ctaHref: dashboardUrl,
        ctaLabel: "Open dashboard",
        footer: "Recurring renewals still depend on your Stripe webhook configuration, so keep the billing webhook active in every environment."
      })
    };
  }

  if (notification.kind === "topup_received") {
    return {
      to: notification.to,
      subject: "Your Cerul credits are ready",
      html: renderEmail({
        title: "Credits added to your wallet",
        intro: "Your one-time PAYG purchase completed successfully.",
        body: [
          `We added ${notification.credits.toLocaleString("en-US")} credits to your Cerul wallet.`,
          `Amount charged: ${formatUsd(notification.amountCents)}.`,
          "Those credits stay available for future searches and are used after any bonus or included credits."
        ],
        ctaHref: settingsUrl,
        ctaLabel: "View wallet",
        footer: "If you did not authorize this purchase, reply to this email and we will help investigate."
      })
    };
  }

  return {
    to: notification.to,
    subject: "Cerul auto-recharge completed",
    html: renderEmail({
      title: "Auto-recharge completed",
      intro: "We refilled your wallet because it fell below your configured threshold.",
      body: [
        `We added ${notification.credits.toLocaleString("en-US")} credits automatically.`,
        `Amount charged: ${formatUsd(notification.amountCents)}.`,
        "You can update or disable auto-recharge at any time from your dashboard settings."
      ],
      ctaHref: settingsUrl,
      ctaLabel: "Manage billing settings",
      footer: "Cerul only attempts auto-recharge when your saved Stripe customer and payment method are available."
    })
  };
}

async function sendEmail(config: AppConfig, payload: EmailPayload): Promise<void> {
  const apiKey = config.email.resendApiKey;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; skipping billing email.", {
      to: payload.to,
      subject: payload.subject
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.email.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend email request failed (${response.status}): ${detail}`);
  }
}

export async function sendBillingNotification(config: AppConfig, notification: BillingEmailNotification): Promise<void> {
  await sendEmail(config, buildBillingEmail(config, notification));
}
