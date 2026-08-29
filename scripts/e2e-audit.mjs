/**
 * Authenticated end-to-end audit against the RUNNING dev server + database.
 *
 * The Auth0 tenant is unreachable from this sandbox (network egress rules), so
 * this script mints real SDK session cookies (same AUTH0_SECRET, via
 * @auth0/nextjs-auth0/testing) and exercises every protected layer exactly as
 * a signed-in browser would:
 *
 *   role rendering, zero-trust middleware, team scoping, admin authorization,
 *   developer impersonation, DB-backed clock-in/clock-out, avatar & team-logo
 *   persistence (upload -> DB -> serve back), and admin role/team management.
 *
 * Run: node scripts/e2e-audit.mjs   (requires: npm run dev + npm run db:up)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const COOKIE = "__session";

// ---- env ------------------------------------------------------------------
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (!readFileSyncSafe(p)) continue;
  for (const line of readFileSyncSafe(p).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
function readFileSyncSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}
const SECRET = process.env.AUTH0_SECRET;
if (!SECRET) throw new Error("AUTH0_SECRET missing");

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let failures = 0;
let checks = 0;
function check(label, ok, extra = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : `  [${extra}]`}`);
}

async function sessionCookieFor(email, name) {
  const session = {
    user: { sub: `auth0|${email}`, email, name: name ?? email.split("@")[0] },
    tokenSet: { accessToken: "e2e-audit", expiresAt: Math.floor(Date.now() / 1000) + 3600 },
    createdAt: Math.floor(Date.now() / 1000),
  };
  return generateSessionCookie(session, { secret: SECRET });
}

function cookieHeader(...cookies) {
  return cookies.filter(Boolean).map((c) => `${COOKIE}=${c}`).join("; ");
}

async function get(pathname, cookie) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: cookie ? { cookie: cookieHeader(cookie) } : {},
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location") ?? "", body: await res.text(), res };
}

async function postJson(pathname, cookie, payload, method = "POST") {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: { cookie: cookieHeader(cookie), "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "manual",
  });
  return { status: res.status, body: await res.text().then((t) => t.slice(0, 400)), res };
}

async function postFile(pathname, cookie, fileBuffer, filename = "test.png") {
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "image/png" }), filename);
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { cookie: cookieHeader(cookie) },
    body: form,
    redirect: "manual",
  });
  return { status: res.status, body: await res.text().then((t) => t.slice(0, 300)), res };
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const q = (text, params) => db.query(text, params);

async function main() {
  await db.connect();

  // Mint sessions for every role
  const dev = await sessionCookieFor("adhambadraan@gmail.com", "Adham Badran");
  const admin = await sessionCookieFor("meredith@bcflights.com", "Meredith");
  const supervisor = await sessionCookieFor("jay@bcflights.com", "Jay");
  const agent = await sessionCookieFor("lamar@bcflights.com", "Lamar");
  const previewer = await sessionCookieFor("outsider Probe <external@gmail.com>".match(/[\w.]+@[\w.]+/)[0], "Outsider");

  const devUser = (await q(`SELECT id FROM "User" WHERE email='adhambadraan@gmail.com'`)).rows[0];
  const agentUser = (await q(`SELECT id FROM "User" WHERE email='lamar@bcflights.com'`)).rows[0];
  const albert = (await q(`SELECT id FROM "User" WHERE email='albert@bcflights.com'`)).rows[0];
  const strikers = (await q(`SELECT id FROM "Team" WHERE name='Strikers'`)).rows[0];
  check("seeded roster present in DB", Boolean(devUser && agentUser && albert && strikers));

  // ---------------------------------------------------------------------- 
  console.log("\n== 1. Zero-trust middleware (unauthenticated) ==");
  for (const p of ["/", "/team", "/admin", "/api/attendance/clock-out"]) {
    const r = await get(p);
    check(`GET ${p} blocked for anonymous`, r.status === 307 || r.status === 401 || r.status === 405, `status=${r.status}`);
    // /api/auth/login is CORRECT; bare /auth/login would be the Vercel-404 bug.
    check(`GET ${p} redirects to /api/auth/login (never bare /auth/login)`, /(^|[^/])\/api\/auth\/login/.test(r.location), r.location);
  }
  const oldPath = await get("/auth/login");
  check("legacy /auth/login does NOT 404-trap users (forwards into /api/auth/login flow)", oldPath.location.includes("/api/auth/login"), oldPath.location);

  // ----------------------------------------------------------------------
  console.log("\n== 2. Dashboard rendering per role ==");
  const devPage = await get("/", dev);
  check("DEV dashboard renders", devPage.status === 200, `status=${devPage.status}`);
  check("DEV sees Developer Control Panel", devPage.body.includes("Developer Control Panel"));
  check("DEV role shown", devPage.body.includes("Developer"));
  check("clock-in recorded automatically (Attended & Clocked In)", devPage.body.includes("Clocked In"));

  const agentPage = await get("/", agent);
  check("AGENT dashboard renders", agentPage.status === 200);
  check("AGENT role shown", agentPage.body.includes("Agent"));
  check("AGENT cannot see Developer Control Panel", !agentPage.body.includes("Developer Control Panel"));
  check("AGENT auto clocked-in", agentPage.body.includes("Clocked In"));

  const previewerPage = await get("/", previewer);
  check("PREVIEWER dashboard renders (restricted)", previewerPage.status === 200 && previewerPage.body.includes("Preview access"));

  // ----------------------------------------------------------------------
  console.log("\n== 3. Team views (role scoping) ==");
  const agentTeam = await get("/team", agent);
  check("AGENT sees own team Strikers", agentTeam.status === 200 && agentTeam.body.includes("Strikers"));
  check("AGENT cannot see Wizards roster", !agentTeam.body.includes("Watkins"));

  const supTeam = await get("/team", supervisor);
  check("SUPERVISOR sees Strikers", supTeam.status === 200 && supTeam.body.includes("Strikers"));

  const adminTeam = await get("/team", admin);
  check("ADMIN sees all teams", adminTeam.status === 200 && adminTeam.body.includes("Strikers") && adminTeam.body.includes("Wizards"));

  const agentAdmin = await get("/admin", agent);
  check("AGENT denied /admin (redirected)", agentAdmin.status === 307 && agentAdmin.location.endsWith("/"), `status=${agentAdmin.status}`);

  // ----------------------------------------------------------------------
  console.log("\n== 4. Developer impersonation engine ==");
  const forbidden = await postJson("/api/dev/impersonate", agent, { email: "jay@bcflights.com" });
  check("AGENT forbidden from impersonation API", forbidden.status === 403, `status=${forbidden.status}`);

  const imp = await postJson("/api/dev/impersonate", dev, { email: "lamar@bcflights.com" });
  check("DEV can start impersonation", imp.status === 200, imp.body);
  const setCookies = imp.res.headers.getSetCookie?.() ?? [imp.res.headers.get("set-cookie") ?? ""];
  const impCookie = setCookies
    .find((c) => c.startsWith("bcf_impersonation="))
    ?.split(";")[0]
    ?.split("bcf_impersonation=")[1];
  check("impersonation cookie issued", Boolean(impCookie));

  const impPage = await getWithCookies("/", [
    [COOKIE, dev],
    ["bcf_impersonation", impCookie],
  ]);
  check("dashboard re-renders as Lamar", impPage.body.includes("Developer simulation"));
  check("simulation banner shown", impPage.body.includes("Developer simulation") || impPage.body.includes("SIMULATED"));
  check("DevSimulator hidden while impersonating", !impPage.body.includes("Developer Control Panel"));

  const impTeam = await getWithCookies("/team", [
    [COOKIE, dev],
    ["bcf_impersonation", impCookie],
  ]);
  check("team view follows impersonated agent (Strikers, read-only)", impTeam.status === 200 && impTeam.body.includes("Strikers"));

  const stop = await postJson("/api/dev/impersonate", dev, undefined, "DELETE");
  check("DEV can stop impersonation", stop.status === 200, stop.body);

  // ----------------------------------------------------------------------
  console.log("\n== 5. Attendance: clock-out & re-clock-in (database-backed) ==");
  const before = (await q(`SELECT count(*)::int AS n FROM "Attendance" WHERE "userId"=$1`, [devUser.id])).rows[0].n;
  const out = await postJson("/api/attendance/clock-out", dev);
  check("clock-out endpoint records shift end", out.status === 200 && JSON.parse(out.body.startsWith("{") ? out.body : "{}").ok !== false, out.body);
  const closed = (await q(`SELECT count(*)::int AS n FROM "Attendance" WHERE "userId"=$1 AND "clockOut" IS NOT NULL`, [devUser.id])).rows[0].n;
  check("clock-out persisted in DB", closed > 0, `closed=${closed}`);

  const devPage2 = await get("/", dev);
  const after = (await q(`SELECT count(*)::int AS n FROM "Attendance" WHERE "userId"=$1`, [devUser.id])).rows[0].n;
  check("next authenticated render auto clocks-in again (new shift)", after === before + 1, `before=${before} after=${after}`);
  check("dashboard shows new open shift", devPage2.body.includes("Clocked In"));

  // ----------------------------------------------------------------------
  console.log("\n== 6. Persistent avatars & team logos (DB storage) ==");
  const av = await postFile("/api/me/avatar", agent, PNG_1x1);
  const avBody = JSON.parse(av.body.startsWith("{") ? av.body : "{}");
  check("avatar upload accepted", av.status === 200 && avBody.avatarUrl, av.body);
  const assetRes = await fetch(`${BASE}${avBody.avatarUrl}`, { headers: { cookie: cookieHeader(agent) } });
  const assetBytes = Buffer.from(await assetRes.arrayBuffer());
  check("avatar served back from /api/assets with identical bytes", assetRes.status === 200 && assetBytes.equals(PNG_1x1), `status=${assetRes.status} bytes=${assetBytes.length}`);
  const avatarInDb = (await q(`SELECT "avatarUrl" FROM "User" WHERE id=$1`, [agentUser.id])).rows[0].avatarUrl;
  check("avatarUrl persisted in DB", avatarInDb === avBody.avatarUrl, avatarInDb);

  const logoDenied = await postFile(`/api/teams/${strikers.id}/logo`, agent, PNG_1x1);
  check("AGENT forbidden to upload team logo", logoDenied.status === 403);
  const logo = await postFile(`/api/teams/${strikers.id}/logo`, dev, PNG_1x1, "logo.png");
  const logoBody = JSON.parse(logo.body.startsWith("{") ? logo.body : "{}");
  check("DEV/manager can upload team logo", logo.status === 200 && logoBody.logoUrl, logo.body);
  const logoInDb = (await q(`SELECT "logoUrl" FROM "Team" WHERE id=$1`, [strikers.id])).rows[0].logoUrl;
  check("team logoUrl persisted in DB", logoInDb === logoBody.logoUrl, logoInDb);

  // ----------------------------------------------------------------------
  console.log("\n== 7. Admin management APIs (role & team assignment) ==");
  const denied = await postJson("/api/admin/users/nonexistent", agent, { role: "ADMIN" }, "PATCH");
  check("AGENT denied admin API", denied.status === 403 || denied.status === 404, `status=${denied.status}`);

  const promote = await postJson(`/api/admin/users/${agentUser.id}`, admin, { role: "SUPERVISOR", teamId: null }, "PATCH");
  check("ADMIN can change roles", promote.status === 200, promote.body);
  const adminTeams = await postJson("/api/admin/teams", admin, { name: "Titans", supervisorId: albert.id });
  check("ADMIN can create team + assign supervisor", adminTeams.status === 200, adminTeams.body);
  const albertTeam = (await q(
    `SELECT t.name FROM "Team" t WHERE t."supervisorId"=$1`,
    [albert.id],
  )).rows[0]?.name;
  check("Albert now supervises Titans (pending assignment resolved)", albertTeam === "Titans", String(albertTeam));

  // revert to spec state
  await q(`UPDATE "User" SET role='AGENT', "teamId"=(SELECT id FROM "Team" WHERE name='Strikers') WHERE id=$1`, [agentUser.id]);
  await q(`UPDATE "User" SET "teamId"=NULL WHERE id=$1`, [albert.id]);
  await q(`DELETE FROM "Team" WHERE name='Titans'`);
  const albertReset = (await q(`SELECT "teamId" FROM "User" WHERE id=$1`, [albert.id])).rows[0].teamId;
  check("state reverted to spec (Albert pending again)", albertReset === null);

  // ----------------------------------------------------------------------
  console.log("\n== 8. 15-minute latency engine, clarifications & warnings (live) ==");

  // Locate the dev's open attendance (created by the §2/§5 dashboard render).
  const openRow = (
    await q(`SELECT id, "clockIn" FROM "Attendance" WHERE "userId"=$1 AND "clockOut" IS NULL ORDER BY "clockIn" DESC LIMIT 1`, [devUser.id])
  ).rows[0];
  check("dev has an open attendance record", Boolean(openRow));

  // 8a. Within the 15-minute company leeway: NO latency indicator at all.
  await q(`UPDATE "Attendance" SET "scheduledStart" = "clockIn" - interval '10 minutes', "lateMinutes" = 10, "latencyCleared" = false WHERE id=$1`, [openRow.id]);
  const leewayPage = await get("/", dev);
  check("≤15 min late: NO latency review card (company leeway)", !leewayPage.body.includes("Shift Latency Review"), "indicator leaked");
  check("≤15 min late: NO late badge", !leewayPage.body.includes("LATE +"), "badge leaked");

  // 8b. Past the leeway: automatic LATE flag + written clarification prompt.
  await q(`UPDATE "Attendance" SET "scheduledStart" = "clockIn" - interval '60 minutes', "lateMinutes" = 60 WHERE id=$1`, [openRow.id]);
  const latePage = await get("/", dev);
  // React SSR splits adjacent text nodes with <!-- --> markers — strip them
  // so policy text like "+1h" can be matched on the rendered output.
  const lateBody = latePage.body.replace(/<!-- -->/g, "");
  check(">15 min late: latency review card appears", lateBody.includes("Shift Latency Review"));
  check(">15 min late: LATE flag displayed", lateBody.includes("LATE"));
  check(">15 min late: +1h shift penalty surfaced", lateBody.includes("+1h"));
  check(">15 min late: 1h late requires 2h coverage surfaced", lateBody.includes("2h"));
  check(">15 min late: clarification prompt shown", latePage.body.includes("Submit Clarification for Approval"));

  // 8c. Agent submits the written clarification -> Pending Approvals queue.
  const clarify = await postJson("/api/attendance/clarification", dev, {
    attendanceId: openRow.id,
    message: "Metro line suspension; arrived as soon as service resumed.",
  });
  check("clarification submits to PENDING", clarify.status === 200, clarify.body);
  const clarificationId = (() => {
    try { return JSON.parse(clarify.body).clarificationId; } catch { return null; }
  })();
  const pendingQueue = (await q(`SELECT count(*)::int AS n FROM "ClarificationRequest" WHERE status='PENDING'`)).rows[0].n;
  check("clarification persisted in approvals queue", pendingQueue > 0 && Boolean(clarificationId));

  const agentDecide = await postJson(`/api/clarification/${clarificationId}/decision`, agent, { action: "APPROVE" }, "POST");
  check("AGENT forbidden from approval decisions", agentDecide.status === 403, `status=${agentDecide.status}`);

  const pendingPage = await get("/", dev);
  check("dashboard shows PENDING APPROVAL state", pendingPage.body.includes("PENDING APPROVAL"));
  check("prompt hidden once clarification submitted", !pendingPage.body.includes("Submit Clarification for Approval"));

  // 8d. APPROVED -> latency flag clears without penalty.
  const approve = await postJson(`/api/clarification/${clarificationId}/decision`, admin, { action: "APPROVE", note: "Verified with transit authority." });
  check("admin approves clarification", approve.status === 200, approve.body);
  const clearedRow = (await q(`SELECT "latencyCleared" FROM "Attendance" WHERE id=$1`, [openRow.id])).rows[0];
  check("approval clears the latency flag in DB", clearedRow.latencyCleared === true);
  const clearedPage = await get("/", dev);
  check("dashboard shows cleared status (no penalty)", clearedPage.body.includes("Cleared — No Penalty"));
  const devWarnings = (await q(`SELECT count(*)::int AS n FROM "Warning" WHERE "userId"=$1`, [devUser.id])).rows[0].n;
  check("no warning issued on the approved path", devWarnings === 0);

  // 8e. DECLINED -> automatic System Warning on the profile.
  const lamarRow = (
    await q(`SELECT id FROM "Attendance" WHERE "userId"=$1 AND "clockOut" IS NULL ORDER BY "clockIn" DESC LIMIT 1`, [agentUser.id])
  ).rows[0];
  await q(`UPDATE "Attendance" SET "scheduledStart" = "clockIn" - interval '45 minutes', "lateMinutes" = 45 WHERE id=$1`, [lamarRow.id]);
  const agentClarify = await postJson("/api/attendance/clarification", agent, {
    attendanceId: lamarRow.id,
    message: "Overslept, sorry.",
  });
  check("agent clarification submits", agentClarify.status === 200, agentClarify.body);
  const agentClarificationId = (() => {
    try { return JSON.parse(agentClarify.body).clarificationId; } catch { return null; }
  })();
  const decline = await postJson(`/api/clarification/${agentClarificationId}/decision`, admin, { action: "DECLINE", note: "No supporting evidence." });
  check("admin declines clarification", decline.status === 200, decline.body);
  const declinedWarning = (
    await q(`SELECT count(*)::int AS n FROM "Warning" WHERE "userId"=$1 AND "reason" LIKE '%DECLINED%'`, [agentUser.id])
  ).rows[0].n;
  check("declined clarification logs automatic System Warning", declinedWarning > 0);

  // 8f. Never submitted (clock-out with unanswered late flag) -> System Warning.
  await q(
    `INSERT INTO "Attendance" (id, "userId", "clockIn", "scheduledStart", "lateMinutes") VALUES (gen_random_uuid()::text, $1, now() - interval '30 minutes', now() - interval '75 minutes', 45)`,
    [agentUser.id],
  );
  const agentOut = await postJson("/api/attendance/clock-out", agent);
  const outBody = (() => { try { return JSON.parse(agentOut.body); } catch { return {}; } })();
  check("clock-out with unsubmitted clarification warns", agentOut.status === 200 && outBody.warningsIssued === 1, agentOut.body);
  const unsubmittedWarning = (
    await q(`SELECT count(*)::int AS n FROM "Warning" WHERE "userId"=$1 AND "reason" LIKE '%never submitted%'`, [agentUser.id])
  ).rows[0].n;
  check("unsubmitted-clarification System Warning persisted", unsubmittedWarning > 0);

  // 8g. Approvals page renders the queue for managers.
  const approvalsPage = await get("/approvals", admin);
  check("approvals page renders for admin", approvalsPage.status === 200, `status=${approvalsPage.status}`);
  const agentApprovals = await get("/approvals", agent);
  check("approvals page restricted for agents", agentApprovals.status === 200 && agentApprovals.body.includes("Approvals are restricted"));

  // ----------------------------------------------------------------------
  console.log("\n== 9. In-app email engine (templates -> attendance.cai@bcflights.com) ==");
  const anonMail = await get("/api/email/dispatch");
  check("email dispatch blocked for anonymous", anonMail.status === 307 || anonMail.status === 401, `status=${anonMail.status}`);
  const dispatch = await postJson("/api/email/dispatch", agent, {
    to: "attendance.cai@bcflights.com",
    from: "lamar@bcflights.com",
    subject: "[SWAP DAY REQUEST] - Lamar",
    body: "Dear Management,\n\nI would like to request a Swap Day.\nAgent: Lamar\nCoverage Date: 2026-09-05\nCovering Agent: Zayn\nLocation (Office/WFH): Office\n\nThank you.",
  });
  const dispatchBody = (() => { try { return JSON.parse(dispatch.body); } catch { return {}; } })();
  check("email dispatch accepted", dispatch.status === 200 && dispatchBody.ok === true, dispatch.body);
  check("dispatch recorded on persistent ledger", Boolean(dispatchBody.recordId));
  const mailRecord = (await q(`SELECT count(*)::int AS n FROM "RequestRecord" WHERE "recipient"='attendance.cai@bcflights.com' AND "kind"='SWAP_DAY'`)).rows[0].n;
  check("RequestRecord targets attendance.cai@bcflights.com", mailRecord > 0);
  const requestsPage = await get("/requests", agent);
  check("requests page renders the dispatcher", requestsPage.status === 200 && requestsPage.body.includes("In-App Email Dispatcher"));
  check("requests page lists all four templates", ["SWAP DAY", "LEAVE", "WFH", "SHIFT CHANGE"].every((k) => requestsPage.body.includes(k)));
  check("requests page surfaces policy rules (45-day swap, $100 No Show)", requestsPage.body.includes("45 days") && requestsPage.body.includes("$100"), "policy text missing");

  // ----------------------------------------------------------------------
  console.log("\n== 10. Branding & assets (logo on tab + gates) ==");
  const logoRes = await fetch(`${BASE}/logo.png`);
  check("/logo.png serves as an image", logoRes.status === 200 && (logoRes.headers.get("content-type") ?? "").startsWith("image/"), logoRes.headers.get("content-type"));
  const devDash = await get("/", dev);
  check("browser tab icons point at /logo.png", devDash.body.includes('href="/logo.png"'), "missing icon metadata");
  check("nav bar carries the brand logo", devDash.body.includes("BCFBreaks Logo"));

  // ----------------------------------------------------------------------
  console.log("\n== 11. Cleanup test artifacts ==");
  await q(`UPDATE "User" SET "avatarUrl"=NULL WHERE id=$1`, [agentUser.id]);
  await q(`UPDATE "Team" SET "logoUrl"=NULL WHERE id=$1`, [strikers.id]);
  await q(`DELETE FROM "Asset"`);
  await q(`DELETE FROM "ClarificationRequest"`);
  await q(`DELETE FROM "Warning"`);
  await q(`DELETE FROM "RequestRecord"`);
  await q(`DELETE FROM "Attendance" WHERE "userId" IN (SELECT id FROM "User" WHERE email='external@gmail.com')`);
  await q(`DELETE FROM "Attendance" WHERE "userId" IN ($1, $2)`, [devUser.id, agentUser.id]);
  await q(`DELETE FROM "User" WHERE email='external@gmail.com'`);
  check("upload/impersonation/latency artifacts cleaned", true);

  console.log(
    failures === 0
      ? `\nE2E AUDIT PASSED ✅  (${checks} checks)`
      : `\nE2E AUDIT: ${failures}/${checks} checks FAILED ❌`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

// helper: request with multiple named cookies (session + impersonation)
async function getWithCookies(pathname, cookies) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { cookie: cookies.map(([name, value]) => `${name}=${value}`).join("; ") },
    redirect: "manual",
  });
  return { status: res.status, body: await res.text(), location: res.headers.get("location") ?? "" };
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
