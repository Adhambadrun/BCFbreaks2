import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 Next.js SDK (v4) singleton.
 *
 * All authentication endpoints are mounted under `/api/auth/*` (configured via
 * the `routes` option). In SDK v4 the `auth0.middleware()` call in
 * `src/middleware.ts` serves these routes — login, logout, callback, profile —
 * so unauthenticated visitors must ALWAYS be redirected to
 * `/api/auth/login` (never `/auth/login`, which does not exist in this app and
 * produces a 404 on Vercel).
 *
 * Environment variables (see .env.example):
 *   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL
 */
export const auth0 = new Auth0Client({
  routes: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    callback: "/api/auth/callback",
    profile: "/api/auth/profile",
    accessToken: "/api/auth/access-token",
    backChannelLogout: "/api/auth/backchannel-logout",
  },
});
