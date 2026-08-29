import { prisma } from "@/lib/db";
import { getEffectiveUser } from "@/lib/session";
import AccessGate from "@/components/AccessGate";
import ApprovalsPanel, { type ApprovalItem } from "@/components/ApprovalsPanel";
import NavBar from "@/components/NavBar";
import { isPrivilegedRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Pending Approvals — written shift-latency clarifications awaiting a decision.
 * Accessible to Admins, Supervisors and the Developer:
 *   APPROVED → the latency flag clears without penalty.
 *   DECLINED → an official System Warning is logged to the agent's profile.
 */
export default async function ApprovalsPage() {
  const { user, impersonating } = await getEffectiveUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060812] px-6">
        <AccessGate
          title="Access verification required"
          message="Your session could not be verified. Sign in to review approvals."
          showLoginCta
        />
      </main>
    );
  }
  if (!isPrivilegedRole(user.role)) {
    return (
      <div className="min-h-screen bg-[#060812]">
        <NavBar user={user} impersonating={impersonating} />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <AccessGate
            title="Approvals are restricted"
            message="Only Administrators, Supervisors and the Developer can review latency clarifications."
          />
        </main>
      </div>
    );
  }

  const pending = await prisma.clarificationRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: { include: { team: true } },
      attendance: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const [decided, recentWarnings] = await Promise.all([
    prisma.clarificationRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { user: true, attendance: true, decidedBy: true },
      orderBy: { decidedAt: "desc" },
      take: 8,
    }),
    prisma.warning.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const items: ApprovalItem[] = pending.map((c) => ({
    id: c.id,
    agentName: c.user.name,
    agentEmail: c.user.email,
    teamName: c.user.team?.name ?? null,
    clockInIso: c.attendance.clockIn.toISOString(),
    lateMinutes: c.attendance.lateMinutes,
    scheduledStartIso: c.attendance.scheduledStart?.toISOString() ?? null,
    message: c.message,
    submittedAtIso: c.createdAt.toISOString(),
  }));

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060812]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-amber-600/10 blur-3xl" />
      <NavBar user={user} impersonating={impersonating} pendingApprovals={pending.length} />

      <main className="relative mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-xl font-bold text-white">Pending Approvals</h1>
        <p className="mt-1 text-sm text-slate-400">
          Written clarifications for late-shift flags. Approving clears the latency flag without
          penalty; declining logs an official System Warning to the profile.
        </p>

        <div className="mt-6">
          <ApprovalsPanel items={items} />
        </div>

        <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6">
            <h2 className="text-sm font-bold text-white">Recent Decisions</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {decided.length === 0 && (
                <li className="text-xs text-slate-500">No decisions recorded yet.</li>
              )}
              {decided.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[12px]"
                >
                  <span className="text-slate-200">{c.user.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.status === "APPROVED"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {c.attendance.lateMinutes}m late
                    {c.decidedBy ? ` · by ${c.decidedBy.name}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6">
            <h2 className="text-sm font-bold text-white">Recent System Warnings</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {recentWarnings.length === 0 && (
                <li className="text-xs text-slate-500">No warnings logged yet.</li>
              )}
              {recentWarnings.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-rose-500/15 bg-rose-500/[0.06] px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-200">{w.user.name}</span>
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-300">
                      {w.kind}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{w.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
