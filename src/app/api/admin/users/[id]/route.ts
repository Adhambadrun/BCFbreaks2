import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import type { AppRole } from "@/lib/permissions";

/**
 * Never prerender or statically optimize this route (AGENT_INSTRUCTIONS.md §5):
 * it reads live session/database state, and keeping it dynamic also stops
 * `next build` from importing it into the static-generation worker.
 */
export const dynamic = "force-dynamic";

const ROLES: AppRole[] = ["DEV", "ADMIN", "SUPERVISOR", "INDEPENDENT", "AGENT", "PREVIEWER"];

/**
 * PATCH /api/admin/users/[id] — change a user's role and/or team assignment.
 * DEV + ADMIN only. Team-supervisor bookkeeping is kept consistent:
 * assigning a SUPERVISOR to a team makes them that team's supervisor
 * (resolving "N/A - pending assignment" states like Albert's and Amir's).
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || (admin.role !== "DEV" && admin.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let role: AppRole | undefined;
  let teamId: string | null | undefined;
  try {
    const body = (await request.json()) as { role?: string; teamId?: string | null };
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role as AppRole)) {
        return NextResponse.json({ error: `Invalid role: ${body.role}` }, { status: 400 });
      }
      role = body.role as AppRole;
    }
    if (body.teamId !== undefined) {
      teamId = body.teamId === null || body.teamId === "" ? null : body.teamId;
      if (teamId) {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return NextResponse.json({ error: "Team not found" }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (target.id === admin.id && role && role !== admin.role) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  const nextRole = role ?? target.role;
  const nextTeamId = teamId ?? target.teamId;

  const updated = await prisma.$transaction(async (tx) => {
    // Demoting away from SUPERVISOR: release any supervised team.
    if (target.role === "SUPERVISOR" && nextRole !== "SUPERVISOR") {
      await tx.team.updateMany({ where: { supervisorId: target.id }, data: { supervisorId: null } });
    }

    // Supervisor team assignment bookkeeping.
    if (nextRole === "SUPERVISOR" && teamId !== undefined) {
      await tx.team.updateMany({ where: { supervisorId: target.id, id: { not: nextTeamId ?? "" } }, data: { supervisorId: null } });
      if (nextTeamId) {
        await tx.team.update({ where: { id: nextTeamId }, data: { supervisorId: target.id } });
      }
    }

    return tx.user.update({
      where: { id: target.id },
      data: {
        ...(role !== undefined ? { role: nextRole } : {}),
        ...(teamId !== undefined ? { teamId: nextTeamId } : {}),
      },
    });
  });

  return NextResponse.json({
    ok: true,
    user: { id: updated.id, email: updated.email, role: updated.role, teamId: updated.teamId },
  });
}
