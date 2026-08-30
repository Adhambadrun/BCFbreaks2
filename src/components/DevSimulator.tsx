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
 * Developer Control Panel — real-time user impersonation.
 * Rendered ONLY for the developer account (adhambadraan@gmail.com); the
 * impersonation target is enforced server-side via a signed cookie that the
 * server only honors for the real developer session.
 */
export default function DevSimulator({
  currentUserEmail,
  impersonatingEmail,
  users,
}: {
  currentUserEmail: string;
  impersonatingEmail?: string | null;
  users: UserOption[];
}) {
  if (currentUserEmail.toLowerCase() !== "adhambadraan@gmail.com") return null;
  return (
    <DevSimulatorInner impersonatingEmail={impersonatingEmail} users={users} />
  );
}

function DevSimulatorInner({
  impersonatingEmail,
  users,
}: {
  impersonatingEmail?: string | null;
  users: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onSimulate(email: string) {
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

  async function onStop() {
    setBusy(true);
    try {
      await fetch("/api/dev/impersonate", { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="liquid-glass--thin my-4 w-full border-gold/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-gold">
          🛠️ Developer Control Panel
        </span>
        <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[10px] text-gold">
          User Impersonation Engine
        </span>
      </div>

      {impersonatingEmail ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="flex-1 text-xs text-amber-200">
            Currently viewing as <span className="font-mono font-bold">{impersonatingEmail}</span>
          </span>
          <button
            onClick={onStop}
            disabled={busy || pending}
            className="rounded-xl border border-gold/40 bg-gold/20 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-gold transition hover:bg-gold/30 disabled:opacity-50"
          >
            {busy || pending ? "Switching..." : "Stop Impersonating"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <select
            value=""
            onChange={(e) => onSimulate(e.target.value)}
            disabled={busy || pending}
            className="flex-1 rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50"
          >
            <option value="">
              {busy || pending
                ? "Switching view..."
                : "-- Select Any User / Supervisor / Agent to Impersonate --"}
            </option>
            {users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name} ({u.email}) - [{u.role}] - Team: {u.team || "N/A"}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
