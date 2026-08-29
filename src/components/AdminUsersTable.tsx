"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  teamName: string | null;
  supervisedTeamName: string | null;
}

const ROLE_OPTIONS = ["DEV", "ADMIN", "SUPERVISOR", "AGENT", "PREVIEWER"];

export default function AdminUsersTable({
  users,
  teams,
  currentUserId,
}: {
  users: AdminUserRow[];
  teams: Array<{ id: string; name: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, { role: string; teamId: string }>>(() =>
    Object.fromEntries(
      users.map((u) => [u.id, { role: u.role, teamId: u.teamId ?? "" }]),
    ),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function update(id: string, patch: Partial<{ role: string; teamId: string }>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save(u: AdminUserRow) {
    const draft = drafts[u.id];
    setSavingId(u.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: draft.role,
          teamId: draft.teamId === "" ? null : draft.teamId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: body.error ?? "Save failed" });
        return;
      }
      setMessage({ kind: "ok", text: `${u.name} updated.` });
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] shadow-xl backdrop-blur-2xl">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="text-base font-bold text-white">Users &amp; Roles</h2>
        {message && (
          <span
            className={`text-xs ${message.kind === "ok" ? "text-emerald-400" : "text-rose-400"}`}
          >
            {message.text}
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-6 py-2 font-semibold">Member</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Team</th>
              <th className="px-6 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const draft = drafts[u.id] ?? { role: u.role, teamId: u.teamId ?? "" };
              const dirty =
                draft.role !== u.role || (draft.teamId ?? "") !== (u.teamId ?? "");
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-6 py-2.5">
                    <span className="block font-medium text-slate-100">
                      {u.name}
                      {isSelf && <span className="ml-2 text-[10px] text-slate-500">(you)</span>}
                    </span>
                    <span className="block text-[10px] text-slate-500">{u.email}</span>
                    {u.supervisedTeamName && (
                      <span className="block text-[10px] text-sky-400/80">
                        supervises: {u.supervisedTeamName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={draft.role}
                      disabled={isSelf}
                      onChange={(e) => update(u.id, { role: e.target.value })}
                      className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={draft.teamId}
                      onChange={(e) => update(u.id, { teamId: e.target.value })}
                      className="max-w-[170px] rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">— No team —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-2.5 text-right">
                    <button
                      onClick={() => save(u)}
                      disabled={!dirty || savingId === u.id || isSelf}
                      className="rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25 disabled:opacity-30"
                    >
                      {savingId === u.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-6 pb-4 pt-2 text-[11px] text-slate-600">
        Assigning a SUPERVISOR to a team makes them that team&apos;s official supervisor — this
        resolves &quot;N/A — pending assignment&quot; states.
      </p>
    </section>
  );
}
