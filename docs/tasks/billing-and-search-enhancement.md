# Billing System & Search Enhancement

Implementation plan for Codex. Two parts:

**Part A** — Billing: PAYG credit top-up, auto-recharge, signup bonus, daily free searches
**Part B** — Search: return full transcript in search results to enable agent multi-round loops

All amounts are expressed in **credits**. Currently 1 search = 1 credit, 1 search with `include_answer=true` = 2 credits. These values may be adjusted independently in the future.

---

## Pricing Summary

| Tier | Monthly fee | Included credits | Top-up rate | Notes |
|------|-------------|------------------|-------------|-------|
| Free | $0 | 100 credits on signup (one-time) | $8/1K credits | + 10 free searches/day for all users |
| Pay as you go | $0 | 0 | $8/1K credits (manual top-up) | Minimum 1,000 credits per purchase |
| Pro | $29.90/month | 5,000 credits/month | $8/1K credits (manual top-up) | Same top-up rate as PAYG |
| Enterprise | Custom | Custom | Custom | Contact sales |

All users (including Pro and Enterprise) get their first 10 searches per day free — no credits deducted.

---

# Part A: Billing

---

## A1. Stripe Products

### Existing (already created)
- **Cerul Pro**: $29.90/month recurring subscription — already created in Stripe, no changes needed

### PAYG top-up checkout
- No separate Stripe Price is required for PAYG top-ups in the current implementation.
- The API computes one-time amounts server-side at **$8 / 1,000 credits**, in **100-credit increments**.
- This avoids Stripe Checkout's limitation around USD prices with more than 2 decimal places in one-time payment mode.

### Env vars

Keep `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID` configured. PAYG top-ups and auto-recharge amounts are computed server-side and sent to Stripe as one-time payment amounts, so no dedicated PAYG `Price` or extra Stripe env var is required.

| File | Change |
|------|--------|
| `.env.example` | Keep only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID` under `# Stripe billing` |
| `api/src/types.ts` | Keep only the Stripe fields needed for recurring Pro checkout |
| `api/src/config.ts` | Map only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID` into `config.stripe` |
| `api/wrangler.toml` | Keep only the active Stripe secrets in the comment block |
| `scripts/dev.sh` | Sync only the active Stripe env vars into `api/.dev.vars` |
| `workers/common/config/settings.py` | Remove obsolete PAYG top-up price env mapping and model field |

---

## A2. Daily Free Searches (First 10/Day)

Every user's first 10 searches per day are free. No credits deducted. Starting from the 11th search, credits are consumed normally.

### Implementation: `api/src/routes/search.ts`

Before the credit debit step in the search handler, add a daily free check:

```ts
import { FREE_DAILY_SEARCHES } from "../services/billing-catalog";

// Count today's searches for this user (UTC day boundary)
const todayStart = new Date();
todayStart.setUTCHours(0, 0, 0, 0);

const dailyCount = await db.fetchrow<{ count: number }>(
  `SELECT COUNT(*)::int AS count
   FROM usage_log
   WHERE user_id = $1
     AND created_at >= $2`,
  userId,
  todayStart.toISOString()
);

const searchesToday = dailyCount?.count ?? 0;
const isFreeSearch = searchesToday < FREE_DAILY_SEARCHES;

if (isFreeSearch) {
  // Skip credit debit — this search is free
  // MUST still log to usage_log so the daily count increments
} else {
  // Normal credit debit flow
  await spendCredits(db, userId, creditsRequired, ...);
}
```

### Constants: `api/src/services/billing-catalog.ts`

These constants already exist from the previous refactor. Verify they are present:

```ts
export const SIGNUP_BONUS_CREDITS = 100;
export const FREE_DAILY_SEARCHES = 10;
```

### Usage API response

Add daily free info to the usage response in `api/src/routes/usage.ts` and `api/src/routes/dashboard.ts`:

```ts
{
  "daily_free_remaining": 7,   // max(0, 10 - searches_today)
  "daily_free_limit": 10
}
```

This requires counting today's searches for the user (same query as above).

### Frontend

Show in `frontend/components/dashboard/usage-screen.tsx`:

```
Free searches today: 7 / 10 remaining
```

---

## A3. Signup Bonus (100 Credits)

Every new account gets 100 free credits on signup. These do not expire.

### Implementation

In the user creation hook (wherever `upsertUserProfile` is called after user signup — check `frontend/lib/auth-server.ts` or the API's `databaseHooks.user.create.after`), add a credit grant:

```ts
await createCreditGrant(db, {
  userId: user.id,
  grantKey: `signup_bonus:${user.id}`,
  grantType: "promo_bonus",
  planCode: "free",
  totalCredits: SIGNUP_BONUS_CREDITS,  // 100
  expiresAt: null,  // no expiry
  metadata: { reason: "signup_bonus" }
});
```

If `createCreditGrant` is only available in the API service layer (not the frontend auth hooks), call it via the existing user profile creation path in the API. The key requirement: it must only fire once per user, and `grantKey: signup_bonus:{userId}` ensures idempotency.

### Update default monthly credit limit

In `api/src/services/billing.ts`, verify `DEFAULT_MONTHLY_CREDIT_LIMITS` has:

```ts
export const DEFAULT_MONTHLY_CREDIT_LIMITS: Record<string, number> = {
  free: 0,         // free users get 100 signup bonus + 10 free searches/day, no monthly grant
  pro: 5_000,
  enterprise: 100_000
};
```

---

## A4. PAYG Credit Top-up (One-Time Purchase)

Users can buy credits at any time. Minimum purchase: 1,000 credits ($8). Quantity adjustable in increments of 100 (e.g., 1,000 / 1,100 / 1,200 / ... / 5,000 / etc.).

Uses Stripe Checkout in `payment` mode with variable quantity.

### API endpoint: `api/src/routes/dashboard.ts`

Add `POST /billing/topup`:

```ts
router.post("/billing/topup", sessionAuth(), async (c) => {
  const db = c.get("db");
  const session = c.get("session");
  const config = c.get("config");
  const profile = await fetchUserProfile(db, session.userId);
  if (!profile) {
    apiError(404, "User profile not found.");
  }

  const rawPayload = ensureJsonObject(await c.req.json().catch(() => ({})), "Request body must be a JSON object.");
  const rawQuantity = typeof rawPayload.quantity === "number" ? rawPayload.quantity : 1000;
  const quantity = Math.max(Math.round(rawQuantity / 100) * 100, 1000);

  if (Boolean(profile.billing_hold)) {
    apiError(403, "Billing account requires review before a new purchase can be created.");
  }

  const email = session.email ?? (profile.email == null ? null : String(profile.email));
  if (!email) {
    apiError(400, "Authenticated session is missing an email address.");
  }

  try {
    const checkoutUrl = await createTopupCheckoutSession(config, {
      userId: session.userId,
      email,
      stripeCustomerId: profile.stripe_customer_id == null ? null : String(profile.stripe_customer_id),
      quantity,
    });
    return c.json({ checkout_url: checkoutUrl, quantity });
  } catch (error) {
    if (error instanceof StripeServiceError) {
      apiError(503, error.message);
    }
    throw error;
  }
});
```

### Stripe checkout function: `api/src/services/stripe.ts`

Add `createTopupCheckoutSession`:

```ts
export function createTopupCheckoutSession(
  config: AppConfig,
  input: { userId: string; email: string; stripeCustomerId?: string | null; quantity: number }
): Promise<string> {
  const client = stripeClient(config);
  const metadata = { user_id: input.userId, type: "topup", quantity: String(input.quantity) };

  const payload: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Cerul Credits",
            description: `${TOPUP_CREDIT_STEP} credits per unit`
          },
          unit_amount: TOPUP_STEP_PRICE_CENTS
        },
        quantity: topupLineItemQuantity(input.quantity),
      }
    ],
    client_reference_id: input.userId,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${webBaseUrl(config)}/dashboard/settings?checkout=success&type=topup&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${webBaseUrl(config)}/dashboard/settings?checkout=cancelled`,
  };

  if (input.stripeCustomerId) {
    payload.customer = input.stripeCustomerId;
  } else {
    payload.customer_email = input.email;
    payload.customer_creation = "always";
  }

  return client.checkout.sessions.create(payload).then((session) => {
    if (!session.url) throw new StripeServiceError("No checkout URL.");
    return String(session.url);
  });
}
```

### Webhook handler: `api/src/routes/webhooks.ts`

Update `checkout.session.completed` to handle both `subscription` and `payment` modes:

```ts
if (eventType === "checkout.session.completed") {
  const metadata = asRecord(eventObject.metadata);
  const userId = asString(metadata.user_id) ?? asString(eventObject.client_reference_id);
  if (!userId) return;

  const mode = asString(eventObject.mode) ?? "";

  if (mode === "subscription") {
    await activateCheckoutSubscription(db, userId, asString(eventObject.customer), asString(eventObject.subscription));
    return;
  }

  if (mode === "payment") {
    const quantity = Number(metadata.quantity) || 1000;
    await fulfillTopupCheckout(db, {
      userId,
      credits: quantity,
      stripeCheckoutSessionId: String(eventObject.id ?? ""),
      stripeCustomerId: asString(eventObject.customer),
      stripePaymentIntentId: asString(eventObject.payment_intent),
      currency: asString(eventObject.currency),
      grossAmountCents: asInteger(eventObject.amount_subtotal ?? eventObject.amount_total),
      discountAmountCents: asInteger(asRecord(eventObject.total_details).amount_discount),
      netAmountCents: asInteger(eventObject.amount_total),
      occurredAt: stripeCreatedAt(eventObject.created),
    });
    return;
  }
}
```

### Fulfill top-up: `api/src/services/billing.ts`

Re-add `fulfillTopupCheckout` (was removed in previous refactor) and restore `"paid_topup"` grant type and `"topup"` order kind:

```ts
// Add "paid_topup" back to CreditGrantType:
type CreditGrantType =
  | "free_monthly"
  | "subscription_monthly"
  | "paid_topup"          // ← restore
  | "promo_bonus"
  | "referral_bonus"
  | "manual_adjustment";

// Add "topup" back to BillingOrderKind:
type BillingOrderKind = "subscription" | "topup";   // ← restore "topup"

// Re-add the TopupInput type and fulfillTopupCheckout function:

type TopupInput = {
  userId: string;
  credits: number;
  stripeCheckoutSessionId: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
  currency: string | null;
  grossAmountCents: number;
  discountAmountCents: number;
  netAmountCents: number;
  occurredAt?: Date | null;
};

export async function fulfillTopupCheckout(db: DatabaseClient, input: TopupInput): Promise<void> {
  await db.transaction(async (tx) => {
    await linkStripeCustomerToUser(tx, input.userId, input.stripeCustomerId);
    const profile = await fetchUserBillingProfile(tx, input.userId);
    const planCode = normalizePlanCode(profile.tier);

    const order = await upsertBillingOrder(tx, {
      userId: input.userId,
      orderKind: "topup",
      productCode: "topup",
      planCode,
      status: "paid",
      currency: defaultCurrency(input.currency),
      grossAmountCents: input.grossAmountCents,
      discountAmountCents: input.discountAmountCents,
      netAmountCents: input.netAmountCents,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: null,
      fulfilledAt: input.occurredAt ?? new Date(),
      metadata: { credits: input.credits },
    });

    await createCreditGrant(tx, {
      userId: input.userId,
      billingOrderId: order.id,
      grantKey: `topup:${input.stripeCheckoutSessionId}`,
      grantType: "paid_topup",
      planCode,
      totalCredits: input.credits,
      expiresAt: null,   // top-up credits do NOT expire
      metadata: { stripe_checkout_session_id: input.stripeCheckoutSessionId },
    });
    await setOrderCreditsGranted(tx, order.id, input.credits);
  });
}
```

Also restore `paid_topup` in the credit spend priority SQL (`fetchSpendableGrants`):

```sql
ORDER BY
  CASE
    WHEN grant_type IN ('promo_bonus', 'referral_bonus', 'manual_adjustment') THEN 0
    WHEN grant_type IN ('free_monthly', 'subscription_monthly') THEN 1
    WHEN grant_type = 'paid_topup' THEN 2
    ELSE 3
  END ASC,
  COALESCE(expires_at, 'infinity'::timestamptz) ASC,
  created_at ASC
```

Credits spend order: bonus first → included next → paid top-up last.

---

## A5. Auto-Recharge

Users can enable auto-recharge in dashboard settings. When their credit balance drops below a configurable threshold after a search, the system automatically charges their saved card and adds credits.

### Database migration

Create `db/migrations/014_auto_recharge.sql`:

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS auto_recharge_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_recharge_threshold INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS auto_recharge_quantity INTEGER NOT NULL DEFAULT 1000;
```

### Settings API: `api/src/routes/dashboard.ts`

Add two routes:

```ts
router.get("/billing/auto-recharge", sessionAuth(), async (c) => {
  const db = c.get("db") as DatabaseClient;
  const session = c.get("session") as DashboardSession;
  const profile = await fetchUserProfile(db, session.userId);
  if (!profile) {
    apiError(404, "User profile not found.");
  }
  return c.json({
    enabled: Boolean(profile.auto_recharge_enabled),
    threshold: Number(profile.auto_recharge_threshold ?? 100),
    quantity: Number(profile.auto_recharge_quantity ?? 1000),
  });
});

router.post("/billing/auto-recharge", sessionAuth(), async (c) => {
  const db = c.get("db") as DatabaseClient;
  const session = c.get("session") as DashboardSession;
  const payload = ensureJsonObject(await c.req.json().catch(() => ({})), "Request body must be a JSON object.");

  const enabled = payload.enabled === true;
  const threshold = typeof payload.threshold === "number"
    ? Math.max(Math.round(payload.threshold), 0)
    : 100;
  const quantity = typeof payload.quantity === "number"
    ? Math.max(Math.round(payload.quantity / 100) * 100, 1000)
    : 1000;

  await db.execute(
    `UPDATE user_profiles
     SET auto_recharge_enabled = $1,
         auto_recharge_threshold = $2,
         auto_recharge_quantity = $3,
         updated_at = NOW()
     WHERE id = $4`,
    enabled, threshold, quantity, session.userId
  );

  return c.json({ enabled, threshold, quantity });
});
```

### Trigger function: `api/src/services/billing.ts`

Add `maybeAutoRecharge` — called after credit debit, fire-and-forget:

```ts
export async function maybeAutoRecharge(
  db: DatabaseClient,
  config: AppConfig,
  userId: string
): Promise<{ triggered: boolean; error?: string }> {
  const profile = await fetchUserBillingProfile(db, userId);

  if (!profile.auto_recharge_enabled) return { triggered: false };
  if (!profile.stripe_customer_id) return { triggered: false };

  const wallet = await fetchCreditWalletSummary(db, userId);
  if (wallet.wallet_balance >= profile.auto_recharge_threshold) return { triggered: false };

  // Prevent double-charge: check for recent pending recharge
  const recentRecharge = await db.fetchrow(
    `SELECT id FROM billing_orders
     WHERE user_id = $1
       AND order_kind = 'topup'
       AND status = 'pending'
       AND created_at > NOW() - INTERVAL '5 minutes'`,
    userId
  );
  if (recentRecharge) return { triggered: false };

  try {
    const stripe = stripeClient(config);
    const quantity = Math.max(Math.round(profile.auto_recharge_quantity / 100) * 100, 1_000);
    const totalAmount = topupAmountCents(quantity);
    if (totalAmount <= 0) {
      return { triggered: false, error: "Stripe auto-recharge amount is invalid." };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "usd",
      customer: profile.stripe_customer_id,
      off_session: true,
      confirm: true,
      metadata: {
        user_id: userId,
        type: "auto_recharge",
        quantity: String(quantity),
      },
    });

    await upsertBillingOrder(db, {
      userId,
      orderKind: "topup",
      productCode: "auto_recharge",
      planCode: normalizePlanCode(profile.tier),
      status: paymentIntent.status === "succeeded" ? "paid" : "pending",
      currency: "usd",
      grossAmountCents: totalAmount,
      discountAmountCents: 0,
      netAmountCents: totalAmount,
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: profile.stripe_customer_id,
      fulfilledAt: paymentIntent.status === "succeeded" ? new Date() : null,
      metadata: { auto_recharge: true, quantity: profile.auto_recharge_quantity },
    });

    if (paymentIntent.status === "succeeded") {
      await createCreditGrant(db, {
        userId,
        grantKey: `auto_recharge:${paymentIntent.id}`,
        grantType: "paid_topup",
        planCode: normalizePlanCode(profile.tier),
        totalCredits: profile.auto_recharge_quantity,
        expiresAt: null,
        metadata: { auto_recharge: true, stripe_payment_intent_id: paymentIntent.id },
      });
    }

    return { triggered: true };
  } catch (err: any) {
    console.error("[billing] Auto-recharge failed:", err?.message);
    return { triggered: false, error: err?.message };
  }
}
```

### Call from search route: `api/src/routes/search.ts`

After `spendCredits` (only when credits were actually debited, not for free searches):

```ts
// Fire-and-forget — NEVER block the search response
void maybeAutoRecharge(db, config, userId).catch((err) =>
  console.error("[billing] auto-recharge error:", err)
);
```

### Webhook for async payment: `api/src/routes/webhooks.ts`

Auto-recharge uses `off_session` PaymentIntents. If payment succeeds immediately, credits are granted inline above. For async success (3D Secure etc.), handle via webhook:

Add to `processStripeEvent`:

```ts
if (eventType === "payment_intent.succeeded") {
  const metadata = asRecord(eventObject.metadata);
  if (asString(metadata.type) === "auto_recharge") {
    const userId = asString(metadata.user_id);
    const quantity = Number(metadata.quantity) || 1000;
    if (userId) {
      const grantKey = `auto_recharge:${String(eventObject.id)}`;
      // Only create grant if it doesn't already exist (idempotent)
      const existing = await db.fetchrow(
        `SELECT id FROM credit_grants WHERE grant_key = $1`,
        grantKey
      );
      if (!existing) {
        const profile = await fetchUserBillingProfile(db, userId);
        await createCreditGrant(db, {
          userId,
          grantKey,
          grantType: "paid_topup",
          planCode: normalizePlanCode(profile.tier),
          totalCredits: quantity,
          expiresAt: null,
          metadata: { auto_recharge: true },
        });
      }
    }
  }
}
```

**Note:** Add `payment_intent.succeeded` to the Stripe webhook event list in Stripe Dashboard.

### Auto-recharge notes

- Requires `stripe_customer_id` on the user profile (set when they first pay via checkout)
- If the off_session charge fails (card declined), log the error, do NOT retry
- `auto_recharge_quantity` must be ≥ 1,000, in increments of 100

---

## A6. Frontend Changes

### Pricing tiers and FAQ: `frontend/lib/site.ts`

The pricing tiers and FAQ have already been updated in the current branch to reflect the new pricing ($29.90 Pro, $8/1K PAYG, 100 credits on signup, 10 free searches/day). Verify they match the pricing summary table at the top of this document. If they don't match, update them.

### Comparison table: `frontend/app/pricing/page.tsx`

Already updated in current branch. Verify it matches:

```ts
const featuresComparison = [
  { name: "Initial free credits", free: "100", payg: "100", pro: "100", enterprise: "Custom" },
  { name: "Free searches / day", free: "10", payg: "10", pro: "10", enterprise: "Custom" },
  { name: "Included credits / month", free: "None", payg: "None", pro: "5,000", enterprise: "Custom" },
  { name: "Credit top-up rate", free: "$20 / 1K", payg: "$20 / 1K", pro: "$20 / 1K", enterprise: "Custom" },
  { name: "Auto-recharge", free: true, payg: true, pro: true, enterprise: true },
  { name: "Rate limits", free: "Standard", payg: "Standard", pro: "Higher", enterprise: "Custom" },
  { name: "Search API access", free: true, payg: true, pro: true, enterprise: true },
  { name: "Priority support", free: false, payg: false, pro: true, enterprise: true },
  { name: "Private indexing", free: false, payg: false, pro: false, enterprise: true },
  { name: "SLA guarantee", free: false, payg: false, pro: false, enterprise: true },
];
```

### Top-up purchase UI: `frontend/components/dashboard/settings-screen.tsx`

Add a "Buy Credits" section in the billing panel:

- Quantity input: min 1,000 credits, step 100
- Display total price: quantity × $0.008 (e.g., "1,000 credits — $8")
- "Buy credits" button → calls `POST /dashboard/billing/topup` with `{ quantity }`
- Show for all users (free, PAYG, and Pro)

### Auto-recharge settings UI: `frontend/components/dashboard/settings-screen.tsx`

Add an "Auto-recharge" toggle section:

- Toggle: Enable / Disable
- Threshold input: "Recharge when balance drops below ___" (default 100 credits)
- Quantity input: "Add ___ credits each time" (min 1,000, step 100)
- "Save" button → calls `POST /dashboard/billing/auto-recharge`
- Only show if user has `has_stripe_customer === true`

### Daily free searches display: `frontend/components/dashboard/usage-screen.tsx`

Show: `Free searches today: 7 / 10 remaining`

### Frontend API client: `frontend/lib/api.ts`

Add methods:

```ts
// In the billing namespace:
async createTopup(quantity: number): Promise<BillingRedirect> { ... }
async getAutoRecharge(): Promise<AutoRechargeSettings> { ... }
async updateAutoRecharge(settings: AutoRechargeSettings): Promise<AutoRechargeSettings> { ... }
```

Add types:

```ts
export type AutoRechargeSettings = {
  enabled: boolean;
  threshold: number;
  quantity: number;
};
```

---

# Part B: Search Enhancement

---

## B1. Return Full Transcript in Search Results

### Context

The `snippet` field truncates ASR text to 220 characters. The full transcript already exists in the database (`retrieval_units.transcript`) and is already fetched in the search SQL query (`ru.transcript AS transcript_text`). It is just not included in the `SearchResult` response.

Returning the full transcript lets AI agents read segment content, extract entities and topics, and decide what to search next — enabling multi-round search loops.

### Add `transcript` to `SearchResult` type: `api/src/types.ts`

```ts
export interface SearchResult {
  id: string;
  score: number;
  rerank_score?: number | null;
  url: string;
  title: string;
  snippet: string;
  transcript?: string | null;    // NEW: full ASR text for the segment
  thumbnail_url?: string | null;
  keyframe_url?: string | null;
  duration: number;
  source: string;
  speaker?: string | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
}
```

### Return `transcript` in search service: `api/src/services/search.ts`

In the section where `results.push({...})` constructs each SearchResult (around line 201-215), add one line:

```ts
results.push({
  id: String(row.id),
  score: clampScore(row.score),
  rerank_score: row.rerank_score == null ? null : clampScore(row.rerank_score),
  url: trackingUrl,
  title: String(row.title ?? ""),
  snippet: this.buildSnippet(row),
  transcript: row.transcript_text == null ? null : String(row.transcript_text),  // NEW
  thumbnail_url: row.thumbnail_url == null ? null : String(row.thumbnail_url),
  keyframe_url: row.keyframe_url == null ? null : String(row.keyframe_url),
  duration: Number(row.duration ?? 0),
  source: String(row.source ?? ""),
  speaker: row.speaker == null ? null : String(row.speaker),
  timestamp_start: coerceOptionalFloat(row.timestamp_start),
  timestamp_end: coerceOptionalFloat(row.timestamp_end)
});
```

No SQL changes needed — `ru.transcript AS transcript_text` is already in the query.

### Update API docs: `docs/api-reference.md`

Add `transcript` field to the search response documentation with description: "Full ASR transcript text for the matched segment. May be null for visual-only segments."

### Update frontend docs: `frontend/lib/docs.ts`

Add `transcript` to the search response schema and example JSON in the docs page.

### Design notes

- `snippet` stays as-is (220-char preview for compact UIs)
- `transcript` is the full ASR text bounded by the segment's `timestamp_start` / `timestamp_end`
- `transcript` is `null` for visual-only units that have no speech content
- This is a backward-compatible addition — no existing fields are changed

---

# File Summary

| File | Action | Part | Description |
|------|--------|------|-------------|
| `.env.example` | Modify | A | Remove obsolete PAYG Stripe price env var |
| `api/src/types.ts` | Modify | A+B | Remove obsolete PAYG Stripe config field, add `transcript` to SearchResult |
| `api/src/config.ts` | Modify | A | Keep only active Stripe config mapping |
| `api/wrangler.toml` | Modify | A | Remove obsolete commented Stripe secret |
| `scripts/dev.sh` | Modify | A | Stop syncing obsolete top-up Stripe env var |
| `workers/common/config/settings.py` | Modify | A | Remove obsolete top-up Stripe env mapping + model field |
| `db/migrations/014_auto_recharge.sql` | Create | A | Add auto-recharge columns to user_profiles |
| `api/src/services/billing-catalog.ts` | Modify | A | Verify `SIGNUP_BONUS_CREDITS`, `FREE_DAILY_SEARCHES` constants |
| `api/src/services/billing.ts` | Modify | A | Re-add `fulfillTopupCheckout`, `paid_topup` grant type, `topup` order kind, add `maybeAutoRecharge`, restore spend priority SQL |
| `api/src/services/stripe.ts` | Modify | A | Add `createTopupCheckoutSession` |
| `api/src/services/search.ts` | Modify | B | Add `transcript` to SearchResult construction (~1 line) |
| `api/src/routes/dashboard.ts` | Modify | A | Add `POST /billing/topup`, `GET/POST /billing/auto-recharge` |
| `api/src/routes/search.ts` | Modify | A | Add daily free search check, call `maybeAutoRecharge` after debit |
| `api/src/routes/usage.ts` | Modify | A | Add `daily_free_remaining` and `daily_free_limit` to response |
| `api/src/routes/webhooks.ts` | Modify | A | Handle `mode === "payment"` for topups, add `payment_intent.succeeded` for auto-recharge |
| `frontend/lib/api.ts` | Modify | A | Add `createTopup(quantity)`, auto-recharge API methods, `AutoRechargeSettings` type |
| `frontend/components/dashboard/settings-screen.tsx` | Modify | A | Add top-up purchase UI, auto-recharge settings toggle |
| `frontend/components/dashboard/usage-screen.tsx` | Modify | A | Show daily free searches remaining |
| `docs/api-reference.md` | Modify | B | Add `transcript` field to search response docs |
| `frontend/lib/docs.ts` | Modify | B | Add `transcript` to docs page schema and examples |

---

# Testing Checklist

### Part A — Billing

- [ ] New signup gets 100 free credits (non-expiring `promo_bonus` grant)
- [ ] All users get first 10 searches/day free (no credit deduction)
- [ ] 11th search of the day deducts credits normally
- [ ] Free user with 0 credits and 10+ daily searches → blocked (402 or 403)
- [ ] Top-up checkout: 1,000 credits → pays $8 → credits granted
- [ ] Top-up checkout: 2,500 credits → pays $20 → credits granted
- [ ] Top-up quantity: < 1,000 rejected, non-100 multiple rounded to nearest 100
- [ ] Pro subscription: $29.90/month, 5,000 credits granted on activation
- [ ] Pro user can also buy top-ups at $8/1K
- [ ] Auto-recharge: enable with threshold=100, quantity=1000 → saves correctly
- [ ] Auto-recharge triggers when balance drops below threshold after a search
- [ ] Auto-recharge does NOT double-trigger within 5 minutes
- [ ] Auto-recharge failure logged, does NOT block search response
- [ ] Auto-recharge only available for users with `stripe_customer_id`
- [ ] PAYG to Pro upgrade: existing top-up credits preserved, Pro credits added
- [ ] Pro cancellation: top-up credits preserved, included credits stop renewing
- [ ] Daily free search counter resets at UTC midnight
- [ ] Dashboard shows daily free searches remaining
- [ ] Dashboard shows auto-recharge settings
- [ ] Dashboard shows "Buy Credits" section with quantity input

### Part B — Search

- [ ] Search results include `transcript` field with full ASR text
- [ ] `transcript` is `null` for visual-only units (no speech content)
- [ ] `snippet` still returns 220-char truncated preview (unchanged)
- [ ] No breaking changes to existing search response fields
- [ ] API docs show the new `transcript` field with example

---

# Design Constraints

- Auto-recharge MUST be fire-and-forget — never block the API response
- Auto-recharge uses `off_session` PaymentIntent — requires saved payment method
- Do NOT retry failed auto-recharge payments automatically
- Daily free search check uses UTC day boundaries
- Top-up credits do NOT expire
- Minimum top-up is 1,000 credits, adjustable in increments of 100
- The daily free search counter is based on `usage_log` rows, not credit grants
- Free daily searches apply to ALL tiers (free, payg, pro, enterprise)
- All amounts use "credits" as the unit — not "requests" or "searches"
- Credit costs per search type may be adjusted independently in the future
