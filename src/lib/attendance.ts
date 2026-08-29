import { prisma } from "./db";
import { evaluateLatency, needsClockOutSystemWarning, scheduledStartFor } from "./policy";

/**
 * Shift attendance tracker.
 *
 * Clock-in happens automatically: the first authenticated page render of a
 * session (and of each new working day) opens an Attendance record whose
 * `clockIn` is the user's official "Attended / Clocked-In" timestamp.
 * The record is latency-stamped at creation against the team's scheduled
 * shift start — the 15-minute company leeway is enforced by src/lib/policy.ts
 * (no indicator below the threshold; flagged "Late" beyond it).
 *
 * Clock-out is written when the user signs out (see LogoutButton ->
 * /api/attendance/clock-out -> /api/auth/logout), recording the official
 * "Shift End / Clock-Out" timestamp. Any flagged-late shift with no
 * clarification submitted automatically logs a System Warning at that moment.
 */

type TeamLike = { shiftStartDefault: string } | null | undefined;

/**
 * Open (not yet clocked-out) attendance for a user, creating one on demand.
 * The created record is stamped with the scheduled shift start (from the
 * user's team default) and the evaluated lateness for the 15-minute engine.
 */
export async function ensureOpenAttendance(userId: string, team?: TeamLike) {
  const open = await prisma.attendance.findFirst({
    where: { userId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (open) return open;

  const clockIn = new Date();
  const scheduledStart = scheduledStartFor(clockIn, team?.shiftStartDefault);
  const evaluation = evaluateLatency(clockIn, scheduledStart);

  return prisma.attendance.create({
    data: {
      userId,
      clockIn,
      scheduledStart,
      lateMinutes: evaluation.minutesLate,
      latencyCleared: false,
    },
  });
}

/**
 * Close any open shifts for a user — the official "Clock Out" timestamp —
 * and enforce the clarification policy: flagged-late shifts with NO
 * clarification submitted automatically log an official System Warning
 * ("unsubmitted clarification"). Returns the warnings that were issued.
 */
export async function clockOutUserWithPolicy(userId: string): Promise<{
  clockOut: Date | null;
  warningsIssued: number;
}> {
  const now = new Date();

  const openShifts = await prisma.attendance.findMany({
    where: { userId, clockOut: null },
    include: { clarifications: { orderBy: { createdAt: "desc" } } },
  });
  if (openShifts.length === 0) return { clockOut: null, warningsIssued: 0 };

  await prisma.attendance.updateMany({
    where: { userId, clockOut: null },
    data: { clockOut: now },
  });

  let warningsIssued = 0;
  for (const shift of openShifts) {
    const flaggedLate = shift.lateMinutes > 15 && !shift.latencyCleared;
    const hasClarification = shift.clarifications.length > 0;
    if (needsClockOutSystemWarning(flaggedLate, hasClarification)) {
      await prisma.warning.create({
        data: {
          userId,
          reason: `Late arrival ${shift.lateMinutes} min past scheduled start (${shift.clockIn.toISOString()}) — clarification was never submitted before clock-out.`,
          kind: "SYSTEM",
          issuedBy: "SYSTEM",
        },
      });
      warningsIssued += 1;
    }
  }

  return { clockOut: now, warningsIssued };
}

/** Current shift + recent history for the dashboard. */
export async function getAttendanceOverview(userId: string) {
  const [open, recent] = await Promise.all([
    prisma.attendance.findFirst({
      where: { userId, clockOut: null },
      orderBy: { clockIn: "desc" },
      include: { clarifications: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.attendance.findMany({
      where: { userId },
      orderBy: { clockIn: "desc" },
      take: 6,
    }),
  ]);
  return { open, recent };
}

/** Live "who is on shift" status for a set of users. */
export async function getTeamAttendanceStatus(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { clockIn: Date }>();
  const open = await prisma.attendance.findMany({
    where: { userId: { in: userIds }, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  const map = new Map<string, { clockIn: Date }>();
  for (const row of open) {
    if (!map.has(row.userId)) map.set(row.userId, { clockIn: row.clockIn });
  }
  return map;
}

/** Pending approvals count for the managers' navigation badge. */
export async function getPendingApprovalsCount(): Promise<number> {
  return prisma.clarificationRequest.count({ where: { status: "PENDING" } });
}
