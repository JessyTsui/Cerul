import { afterEach, describe, expect, it } from "vitest";
import {
  getConfiguredAdminEmails,
  getConfiguredBootstrapAdminSecret,
} from "./console-settings";

describe("console settings helpers", () => {
  const originalAdminEmails = process.env.ADMIN_CONSOLE_EMAILS;
  const originalSharedAdminEmails = process.env.CERUL__DASHBOARD__ADMIN_EMAILS;
  const originalBootstrapSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
  const originalSharedBootstrapSecret =
    process.env.CERUL__DASHBOARD__BOOTSTRAP_ADMIN_SECRET;

  afterEach(() => {
    process.env.ADMIN_CONSOLE_EMAILS = originalAdminEmails;
    process.env.CERUL__DASHBOARD__ADMIN_EMAILS = originalSharedAdminEmails;
    process.env.BOOTSTRAP_ADMIN_SECRET = originalBootstrapSecret;
    process.env.CERUL__DASHBOARD__BOOTSTRAP_ADMIN_SECRET =
      originalSharedBootstrapSecret;
  });

  it("merges legacy and shared admin email settings", () => {
    process.env.ADMIN_CONSOLE_EMAILS = "owner@example.com";
    process.env.CERUL__DASHBOARD__ADMIN_EMAILS = "admin@example.com, owner@example.com";

    expect(Array.from(getConfiguredAdminEmails()).sort()).toEqual([
      "admin@example.com",
      "owner@example.com",
    ]);
  });

  it("prefers the legacy bootstrap secret when both forms are set", () => {
    process.env.BOOTSTRAP_ADMIN_SECRET = "legacy-secret";
    process.env.CERUL__DASHBOARD__BOOTSTRAP_ADMIN_SECRET = "shared-secret";

    expect(getConfiguredBootstrapAdminSecret()).toBe("legacy-secret");
  });

  it("falls back to the shared bootstrap secret", () => {
    delete process.env.BOOTSTRAP_ADMIN_SECRET;
    process.env.CERUL__DASHBOARD__BOOTSTRAP_ADMIN_SECRET = "shared-secret";

    expect(getConfiguredBootstrapAdminSecret()).toBe("shared-secret");
  });
});

