"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ApprovalItem = {
  id: string;
  agentName: string;
  agentEmail: string;
  teamName: string | null;
  clockInIso: string;
  lateMinutes: number;
  scheduledStartIso: string | null;
  message: string;
  submittedAtIso: string;
};

/**
 * Pending Approvals queue actions — Admins, Supervisors and the Developer.
 * APPROVED clears the agent's latency flag without penalty; DECLINED logs an
 * official System Warning to the agent's profile automatically.
 */
export default function ApprovalsPanel({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "APPROVE" | "DECLINE") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/clarification/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[id]?.trim() || undefined }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Decision failed. Please try again.");
      }
    } catch {
      setError("Network error while recording the decision.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="liquid-glass--thin p-5 text-sm text-green">
        ✓ No pending clarifications — the approvals queue is clear.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="liquid-glass--thin border-gold/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-bold text-white">{item.agentName}</span>
              <span className="ml-2 font-mono text-[11px] text-zinc-400">{item.agentEmail}</span>
              {item.teamName && (
                <span className="ml-2 rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-cyan">
                  {item.teamName}
                </span>
              )}
            </div>
            <span className="glow-crimson rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-rose-300">
              {item.lateMinutes} min late
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
            <span>
              Clocked in:{" "}
              <span className="font-mono text-zinc-300">
                {new Date(item.clockInIso).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
            {item.scheduledStartIso && (
              <span>
                Scheduled:{" "}
                <span className="font-mono text-zinc-300">
                  {new Date(item.scheduledStartIso).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            )}
            <span>
              Submitted:{" "}
              <span className="font-mono text-zinc-300">
                {new Date(item.submittedAtIso).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          </div>

          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-black/30 p-3 text-xs leading-relaxed text-zinc-200">
            {item.message}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={notes[item.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
              placeholder="Reviewer note (optional)…"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 transition-colors focus:border-gold/60 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => decide(item.id, "APPROVE")}
                disabled={busyId === item.id}
                className="rounded-xl bg-gradient-to-r from-green to-emerald-500 px-4 py-2 font-display text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_20px_rgba(0,255,136,0.25)] transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
              >
                {busyId === item.id ? "…" : "Approve — clear flag"}
              </button>
              <button
                onClick={() => decide(item.id, "DECLINE")}
                disabled={busyId === item.id}
                className="rounded-xl bg-gradient-to-r from-crimson to-rose-500 px-4 py-2 font-display text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,0,60,0.25)] transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
              >
                {busyId === item.id ? "…" : "Decline — warn"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
