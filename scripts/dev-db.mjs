/**
 * Dev-only embedded PostgreSQL launcher (sandbox / local machine).
 *
 * Production never uses this — production DATABASE_URL points at a managed
 * Postgres (Vercel Postgres / Neon / Supabase / RDS). This script exists so
 * the app can run against a REAL database locally with zero external setup.
 *
 * Data lives in ./.pgdata (gitignored). Run: `npm run db:up`
 */
import EmbeddedPostgres from "embedded-postgres";

const PORT = 5432;
const DB_NAME = "bcfbreaks";

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: ".pgdata",
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    onError: (msgOrError) => console.error("[postgres]", msgOrError),
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME).catch((e) => {
    const msg = String(e?.message ?? e);
    if (!/already exists/i.test(msg)) throw e;
    console.log(`[postgres] database "${DB_NAME}" already exists`);
  });

  console.log(`[postgres] ready — postgresql://postgres:postgres@127.0.0.1:${PORT}/${DB_NAME}`);
  // Keep this process alive so the server keeps running.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("[postgres] failed to start:", err);
  process.exit(1);
});
