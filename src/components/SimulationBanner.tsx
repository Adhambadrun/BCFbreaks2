"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface UserOption {
  email: string;
  name: string;
  role: string;
  team?: string | null;
}

/**
 * Persistent Developer Simulation banner.
 *
 * Rendered at the top of the viewport on every surface whenever the Developer
 * is impersonating another user (`simulatedUser` active). It keeps the
 * impersonation controls permanently visible — the toolbar never disappears —
 * with two required controls:
 *
 *   1. "Exit Simulation" — clears the impersonation cookie and restores the
 *      primary Developer view.
 *   2. "Switch User" — a quick-select dropdown to swap simulated profiles on
 *      the fly without navigating away.
 *
 * The impersonation cookie itself is server-enforced (signed with AUTH0_SECRET
 * and only honored for the real Developer session), so this component is purely
 * a control surface — it cannot escalate permissions on its own.
 */
export default function SimulationBanner({
  impersonatingEmail,
  users,
}: {
  impersonatingEmail: string | null;
  users: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onSwitch(email: string) {
    if (!email) return;
    setBusy(true);
    try {
      await fetch("/api/dev/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function onExit() {
    setBusy(true);
    try {
      await fetch("/api/dev/impersonate", { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-2">
      <div className="liquid-glass--thin pointer-events-auto flex w-full max-w-3xl flex-col gap-2 border-gold/40 p-3 shadow-[0_12px_45px_rgba(0,0,0,0.7)] sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-gold shadow-[0_0_12px_rgba(255,204,0,0.9)]" />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-gold">
            Dev Simulator
          </span>
          <span className="truncate rounded bg-gold/15 px-2 py-0.5 font-mono text-[10px] text-amber-200">
            {impersonatingEmail}
          </span>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <select
            value=""
            onChange={(e) => onSwitch(e.target.value)}
            disabled={busy || pending}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 p-2 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50 sm:max-w-xs"
          >
            <option value="">{busy || pending ? "Switching…" : "Switch User…"}</option>
            {users.map((u) => (
              <option key={u.email} value={u.email} disabled={u.email === impersonatingEmail}>
                {u.name} ({u.email}) — {u.role}
                {u.team ? ` · ${u.team}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={onExit}
            disabled={busy || pending}
            className="shrink-0 rounded-xl border border-crimson/50 bg-crimson/20 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-crimson transition hover:bg-crimson/30 hover:shadow-[0_0_20px_rgba(255,0,60,0.4)] disabled:opacity-50"
          >
            {busy || pending ? "…" : "Exit Simulation"}
          </button>
        </div>
      </div>
    </div>
  );
}
