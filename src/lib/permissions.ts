/**
 * BCFbreaks role engine — the single source of truth for mapping an email
 * address to its access role. Dependency-free by design so it can be imported
 * from server components, route handlers, seeds, audits and tests alike.
 *
 *   DEV          — adhambadraan@gmail.com (system admin + impersonation engine)
 *   ADMIN        — roster "Admin / Manager" addresses
 *   SUPERVISOR   — roster "Supervisor" addresses (each mapped to their CAI team)
 *   INDEPENDENT  — roster "Independent Agent" address (CAI 1, no supervisor)
 *   AGENT        — ANY other @bcflights.com address (automatic domain rule)
 *   PREVIEWER    — any other domain (restricted preview access)
 *
 * Administrative lists are derived from `src/lib/roster.ts` (the canonical
 * company roster) so the engine can never drift from the published roster.
 */

import {
  fullNameForEmail,
  displayNameForEmail,
  ROSTER,
  ROSTER_BY_EMAIL,
  type RosterRole,
} from "./roster";

export const DEV_EMAIL = "adhambadraan@gmail.com";

/** Map a roster role label to the engine's access role. */
const ROSTER_ROLE_TO_APP_ROLE: Record<RosterRole, AppRole> = {
  "Admin / Manager": "ADMIN",
  Developer: "DEV",
  "Independent Agent": "INDEPENDENT",
  Supervisor: "SUPERVISOR",
  "Team Member": "AGENT",
};

/** Administrator addresses (roster "Admin / Manager"). */
export const ADMIN_EMAILS: readonly string[] = ROSTER.filter(
  (e) => e.role === "Admin / Manager",
).map((e) => e.email.toLowerCase());

/** Supervisor emails -> the CAI team they supervise. */
export const SUPERVISOR_MAPPING: Record<string, string> = Object.fromEntries(
  ROSTER.filter((e) => e.role === "Supervisor").map((e) => [e.email.toLowerCase(), e.team]),
);

export type AppRole = "DEV" | "ADMIN" | "SUPERVISOR" | "INDEPENDENT" | "AGENT" | "PREVIEWER";

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Deterministic, offline-safe role resolution for an email address.
 * Roster members resolve to their roster role; other corporate addresses fall
 * through to the automatic AGENT domain rule.
 * `endsWith('@bcflights.com')` is deliberately NOT `includes('bcflights.com')`
 * so look-alikes such as `me@bcflights.com.evil.tld` or `me@notbcflights.com`
 * do not match the corporate domain rule.
 */
export function getRoleForEmail(email: string): AppRole {
  const clean = normalizeEmail(email);

  const entry = ROSTER_BY_EMAIL.get(clean);
  if (entry) return ROSTER_ROLE_TO_APP_ROLE[entry.role];

  if (clean.endsWith("@bcflights.com")) return "AGENT";

  return "PREVIEWER";
}

/** Team a supervisor email is assigned to supervise (null when not a supervisor). */
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
  INDEPENDENT: "Independent Agent",
  AGENT: "Agent",
  PREVIEWER: "Previewer",
};

export const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  DEV: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ADMIN: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  SUPERVISOR: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  INDEPENDENT: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  AGENT: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PREVIEWER: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

/** Pretty default display name derived from an email local-part. */
export function defaultNameForEmail(email: string): string {
  const local = normalizeEmail(email).split("@")[0] ?? "Agent";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Re-export roster name helpers so callers have one import surface. */
export { fullNameForEmail, displayNameForEmail };
