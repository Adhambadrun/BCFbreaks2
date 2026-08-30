import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEffectiveUser, getSessionUser } from "@/lib/session";
import { ensureOpenAttendance, getAttendanceOverview, getPendingApprovalsCount } from "@/lib/attendance";
import { evaluateLatency } from "@/lib/policy";
import AccessGate from "@/components/AccessGate";
import AttendanceCard from "@/components/AttendanceCard";
import Avatar from "@/components/Avatar";
import AvatarUpload from "@/components/AvatarUpload";
import DevSimulator from "@/components/DevSimulator";
import EmailTemplateDispatcher from "@/components/EmailTemplateDispatcher";
import LatencyClarificationCard from "@/components/LatencyClarificationCard";
import LogoutButton from "@/components/LogoutButton";
import NavBar from "@/components/NavBar";
import RoleBadge from "@/components/RoleBadge";
import ShaderBackground from "@/components/ShaderBackground";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Middleware guarantees a session; provision the DB user on first sign-in.
  const real = await getSessionUser();

  if (!real) {
    // Defensive: middleware should have redirected already.
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6">
        <ShaderBackground />
        <div className="relative z-10 flex items-center justify-center">
          <AccessGate
            title="Access verification required"
            message={
              <>
                This is a secured, live production system. Your session could not be verified —
                redirecting you to secure login…
              </>
            }
            showLoginCta
          />
        </div>
      </main>
    );
  }

  // Official clock-in: automatically recorded when the user's session starts
  // the shift (persisted in the Attendance table — DB-backed, reload-proof),
  // latency-stamped against the team's scheduled shift start.
  await ensureOpenAttendance(real.id, real.team);

  const { user: viewUser, impersonating } = await getEffectiveUser();
  const user = viewUser ?? real;

  const [attendance, allUsers, pendingApprovals, warnings, sentRequests] = await Promise.all([
    getAttendanceOverview(user.id),
    real.role === "DEV"
      ? prisma.user.findMany({
          include: { team: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    ["DEV", "ADMIN", "SUPERVISOR"].includes(real.role) ? getPendingApprovalsCount() : Promise.resolve(0),
    prisma.warning.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.requestRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const open = attendance.open;
  const latency = open ? evaluateLatency(open.clockIn, open.scheduledStart) : null;
  const latestClarification =
    open?.clarifications.length && open.clarifications.length > 0 ? open.clarifications[0] : null;

  const teamName = user.team?.name ?? null;
  const isPreviewer = user.role === "PREVIEWER";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <ShaderBackground />

      {/* Brand light leaks — logo gold / amber edge blooms over the shader */}
      <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-gold/[0.12] blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-gold/[0.07] blur-3xl md:h-[420px] md:w-[860px]" />

      <NavBar user={user} impersonating={impersonating} pendingApprovals={pendingApprovals} />

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 py-12">
        <div className="w-full max-w-md">
          {impersonating && (
            <div className="liquid-glass--thin mb-4 p-3 text-center text-xs text-amber-200">
              🛠️ Developer simulation — viewing the console as{" "}
              <span className="font-mono font-bold text-gold">{user.email}</span>
            </div>
          )}

          {real.role === "DEV" && !impersonating && (
            <DevSimulator
              currentUserEmail={real.email}
              impersonatingEmail={impersonating ? user.email : null}
              users={allUsers.map((u) => ({
                email: u.email,
                name: u.name,
                role: u.role,
                team: u.team?.name ?? null,
              }))}
            />
          )}

          <div className="liquid-glass--thick flex w-full flex-col gap-6 p-8">
            <div className="text-center">
              <div className="mb-3 flex justify-center">
                <Avatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} size={72} />
              </div>
              <h1 className="bg-gradient-to-r from-gold via-amber-200 to-gold bg-clip-text font-display text-2xl font-black tracking-wide text-transparent">
                Team Breaks Console
              </h1>
              <p className="mt-1 text-sm text-zinc-400">Welcome, {user.name}</p>
              <p className="font-mono text-xs text-zinc-500">{user.email}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs">
              <span className="text-zinc-400">Role &amp; Access Level:</span>
              <RoleBadge role={user.role} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs">
              <span className="text-zinc-400">Assigned Team:</span>
              <span className="font-semibold text-cyan-300">{teamName ?? "N/A (pending assignment)"}</span>
            </div>

            {isPreviewer ? (
              <div className="liquid-glass--thin p-4 text-xs leading-relaxed text-zinc-300">
                <span className="font-semibold text-zinc-100">Preview access.</span> You are
                viewing a restricted preview of the Team Breaks &amp; Shift Management system.
                Attendance tracking, team views and management tools unlock with a
                <span className="font-mono text-cyan-300"> @bcflights.com</span> account.
              </div>
            ) : (
              <>
                <AttendanceCard
                  clockInIso={open?.clockIn.toISOString() ?? null}
                  clockOutIso={
                    open
                      ? null // currently on shift — card shows the live status
                      : attendance.recent.find((a) => a.clockOut)?.clockOut?.toISOString() ?? null
                  }
                  lateMinutes={open?.lateMinutes ?? 0}
                  latencyFlagged={Boolean(latency?.flagged && !open?.latencyCleared)}
                  impersonated={impersonating}
                />

                {/* 15-minute latency engine — mounts only past the leeway window */}
                {open && latency && (
                  <LatencyClarificationCard
                    attendanceId={open.id}
                    lateMinutes={latency.minutesLate}
                    scheduledStartIso={open.scheduledStart?.toISOString() ?? null}
                    cleared={open.latencyCleared}
                    clarification={
                      latestClarification
                        ? {
                            id: latestClarification.id,
                            status: latestClarification.status,
                            message: latestClarification.message,
                            decisionNote: latestClarification.decisionNote,
                          }
                        : null
                    }
                    penaltyHours={latency.penaltyHours}
                    coverageHoursRequired={latency.coverageHoursRequired}
                    readOnly={impersonating}
                  />
                )}

                {!impersonating && <AvatarUpload />}

                <div className="liquid-glass--ultrathin p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Recent Shift History
                  </p>
                  {attendance.recent.length === 0 ? (
                    <p className="text-xs text-zinc-500">No shifts recorded yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {attendance.recent.map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">
                            {a.clockIn.toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                          <span className="flex items-center gap-2 font-mono text-zinc-300">
                            {a.clockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {a.clockOut
                              ? a.clockOut.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "on shift"}
                            {a.lateMinutes > 15 && !a.latencyCleared && (
                              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-sans text-[9px] font-bold text-rose-400">
                                LATE
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Official warnings on the profile */}
                <div className="liquid-glass--ultrathin p-4">
                  <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <span>⚠️ Official Profile Warnings</span>
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold normal-case text-rose-300">
                      {warnings.length} recent
                    </span>
                  </p>
                  {warnings.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      Clean record — no system or manual warnings.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {warnings.map((w) => (
                        <li key={w.id} className="rounded-lg border border-rose-500/15 bg-rose-500/[0.06] px-2.5 py-1.5">
                          <p className="text-[11px] leading-snug text-rose-200">{w.reason}</p>
                          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
                            {w.kind} · {w.issuedBy} ·{" "}
                            {w.createdAt.toLocaleDateString([], { month: "short", day: "numeric" })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Link
                    href="/requests"
                    className="inline-block w-full rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-6 py-3 text-center font-display text-[13px] font-bold uppercase tracking-widest text-emerald-300 transition-all duration-200 hover:bg-emerald-500/20 hover:shadow-[0_0_25px_rgba(16,255,136,0.25)]"
                  >
                    📧 Requests &amp; Email Dispatcher
                  </Link>
                  <Link
                    href="/team"
                    className="inline-block w-full rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-6 py-3 text-center font-display text-[13px] font-bold uppercase tracking-widest text-cyan-300 transition-all duration-200 hover:bg-cyan-500/20 hover:shadow-[0_0_25px_rgba(0,229,255,0.25)]"
                  >
                    View My Team
                  </Link>
                  <LogoutButton />
                </div>
              </>
            )}
          </div>

          {/* Sent request emails — persistent ledger */}
          {!isPreviewer && sentRequests.length > 0 && (
            <div className="liquid-glass--ultrathin mt-5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Sent Request Emails
              </p>
              <ul className="flex flex-col gap-1.5">
                {sentRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-zinc-300">{r.kind.replace("_", " ")}</span>
                    <span className="max-w-[240px] truncate text-zinc-500">{r.subject}</span>
                    <span className="text-zinc-500">
                      {r.createdAt.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] text-zinc-600">Time Management</p>
        </div>
      </main>
    </div>
  );
}
