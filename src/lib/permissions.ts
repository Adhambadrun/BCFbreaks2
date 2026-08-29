/**
 * BCFbreaks role engine — the single source of truth for mapping an email
 * address to its access role. Dependency-free by design so it can be imported
 * from server components, route handlers, seeds, audits and tests alike.
 *
 *   DEV        — adhambadraan@gmail.com (system admin + impersonation engine)
 *   ADMIN      — explicitly listed administrator addresses
 *   SUPERVISOR — explicitly listed supervisor addresses
 *   AGENT      — ANY other @bcflights.com address (automatic domain rule)
 *   PREVIEWER  — any other domain (restricted preview access)
 */

export const DEV_EMAIL = "adhambadraan@gmail.com";

export const ADMIN_EMAILS = [
  "meredith@bcflights.com",
  "atlas@bcflights.com",
  "jolene@bcflights.com",
  "naomi@bcflights.com",
];

/** Supervisor emails -> the team they are assigned to supervise (null = pending admin assignment). */
export const SUPERVISOR_MAPPING: Record<string, string | null> = {
  "jay@bcflights.com": "Strikers",
  "watkins@bcflights.com": "Wizards",
  "albert@bcflights.com": null, // pending assignment by Admins/Dev
  "amir@bcflights.com": null, // pending assignment by Admins/Dev
};

export type AppRole = "DEV" | "ADMIN" | "SUPERVISOR" | "AGENT" | "PREVIEWER";

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Deterministic, offline-safe role resolution for an email address.
 * `endsWith('@bcflights.com')` is deliberately NOT `includes('bcflights.com')`
 * so look-alikes such as `me@bcflights.com.evil.tld` or `me@notbcflights.com`
 * do not match the corporate domain rule.
 */
export function getRoleForEmail(email: string): AppRole {
  const clean = normalizeEmail(email);

  if (clean === DEV_EMAIL) return "DEV";
  if (ADMIN_EMAILS.includes(clean)) return "ADMIN";
  if (clean in SUPERVISOR_MAPPING) return "SUPERVISOR";
  if (clean.endsWith("@bcflights.com")) return "AGENT";

  return "PREVIEWER";
}

/** Team a supervisor email is assigned to supervise (null when pending). */
export function getSupervisorTeamForEmail(email: string): string | null {
  if (getRoleForEmail(email) !== "SUPERVISOR") return null;
  return SUPERVISOR_MAPPING[normalizeEmail(email)] ?? null;
}

export const PRIVILEGED_ROLES: readonly AppRole[] = ["DEV", "ADMIN", "SUPERVISOR"];

export function isPrivilegedRole(role: AppRole): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

export function canManageSystem(role: AppRole): boolean {
  return role === "DEV" || role === "ADMIN";
}

export const ROLE_LABELS: Record<AppRole, string> = {
  DEV: "Developer",
  ADMIN: "Administrator",
  SUPERVISOR: "Supervisor",
  AGENT: "Agent",
  PREVIEWER: "Previewer",
};

export const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  DEV: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ADMIN: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  SUPERVISOR: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  AGENT: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PREVIEWER: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

/** Pretty default display name derived from an email local-part. */
export function defaultNameForEmail(email: string): string {
  const local = normalizeEmail(email).split("@")[0] ?? "Agent";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
