"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LATENCY_LEEWAY_MINUTES, LATE_PENALTY_HOURS, COVERAGE_HOURS_PER_LATE_HOUR } from "@/lib/policy";

export type ClarificationView = {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  message: string;
  decisionNote?: string | null;
};

/**
 * The 15-minute latency engine's user-facing surface.
 *
 * Renders NOTHING while the agent is inside the company leeway window
 * (0–15 minutes) — no indicator, no flag, per policy. Only once the session
 * is flagged "Late" (> 15 minutes past scheduled shift start) does this card
 * appear with the +1h shift penalty, the coverage requirement, and the
 * written clarification prompt.
 */
export default function LatencyClarificationCard({
  attendanceId,
  lateMinutes,
  scheduledStartIso,
  cleared,
  clarification,
  penaltyHours,
  coverageHoursRequired,
  readOnly = false,
}: {
  attendanceId: string;
  lateMinutes: number;
  scheduledStartIso: string | null;
  cleared: boolean;
  clarification: ClarificationView | null;
  penaltyHours: number;
  coverageHoursRequired: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company leeway: below or at the threshold this component must not even
  // mount an indicator (audit-verified).
  if (lateMinutes <= LATENCY_LEEWAY_MINUTES) return null;

  const flagged = !cleared;
  const scheduled = scheduledStartIso
    ? new Date(scheduledStartIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  async function submitClarification() {
    if (!message.trim()) {
      setError("A written clarification is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance/clarification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, message: message.trim() }),
      });
      if (res.ok) {
        setMessage("");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to submit clarification. Please try again.");
      }
    } catch {
      setError("Network error submitting clarification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`liquid-glass--thin flex w-full flex-col gap-3 border p-4 ${
        flagged ? "border-rose-500/30 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-zinc-200">
          ⏱️ Shift Latency Review
        </span>
        {cleared ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            ✓ Cleared — No Penalty
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-rose-400" />
            Late — {lateMinutes} min over schedule
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-zinc-300 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
            Scheduled start
          </span>
          <span className="font-mono font-semibold text-zinc-200">{scheduled ?? "—"}</span>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
            Shift penalty
          </span>
          <span className="font-mono font-semibold text-rose-300">
            +{penaltyHours}h {flagged ? "" : "(waived)"}
          </span>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
            Coverage owed
          </span>
          <span className="font-mono font-semibold text-amber-300">
            {coverageHoursRequired}h{" "}
            <span className="font-sans text-[10px] font-normal text-zinc-500">
              ({LATE_PENALTY_HOURS}h late → {COVERAGE_HOURS_PER_LATE_HOUR}h coverage)
            </span>
          </span>
        </div>
      </div>

      {clarification ? (
        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300">Your clarification</span>
            {clarification.status === "PENDING" && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                PENDING APPROVAL
              </span>
            )}
            {clarification.status === "APPROVED" && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                APPROVED
              </span>
            )}
            {clarification.status === "DECLINED" && (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                DECLINED — WARNING LOGGED
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
            {clarification.message}
          </p>
          {clarification.decisionNote && (
            <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] italic text-zinc-500">
              Reviewer note: {clarification.decisionNote}
            </p>
          )}
        </div>
      ) : (
        flagged &&
        !readOnly && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold text-zinc-300">
              Written clarification required — route to Pending Approvals:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain the circumstances of your late arrival (e.g. transport failure, emergency)…"
              className="h-24 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 focus:border-rose-400 focus:outline-none"
            />
            <button
              onClick={submitClarification}
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-crimson to-rose-500 px-4 py-2.5 font-display text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,0,60,0.25)] transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Clarification for Approval"}
            </button>
            <p className="text-[10px] text-zinc-500">
              If declined — or never submitted before your shift ends — an official System
              Warning is logged to your profile automatically.
            </p>
          </div>
        )
      )}

      {readOnly && flagged && (
        <p className="text-[11px] italic text-zinc-400">
          * Read-only impersonated view — the agent submits their own clarification.
        </p>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
