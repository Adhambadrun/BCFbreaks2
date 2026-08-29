/**
 * Edge-safe Auth0 session evaluation for `src/middleware.ts`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `@auth0/nextjs-auth0`'s full server client cannot execute inside the Next.js
 * Edge Runtime: it pulls in Node built-ins (node:crypto HKDF via
 * `@panva/hkdf`, Compression/DecompressionStream consumers, fs tracing). This
 * previously surfaced as Vercel/`next build` Edge compilation failures.
 *
 * The v4 SDK does not publish an `@auth0/nextjs-auth0/edge` entry point, so
 * this module implements the middleware-side half of the SDK (`getSession`)
 * using ONLY Web-standard APIs available in the Edge Runtime (`jose` +
 * WebCrypto). It reads the exact same JWE session cookie the Node SDK writes:
 *
 *   - cookie name `__session` (chunked as `__session__0`, `__session__1`, …)
 *   - legacy cookie `appSession` (chunked as `appSession.0`, `appSession.1`, …)
 *   - JWE: alg `dir`, enc `A256GCM`
 *   - content key: HKDF-SHA256(secret, salt="", info="JWE CEK", 32 bytes)
 *   - payload: `{ user, tokenSet, internal }` (legacy cookies carry the user
 *     claims at the top level and are normalized the same way the SDK does)
 *
 * The heavy lifting (login/logout/callback, token rotation, rolling sessions)
 * stays in the Node-runtime SDK mounted at `src/app/api/auth/[auth0]/route.ts`
 * — middleware only needs to answer one question: "is this request
 * authenticated?" — and it fails CLOSED: any decryption/config error is
 * treated as "no session" and bounces the visitor into the Auth0 login.
 */

import { jwtDecrypt } from "jose";

const SESSION_COOKIE_NAME = "__session";
const LEGACY_COOKIE_NAME = "appSession";

/** Minimum remaining entropy the JWE AAAD… no-op; mirrors SDK clock tolerance. */
const CLOCK_TOLERANCE_SECONDS = 15;

export type EdgeSessionUser = {
  sub?: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  [claim: string]: unknown;
};

export type EdgeSession = {
  user: EdgeSessionUser;
  tokenSet?: Record<string, unknown>;
  internal?: { sid?: string; createdAt?: number };
};

// ---------------------------------------------------------------------------
// Cookie utilities (Edge-safe — no `next/headers`, request-scoped only)
// ---------------------------------------------------------------------------

function readCookieJar(request: Request): Map<string, string> {
  const jar = new Map<string, string>();
  const header = request.headers.get("cookie");
  if (!header) return jar;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    if (!jar.has(name)) jar.set(name, decodeURIComponent(value));
  }
  return jar;
}

/** Mirrors the SDK's chunked-cookie reassembly (chunks join with ""). */
function reassembleChunked(
  jar: Map<string, string>,
  baseName: string,
  legacySeparator: boolean,
): string | undefined {
  const direct = jar.get(baseName);
  if (direct) return direct;

  const suffixRegex = legacySeparator ? /\.(\d+)$/ : /__(\d+)$/;
  const chunks: Array<{ index: number; value: string }> = [];
  for (const [name, value] of jar) {
    if (!name.startsWith(baseName)) continue;
    const match = suffixRegex.exec(name.slice(baseName.length));
    if (match) chunks.push({ index: parseInt(match[1] ?? "0", 10), value });
  }
  if (chunks.length === 0) return undefined;
  chunks.sort((a, b) => a.index - b.index);
  // Sequence integrity: 0..N with no gaps, exactly like the SDK.
  for (let i = 0; i < chunks.length; i += 1) {
    if (chunks[i]!.index !== i) return undefined;
  }
  return chunks.map((c) => c.value).join("");
}

// ---------------------------------------------------------------------------
// JWE decryption (WebCrypto HKDF — identical KDF to the SDK's cookies.ts)
// ---------------------------------------------------------------------------

let cachedKeyMaterial: Uint8Array | null = null;

async function derivedContentKey(secret: string): Promise<Uint8Array> {
  if (cachedKeyMaterial) return cachedKeyMaterial;

  const encoder = new TextEncoder();
  const ikm = encoder.encode(secret);
  const info = encoder.encode("JWE CEK");
  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info },
    baseKey,
    32 * 8,
  );
  cachedKeyMaterial = new Uint8Array(bits);
  return cachedKeyMaterial;
}

/** Normalize a legacy (SDK v3-era) session payload, mirroring the SDK. */
function normalizeSession(decrypted: {
  payload: Record<string, unknown>;
  protectedHeader: Record<string, unknown>;
}): EdgeSession | null {
  const payload = decrypted.payload as Record<string, unknown>;
  const header = decrypted.protectedHeader as Record<string, unknown>;

  if (header?.iat) {
    // Legacy shape: user claims at top level next to token fields.
    const user = (payload.user ?? null) as EdgeSessionUser | null;
    if (!user) return null;
    return {
      user,
      tokenSet: {
        idToken: payload.idToken,
        accessToken: payload.accessToken,
        scope: payload.accessTokenScope,
        refreshToken: payload.refreshToken,
        expiresAt: payload.accessTokenExpiresAt,
      },
      internal: {
        sid: (user as { sid?: string }).sid,
        createdAt: typeof header.iat === "number" ? header.iat : undefined,
      },
    };
  }

  const user = (payload.user ?? null) as EdgeSessionUser | null;
  if (!user) return null;
  return {
    user,
    tokenSet: (payload.tokenSet ?? undefined) as Record<string, unknown> | undefined,
    internal: (payload.internal ?? undefined) as EdgeSession["internal"],
  };
}

/**
 * Edge equivalent of `getSession(request, response)` from the Auth0 SDK.
 * Returns `null` when there is no valid session — never throws. Accepts an
 * optional response argument so the signature matches the SDK's edge helper;
 * rolling-session writes are deliberately not performed here (they stay in the
 * Node runtime routes, which own the session lifecycle).
 */
export async function getSession(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _response?: unknown,
): Promise<EdgeSession | null> {
  try {
    const secret = process.env.AUTH0_SECRET;
    if (!secret) return null; // fail closed

    const jar = readCookieJar(request);
    const cookieValue =
      reassembleChunked(jar, SESSION_COOKIE_NAME, false) ??
      reassembleChunked(jar, LEGACY_COOKIE_NAME, true);
    if (!cookieValue) return null;

    const key = await derivedContentKey(secret);
    const decrypted = await jwtDecrypt(cookieValue, key, {
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });

    return normalizeSession(decrypted);
  } catch {
    // Expired, tampered or unreadable cookie — unauthenticated, fail closed.
    return null;
  }
}
