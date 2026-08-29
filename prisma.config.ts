// =============================================================================
// Prisma configuration (Prisma 7 — Rust-free: query compiler WASM +
// @prisma/adapter-pg driver adapter; no binary downloads required).
//
// Prisma 7 no longer auto-loads .env files, so this config explicitly loads
// `.env.local` (gitignored) then `.env` for CLI commands (migrate, seed...).
// At runtime, Next.js loads the same files for us.
// =============================================================================
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.resolve(".env.local"), quiet: true });
loadEnv({ path: path.resolve(".env"), quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
