import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/**
 * Never prerender or statically optimize this route (AGENT_INSTRUCTIONS.md §5):
 * it reads live session/database state, and keeping it dynamic also stops
 * `next build` from importing it into the static-generation worker.
 */
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/teams — create a team, optionally with a supervisor.
 * DEV + ADMIN only.
 */
export async function POST(request: NextRequest) {
  const admin = await getSessionUser();
  if (!admin || (admin.role !== "DEV" && admin.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });
  }

  let name: string | undefined;
  let supervisorId: string | undefined;
  try {
    const body = (await request.json()) as { name?: string; supervisorId?: string | null };
    name = body.name?.trim();
    supervisorId = body.supervisorId || undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!name || name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Team name must be 2-60 characters" }, { status: 400 });
  }

  const existing = await prisma.team.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: `Team "${name}" already exists` }, { status: 409 });
  }

  if (supervisorId) {
    const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
    if (!supervisor) return NextResponse.json({ error: "Supervisor not found" }, { status: 400 });
    if (supervisor.role !== "SUPERVISOR" && supervisor.role !== "ADMIN" && supervisor.role !== "DEV") {
      return NextResponse.json({ error: "Selected user is not a supervisor" }, { status: 400 });
    }
    const already = await prisma.team.findUnique({ where: { supervisorId } });
    if (already) {
      return NextResponse.json(
        { error: `${supervisor.name} already supervises team "${already.name}"` },
        { status: 409 },
      );
    }
  }

  const team = await prisma.team.create({
    data: {
      name,
      ...(supervisorId ? { supervisorId } : {}),
    },
  });

  if (supervisorId) {
    await prisma.user.update({ where: { id: supervisorId }, data: { teamId: team.id } });
  }

  return NextResponse.json({ ok: true, team: { id: team.id, name: team.name } });
}
