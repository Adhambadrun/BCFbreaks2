import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEffectiveUser, getSessionUser } from "@/lib/session";
import { ensureOpenAttendance, getAttendanceOverview } from "@/lib/attendance";
import { getRoleForEmail } from "@/lib/permissions";
import AttendanceCard from "@/components/AttendanceCard";
import AvatarUpload from "@/components/AvatarUpload";
import DevSimulator from "@/components/DevSimulator";
import LogoutButton from "@/components/LogoutButton";
import NavBar from "@/components/NavBar";
import RoleBadge from "@/components/RoleBadge";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Middleware guarantees a session; provision the DB user on first sign-in.
  const real = await getSessionUser();

  if (!real) {
    // Defensive: middleware should have redirected already.
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060812] px-6">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-2xl">
          <h1 className="text-xl font-bold text-white">Session required</h1>
          <p className="mt-2 text-sm text-slate-400">Redirecting you to secure login...</p>
        </div>
      </main>
    );
  }

  // Official clock-in: automatically recorded when the user's session starts
  // the shift (persisted in the Attendance table — DB-backed, reload-proof).
  await ensureOpenAttendance(real.id);

  const { user: viewUser, impersonating } = await getEffectiveUser();
  const user = viewUser ?? real;

  const [attendance, allUsers] = await Promise.all([
    getAttendanceOverview(user.id),
    real.role === "DEV"
      ? prisma.user.findMany({
          include: { team: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const teamName = user.team?.name ?? null;
  const isPreviewer = user.role === "PREVIEWER";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060812]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl md:h-[450px] md:w-[900px]" />

      <NavBar user={real} impersonating={impersonating} />

      <main className="relative mx-auto flex max-w-6xl flex-col items-center px-6 py-12">
        <div className="w-full max-w-md">
          {impersonating && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-200">
              🛠️ Developer simulation — viewing the console as{" "}
              <span className="font-mono font-bold">{user.email}</span>
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

          <div className="flex w-full flex-col gap-6 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl">
            <div className="text-center">
              <div className="mb-3 flex justify-center">
                <Avatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} size={72} />
              </div>
              <h1 className="text-2xl font-bold text-white">Team Breaks Console</h1>
              <p className="mt-1 text-sm text-slate-400">Welcome, {user.name}</p>
              <p className="font-mono text-xs text-slate-500">{user.email}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-2 text-xs">
              <span className="text-slate-400">Role &amp; Access Level:</span>
              <RoleBadge role={user.role} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-2 text-xs">
              <span className="text-slate-400">Assigned Team:</span>
              <span className="font-semibold text-sky-400">{teamName ?? "N/A (pending assignment)"}</span>
            </div>

            {isPreviewer ? (
              <div className="rounded-2xl border border-slate-500/20 bg-slate-500/10 p-4 text-xs leading-relaxed text-slate-300">
                <span className="font-semibold text-slate-200">Preview access.</span> You are
                viewing a restricted preview of the Team Breaks &amp; Shift Management system.
                Attendance tracking, team views and management tools unlock with a
                <span className="font-mono text-slate-200"> @bcflights.com</span> account.
              </div>
            ) : (
              <>
                <AttendanceCard
                  clockInIso={attendance.open?.clockIn.toISOString() ?? null}
                  clockOutIso={
                    attendance.open
                      ? null // currently on shift — card shows the live status
                      : attendance.recent.find((a) => a.clockOut)?.clockOut?.toISOString() ?? null
                  }
                  impersonated={impersonating}
                />

                {!impersonating && <AvatarUpload />}

                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recent Shift History
                  </p>
                  {attendance.recent.length === 0 ? (
                    <p className="text-xs text-slate-500">No shifts recorded yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {attendance.recent.map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            {a.clockIn.toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                          <span className="font-mono text-slate-300">
                            {a.clockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {a.clockOut
                              ? a.clockOut.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "on shift"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Link
                    href="/team"
                    className="inline-block w-full rounded-2xl border border-sky-500/20 bg-sky-500/10 px-6 py-3 text-center text-[15px] font-medium text-sky-300 transition-all duration-200 hover:bg-sky-500/20"
                  >
                    View My Team
                  </Link>
                  <LogoutButton />
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-600">
            BCF Breaks Console — live production system. Login and logout timestamps are recorded
            automatically.
          </p>
        </div>
      </main>
    </div>
  );
}
