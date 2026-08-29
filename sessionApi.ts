/**
 * Client view of the server-verified session.
 *
 * The browser holds no tokens and cannot assert who it is: `serverAuth.ts` owns the
 * Auth0 session and hands out only display fields here. Everything the UI needs to
 * *decide* (role, access tier) is computed server-side from the verified ID token,
 * so a user editing local state or localStorage can change what they see but never
 * what they are allowed to do — every API and the gate itself re-check regardless.
 */
import type { AccessLevel } from './accessLevels';
import type { UserRole } from './types';

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  teamId: string;
}

export interface SessionSnapshot {
  user: SessionUser;
  accessLevel: AccessLevel;
  env: string;
  expiresAt: number;
}

export type SessionOutcome =
  | { status: 'authenticated'; session: SessionSnapshot }
  | { status: 'unauthenticated'; login: string }
  | { status: 'unavailable'; reason: string };

/**
 * Reads `/api/session`.
 *
 * `credentials: 'same-origin'` is explicit rather than implied: the session cookie
 * is what authenticates this call. A 401 is a normal, expected state (logged out),
 * while a 503 means the *server* could not be configured — the two must not be
 * conflated, or a broken deployment would look like "nobody is signed in".
 */
export async function fetchSession(): Promise<SessionOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
  } catch (err: any) {
    return { status: 'unavailable', reason: err?.message || 'Session endpoint unreachable' };
  }

  if (res.status === 401) {
    const body = await res.json().catch(() => null);
    return { status: 'unauthenticated', login: body?.login || '/auth/login' };
  }
  if (!res.ok) {
    return { status: 'unavailable', reason: `Session endpoint returned HTTP ${res.status}` };
  }

  const data = await res.json().catch(() => null);
  if (!data?.authenticated || !data.user?.email) {
    return { status: 'unavailable', reason: 'Malformed session payload' };
  }
  return {
    status: 'authenticated',
    session: {
      user: data.user,
      accessLevel: data.accessLevel === 'production' ? 'production' : 'preview',
      env: data.env || 'unknown',
      expiresAt: Number(data.expiresAt) || 0,
    },
  };
}

/** Sends the browser to Auth0's hosted login, returning to the current location. */
export function beginLogin(returnTo?: string): void {
  const target = returnTo ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/auth/login?returnTo=${encodeURIComponent(target || '/')}`);
}

/** Server-side logout: clears the cookie and bounces through Auth0's /v2/logout. */
export function beginLogout(): void {
  window.location.assign('/auth/logout');
}
