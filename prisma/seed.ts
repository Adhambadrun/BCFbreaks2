/**
 * BCFbreaks database seed — the production roster from the system spec.
 *
 * Run: npm run db:seed   (idempotent — safe to run repeatedly; existing users
 * are never overwritten, so in-app role/team edits survive re-seeding.)
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getRoleForEmail, type AppRole } from "../src/lib/permissions";

loadEnv({ path: path.resolve(".env.local"), quiet: true });
loadEnv({ path: path.resolve(".env"), quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function nameFor(email: string, role: AppRole): string {
  if (email.toLowerCase() === "adhambadraan@gmail.com") return "Adham Badran";
  const local = email.split("@")[0] ?? "Member";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const TEAM_NAMES = ["Strikers", "Wizards"];

const ROSTER: string[] = [
  // Developer
  "adhambadraan@gmail.com",
  // Administrators
  "meredith@bcflights.com",
  "atlas@bcflights.com",
  "jolene@bcflights.com",
  "naomi@bcflights.com",
  // Supervisors (teams linked below)
  "jay@bcflights.com",
  "watkins@bcflights.com",
  "albert@bcflights.com", // pending assignment
  "amir@bcflights.com", // pending assignment
  // Strikers agents (supervisor: Jay)
  "solomon@bcflights.com",
  "zayn@bcflights.com",
  "leo@bcflights.com",
  "lamar@bcflights.com",
  "fabiola@bcflights.com",
  "shay@bcflights.com",
  "wesley@bcflights.com",
  "eric@bcflights.com",
  "thomas@bcflights.com",
];

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

  // 2. Users — roles come from the role engine (same rules as production).
  const ids: Record<string, string> = {};
  for (const email of ROSTER) {
    const clean = email.toLowerCase().trim();
    const role = getRoleForEmail(clean);
    const teamName =
      role === "SUPERVISOR"
        ? null // supervisors link via Team.supervisorId, not membership
        : clean === "jay@bcflights.com"
          ? null
          : role === "AGENT"
            ? "Strikers"
            : null;

    const user = await prisma.user.upsert({
      where: { email: clean },
      update: {}, // never clobber in-app edits
      create: {
        email: clean,
        name: nameFor(clean, role),
        role,
        ...(role === "AGENT" && teams["Strikers"] ? { teamId: teams["Strikers"] } : {}),
      },
    });
    ids[clean] = user.id;
    console.log(`  user: ${clean.padEnd(28)} -> ${role}${teamName ? ` (${teamName})` : ""}`);
  }

  // 3. Supervisor -> team assignments (Jay -> Strikers, Watkins -> Wizards).
  const supervisorLinks: Array<[string, string]> = [
    ["jay@bcflights.com", "Strikers"],
    ["watkins@bcflights.com", "Wizards"],
  ];
  for (const [email, teamName] of supervisorLinks) {
    await prisma.team.update({
      where: { id: teams[teamName] },
      data: { supervisorId: ids[email] },
    });
    await prisma.user.update({ where: { id: ids[email] }, data: { teamId: teams[teamName] } });
    console.log(`  link: ${email} supervises ${teamName}`);
  }
  // Albert & Amir remain unassigned (pending) by design.

  const counts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    attendances: await prisma.attendance.count(),
  };
  console.log(`Seed complete: ${counts.users} users, ${counts.teams} teams, ${counts.attendances} attendance records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
