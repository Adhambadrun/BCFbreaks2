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
 * POST /api/me/avatar — multipart upload of a new profile picture.
 * The image bytes are stored in the Asset table and avatarUrl points at
 * /api/assets/<id> — a stable, database-backed URL that persists across page
 * reloads AND deployments (never volatile local state).
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

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
    return NextResponse.json({ error: "Image must be 2 MB or smaller" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const asset = await prisma.asset.create({
    data: {
      filename: file.name || "avatar",
      mimeType: file.type,
      size: bytes.length,
      data: bytes,
      uploadedById: user.id,
    },
  });

  const avatarUrl = `/api/assets/${asset.id}`;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });

  return NextResponse.json({ ok: true, avatarUrl });
}
