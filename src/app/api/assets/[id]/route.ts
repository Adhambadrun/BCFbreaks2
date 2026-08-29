import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/assets/[id] — serves a stored avatar / team logo straight from the
 * database (Asset.data). Middleware already guarantees the requester is
 * authenticated. IDs are unique per upload, so responses are immutable and can
 * be cached aggressively.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
  }

  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = new Uint8Array(asset.data);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
