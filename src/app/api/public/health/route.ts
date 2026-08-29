import { NextResponse } from "next/server";

/**
 * Never prerender this route (AGENT_INSTRUCTIONS.md §5). It reports liveness,
 * so a build-time snapshot would be a stale lie — every request must answer for
 * the running instance.
 */
export const dynamic = "force-dynamic";

/**
 * Public health endpoint — intentionally reachable without a session (the
 * middleware's `/api/public` pass-through). Reports liveness only; it never
 * exposes user data.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "bcfbreaks", time: new Date().toISOString() });
}
