import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/**
 * Never prerender or statically optimize this route (AGENT_INSTRUCTIONS.md §5):
 * it reads live session/database state, and keeping it dynamic also stops
 * `next build` from importing it into the static-generation worker.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * POST /api/teams/[id]/logo — multipart upload of a team logo.
 * Allowed for DEV/ADMIN and for the team's own supervisor.
 * Bytes are stored in the Asset table; team.logoUrl points at
 * /api/assets/<id> — permanently persisted in the database.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const isManager = user.role === "DEV" || user.role === "ADMIN";
  const isOwnSupervisor = user.role === "SUPERVISOR" && team.supervisorId === user.id;
  if (!isManager && !isOwnSupervisor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "Invalid multipart payload" }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPEG, WebP or GIF images are allowed" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const asset = await prisma.asset.create({
    data: {
      filename: file.name || "team-logo",
      mimeType: file.type,
      size: bytes.length,
      data: bytes,
      uploadedById: user.id,
    },
  });

  const logoUrl = `/api/assets/${asset.id}`;
  await prisma.team.update({ where: { id: team.id }, data: { logoUrl } });

  return NextResponse.json({ ok: true, logoUrl });
}
