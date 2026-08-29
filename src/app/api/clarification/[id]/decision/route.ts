import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isPrivilegedRole } from "@/lib/permissions";

/**
 * Never prerender or statically optimize this route (AGENT_INSTRUCTIONS.md §5):
 * it reads live session/database state, and keeping it dynamic also stops
 * `next build` from importing it into the static-generation worker.
 */
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * POST /api/clarification/[id]/decision — Approvals queue decision.
 * Accessible to Admins, Supervisors and the Developer only.
 *
 *   APPROVE → the latency flag clears without penalty.
 *   DECLINE → an official System Warning is logged to the agent's profile.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const decider = await getSessionUser();
  if (!decider) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!isPrivilegedRole(decider.role)) {
    return NextResponse.json(
      { error: "Forbidden — Admins, Supervisors and the Developer only" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  let payload: { action?: string; note?: string };
  try {
    payload = (await request.json()) as { action?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = payload.action?.toUpperCase();
  if (action !== "APPROVE" && action !== "DECLINE") {
    return NextResponse.json({ error: "action must be APPROVE or DECLINE" }, { status: 400 });
  }
  const note = payload.note?.trim() || null;

  const clarification = await prisma.clarificationRequest.findUnique({
    where: { id },
    include: { attendance: true, user: true },
  });
  if (!clarification) {
    return NextResponse.json({ error: "Clarification not found" }, { status: 404 });
  }
  if (clarification.status !== "PENDING") {
    return NextResponse.json(
      { error: `This clarification was already ${clarification.status.toLowerCase()}.` },
      { status: 409 },
    );
  }

  if (action === "APPROVE") {
    // APPROVED: latency flag clears without penalty.
    await prisma.$transaction([
      prisma.clarificationRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          decidedById: decider.id,
          decisionNote: note,
          decidedAt: new Date(),
        },
      }),
      prisma.attendance.update({
        where: { id: clarification.attendanceId },
        data: { latencyCleared: true },
      }),
    ]);
    return NextResponse.json({ ok: true, status: "APPROVED", latencyCleared: true });
  }

  // DECLINED: automatic official System Warning on the profile.
  const reason = `Late arrival ${clarification.attendance.lateMinutes} min past scheduled start (${clarification.attendance.clockIn.toISOString()}) — written clarification DECLINED.`;
  await prisma.$transaction([
    prisma.clarificationRequest.update({
      where: { id },
      data: {
        status: "DECLINED",
        decidedById: decider.id,
        decisionNote: note,
        decidedAt: new Date(),
      },
    }),
    prisma.warning.create({
      data: {
        userId: clarification.userId,
        reason: note ? `${reason} Reviewer note: ${note}` : reason,
        kind: "SYSTEM",
        issuedBy: `SYSTEM (${decider.email})`,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, status: "DECLINED", warningLogged: true });
}
