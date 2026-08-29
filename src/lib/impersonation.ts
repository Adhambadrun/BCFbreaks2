import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeEmail } from "./permissions";

/**
 * Developer impersonation engine.
 *
 * The Developer (adhambadraan@gmail.com) can view the app as ANY other user to
 * test role permissions, team views and UI states in real time. The
 * impersonation target is stored in a signed cookie so it survives navigation
 * and reloads — but it is ONLY honored when the *real* authenticated session
 * belongs to the Developer, making it impossible to forge without the
 * AUTH0_SECRET signing key.
 */

export const IMPERSONATION_COOKIE = "bcf_impersonation";

function signingSecret(): string {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error("AUTH0_SECRET must be set to sign impersonation cookies");
  return secret;
}

export function signImpersonation(email: string): string {
  const clean = normalizeEmail(email);
  const mac = createHmac("sha256", signingSecret()).update(clean).digest("hex");
  return `${clean}.${mac}`;
}

export function verifyImpersonation(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return null;
  const email = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const expected = createHmac("sha256", signingSecret()).update(email).digest("hex");
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return normalizeEmail(email);
}

/** Read the impersonation target requested by the current browser (unverified role-wise). */
export async function readImpersonationCookie(): Promise<string | null> {
  const store = await cookies();
  return verifyImpersonation(store.get(IMPERSONATION_COOKIE)?.value);
}
