import { prisma } from "./db";

/**
 * Shift attendance tracker.
 *
 * Clock-in happens automatically: the first authenticated page render of a
 * session (and of each new working day) opens an Attendance record whose
 * `clockIn` is the user's official "Attended / Clocked-In" timestamp.
 * Clock-out is written when the user signs out (see LogoutButton ->
 * /api/attendance/clock-out -> /api/auth/logout), recording the official
 * "Shift End / Clock-Out" timestamp.
 */

/** Open (not yet clocked-out) attendance for a user, creating one on demand. */
export async function ensureOpenAttendance(userId: string) {
  const open = await prisma.attendance.findFirst({
    where: { userId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (open) return open;
  return prisma.attendance.create({ data: { userId } });
}

/** Close any open shift for a user — the official "Clock Out" timestamp. */
export async function clockOutUser(userId: string): Promise<Date | null> {
  const now = new Date();
  const { count } = await prisma.attendance.updateMany({
    where: { userId, clockOut: null },
    data: { clockOut: now },
  });
  return count > 0 ? now : null;
}

/** Current shift + recent history for the dashboard. */
export async function getAttendanceOverview(userId: string) {
  const [open, recent] = await Promise.all([
    prisma.attendance.findFirst({
      where: { userId, clockOut: null },
      orderBy: { clockIn: "desc" },
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
