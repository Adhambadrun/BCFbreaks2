import { prisma } from "@/lib/db";
import { getEffectiveUser } from "@/lib/session";
import { REQUEST_POLICY } from "@/lib/policy";
import AccessGate from "@/components/AccessGate";
import EmailTemplateDispatcher from "@/components/EmailTemplateDispatcher";
import NavBar from "@/components/NavBar";
import ShaderBackground from "@/components/ShaderBackground";

export const dynamic = "force-dynamic";

/**
 * Requests hub — the In-App Email Engine. Agents dispatch structured request
 * emails (Swap Day, Annual/Sick Leave, WFH, Shift Change) directly to
 * attendance.cai@bcflights.com using ready templates with the policy rules
 * attached, and review their persistent dispatch ledger.
 */
export default async function RequestsPage() {
  const { user, impersonating } = await getEffectiveUser();
  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6">
        <ShaderBackground />
        <div className="relative z-10">
          <AccessGate
            title="Access verification required"
            message="Your session could not be verified. Sign in to dispatch requests."
            showLoginCta
          />
        </div>
      </main>
    );
  }

  const history = await prisma.requestRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const isPreviewer = user.role === "PREVIEWER";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <ShaderBackground />
      <div className="pointer-events-none absolute -right-32 top-24 h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-1/4 h-72 w-72 rounded-full bg-gold/[0.08] blur-3xl" />
      <NavBar user={user} impersonating={impersonating} />

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <h1 className="bg-gradient-to-r from-gold via-amber-200 to-gold bg-clip-text font-display text-xl font-black tracking-wide text-transparent">
          Requests &amp; Email Dispatcher
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Send official request emails to{" "}
          <span className="font-mono text-green">attendance.cai@bcflights.com</span> using ready
          templates — every dispatch is recorded on your permanent ledger.
        </p>

        {isPreviewer ? (
          <div className="mt-6">
            <AccessGate
              title="Requests require a staff account"
              message={
                <>
                  Preview accounts cannot dispatch request emails. Sign in with a{" "}
                  <span className="font-mono">@bcflights.com</span> account.
                </>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.entries(REQUEST_POLICY) as Array<[keyof typeof REQUEST_POLICY, { label: string; rules: readonly string[] }]>).map(
                ([key, policy]) => (
                  <div key={key} className="liquid-glass--ultrathin p-4">
                    <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200">
                      {policy.label}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {policy.rules.map((rule) => (
                        <li key={rule} className="text-[11px] leading-relaxed text-zinc-400">
                          • {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>

            <div className="mt-6">
              {!impersonating ? (
                <EmailTemplateDispatcher userName={user.name} userEmail={user.email} />
              ) : (
                <div className="liquid-glass--thin p-4 text-xs text-amber-200">
                  🛠️ Read-only impersonated view — the agent dispatches their own request emails.
                </div>
              )}
            </div>

            <div className="liquid-glass--ultrathin mt-6 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Dispatch Ledger (permanent)
              </p>
              {history.length === 0 ? (
                <p className="text-xs text-zinc-500">No request emails sent yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.map((r) => (
                    <li key={r.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full border border-green/30 bg-green/10 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-green">
                          {r.kind.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          to <span className="font-mono text-zinc-400">{r.recipient}</span> ·{" "}
                          {r.createdAt.toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-zinc-200">{r.subject}</p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-zinc-500">
                        {r.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
