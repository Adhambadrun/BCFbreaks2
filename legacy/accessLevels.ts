/**
 * BCFbreaks access policy — the single source of truth, shared by the Express
 * server (enforcement) and the browser (presentation).
 *
 * This module is dependency-free by design: `server.ts` bundles it with esbuild
 * for the Node runtime, and Vite bundles the same file for the browser, so the two
 * sides cannot drift apart. It deliberately imports nothing from `./firebase`.
 */
import { INITIAL_USERS } from './storage';
import type { UserRole } from './types';

export type AccessLevel = 'production' | 'preview';

/**
 * Environment access tier, evaluated from the verified email only.
 *
 *   production — @bcflights.com, or the developer override account
 *   preview    — every other domain (still authenticated, still restricted)
 *
 * `email` is compared case-insensitively; `endsWith('@bcflights.com')` is
 * deliberately not `includes('bcflights.com')`, so look-alikes such as
 * `me@bcflights.com.evil.tld` or `me@notbcflights.com` do not match.
 */
export function getUserAccessLevel(email?: string | null): AccessLevel {
  if (!email) return 'preview';
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail.endsWith('@bcflights.com') || cleanEmail === DEVELOPER_OVERRIDE_EMAIL) {
    return 'production';
  }
  return 'preview';
}

/** The one non-corporate account granted production access. */
export const DEVELOPER_OVERRIDE_EMAIL = 'adhambadraan@gmail.com';

/** True when an email may hold the production floor (identical to the classic gate). */
export function isEmailAllowedToLogin(email: string): boolean {
  return getUserAccessLevel(email) === 'production';
}

/**
 * Roles that must never be held by a Preview-tier user.
 *
 * Why this exists: `determineRoleForEmail()` grants `admin` to *any* address that
 * merely contains the substring "admin", and Preview tier admits all non-corporate
 * domains. Without this clamp, `someone-admin@gmail.com` could sign in through the
 * tenant's own signup and immediately receive the admin deck (and, because
 * `RoleGuard` lets `developer` bypass every check, the path from admin to
 * developer via GodMode). The tier check is what turns "authenticated" back into
 * "authorized".
 */
export const PRODUCTION_ONLY_ROLES: readonly UserRole[] = ['admin', 'supervisor', 'developer'];

export function isPrivilegedRole(role: UserRole): boolean {
  return PRODUCTION_ONLY_ROLES.includes(role);
}

/**
 * Defenses for the same problem viewed from the other side: what a session may do.
 */
export function canUsePrivilegedSurfaces(accessLevel: AccessLevel, role: UserRole): boolean {
  if (!isPrivilegedRole(role)) return true;
  return accessLevel === 'production';
}

/**
 * Role/team assignment from a verified email.
 *
 * NOTE: email-address shape matching is a bootstrap convenience, not a security
 * boundary. The durable fix is to store `app_metadata.role` in Auth0 and read it
 * from the token; this keeps the existing demo behaviour for now.
 */
export function determineRoleForEmail(email: string): { role: UserRole; teamId: string; name?: string } {
  const lower = email.toLowerCase();
  // Developer override (Adham)
  if (lower === DEVELOPER_OVERRIDE_EMAIL || lower === 'adham@bcflights.com') {
    return { role: 'developer', teamId: 'team_strikers', name: 'Adham Badran' };
  }
  // Admin
  if (lower.includes('admin') || lower === 'karim.admin@bcflights.com' || lower === 'maya.admin@bcflights.com') {
    return { role: 'admin', teamId: 'team_strikers' };
  }
  // Supervisors
  if (lower.includes('supervisor') || lower === 'tarek.zaki@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_strikers' };
  }
  if (lower === 'rania.fawzy@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_titans' };
  }
  if (lower === 'omar.nabil@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_apex' };
  }
  if (lower === 'dina.helmy@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_phantom' };
  }
  const seeded = INITIAL_USERS.find(u => u.email.toLowerCase() === lower);
  if (seeded) {
    return { role: seeded.role, teamId: seeded.teamId, name: seeded.name };
  }
  return { role: 'agent', teamId: 'team_strikers' };
}

/**
 * Resolves the effective role for a session, applying the tier clamp.
 * Returns `agent` for a Preview-tier user who would otherwise be privileged.
 */
export function resolveSessionRole(
  email: string,
  accessLevel: AccessLevel,
  storedRole?: UserRole
): { role: UserRole; teamId: string; demoted: boolean } {
  const meta = determineRoleForEmail(email);
  const role = storedRole || meta.role;
  const privileged = isPrivilegedRole(role);
  const allowed = !privileged || accessLevel === 'production';
  return {
    role: allowed ? role : 'agent',
    teamId: meta.teamId,
    demoted: !allowed,
  };
}

/**
 * Firestore document IDs reject `.`, `/`, `#`, `[`, `]` and `%`. Auth0 subjects
 * are usually safe (`google-oauth2|123…`) but database connections can produce
 * `auth0|user@bcflights.com`, so sanitize rather than assume.
 */
export function sanitizeIdentityId(rawId: string): string {
  return String(rawId || '').replace(/[./#\[\]%]/g, '_');
}
