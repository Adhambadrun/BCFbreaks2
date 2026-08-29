import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

/**
 * Zero-trust middleware — LIVE production mode. There is no demo route, no
 * mock page, no guest browsing: EVERY request must carry an Auth0 session or
 * it is bounced straight into the Auth0 Universal Login.
 *
 * Route fix (the Vercel 404 bug): unauthenticated visitors are redirected to
 * `/api/auth/login` — the SDK-configured login route handled by
 * `auth0.middleware()` — and NEVER to `/auth/login`, which is not a route in
 * this application.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth0 SDK routes (login/logout/callback/profile/access-token/backchannel)
  // are served by the SDK middleware itself.
  if (pathname.startsWith("/api/auth")) {
    return await auth0.middleware(request);
  }

  const session = await auth0.getSession(request);

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

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
