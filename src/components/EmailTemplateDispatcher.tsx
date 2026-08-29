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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 text-white">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm">📧 In-App Email Dispatcher</h3>
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/30">
          To: {ATTENDANCE_MAILBOX}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((k) => (
          <button
            key={k}
            onClick={() => handleTemplateChange(k)}
            className={`text-xs py-2 px-3 rounded-xl font-medium border transition-all ${
              selectedKey === k
                ? "bg-blue-600 border-blue-400 text-white"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {k.replace("_", " ")}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <li className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {REQUEST_POLICY[selectedKey].label} — Policy Rules
        </li>
        {rules.map((rule) => (
          <li key={rule} className="text-[11px] leading-relaxed text-slate-400">
            • {rule}
          </li>
        ))}
      </ul>

      <textarea
        value={emailBody}
        onChange={(e) => setEmailBody(e.target.value)}
        className="w-full h-40 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
      />

      <button
        onClick={handleSendEmail}
        disabled={sending}
        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold text-xs py-3 rounded-xl transition-all"
      >
        {sending ? "Sending Email..." : "Send Request Email Now"}
      </button>

      {status && <p className="text-xs text-center">{status}</p>}
    </div>
  );
}
