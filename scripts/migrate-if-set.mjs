/**
 * Deploy Prisma migrations during `next build` — only when DATABASE_URL is set.
 *
 * Why this exists: the deployment flow used to run only
 * `prisma generate` + `next build`, never `prisma migrate deploy`. The
 * generated Prisma client (which reflects schema.prisma, e.g. `User.fullName`,
 * `Role.INDEPENDENT`) is then deployed against a live database that may still
 * have the old schema — every request fails with
 * `column "fullName" does not exist` and the app goes down.
 *
 * Behavior:
 *   - DATABASE_URL set (Vercel production/staging, any env with a DB
 *     configured) -> `npx prisma migrate deploy` (idempotent; applies only
 *     pending migrations, records them in `_prisma_migrations`).
 *   - DATABASE_URL unset (local, preview, CI, fresh clone) -> skip with a
 *     notice. The build must still succeed with ZERO env vars (see
 *     AGENT_INSTRUCTIONS.md §4).
 *
 * Only `process.env` is consulted — no .env file is read here, so a build can
 * never target a database it was not explicitly pointed at. Real-engine
 * Prisma CLI commands must not go through `scripts/prisma.mjs` (that wrapper
 * substitutes a placeholder engine for offline sandboxes); `migrate deploy`
 * is run directly, exactly like `npm run db:deploy`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const connectionString = process.env.DATABASE_URL;

if (!connectionString || !connectionString.trim()) {
  console.log(
    "[migrate-if-set] DATABASE_URL not set — skipping prisma migrate deploy",
  );
  process.exit(0);
}

console.log("[migrate-if-set] DATABASE_URL is set — running prisma migrate deploy");

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  cwd: REPO_ROOT,
  env: process.env,
});

if (result.error) {
  console.error("[migrate-if-set] failed to start prisma migrate deploy:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `[migrate-if-set] prisma migrate deploy exited with status ${result.status} — ` +
      "the database is not ready for this schema, failing the build instead of deploying a broken app.",
  );
  process.exit(result.status ?? 1);
}

console.log("[migrate-if-set] prisma migrate deploy completed");
