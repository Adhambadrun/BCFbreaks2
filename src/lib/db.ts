import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createLazyClient } from "./lazy";

/**
 * Prisma Client singleton (Prisma 7, Rust-free):
 * the query compiler runs in WASM and all database I/O goes through the
 * `pg` driver adapter — no native engine binaries are required at runtime.
 *
 * ⚠️ LAZY BY CONTRACT — do not "simplify" this back to `new PrismaClient()` at
 * module scope. Importing this module must never throw: `next build` imports
 * every route module while collecting page data, and an eager client turns a
 * missing runtime `DATABASE_URL` into a failed Vercel deployment instead of a
 * per-request error. The rule is enforced in AGENT_INSTRUCTIONS.md §5.
 *
 * Every `prisma.<model>` / `prisma.$transaction` access goes through the proxy,
 * so the client (and its `pg` pool) is built once, on first real use, and
 * memoized for the lifetime of the server process/container.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Reuse across HMR reloads (dev) and across requests within one container
  // (prod) — a fresh client per call would spawn a new pg pool every time.
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and configure your PostgreSQL connection.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}

export const prisma: PrismaClient = createLazyClient("prisma", createPrismaClient);
