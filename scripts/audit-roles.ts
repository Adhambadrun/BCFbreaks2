/**
 * End-to-end audit for the BCFbreaks role engine + system invariants.
 * Run: npm run audit:roles
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  getRoleForEmail,
  getSupervisorTeamForEmail,
  type AppRole,
} from "../src/lib/permissions";
import { ROSTER } from "../src/lib/roster";
import {
  evaluateLatency,
  owesSystemWarning,
  needsClockOutSystemWarning,
  scheduledStartFor,
  LATENCY_LEEWAY_MINUTES,
} from "../src/lib/policy";

/** Helper: a Date `minutes` after 2026-08-29 09:00 local. */
function atMinutes(minutes: number): Date {
  const base = new Date(2026, 7, 29, 9, 0, 0, 0);
  return new Date(base.getTime() + minutes * 60000);
}

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `  (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}

// ---------------------------------------------------------------------------
// 1. Role & email resolution matrix (derived from the canonical roster)
// ---------------------------------------------------------------------------
const ROSTER_ROLE: Record<string, AppRole> = {
  "Admin / Manager": "ADMIN",
  Developer: "DEV",
  "Independent Agent": "INDEPENDENT",
  Supervisor: "SUPERVISOR",
  "Team Member": "AGENT",
};

console.log("\n== Role & email resolution ==");
for (const entry of ROSTER) {
  check(entry.email, getRoleForEmail(entry.email), ROSTER_ROLE[entry.role]);
}

// Automatic domain rule for non-roster corporate addresses.
check("any_other@bcflights.com", getRoleForEmail("any_other@bcflights.com"), "AGENT");
check("external@gmail.com", getRoleForEmail("external@gmail.com"), "PREVIEWER");
check("random@outlook.com", getRoleForEmail("random@outlook.com"), "PREVIEWER");

// Case-insensitivity + trimming
check("Case: LAMAR@BCFLIGHTS.COM", getRoleForEmail("LAMAR@BCFLIGHTS.COM"), "AGENT");
check("Case: Jay@BCFlights.com", getRoleForEmail("Jay@BCFlights.com"), "SUPERVISOR");
check("Trim:  dev@gmail.com ", getRoleForEmail(" adhambadraan@gmail.com "), "DEV");

// Look-alike domain hardening
check("Spoof: me@bcflights.com.evil.tld", getRoleForEmail("me@bcflights.com.evil.tld"), "PREVIEWER");
check("Spoof: me@notbcflights.com", getRoleForEmail("me@notbcflights.com"), "PREVIEWER");

// Supervisor team assignments
console.log("\n== Supervisor team assignments ==");
check("Jay -> CAI 2", getSupervisorTeamForEmail("jay@bcflights.com"), "CAI 2");
check("Albert -> CAI 3", getSupervisorTeamForEmail("albert@bcflights.com"), "CAI 3");
check("Watkins -> CAI 4", getSupervisorTeamForEmail("watkins@bcflights.com"), "CAI 4");
check("Amir -> CAI 5", getSupervisorTeamForEmail("amir@bcflights.com"), "CAI 5");
check("Dominick (independent) -> no team", getSupervisorTeamForEmail("dominick@bcflights.com"), null);

// ---------------------------------------------------------------------------
// 1b. Roster data integrity (the data-management invariants)
// ---------------------------------------------------------------------------
console.log("\n== Roster data integrity ==");
check("roster contains 47 people", ROSTER.length, 47);

const emails = ROSTER.map((e) => e.email.toLowerCase());
check("no duplicate emails", new Set(emails).size, emails.length);

let namesOk = true;
for (const e of ROSTER) {
  const firstName = e.fullName.split(/\s+/)[0];
  if (e.displayName !== firstName) namesOk = false;
}
check("display name is always the first name", namesOk, true);

let emailsOk = true;
for (const e of ROSTER) {
  const expected =
    e.email.toLowerCase() === "adhambadraan@gmail.com"
      ? "adhambadraan@gmail.com"
      : `${e.displayName.toLowerCase()}@bcflights.com`;
  if (e.email !== expected) emailsOk = false;
}
check("email follows firstname@bcflights.com (Adham = gmail)", emailsOk, true);

const supervisors = ROSTER.filter((e) => e.role === "Supervisor");
check("exactly 4 supervisors", supervisors.length, 4);
check(
  "supervisors are never duplicated as team members",
  supervisors.every((s) => !ROSTER.some((e) => e !== s && e.email === s.email)),
  true,
);

// ---------------------------------------------------------------------------
// 2. Middleware & auth wiring (no /auth/login 404 regressions)
// ---------------------------------------------------------------------------
console.log("\n== Middleware & auth validation ==");
const mwPath = path.join(ROOT, "src", "middleware.ts");
const mw = existsSync(mwPath) ? readFileSync(mwPath, "utf8") : "";
check("src/middleware.ts exists", existsSync(mwPath), true);
check("middleware redirects unauthenticated to /api/auth/login", mw.includes('"/api/auth/login"'), true);
check("middleware never redirects to /auth/login", /redirect\([^)]*["'`]\/auth\/login/.test(mw), false);
check("middleware passes /api/auth through to the SDK mount (edge-safe)", mw.includes('pathname.startsWith("/api/auth")'), true);
const authRouteHandler = readFileSync(path.join(ROOT, "src", "app", "api", "auth", "[auth0]", "route.ts"), "utf8");
check("auth route mount serves via auth0.middleware", authRouteHandler.includes("auth0.middleware(request)"), true);
check("auth route mount runs in the node runtime", authRouteHandler.includes('runtime = "nodejs"'), true);

const auth0libPath = path.join(ROOT, "src", "lib", "auth0.ts");
const auth0lib = existsSync(auth0libPath) ? readFileSync(auth0libPath, "utf8") : "";
check("routes configured to /api/auth/login", auth0lib.includes('"/api/auth/login"'), true);
check("routes configured to /api/auth/callback", auth0lib.includes('"/api/auth/callback"'), true);

const authRoutePath = path.join(ROOT, "src", "app", "api", "auth", "[auth0]", "route.ts");
check("dynamic route src/app/api/auth/[auth0]/route.ts present", existsSync(authRoutePath), true);

// ---------------------------------------------------------------------------
// 3. Persistence wiring (avatars/logos DB-backed, not volatile state)
// ---------------------------------------------------------------------------
console.log("\n== Persistence & asset storage ==");
const schema = readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
check("User.avatarUrl is a persisted column", /avatarUrl\s+String\?/.test(schema), true);
check("Team.logoUrl is a persisted column", /logoUrl\s+String\?/.test(schema), true);
check("Asset model stores binary data in DB", /model Asset[\s\S]*data\s+Bytes/.test(schema), true);
check("attendance route: clock-out API exists", existsSync(path.join(ROOT, "src", "app", "api", "attendance", "clock-out", "route.ts")), true);
check("avatar upload API exists", existsSync(path.join(ROOT, "src", "app", "api", "me", "avatar", "route.ts")), true);
check("team logo upload API exists", existsSync(path.join(ROOT, "src", "app", "api", "teams", "[id]", "logo", "route.ts")), true);
check("asset serving API exists", existsSync(path.join(ROOT, "src", "app", "api", "assets", "[id]", "route.ts")), true);

// AttendanceCard must render DB-backed data (clockInIso prop), not Date.now()
const card = readFileSync(path.join(ROOT, "src", "components", "AttendanceCard.tsx"), "utf8");
check("AttendanceCard consumes DB clock-in (clockInIso)", card.includes("clockInIso"), true);

// ---------------------------------------------------------------------------
// 4. Latency engine — 15-minute leeway, penalties & warning rules
// ---------------------------------------------------------------------------
console.log("\n== 15-minute latency engine (policy) ==");

// Leeway boundary: 0 and 15 minutes late are NOT flagged; 16 minutes is.
check("latency: exactly on time → not flagged", evaluateLatency(atMinutes(0), atMinutes(0)).flagged, false);
check("latency: 1 min late → not flagged", evaluateLatency(atMinutes(1), atMinutes(0)).flagged, false);
check("latency: 15 min late (leeway edge) → NOT flagged", evaluateLatency(atMinutes(15), atMinutes(0)).flagged, false);
check("latency: 15 min late shows no indicator (minutesLate<=15)", evaluateLatency(atMinutes(15), atMinutes(0)).minutesLate <= LATENCY_LEEWAY_MINUTES, true);
check("latency: 16 min late → FLAGGED", evaluateLatency(atMinutes(16), atMinutes(0)).flagged, true);
check("latency: 60 min late → FLAGGED", evaluateLatency(atMinutes(60), atMinutes(0)).flagged, true);
check("latency: no scheduled start → never flagged", evaluateLatency(new Date(), null).flagged, false);
check("latency: early arrival → not flagged", evaluateLatency(atMinutes(-10), atMinutes(0)).flagged, false);

// Penalty & coverage: +1 hour shift penalty; 1 hour late requires 2 hours coverage.
check("penalty: flagged shift carries +1h", evaluateLatency(atMinutes(61), atMinutes(0)).penaltyHours, 1);
check("penalty: leeway shift carries none", evaluateLatency(atMinutes(10), atMinutes(0)).penaltyHours, 0);
check("coverage: 1h late requires 2h coverage", evaluateLatency(atMinutes(60), atMinutes(0)).coverageHoursRequired, 2);
check("coverage: 2h late requires 4h coverage", evaluateLatency(atMinutes(120), atMinutes(0)).coverageHoursRequired, 4);

// Clarification/warning decision table.
check("warning: unsubmitted clarification → system warning", owesSystemWarning({ flaggedLate: true, clarificationStatus: null }), true);
check("warning: declined clarification → system warning", owesSystemWarning({ flaggedLate: true, clarificationStatus: "DECLINED" }), true);
check("warning: pending clarification → no warning yet", owesSystemWarning({ flaggedLate: true, clarificationStatus: "PENDING" }), false);
check("warning: approved clarification → no warning", owesSystemWarning({ flaggedLate: true, clarificationStatus: "APPROVED" }), false);
check("warning: not flagged → never warned", owesSystemWarning({ flaggedLate: false, clarificationStatus: null }), false);
check("warning: clock-out warns only when no clarification at all", needsClockOutSystemWarning(true, false), true);
check("warning: clock-out skips when clarification exists", needsClockOutSystemWarning(true, true), false);
check("warning: clock-out skips clean shifts", needsClockOutSystemWarning(false, false), false);

// Scheduled start resolution ("HH:MM").
const day = new Date(2026, 7, 29, 15, 0, 0, 0); // 15:00 local
check("scheduledStart: resolves HH:MM same day", scheduledStartFor(day, "09:00")?.getHours(), 9);
check("scheduledStart: invalid input → null", scheduledStartFor(day, "banana"), null);
check("scheduledStart: missing config → null", scheduledStartFor(day, null), null);

// Email engine wiring (in-app dispatcher → attendance mailbox).
const dispatcherPath = path.join(ROOT, "src", "components", "EmailTemplateDispatcher.tsx");
const dispatcher = existsSync(dispatcherPath) ? readFileSync(dispatcherPath, "utf8") : "";
check("email: dispatcher component exists", existsSync(dispatcherPath), true);
check("email: all four templates present", ["SWAP_DAY", "LEAVE", "WFH", "SHIFT_CHANGE"].every((k) => dispatcher.includes(k)), true);
check("email: dispatches to attendance.cai@bcflights.com", dispatcher.includes("attendance.cai@bcflights.com") || dispatcher.includes("ATTENDANCE_MAILBOX"), true);
check("email: dispatch API exists", existsSync(path.join(ROOT, "src", "app", "api", "email", "dispatch", "route.ts")), true);
check("email: dispatch API targets attendance mailbox", readFileSync(path.join(ROOT, "src", "app", "api", "email", "dispatch", "route.ts"), "utf8").includes("attendance.cai@bcflights.com"), true);

// Branding: logo on tab icons + access gates (never shield icons) + tab title + login quote.
const layout = readFileSync(path.join(ROOT, "src", "app", "layout.tsx"), "utf8");
check("branding: layout icons point at /logo.png", layout.includes('"/logo.png"'), true);
check("branding: /public/logo.png exists", existsSync(path.join(ROOT, "public", "logo.png")), true);
check("branding: tab title is BCF Time Management (default)", layout.includes('"BCF Time Management"'), true);
check("branding: tab title template keeps base title on all routes", layout.includes("%s — BCF Time Management"), true);
const accessGate = readFileSync(path.join(ROOT, "src", "components", "AccessGate.tsx"), "utf8");
check("branding: access gate uses the brand logo", accessGate.includes('/logo.png') || accessGate.includes("BrandLogo"), true);
check("branding: access gate has no shield emoji/icon", !accessGate.includes("🛡"), true);
check("branding: login quote (Jim Rohn) on the access gate", accessGate.includes("Time is more valuable than money") && accessGate.includes("Jim Rohn"), true);
check("branding: logo rendered unclipped (square-safe)", readFileSync(path.join(ROOT, "src", "components", "BrandLogo.tsx"), "utf8").includes("rounded-xl"), true);
check("latency: clarification card component exists", existsSync(path.join(ROOT, "src", "components", "LatencyClarificationCard.tsx")), true);
check("latency: approvals page exists", existsSync(path.join(ROOT, "src", "app", "approvals", "page.tsx")), true);
check("latency: clarification submit API exists", existsSync(path.join(ROOT, "src", "app", "api", "attendance", "clarification", "route.ts")), true);
check("latency: decision API exists", existsSync(path.join(ROOT, "src", "app", "api", "clarification", "[id]", "decision", "route.ts")), true);

// Edge-runtime safety: middleware must not import the Node-only SDK client.
check("edge: middleware uses edge-safe getSession", mw.includes("@/lib/edge-session"), true);
check("edge: middleware does not import the Node SDK directly", !mw.includes('from "./lib/auth0"'), true);
const edgeSession = readFileSync(path.join(ROOT, "src", "lib", "edge-session.ts"), "utf8");
check("edge: shim is Node-free (no node: imports)", !/from\s+"node:/.test(edgeSession), true);

// ---------------------------------------------------------------------------
console.log(
  failures === 0
    ? "\nALL CHECKS PASSED ✅  — role engine, middleware wiring and persistence invariants verified."
    : `\n${failures} CHECK(S) FAILED ❌`,
);
process.exit(failures === 0 ? 0 : 1);
