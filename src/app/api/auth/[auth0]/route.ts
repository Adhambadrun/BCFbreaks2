import { NextResponse } from "next/server";

/**
 * Structure-preserving handler for /api/auth/[auth0].
 *
 * Auth0 Next.js SDK v4 note: this SDK serves every auth route (login, logout,
 * callback, profile, access-token, backchannel-logout) from
 * `auth0.middleware()` in `src/middleware.ts`, which intercepts requests to
 * the configured `/api/auth/*` paths BEFORE they ever reach a route handler
 * (the v3 `auth0.handleAuth()` used here historically no longer exists in
 * v4). This handler therefore only ever sees requests that bypassed
 * middleware — i.e. never in normal operation — and exists to fail loudly
 * rather than 404 silently.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "auth_route_handled_by_middleware",
      hint: "Auth0 routes are served by auth0.middleware() — see src/middleware.ts. Login lives at /api/auth/login.",
    },
    { status: 404 },
  );
}

export const POST = GET;
