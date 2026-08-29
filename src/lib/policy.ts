/**
 * BCFbreaks policy engine — the single source of truth for the 15-minute
 * latency rules and the request/leave policy limits. Dependency-free and
 * pure so it can run in the browser, route handlers, seeds and audits.
 *
 * LATENCY TRACKING (15-MINUTE COMPANY LEEWAY)
 * -------------------------------------------
 *   0–15 minutes late  → company leeway. NO latency indicator is displayed
 *                        and nothing is flagged.
 *   > 15 minutes late  → the session is automatically flagged "Late":
 *                          • +1 hour shift penalty per occurrence
 *                          • 1 hour late requires 2 hours coverage
 *                        and the agent is prompted for a written
 *                        clarification.
 *
 * CLARIFICATION & WARNING RULES
 * -----------------------------
 *   • A written clarification routes to Pending Approvals
 *     (Admins, Supervisors and the Developer).
 *   • APPROVED          → the latency flag clears without penalty.
 *   • DECLINED          → an official System Warning is logged to the profile.
 *   • NEVER SUBMITTED   → (shift ends with an unanswered late flag) an
 *                         official System Warning is logged automatically.
 */

// ---------------------------------------------------------------------------
// Latency constants
// ---------------------------------------------------------------------------

/** Company leeway window, in minutes, before a late flag may appear. */
export const LATENCY_LEEWAY_MINUTES = 15;

/** Shift penalty hours applied per flagged late occurrence. */
export const LATE_PENALTY_HOURS = 1;

/** Coverage hours required per hour of lateness (1h late → 2h coverage). */
export const COVERAGE_HOURS_PER_LATE_HOUR = 2;

// ---------------------------------------------------------------------------
// Latency math (pure)
// ---------------------------------------------------------------------------

export type LatencyEvaluation = {
  /** Minutes between scheduled shift start and the actual clock-in. */
  minutesLate: number;
  /**
   * True ONLY when the lateness exceeds the 15-minute leeway — this gates
   * every UI indicator, flag and clarification prompt in the product.
   */
  flagged: boolean;
  /** Penalty hours for the occurrence (0 when within leeway). */
  penaltyHours: number;
  /** Coverage hours required (0 when within leeway). */
  coverageHoursRequired: number;
};

/**
 * Resolve the Date a shift starting on `day` was scheduled to begin, given a
 * team's default shift start ("HH:MM"). Uses the server's operations
 * timezone. Returns `null` when no schedule is configured.
 */
export function scheduledStartFor(day: Date, shiftStartHHMM: string | null | undefined): Date | null {
  if (!shiftStartHHMM) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(shiftStartHHMM.trim());
  if (!match) return null;
  const hours = Math.min(23, parseInt(match[1]!, 10));
  const minutes = Math.min(59, parseInt(match[2]!, 10));
  const start = new Date(day);
  start.setHours(hours, minutes, 0, 0);
  return start;
}

/**
 * Evaluate a clock-in against the scheduled shift start.
 * At or before scheduled start → not late. Within 15 minutes past → leeway,
 * NOT flagged (no UI indicator may be shown). Beyond 15 minutes → flagged.
 */
export function evaluateLatency(
  clockIn: Date,
  scheduledStart: Date | null | undefined,
): LatencyEvaluation {
  const empty: LatencyEvaluation = {
    minutesLate: 0,
    flagged: false,
    penaltyHours: 0,
    coverageHoursRequired: 0,
  };
  if (!scheduledStart) return empty;

  const minutesLate = Math.max(0, Math.round((clockIn.getTime() - scheduledStart.getTime()) / 60000));
  const flagged = minutesLate > LATENCY_LEEWAY_MINUTES;
  return {
    minutesLate,
    flagged,
    penaltyHours: flagged ? LATE_PENALTY_HOURS : 0,
    coverageHoursRequired: flagged
      ? Math.max(COVERAGE_HOURS_PER_LATE_HOUR, Math.ceil((minutesLate / 60) * COVERAGE_HOURS_PER_LATE_HOUR))
      : 0,
  };
}

/**
 * Whether a late attendance still owes the system a clarification — used to
 * decide the automatic System Warning at clock-out (DECLINED or never
 * submitted → warning; APPROVED or not flagged → clear).
 */
export function owesSystemWarning(input: {
  flaggedLate: boolean;
  clarificationStatus?: "PENDING" | "APPROVED" | "DECLINED" | null;
}): boolean {
  if (!input.flaggedLate) return false;
  return input.clarificationStatus !== "APPROVED" && input.clarificationStatus !== "PENDING";
}

/**
 * Clock-out rule: a flagged-late shift with NO clarification at all is treated
 * as "unsubmitted" and logs a System Warning automatically. (PENDING is still
 * with the approvers; APPROVED cleared the flag; DECLINED was already warned
 * at decision time — neither may double-issue.)
 */
export function needsClockOutSystemWarning(flaggedLate: boolean, hasAnyClarification: boolean): boolean {
  return flaggedLate && !hasAnyClarification;
}

// ---------------------------------------------------------------------------
// Request / leave policy (surfaced in the Email Template Dispatcher UI)
// ---------------------------------------------------------------------------

export const REQUEST_POLICY = {
  SWAP_DAY: {
    label: "Swap Day",
    rules: [
      "1 swap day every 45 days",
      "Must request 24h in advance with coverage date included",
      "WFH target: min 40 outbound calls (avg 2h talk time) and 3 leads or 30 BQ",
      "Extra swaps count 2-for-1",
    ],
  },
  LEAVE: {
    label: "Annual Leave / Sick Day",
    rules: [
      "21 Annual Leave days per year",
      "Max 20–30% of the floor off at once; 1 request per 45 days; 24h notice",
      "10 Sick Days per year — valid medical certificate required",
    ],
  },
  WFH: {
    label: "Work From Home",
    rules: [
      "Max 1 request per month (20–30% capacity limit)",
      "Must meet WFH targets or be marked No Show ($100 NET penalty)",
    ],
  },
  SHIFT_CHANGE: {
    label: "Shift Change",
    rules: ["Requires current shift, target shift, and explicit operational reason"],
  },
} as const;

/** Operational mailbox every in-app request email is delivered to. */
export const ATTENDANCE_MAILBOX = "attendance.cai@bcflights.com";
