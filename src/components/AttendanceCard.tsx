"use client";

import { useEffect, useState } from "react";

/**
 * Shift Attendance Status card.
 *
 * The clock-in timestamp comes from the DATABASE (Attendance.clockIn, written
 * automatically when the user's session starts the shift) — not from volatile
 * client state — so it survives reloads, redeployments and devices.
 */
export default function AttendanceCard({
  clockInIso,
  clockOutIso,
  impersonated = false,
}: {
  /** ISO timestamp of the official DB-backed clock-in (open shift), if any. */
  clockInIso?: string | null;
  /** ISO timestamp of the last official clock-out, if the shift already ended. */
  clockOutIso?: string | null;
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

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">Shift Attendance Status</span>
        {onShift ? (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
            Attended &amp; Clocked In
          </span>
        ) : clockOutTime ? (
          <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            Clocked Out
          </span>
        ) : (
          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
            Recording...
          </span>
        )}
      </div>

      <div className="text-sm text-slate-200">
        Login Shift Start:{" "}
        <span className="font-mono font-semibold text-blue-400">{clockInTime ?? "Pending"}</span>
      </div>

      {onShift && elapsed && (
        <div className="text-sm text-slate-200">
          Time on shift: <span className="font-mono font-semibold text-emerald-400">{elapsed}</span>
        </div>
      )}

      {clockOutTime && (
        <div className="text-sm text-slate-200">
          Shift End / Clock-Out:{" "}
          <span className="font-mono font-semibold text-rose-400">{clockOutTime}</span>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        {impersonated
          ? "* Read-only impersonated view — the developer is observing this member's shift."
          : "* Signing out records your official departure timestamp and logs you off duty."}
      </p>
    </div>
  );
}
