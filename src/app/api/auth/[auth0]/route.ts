import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * Auth0 SDK route mount — serves every authentication endpoint under
 * `/api/auth/*` (login, logout, callback, profile, access-token,
 * backchannel-logout) by delegating to `auth0.middleware()`.
 *
 * Runtime note: this handler runs in the NODE runtime (see `export const
 * runtime` below) where the SDK's full server client is safe to execute — the
 * Node-only code paths (node:crypto HKDF, CompressionStream consumers) that
 * break Edge builds are fine here, and `serverExternalPackages` in
 * next.config.js keeps the SDK external to the server bundle.
 *
 * Zero-trust flow: unauthenticated visitors are redirected by
 * `src/middleware.ts` to `/api/auth/login`, which lands HERE and starts the
 * Auth0 Universal Login. `/auth/login` (legacy path) is forwarded to this
 * flow by `src/app/auth/login/page.tsx`.
 */
export const runtime = "nodejs";

async function handler(request: NextRequest): Promise<NextResponse> {
  return auth0.middleware(request);
}

export { handler as GET, handler as POST };
