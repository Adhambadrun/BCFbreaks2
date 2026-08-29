import Link from "next/link";
import Avatar from "./Avatar";
import BrandLogo from "./BrandLogo";
import RoleBadge from "./RoleBadge";
import type { User } from "@/generated/prisma/client";

export default function NavBar({
  user,
  impersonating,
  pendingApprovals = 0,
}: {
  user: User;
  impersonating: boolean;
  pendingApprovals?: number;
}) {
  const canManage = user.role === "DEV" || user.role === "ADMIN";
  const isSupervisor = user.role === "SUPERVISOR";
  const seesApprovals =
    !impersonating && (canManage || isSupervisor) && pendingApprovals > 0;
  const showTeamLink = user.role !== "PREVIEWER";

  return (
    <header className="relative z-20 border-b border-white/[0.08] bg-black/40 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <BrandLogo
            size={34}
            className="ring-1 ring-gold/40 transition-shadow duration-300 group-hover:ring-gold/70 group-hover:shadow-[0_0_22px_rgba(255,204,0,0.35)]"
          />
          <span className="bg-gradient-to-r from-gold via-amber-200 to-gold bg-clip-text font-display text-[15px] font-black tracking-wide text-transparent">
            BCFBreaks
          </span>
          <span className="hidden font-display text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-500 sm:inline">
            Console
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
  );
}
