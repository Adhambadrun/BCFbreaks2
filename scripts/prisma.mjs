/**
 * Prisma CLI wrapper.
 *
 * Why this exists: `prisma generate` in this offline sandbox cannot reach
 * binaries.prisma.sh (the engine CDN). The CLI skips the download entirely when
 * PRISMA_SCHEMA_ENGINE_BINARY points at an existing file — and `generate` never
 * executes the engine (runtime uses the WASM query compiler + the pg driver
 * adapter). This wrapper therefore:
 *
 *   1. Ensures a placeholder engine file exists in node_modules
 *   2. Sets PRISMA_SCHEMA_ENGINE_BINARY so the CLI resolves it locally
 *   3. Spawns the real Prisma CLI with all passed-through arguments
 *
 * Migrate commands that EXECUTE the engine (`migrate dev`, `migrate deploy`,
 * `db push`, `db pull`) need the REAL engine binary. In any network-normal
 * environment (Vercel CI, GitHub Actions, your machine) run them directly:
 *
 *   npx prisma migrate deploy          # real engine, downloads from CDN
 *
 * or set BCF_PRISMA_REAL_ENGINE=1 to disable the local placeholder entirely.
 *
 * Usage: node scripts/prisma.mjs <prisma args...>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const ENGINES_DIR = path.join(REPO_ROOT, "node_modules", "@prisma", "engines");
const PLACEHOLDER = path.join(ENGINES_DIR, "schema-engine-debian-openssl-3.0.x");

const args = process.argv.slice(2);
const useRealEngine =
  process.env.BCF_PRISMA_REAL_ENGINE === "1" || args.some((a) => a === "--real-engine");

if (!useRealEngine) {
  fs.mkdirSync(ENGINES_DIR, { recursive: true });
  if (!fs.existsSync(PLACEHOLDER)) fs.writeFileSync(PLACEHOLDER, "");
  fs.chmodSync(PLACEHOLDER, 0o755);
}

const env = { ...process.env };
if (!useRealEngine) env.PRISMA_SCHEMA_ENGINE_BINARY = PLACEHOLDER;

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  cwd: REPO_ROOT,
  env,
});

process.exit(result.status ?? 1);
