import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { clockOutUser } from "@/lib/attendance";

/**
 * Records the official Shift End / Clock-Out timestamp for the REAL signed-in
 * user, then the client proceeds to /api/auth/logout.
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

  const clockOut = await clockOutUser(real.id);
  return NextResponse.json({ ok: true, clockedOutAt: clockOut });
}
