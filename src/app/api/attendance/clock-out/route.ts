import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { clockOutUserWithPolicy } from "@/lib/attendance";

/**
 * Never prerender or statically optimize this route (AGENT_INSTRUCTIONS.md §5):
 * it reads live session/database state, and keeping it dynamic also stops
 * `next build` from importing it into the static-generation worker.
 */
export const dynamic = "force-dynamic";

/**
 * Records the official Shift End / Clock-Out timestamp for the REAL signed-in
 * user, then the client proceeds to /api/auth/logout.
 *
 * Policy enforcement at clock-out: a flagged-late shift whose clarification
 * was never submitted automatically logs an official System Warning to the
 * profile (declined clarifications are already warned at decision time;
 * pending ones remain with the approvers).
 *
 * Note: called with the real session identity — if the developer is currently
 * impersonating someone, only the developer's own shift is closed, never the
 * impersonated member's.
 */
export async function POST() {
  const real = await getSessionUser();
  if (!real) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { clockOut, warningsIssued } = await clockOutUserWithPolicy(real.id);
  return NextResponse.json({ ok: true, clockedOutAt: clockOut, warningsIssued });
}
