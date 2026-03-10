"""Billing helpers shared across dashboard and webhook flows."""

from __future__ import annotations

DEFAULT_MONTHLY_CREDIT_LIMITS: dict[str, int] = {
    "free": 1_000,
    "pro": 10_000,
    "builder": 10_000,
    "enterprise": 100_000,
}

TIER_KEY_LIMITS: dict[str, int] = {
    "free": 1,
    "pro": 5,
    "builder": 5,
    "enterprise": 25,
}


def key_limit_for_tier(tier: str | None) -> int:
    normalized_tier = (tier or "free").lower()
    return TIER_KEY_LIMITS.get(normalized_tier, TIER_KEY_LIMITS["free"])


def monthly_credit_limit_for_tier(tier: str | None) -> int:
    normalized_tier = (tier or "free").lower()
    return DEFAULT_MONTHLY_CREDIT_LIMITS.get(
        normalized_tier,
        DEFAULT_MONTHLY_CREDIT_LIMITS["free"],
    )
