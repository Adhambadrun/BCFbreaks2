import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { ATTENDANCE_MAILBOX } from "@/lib/policy";

export const runtime = "nodejs";

const MAX_BODY_CHARS = 20_000;
const MAX_SUBJECT_CHARS = 300;

type DispatchBody = {
  to?: string;
  from?: string;
  subject?: string;
  body?: string;
};

/**
 * POST /api/email/dispatch — the In-App Email Engine.
 *
 * Sends a request email from the signed-in agent to the operations mailbox
 * (attendance.cai@bcflights.com) and persists an immutable RequestRecord
 * audit entry. Every dispatch is attributed server-side to the Auth0 session
 * identity — a client-supplied `from` is never trusted for attribution.
 *
 * Transport: when RESEND_API_KEY is configured the mail goes out immediately
 * over the Resend HTTP API; otherwise the dispatch is stored on the approvals
 * ledger and logged for the mail queue (dev/offline mode) — the response
 * reports which transport was used.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role === "PREVIEWER") {
    return NextResponse.json({ error: "Preview accounts cannot dispatch emails" }, { status: 403 });
  }

  let payload: DispatchBody;
  try {
    payload = (await request.json()) as DispatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = payload.subject?.trim();
  const body = payload.body?.trim();
  if (!subject || !body) {
    return NextResponse.json({ error: "subject and body are required" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT_CHARS || body.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "Email exceeds size limits" }, { status: 413 });
  }

  // The operational mailbox is fixed; spoofable fields are normalized.
  const to = ATTENDANCE_MAILBOX;
  const from = user.email;

  let delivered = false;
  let transport: "resend" | "ledger" = "ledger";

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "BCFBreaks <onboarding@resend.dev>",
          to: [to],
          reply_to: from,
          subject: `${subject} — ${user.name} <${from}>`,
          text: `${body}\n\n—\nSent from BCFbreaks by ${user.name} <${from}>\n`,
        }),
      });
      delivered = res.ok;
      if (!res.ok) {
        console.error("[email/dispatch] resend rejected:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[email/dispatch] resend request failed:", err);
    }
    transport = delivered ? "resend" : "ledger";
  } else {
    console.log(
      `[email/dispatch] (ledger transport) ${user.email} -> ${to}: ${subject}\n${body}`,
    );
  }

  const record = await prisma.requestRecord.create({
    data: {
      userId: user.id,
      kind: inferKind(subject),
      subject,
      body,
      recipient: to,
    },
  });

  return NextResponse.json({
    ok: true,
    delivered,
    transport,
    recordId: record.id,
    to,
    from,
  });
}

/** Best-effort classification of the dispatch for the audit ledger. */
function inferKind(subject: string): string {
  const upper = subject.toUpperCase();
  if (upper.includes("SWAP")) return "SWAP_DAY";
  if (upper.includes("LEAVE") || upper.includes("SICK")) return "LEAVE";
  if (upper.includes("WORK FROM HOME") || upper.includes("WFH")) return "WFH";
  if (upper.includes("SHIFT CHANGE")) return "SHIFT_CHANGE";
  return "OTHER";
}
