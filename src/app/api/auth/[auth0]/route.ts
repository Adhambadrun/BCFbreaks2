import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * Never prerender or statically optimize this route (AGENT_INSTRUCTIONS.md §5):
 * it reads live session/database state, and keeping it dynamic also stops
 * `next build` from importing it into the static-generation worker.
 */
export const dynamic = "force-dynamic";

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

/**
 * Human-readable failure shape for configuration errors. When the Auth0 env
 * vars are absent (or malformed), the SDK throws a typed `SdkError` subclass
 * (e.g. `DomainResolutionError`, code `domain_resolution_error`) from inside
 * `auth0.middleware()`. Left unhandled that becomes Next's blank 500 — the
 * production "white screen". We catch it, log the full detail server-side, and
 * return readable JSON pointing at the public diagnostic endpoint.
 */
function toReadableAuthError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const rawCode = (error as { code?: unknown }).code;
    const code = typeof rawCode === "string" && rawCode.length > 0 ? rawCode : "auth_middleware_error";
    const cause = error.cause instanceof Error ? ` — ${error.cause.message}` : "";
    return { code, message: `${error.message}${cause}` };
  }
  return { code: "auth_middleware_error", message: String(error) };
}

async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    return await auth0.middleware(request);
  } catch (error) {
    // Configuration/runtime failure inside the SDK (missing or invalid env
    // vars, unreachable tenant, …). Log everything for Vercel logs, but keep
    // the response readable — never a blank page.
    console.error("[api/auth] auth0.middleware failed:", error);
    const { code, message } = toReadableAuthError(error);
    return NextResponse.json(
      {
        error: "authentication_is_misconfigured",
        code,
        message,
        hint: "This deployment's Auth0 configuration is missing or invalid. GET /api/public/config (public, no session required) reports which environment variables are missing — names only, no values — plus the Allowed Callback / Logout URLs that must be registered on the Auth0 application.",
        diagnosticsUrl: "/api/public/config",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export { handler as GET, handler as POST };
