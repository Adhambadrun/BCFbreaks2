"use client";

import { useEffect, useState } from "react";
import { LATENCY_LEEWAY_MINUTES } from "@/lib/policy";

/**
 * Shift Attendance Status card.
 *
 * The clock-in timestamp comes from the DATABASE (Attendance.clockIn, written
 * automatically when the user's session starts the shift) — not from volatile
 * client state — so it survives reloads, redeployments and devices.
 *
 * Latency display obeys the 15-minute company leeway: NO late indicator is
 * rendered while within the window; the "LATE" badge appears only when the
 * 15-minute threshold is exceeded (server-evaluated flag).
 */
export default function AttendanceCard({
  clockInIso,
  clockOutIso,
  lateMinutes = 0,
  latencyFlagged = false,
  impersonated = false,
}: {
  /** ISO timestamp of the official DB-backed clock-in (open shift), if any. */
  clockInIso?: string | null;
  /** ISO timestamp of the last official clock-out, if the shift already ended. */
  clockOutIso?: string | null;
  /** Minutes past scheduled start (server-evaluated). */
  lateMinutes?: number;
  /** True only when the server flagged the shift LATE (beyond 15-min leeway). */
  latencyFlagged?: boolean;
  /** True when viewing through Developer impersonation (read-only). */
  impersonated?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : null;

  const clockInTime = formatTime(clockInIso);
  const clockOutTime = formatTime(clockOutIso);

  let elapsed = "";
  if (clockInIso && now) {
    const seconds = Math.max(0, Math.floor((now - new Date(clockInIso).getTime()) / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    elapsed = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const onShift = Boolean(clockInIso) && !clockOutIso;
  // Company leeway: at or under 15 minutes late, no indicator may be shown.
  const showLateBadge = latencyFlagged && lateMinutes > LATENCY_LEEWAY_MINUTES;

  return (
    <div className="liquid-glass--thin flex w-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          Shift Attendance Status
        </span>
        <span className="flex items-center gap-2">
          {showLateBadge && (
            <span className="glow-crimson rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-rose-300">
              LATE +{lateMinutes}m
            </span>
          )}
          {onShift ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
              Attended &amp; Clocked In
            </span>
          ) : clockOutTime ? (
            <span className="rounded-full border border-zinc-400/20 bg-zinc-400/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
              Clocked Out
            </span>
          ) : (
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              Recording...
            </span>
          )}
        </span>
      </div>

      <div className="text-sm text-zinc-200">
        Login Shift Start:{" "}
        <span className="font-mono font-semibold text-cyan-300">{clockInTime ?? "Pending"}</span>
      </div>

      {onShift && elapsed && (
        <div className="text-sm text-zinc-200">
          Time on shift:{" "}
          <span className="font-mono font-semibold text-gold">{elapsed}</span>
        </div>
      )}

      {clockOutTime && (
        <div className="text-sm text-zinc-200">
          Shift End / Clock-Out: <span className="font-mono font-semibold text-rose-400">{clockOutTime}</span>
        </div>
      )}

      <p className="text-[11px] text-zinc-400">
        {impersonated
          ? "* Read-only impersonated view — the developer is observing this member's shift."
          : "* Signing out records your official departure timestamp and logs you off duty. A 15-minute company leeway applies to scheduled shift starts."}
      </p>
    </div>
  );
}
