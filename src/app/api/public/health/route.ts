import { NextResponse } from "next/server";

/**
 * Public health endpoint — intentionally reachable without a session (the
 * middleware's `/api/public` pass-through). Reports liveness only; it never
 * exposes user data.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "bcfbreaks", time: new Date().toISOString() });
}
