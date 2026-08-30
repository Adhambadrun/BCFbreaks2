import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import Avatar from "./Avatar";
import BrandLogo from "./BrandLogo";
import RoleBadge from "./RoleBadge";
import SimulationBanner, { type UserOption } from "./SimulationBanner";
import type { User } from "@/generated/prisma/client";

export default async function NavBar({
  user,
  impersonating,
  pendingApprovals = 0,
}: {
  user: User;
  impersonating: boolean;
  pendingApprovals?: number;
}) {
  // The REAL authenticated identity (never the impersonation target) — used to
  // decide whether the Developer simulation controls are shown, and to fetch
  // the switchable roster for the "Switch User" dropdown on every surface.
  const real = await getSessionUser();
  const isDeveloper = real?.role === "DEV";

  let simUsers: UserOption[] = [];
  if (isDeveloper) {
    const rows = await prisma.user.findMany({
      include: { team: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    simUsers = rows.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      team: u.team?.name ?? null,
    }));
  }

  const showSimulationBanner = isDeveloper && impersonating;

  const canManage = user.role === "DEV" || user.role === "ADMIN";
  const isSupervisor = user.role === "SUPERVISOR";
  const seesApprovals =
    !impersonating && (canManage || isSupervisor) && pendingApprovals > 0;
  const showTeamLink = user.role !== "PREVIEWER";

  return (
    <>
      {showSimulationBanner && (
        <SimulationBanner impersonatingEmail={user.email} users={simUsers} />
      )}
      <header
        className={`relative z-20 border-b border-white/[0.08] bg-black/40 backdrop-blur-2xl ${
          showSimulationBanner ? "mt-14" : ""
        }`}
      >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <BrandLogo
            size={34}
            className="ring-1 ring-gold/40 transition-shadow duration-300 group-hover:ring-gold/70 group-hover:shadow-[0_0_22px_rgba(255,204,0,0.35)]"
          />
          <span className="bg-gradient-to-r from-gold via-amber-200 to-gold bg-clip-text font-display text-[15px] font-black tracking-wide text-transparent">
            BCFBreaks
          </span>
          <span className="hidden bg-gradient-to-r from-zinc-300 via-zinc-500 to-zinc-300 bg-clip-text font-display text-[9px] font-semibold uppercase tracking-[0.32em] text-transparent sm:inline">
            CONSOLE
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-[13px]">
          {showTeamLink && (
            <Link
              href="/team"
              className="rounded-lg px-3 py-1.5 font-medium text-zinc-400 transition hover:bg-gold/10 hover:text-gold"
            >
              Team
            </Link>
          )}
          {showTeamLink && (
            <Link
              href="/requests"
              className="rounded-lg px-3 py-1.5 font-medium text-zinc-400 transition hover:bg-gold/10 hover:text-gold"
            >
              Requests
            </Link>
          )}
          {seesApprovals && (
            <Link
              href="/approvals"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-amber-300 transition hover:bg-amber-500/10"
            >
              Approvals
              <span className="glow-gold rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                {pendingApprovals}
              </span>
            </Link>
          )}
          {canManage && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 font-medium text-zinc-400 transition hover:bg-gold/10 hover:text-gold"
            >
              Admin
            </Link>
          )}
          <span className="mx-2 hidden items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] py-1 pl-1 pr-3 backdrop-blur-md sm:flex">
            <Avatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} size={26} />
            <span className="max-w-[160px] truncate text-xs font-medium text-zinc-200">
              {user.name}
            </span>
            {impersonating ? (
              <span className="glow-gold rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                SIMULATED
              </span>
            ) : (
              <RoleBadge role={user.role} />
            )}
          </span>
        </nav>
      </div>
      {isSupervisor && !impersonating && (
        <div className="mx-auto max-w-6xl px-5 pb-2 font-display text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
          Supervisor view active
        </div>
      )}
    </header>
    </>
  );
}
