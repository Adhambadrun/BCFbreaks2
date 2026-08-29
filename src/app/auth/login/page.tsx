import { redirect } from "next/navigation";

/**
 * Legacy-path compatibility forwarder.
 *
 * The system's login endpoint is `/api/auth/login` (the Auth0 SDK route).
 * Hitting the old bare `/auth/login` path forwards into the real flow instead
 * of stranding users on a Vercel 404 — the middleware deliberately passes
 * `/auth/*` through so this page can perform the redirect.
 */
export default async function LegacyAuthLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const target = returnTo
    ? `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/api/auth/login";
  redirect(target);
}
