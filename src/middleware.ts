import { NextRequest, NextResponse } from "next/server";
// Edge-safe session evaluation. The SDK's full server client is Node-only
// (node:crypto HKDF / streams) and cannot compile for the Edge runtime, so the
// middleware uses this WebCrypto-native `getSession` shim that decrypts the
// very same `__session` JWE the Node SDK issues (see src/lib/edge-session.ts).
// (Historical `@auth0/nextjs-auth0/edge` import — that subpath no longer
// exists in SDK v4, which is exactly what broke Vercel builds before.)
import { getSession } from "@/lib/edge-session";

/**
 * Zero-trust middleware — LIVE production mode. There is no demo route, no
 * mock page, no guest browsing: EVERY request must carry a valid Auth0
 * session or it is bounced into the Auth0 Universal Login at
 * `/api/auth/login` (NEVER `/auth/login` — that path is not an auth endpoint
 * in this application and 404s on Vercel).
 *
 * Pass-through (public) surfaces: the Auth0 route mount, the legacy
 * `/auth/*` compatibility forwarder, and `/api/public/*` health endpoints.
 * Static assets are excluded via the matcher below.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/public")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getSession(request, response);

  if (!session || !session.user) {
    // Redirect to the Auth0 login API endpoint to prevent Vercel 404 errors,
    // preserving where the user was headed so they land back after login.
    const loginUrl = new URL("/api/auth/login", request.url);
    const returnTo = pathname + (request.nextUrl.search || "");
    if (returnTo && returnTo !== "/") {
      loginUrl.searchParams.set("returnTo", returnTo);
    }
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|icon.png|apple-icon.png|sitemap.xml|robots.txt).*)",
  ],
};
