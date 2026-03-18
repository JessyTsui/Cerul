function normalizeEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizeSecret(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function getConfiguredAdminEmails(): Set<string> {
  const emails = new Set<string>();

  for (const value of [
    process.env.ADMIN_CONSOLE_EMAILS,
    process.env.CERUL__DASHBOARD__ADMIN_EMAILS,
  ]) {
    for (const email of normalizeEmailList(value)) {
      emails.add(email);
    }
  }

  return emails;
}

export function getConfiguredBootstrapAdminSecret(): string | null {
  return (
    normalizeSecret(process.env.BOOTSTRAP_ADMIN_SECRET) ??
    normalizeSecret(process.env.CERUL__DASHBOARD__BOOTSTRAP_ADMIN_SECRET)
  );
}

