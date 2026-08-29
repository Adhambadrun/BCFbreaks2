/**
 * Applies prisma/migrations/*.sql to the database and stamps
 * _prisma_migrations — without invoking the Rust schema-engine (which this
 * offline sandbox cannot download). The resulting database state is identical
 * to what `prisma migrate deploy` produces, so running the real
 * `npx prisma migrate deploy` afterwards is a no-op.
 *
 * Dev/sandbox only. Production should use: npx prisma migrate deploy
 * Usage: node scripts/db-init.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "prisma", "migrations");

// .env.local is loaded by Next.js at runtime but not here — load manually.
for (const envFile of [".env.local", ".env"]) {
  const p = path.join(REPO_ROOT, envFile);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (.env.local)");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();

  // Ensure the migrations bookkeeping table exists (engine-managed normally).
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id                      VARCHAR(36) NOT NULL,
        checksum                VARCHAR(64) NOT NULL,
        finished_at             TIMESTAMPTZ(3),
        migration_name          VARCHAR(255) NOT NULL,
        logs                    TEXT,
        rolled_back_at          TIMESTAMPTZ(3),
        started_at              TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        applied_steps_count     INTEGER NOT NULL DEFAULT 0
    );
  `);

  const entries = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const name of entries) {
    const sqlPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const { rows } = await client.query(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1 AND rolled_back_at IS NULL LIMIT 1`,
      [name],
    );
    if (rows.length > 0) {
      console.log(`= ${name} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(sqlPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
         VALUES ($1, $2, now(), $3, 1)`,
        [randomUUID(), checksum, name],
      );
      console.log(`+ ${name} (applied)`);
    } catch (err) {
      console.error(`! ${name} FAILED:`, err.message);
      process.exitCode = 1;
      break;
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
