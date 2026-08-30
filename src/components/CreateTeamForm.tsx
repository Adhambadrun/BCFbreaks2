"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTeamForm({
  supervisors,
}: {
  supervisors: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, supervisorId: supervisorId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: body.error ?? "Failed to create team" });
        return;
      }
      setMessage({ kind: "ok", text: `Team "${name}" created.` });
      setName("");
      setSupervisorId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name (e.g. Titans)"
        className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-gold/50"
      />
      <select
        value={supervisorId}
        onChange={(e) => setSupervisorId(e.target.value)}
        className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-gold/50"
      >
        <option value="">— No supervisor yet —</option>
        {supervisors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.email})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="rounded-xl border border-gold/40 bg-gold/15 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-gold transition hover:bg-gold/25 hover:shadow-[0_0_20px_rgba(255,204,0,0.25)] disabled:opacity-40"
      >
        {busy ? "Creating..." : "Create Team"}
      </button>
      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
