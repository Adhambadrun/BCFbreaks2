import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { IMPERSONATION_COOKIE, signImpersonation } from "@/lib/impersonation";
import { normalizeEmail } from "@/lib/permissions";

/**
 * Developer-only impersonation endpoint.
 * POST   { email }  — start viewing the app as the given user
 * DELETE           — stop impersonating
 *
 * The cookie is HMAC-signed with AUTH0_SECRET; the server only honors it when
 * the REAL session belongs to the developer, so it cannot be forged.
 */
export async function POST(request: NextRequest) {
  const real = await getSessionUser();
  if (!real || real.role !== "DEV") {
    return NextResponse.json({ error: "Forbidden — developer only" }, { status: 403 });
  }

  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const clean = normalizeEmail(email);
  const target = await prisma.user.findUnique({ where: { email: clean } });
  if (!target) {
    return NextResponse.json({ error: `No such user: ${clean}` }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, impersonating: target.email });
  res.cookies.set(IMPERSONATION_COOKIE, signImpersonation(target.email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const real = await getSessionUser();
  if (!real || real.role !== "DEV") {
    return NextResponse.json({ error: "Forbidden — developer only" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, impersonating: null });
  res.cookies.set(IMPERSONATION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
