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

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `  (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}

// ---------------------------------------------------------------------------
// 1. Role & email resolution matrix (from the spec's verification protocol)
// ---------------------------------------------------------------------------
const MATRIX: Array<[string, AppRole]> = [
  ["adhambadraan@gmail.com", "DEV"],
  ["meredith@bcflights.com", "ADMIN"],
  ["atlas@bcflights.com", "ADMIN"],
  ["jolene@bcflights.com", "ADMIN"],
  ["naomi@bcflights.com", "ADMIN"],
  ["jay@bcflights.com", "SUPERVISOR"],
  ["watkins@bcflights.com", "SUPERVISOR"],
  ["albert@bcflights.com", "SUPERVISOR"],
  ["amir@bcflights.com", "SUPERVISOR"],
  ["solomon@bcflights.com", "AGENT"],
  ["zayn@bcflights.com", "AGENT"],
  ["leo@bcflights.com", "AGENT"],
  ["lamar@bcflights.com", "AGENT"],
  ["fabiola@bcflights.com", "AGENT"],
  ["shay@bcflights.com", "AGENT"],
  ["wesley@bcflights.com", "AGENT"],
  ["eric@bcflights.com", "AGENT"],
  ["thomas@bcflights.com", "AGENT"],
  ["any_other@bcflights.com", "AGENT"],
  ["external@gmail.com", "PREVIEWER"],
  ["random@outlook.com", "PREVIEWER"],
];

console.log("\n== Role & email resolution ==");
for (const [email, role] of MATRIX) check(email, getRoleForEmail(email), role);

// Case-insensitivity + trimming
check("Case: LAMAR@BCFLIGHTS.COM", getRoleForEmail("LAMAR@BCFLIGHTS.COM"), "AGENT");
check("Case: Jay@BCFlights.com", getRoleForEmail("Jay@BCFlights.com"), "SUPERVISOR");
check("Trim:  dev@gmail.com ", getRoleForEmail(" adhambadraan@gmail.com "), "DEV");

// Look-alike domain hardening
check("Spoof: me@bcflights.com.evil.tld", getRoleForEmail("me@bcflights.com.evil.tld"), "PREVIEWER");
check("Spoof: me@notbcflights.com", getRoleForEmail("me@notbcflights.com"), "PREVIEWER");

// Supervisor team assignments
console.log("\n== Supervisor team assignments ==");
check("Jay -> Strikers", getSupervisorTeamForEmail("jay@bcflights.com"), "Strikers");
check("Watkins -> Wizards", getSupervisorTeamForEmail("watkins@bcflights.com"), "Wizards");
check("Albert -> pending (null)", getSupervisorTeamForEmail("albert@bcflights.com"), null);
check("Amir -> pending (null)", getSupervisorTeamForEmail("amir@bcflights.com"), null);

// ---------------------------------------------------------------------------
// 2. Middleware & auth wiring (no /auth/login 404 regressions)
// ---------------------------------------------------------------------------
console.log("\n== Middleware & auth validation ==");
const mwPath = path.join(ROOT, "src", "middleware.ts");
const mw = existsSync(mwPath) ? readFileSync(mwPath, "utf8") : "";
check("src/middleware.ts exists", existsSync(mwPath), true);
check("middleware redirects unauthenticated to /api/auth/login", mw.includes('"/api/auth/login"'), true);
check("middleware never redirects to /auth/login", /redirect\([^)]*["'`]\/auth\/login/.test(mw), false);
check("middleware serves auth routes via auth0.middleware", mw.includes("auth0.middleware(request)"), true);

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
console.log(
  failures === 0
    ? "\nALL CHECKS PASSED ✅  — role engine, middleware wiring and persistence invariants verified."
    : `\n${failures} CHECK(S) FAILED ❌`,
);
process.exit(failures === 0 ? 0 : 1);
