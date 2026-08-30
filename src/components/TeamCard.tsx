import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import TeamLogoUpload from "./TeamLogoUpload";

export interface TeamCardData {
  id: string;
  name: string;
  logoUrl: string | null;
  supervisor: { name: string; email: string; avatarUrl: string | null } | null;
  members: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    onShiftClockIn: string | null;
  }>;
}

function ShiftStatus({ clockInIso }: { clockInIso: string | null }) {
  if (!clockInIso) {
    return (
      <span className="rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
        Off shift
      </span>
    );
  }
  const since = new Date(clockInIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
      On shift since {since}
    </span>
  );
}

export default function TeamCard({
  team,
  canUploadLogo = false,
}: {
  team: TeamCardData;
  canUploadLogo?: boolean;
}) {
  const onShiftCount = team.members.filter((m) => m.onShiftClockIn).length;

  return (
    <section className="liquid-glass--thick flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logoUrl}
              alt={`${team.name} logo`}
              className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan/30 bg-gradient-to-br from-cyan/30 to-cyan/10 text-lg font-black text-cyan-100">
              {team.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h2 className="font-display text-lg font-black tracking-wide text-white">{team.name}</h2>
            <p className="text-[11px] text-zinc-400">
              {onShiftCount}/{team.members.length} on shift
              {team.supervisor ? ` · Supervisor: ${team.supervisor.name}` : " · Supervisor: N/A"}
            </p>
          </div>
        </div>
        {canUploadLogo && <TeamLogoUpload teamId={team.id} />}
      </div>

      <ul className="flex flex-col gap-1.5">
        {team.members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar name={m.name} email={m.email} avatarUrl={m.avatarUrl} size={30} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-100">
                  {m.name}
                </span>
                <span className="block truncate text-[10px] text-zinc-500">{m.email}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <RoleBadge role={m.role as never} />
              <ShiftStatus clockInIso={m.onShiftClockIn} />
            </span>
          </li>
        ))}
        {team.members.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-zinc-500">
            No members yet.
          </li>
        )}
      </ul>
    </section>
  );
}
