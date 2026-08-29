import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { evaluateLatency, LATENCY_LEEWAY_MINUTES } from "@/lib/policy";

export const runtime = "nodejs";

/**
 * POST /api/attendance/clarification — the agent's written clarification for a
 * flagged-late shift (> 15 minutes past scheduled start, the company leeway).
 *
 * Creates a PENDING ClarificationRequest that routes to the Pending Approvals
 * queue (Admins, Supervisors, Developer). APPROVED clears the latency flag;
 * DECLINED (or never submitted) logs a System Warning automatically.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let payload: { attendanceId?: string; message?: string };
  try {
    payload = (await request.json()) as { attendanceId?: string; message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const attendanceId = payload.attendanceId?.trim();
  const message = payload.message?.trim();
  if (!attendanceId || !message) {
    return NextResponse.json({ error: "attendanceId and message are required" }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Clarification too long (max 5000 chars)" }, { status: 413 });
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { clarifications: true },
  });
  if (!attendance || attendance.userId !== user.id) {
    return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
  }

  // Recompute latency server-side — never trust a client-supplied flag.
  const evaluation = evaluateLatency(attendance.clockIn, attendance.scheduledStart);
  if (!evaluation.flagged) {
    return NextResponse.json(
      {
        error: `This shift is within the ${LATENCY_LEEWAY_MINUTES}-minute company leeway — no clarification is needed.`,
      },
      { status: 409 },
    );
  }
  if (attendance.latencyCleared) {
    return NextResponse.json({ error: "This latency flag was already cleared." }, { status: 409 });
  }
  if (attendance.clarifications.length > 0) {
    return NextResponse.json(
      { error: "A clarification was already submitted for this shift." },
      { status: 409 },
    );
  }

  const created = await prisma.clarificationRequest.create({
    data: {
      attendanceId: attendance.id,
      userId: user.id,
      message,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, clarificationId: created.id, status: created.status });
}
