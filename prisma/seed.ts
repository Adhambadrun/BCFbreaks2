/**
 * BCFbreaks database seed — the production roster from the canonical source of
 * truth (`src/lib/roster.ts`).
 *
 * Run: npm run db:seed   (idempotent — safe to run repeatedly)
 *
 * Unlike older seeds, this one is AUTHORITATIVE for the roster: every roster
 * member's `name` (display/first name), `fullName`, `role` and team membership
 * are synced from the roster on each run. Non-roster users (e.g. previewers
 * provisioned on first sign-in, or manually added rows) are left untouched.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getRoleForEmail, type AppRole } from "../src/lib/permissions";
import { ROSTER, TEAM_NAMES } from "../src/lib/roster";

loadEnv({ path: path.resolve(".env.local"), quiet: true });
loadEnv({ path: path.resolve(".env"), quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log("Seeding BCFbreaks production roster...");

  // 1. Teams (logos intentionally empty — uploaded in-app and stored in DB).
  const teams: Record<string, string> = {};
  for (const teamName of TEAM_NAMES) {
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {},
      create: { name: teamName },
    });
    teams[teamName] = team.id;
    console.log(`  team: ${teamName}`);
  }

  // 2. Users — authoritative name / fullName / role / team from the roster.
  const ids: Record<string, string> = {};
  for (const entry of ROSTER) {
    const clean = entry.email.toLowerCase().trim();
    const role: AppRole = getRoleForEmail(clean);

    // Real DB teams only exist for CAI 1–5. Admin / Manager and Developer are
    // role groupings, not teams, so those members have no teamId.
    const teamId = TEAM_NAMES.includes(entry.team) ? teams[entry.team] : null;

    const user = await prisma.user.upsert({
      where: { email: clean },
      update: {
        name: entry.displayName,
        fullName: entry.fullName,
        role,
        teamId,
      },
      create: {
        email: clean,
        name: entry.displayName,
        fullName: entry.fullName,
        role,
        ...(teamId ? { teamId } : {}),
      },
    });
    ids[clean] = user.id;
    console.log(
      `  user: ${clean.padEnd(28)} -> ${role.padEnd(12)} ${teamId ? entry.team : "(no team)"}`,
    );
  }

  // 3. Supervisor -> team assignments (Jay→CAI 2, Albert→CAI 3, Watkins→CAI 4,
  //    Amir→CAI 5). CAI 1 has no supervisor (independent agent).
  for (const entry of ROSTER) {
    if (entry.role !== "Supervisor") continue;
    const clean = entry.email.toLowerCase().trim();
    const teamId = teams[entry.team];
    const userId = ids[clean];

    await prisma.team.update({ where: { id: teamId }, data: { supervisorId: userId } });
    await prisma.user.update({ where: { id: userId }, data: { teamId } });
    console.log(`  link: ${clean} supervises ${entry.team}`);
  }

  const counts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    attendances: await prisma.attendance.count(),
  };
  console.log(
    `Seed complete: ${counts.users} users, ${counts.teams} teams, ${counts.attendances} attendance records.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
