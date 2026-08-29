import Link from "next/link";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import type { User } from "@/generated/prisma/client";

export default function NavBar({ user, impersonating }: { user: User; impersonating: boolean }) {
  const canManage = user.role === "DEV" || user.role === "ADMIN";
  const isSupervisor = user.role === "SUPERVISOR";
  const showTeamLink = user.role !== "PREVIEWER";

  return (
    <header className="relative z-10 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-black text-white">
            B
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">
            BCF Breaks <span className="text-slate-500">Console</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-[13px]">
          {showTeamLink && (
            <Link
              href="/team"
              className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Team
            </Link>
          )}
          {canManage && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Admin
            </Link>
          )}
          <span className="mx-2 hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3 sm:flex">
            <Avatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} size={26} />
            <span className="max-w-[160px] truncate text-xs font-medium text-slate-200">
              {user.name}
            </span>
            {impersonating ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                SIMULATED
              </span>
            ) : (
              <RoleBadge role={user.role} />
            )}
          </span>
        </nav>
      </div>
      {isSupervisor && !impersonating && (
        <div className="mx-auto max-w-6xl px-5 pb-2 text-[11px] text-sky-300/80">
          Supervisor view active
        </div>
      )}
    </header>
  );
}
