import { NextResponse } from "next/server";

/**
 * Never prerender this route (AGENT_INSTRUCTIONS.md §5): it must answer for the
 * environment of the instance actually serving the request, not a build-time
 * snapshot.
 */
export const dynamic = "force-dynamic";

/** Node runtime: only needed for `process.env` reads, but pinned explicitly. */
export const runtime = "nodejs";

/**
 * Public configuration diagnostic — reachable without a session (the
 * middleware passes `/api/public/*` through, see `src/middleware.ts`).
 *
 * WHY THIS EXISTS: when the Auth0 environment variables are absent in a
 * deployment, `/api/auth/*` fails with an opaque 500 (SDK `DomainResolutionError`)
 * and users see a blank page. This endpoint answers "what is missing?" in one
 * GET so misconfiguration can be diagnosed from the browser.
 *
 * PRIVACY CONTRACT — NAMES ONLY, NO VALUES: no secret value is ever echoed
 * here. Presence booleans and (for AUTH0_SECRET) a length>=32 strength flag
 * only. The single exception is APP_BASE_URL, which is echoed verbatim because
 * it is the public origin of the deployment (it must match the callback/logout
 * URLs registered on the Auth0 application, so seeing the actual value is the
 * point). No session or user data is exposed.
 *
 * Required: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET
 * (>= 32 chars), APP_BASE_URL, DATABASE_URL. Optional: RESEND_API_KEY.
 */

const REQUIRED_VARS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "APP_BASE_URL",
  "DATABASE_URL",
] as const;

const OPTIONAL_VARS = ["RESEND_API_KEY"] as const;

/** The two URLs that must be registered on the Auth0 application (dashboard). */
function auth0DashboardUrls(): { allowedCallbackUrl: string; allowedLogoutUrl: string } {
  // Prefer the deployed APP_BASE_URL; fall back to the production origin so
  // the guidance is correct even before APP_BASE_URL itself is set.
  const base = process.env.APP_BASE_URL?.trim() || "https://bcflights.vercel.app";
  return {
    allowedCallbackUrl: `${base}/api/auth/callback`,
    allowedLogoutUrl: base,
  };
}

export async function GET() {
  const required: Record<string, boolean> = {};
  const missing: string[] = [];

  for (const name of REQUIRED_VARS) {
    const value = process.env[name];
    const present = typeof value === "string" && value.trim().length > 0;
    required[name] = present;
    if (!present) missing.push(name);
  }

  // Strength check for the session-cookie signing secret (boolean only —
  // never the value or its exact length). A short AUTH0_SECRET weakens the
  // encrypted session cookie.
  const auth0Secret = process.env.AUTH0_SECRET?.trim() ?? "";
  const auth0SecretStrength = { minLength32: auth0Secret.length >= 32 };

  const optional: Record<string, boolean> = {};
  for (const name of OPTIONAL_VARS) {
    const value = process.env[name];
    optional[name] = typeof value === "string" && value.trim().length > 0;
  }

  return NextResponse.json(
    {
      ok: missing.length === 0,
      required,
      auth0SecretStrength,
      optional,
      missing,
      appBaseUrl: process.env.APP_BASE_URL?.trim() || null,
      auth0DashboardUrls: auth0DashboardUrls(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
