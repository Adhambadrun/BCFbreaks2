"use client";
import { useState } from "react";
import { REQUEST_POLICY, ATTENDANCE_MAILBOX } from "@/lib/policy";

const TEMPLATES = {
  SWAP_DAY: {
    subject: "SWAP DAY REQUEST",
    template: (name: string) =>
      `Dear Management,\n\nI would like to request a Swap Day.\nAgent: ${name}\nCoverage Date:\nCovering Agent:\nLocation (Office/WFH):\n\nThank you.`,
  },
  LEAVE: {
    subject: "ANNUAL / SICK LEAVE REQUEST",
    template: (name: string) =>
      `Dear Management,\n\nI am requesting Leave.\nAgent: ${name}\nType (Annual/Sick):\nStart Date:\nEnd Date:\nMedical Certificate URL (if Sick):\n\nThank you.`,
  },
  WFH: {
    subject: "WORK FROM HOME REQUEST",
    template: (name: string) =>
      `Dear Management,\n\nI am submitting a Work From Home request.\nAgent: ${name}\nRequested Date:\nReason:\n\nI confirm I will meet the minimum WFH targets.`,
  },
  SHIFT_CHANGE: {
    subject: "SHIFT CHANGE REQUEST",
    template: (name: string) =>
      `Dear Management,\n\nI am requesting a shift change.\nAgent: ${name}\nDate:\nCurrent Shift:\nRequested Shift:\nReason:\n\nThank you.`,
  },
};

export default function EmailTemplateDispatcher({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const [selectedKey, setSelectedKey] = useState<keyof typeof TEMPLATES>("SWAP_DAY");
  const [emailBody, setEmailBody] = useState(TEMPLATES.SWAP_DAY.template(userName));
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleTemplateChange = (key: keyof typeof TEMPLATES) => {
    setSelectedKey(key);
    setEmailBody(TEMPLATES[key].template(userName));
    setStatus(null);
  };

  const handleSendEmail = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/email/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: ATTENDANCE_MAILBOX,
          from: userEmail,
          subject: `[${TEMPLATES[selectedKey].subject}] - ${userName}`,
          body: emailBody,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { delivered?: boolean };
      if (res.ok && data.delivered) {
        setStatus(`✅ Email dispatched directly to ${ATTENDANCE_MAILBOX}!`);
      } else if (res.ok) {
        setStatus("🗂️ Request stored on record — direct email transport is not configured, management still receives it via the approvals ledger.");
      } else {
        setStatus("❌ Failed to send email. Please try again.");
      }
    } catch {
      setStatus("❌ Network error sending email.");
    } finally {
      setSending(false);
    }
  };

  const rules = REQUEST_POLICY[selectedKey].rules;

  return (
    <div className="liquid-glass--thin flex flex-col gap-4 p-6 text-white">
      <div className="flex justify-between items-center">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-zinc-100">
          📧 In-App Email Dispatcher
        </h3>
        <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-wider text-cyan">
          To: {ATTENDANCE_MAILBOX}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((k) => (
          <button
            key={k}
            onClick={() => handleTemplateChange(k)}
            className={`font-display text-[10px] py-2 px-3 rounded-xl font-bold uppercase tracking-wider border transition-all ${
              selectedKey === k
                ? "border-gold/60 bg-gold/20 text-gold shadow-[0_0_18px_rgba(255,204,0,0.25)]"
                : "border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-100 hover:border-white/20"
            }`}
          >
            {k.replace("_", " ")}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-1 rounded-xl border border-white/[0.07] bg-black/30 p-3">
        <li className="font-display text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          {REQUEST_POLICY[selectedKey].label} — Policy Rules
        </li>
        {rules.map((rule) => (
          <li key={rule} className="text-[11px] leading-relaxed text-zinc-400">
            • {rule}
          </li>
        ))}
      </ul>

      <textarea
        value={emailBody}
        onChange={(e) => setEmailBody(e.target.value)}
        className="h-40 w-full rounded-xl border border-white/[0.08] bg-black/40 p-3 font-mono text-xs text-zinc-200 transition-colors focus:border-cyan/50 focus:outline-none"
      />

      <button
        onClick={handleSendEmail}
        disabled={sending}
        className="rounded-xl bg-gradient-to-r from-green to-emerald-500 py-3 font-display text-xs font-black uppercase tracking-widest text-black shadow-[0_0_25px_rgba(0,255,136,0.3)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {sending ? "Sending Email..." : "Send Request Email Now"}
      </button>

      {status && <p className="text-xs text-center text-zinc-300">{status}</p>}
    </div>
  );
}
