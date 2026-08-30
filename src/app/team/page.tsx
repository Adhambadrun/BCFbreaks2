import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEffectiveUser } from "@/lib/session";
import { getTeamAttendanceStatus } from "@/lib/attendance";
import AccessGate from "@/components/AccessGate";
import NavBar from "@/components/NavBar";
import ShaderBackground from "@/components/ShaderBackground";
import TeamCard, { type TeamCardData } from "@/components/TeamCard";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { user, impersonating } = await getEffectiveUser();
  if (!user) redirect("/");

  const isManager = user.role === "DEV" || user.role === "ADMIN";

  // ---- Role-scoped team visibility ----------------------------------------
  if (user.role === "PREVIEWER") {
    return (
      <div className="min-h-screen bg-black">
        <NavBar user={user} impersonating={impersonating} />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <AccessGate
            title="Team views require a staff account"
            message={
              <>
                Preview access is restricted. Sign in with a{" "}
                <span className="font-mono">@bcflights.com</span> account to see team rosters and
                shift status.
              </>
            }
          />
        </main>
      </div>
    );
  }

  let teams: TeamCardData[] = [];

  if (isManager) {
    // Admins + Developer see every team.
    const rows = await prisma.team.findMany({
      include: {
        supervisor: true,
        members: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });
    const status = await getTeamAttendanceStatus(rows.flatMap((t) => t.members.map((m) => m.id)));
    teams = rows.map((t) => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logoUrl,
      supervisor: t.supervisor
        ? { name: t.supervisor.name, email: t.supervisor.email, avatarUrl: t.supervisor.avatarUrl ?? null }
        : null,
      members: t.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        avatarUrl: m.avatarUrl,
        onShiftClockIn: status.get(m.id)?.clockIn.toISOString() ?? null,
      })),
    }));
  } else {
    // Supervisors see the team they supervise; agents see their own team.
    const team =
      (user.role === "SUPERVISOR"
        ? await prisma.team.findUnique({
            where: { supervisorId: user.id },
            include: { supervisor: true, members: { orderBy: { name: "asc" } } },
          })
        : user.teamId
          ? await prisma.team.findUnique({
              where: { id: user.teamId },
              include: { supervisor: true, members: { orderBy: { name: "asc" } } },
            })
          : null);

    if (!team) {
      return (
        <div className="min-h-screen bg-black">
          <NavBar user={user} impersonating={impersonating} />
          <main className="mx-auto max-w-3xl px-6 py-16">
            <AccessGate
              title={user.role === "SUPERVISOR" ? "No team assigned yet" : "Not on a team yet"}
              message={
                user.role === "SUPERVISOR"
                  ? "An Administrator or the Developer will assign your team shortly."
                  : "Ask your supervisor or an administrator to add you to a team."
              }
            />
          </main>
        </div>
      );
    }

    const status = await getTeamAttendanceStatus(team.members.map((m) => m.id));
    teams = [
      {
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        supervisor: team.supervisor
          ? { name: team.supervisor.name, email: team.supervisor.email, avatarUrl: team.supervisor.avatarUrl ?? null }
          : null,
        members: team.members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          avatarUrl: m.avatarUrl,
          onShiftClockIn: status.get(m.id)?.clockIn.toISOString() ?? null,
        })),
      },
    ];
  }

  const canUploadLogos = isManager || user.role === "SUPERVISOR";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <ShaderBackground />
      <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />
      <NavBar user={user} impersonating={impersonating} />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <h1 className="bg-gradient-to-r from-cyan via-sky-200 to-cyan bg-clip-text font-display text-xl font-black tracking-wide text-transparent">
          {isManager ? "All Teams" : user.role === "SUPERVISOR" ? "Your Team" : "Your Team"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isManager
            ? "Organization-wide rosters and live shift status."
            : user.role === "SUPERVISOR"
              ? "Live shift status for every member you supervise."
              : "Your team roster and who is currently on shift."}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              canUploadLogo={canUploadLogos && (isManager || t.supervisor?.email === user.email)}
            />
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-slate-500">No teams exist yet.</p>
          )}
        </div>

        {canUploadLogos && (
          <p className="mt-6 text-[11px] text-zinc-600">
            Team logos are stored in the database and persist across reloads and redeploys.
          </p>
        )}
      </main>
    </div>
  );
}
