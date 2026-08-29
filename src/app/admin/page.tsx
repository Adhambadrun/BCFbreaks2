import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEffectiveUser } from "@/lib/session";
import NavBar from "@/components/NavBar";
import AdminUsersTable from "@/components/AdminUsersTable";
import CreateTeamForm from "@/components/CreateTeamForm";

export const dynamic = "force-dynamic";

/**
 * Developer & Administrator control room: role management, team creation,
 * supervisor assignment and team logos. DEV + ADMIN only — anyone else is
 * bounced back to the dashboard.
 */
export default async function AdminPage() {
  const { user, impersonating } = await getEffectiveUser();
  if (!user) redirect("/");
  if (user.role !== "DEV" && user.role !== "ADMIN") redirect("/");

  const [users, teams] = await Promise.all([
    prisma.user.findMany({
      include: { team: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.team.findMany({
      include: { supervisor: true, members: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const assignableSupervisors = users
    .filter((u) => u.role === "SUPERVISOR" || u.role === "ADMIN" || u.role === "DEV")
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060812]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
      <NavBar user={user} impersonating={impersonating} />

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-xl font-bold text-white">System Administration</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage roles, teams and supervisor assignments for the whole organization.
        </p>

        {/* Pending supervisor assignments */}
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Pending team assignments
          </p>
          {(() => {
            const pending = users.filter(
              (u) => u.role === "SUPERVISOR" && !u.teamId && !(teams.some((t) => t.supervisorId === u.id)),
            );
            return pending.length > 0 ? (
              <p className="mt-1 text-[13px] text-amber-100/90">
                {pending.map((u) => u.name).join(", ")} — awaiting a team assignment below.
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-amber-100/90">All supervisors have teams. ✓</p>
            );
          })()}
        </div>

        <AdminUsersTable
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            teamId: u.teamId,
            teamName: u.team?.name ?? null,
            supervisedTeamName: teams.find((t) => t.supervisorId === u.id)?.name ?? null,
          }))}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          currentUserId={user.id}
        />

        <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-xl backdrop-blur-2xl">
            <h2 className="text-base font-bold text-white">Create a Team</h2>
            <p className="mt-1 text-xs text-slate-400">
              New teams persist in the database and appear instantly for supervisors and agents.
            </p>
            <CreateTeamForm supervisors={assignableSupervisors} />
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-xl backdrop-blur-2xl">
            <h2 className="text-base font-bold text-white">Teams Overview</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-slate-100">{t.name}</span>
                  <span className="text-[11px] text-slate-400">
                    {t.supervisor ? `Supervisor: ${t.supervisor.name}` : "No supervisor"}
                    {" · "}
                    {t.members.length} member{t.members.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
              {teams.length === 0 && <li className="text-xs text-slate-500">No teams yet.</li>}
            </ul>
            <p className="mt-3 text-[11px] text-slate-600">
              Upload team logos from the <span className="font-mono">/team</span> page — logos are
              stored in the database, permanently.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
