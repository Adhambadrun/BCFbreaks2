/**
 * BCFbreaks canonical company roster — the single source of truth for who is
 * in the organization, what team they belong to, their role and their name.
 *
 * This module is dependency-free and purely declarative so it can be imported
 * from the role engine (`permissions.ts`), the database seed, audits and UI
 * alike without pulling in any infrastructure.
 *
 * Data-management invariants (enforced by `scripts/audit-roles.ts`):
 *   1. Every email is lowercase.
 *   2. `displayName` is always the person's first name.
 *   3. Email is `firstname@bcflights.com` — EXCEPT Adham Badraan, who uses
 *      `adhambadraan@gmail.com`.
 *   4. No duplicates — each email appears exactly once, and supervisors are
 *      never duplicated as Team Members.
 */

export type RosterRole =
  | "Admin / Manager"
  | "Developer"
  | "Independent Agent"
  | "Supervisor"
  | "Team Member";

export interface RosterEntry {
  /** Organizational unit: a CAI team, or "Admin / Manager" / "Developer". */
  team: string;
  role: RosterRole;
  fullName: string;
  /** Always the person's first name. */
  displayName: string;
  email: string;
}

/**
 * The complete production roster. Ordering follows the system spec:
 * Admin/Manager, Developer, then CAI 1 → CAI 5 (supervisor first, then members).
 */
export const ROSTER: RosterEntry[] = [
  // ---- Admin / Manager -----------------------------------------------------
  { team: "Admin / Manager", role: "Admin / Manager", fullName: "Meredith Devereux", displayName: "Meredith", email: "meredith@bcflights.com" },
  { team: "Admin / Manager", role: "Admin / Manager", fullName: "Atlas Mavridis", displayName: "Atlas", email: "atlas@bcflights.com" },

  // ---- Developer -----------------------------------------------------------
  { team: "Developer", role: "Developer", fullName: "Adham Badraan", displayName: "Adham", email: "adhambadraan@gmail.com" },

  // ---- CAI 1 (independent, no supervisor) -----------------------------------
  { team: "CAI 1", role: "Independent Agent", fullName: "Dominick Grant", displayName: "Dominick", email: "dominick@bcflights.com" },

  // ---- CAI 2 (supervisor: Jay Morgan) ---------------------------------------
  { team: "CAI 2", role: "Supervisor", fullName: "Jay Morgan", displayName: "Jay", email: "jay@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Thomas Miller", displayName: "Thomas", email: "thomas@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Lamar Garcia", displayName: "Lamar", email: "lamar@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Leo Vento", displayName: "Leo", email: "leo@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Wesley Navarro", displayName: "Wesley", email: "wesley@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Eric Williams", displayName: "Eric", email: "eric@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Solomon Morris", displayName: "Solomon", email: "solomon@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Fabiola Evans", displayName: "Fabiola", email: "fabiola@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Shay Lopez", displayName: "Shay", email: "shay@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Ilaya Rosewood", displayName: "Ilaya", email: "ilaya@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Brodie Fisher", displayName: "Brodie", email: "brodie@bcflights.com" },
  { team: "CAI 2", role: "Team Member", fullName: "Salma Wilson", displayName: "Salma", email: "salma@bcflights.com" },

  // ---- CAI 3 (supervisor: Albert Cooper) -------------------------------------
  { team: "CAI 3", role: "Supervisor", fullName: "Albert Cooper", displayName: "Albert", email: "albert@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Avery Parker", displayName: "Avery", email: "avery@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Morgan Stein", displayName: "Morgan", email: "morgan@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Emma Quinn", displayName: "Emma", email: "emma@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Luka Ricci", displayName: "Luka", email: "luka@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Tyler Valente", displayName: "Tyler", email: "tyler@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Crosby Zaki", displayName: "Crosby", email: "crosby@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Oscar Reed", displayName: "Oscar", email: "oscar@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Jordan Glassman", displayName: "Jordan", email: "jordan@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Cillian O'connor", displayName: "Cillian", email: "cillian@bcflights.com" },
  { team: "CAI 3", role: "Team Member", fullName: "Joe Green", displayName: "Joe", email: "joe@bcflights.com" },

  // ---- CAI 4 (supervisor: Watkins West) --------------------------------------
  { team: "CAI 4", role: "Supervisor", fullName: "Watkins West", displayName: "Watkins", email: "watkins@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Alexander Fleming", displayName: "Alexander", email: "alexander@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Tony Carter", displayName: "Tony", email: "tony@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Jason Owen", displayName: "Jason", email: "jason@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Forbes Whitlock", displayName: "Forbes", email: "forbes@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Scott Daskin", displayName: "Scott", email: "scott@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Rufus Kennett", displayName: "Rufus", email: "rufus@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Jacob Adams", displayName: "Jacob", email: "jacob@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Noah Hayes", displayName: "Noah", email: "noah@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Henry Bennet", displayName: "Henry", email: "henry@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "William Jackson", displayName: "William", email: "william@bcflights.com" },
  { team: "CAI 4", role: "Team Member", fullName: "Max Evans", displayName: "Max", email: "max@bcflights.com" },

  // ---- CAI 5 (supervisor: Amir Malik) ----------------------------------------
  { team: "CAI 5", role: "Supervisor", fullName: "Amir Malik", displayName: "Amir", email: "amir@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Zane Wilson", displayName: "Zane", email: "zane@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Avicci Cade", displayName: "Avicci", email: "avicci@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Lorraine Harper", displayName: "Lorraine", email: "lorraine@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Vella Watson", displayName: "Vella", email: "vella@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Miller Smith", displayName: "Miller", email: "miller@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Adryana Noelle", displayName: "Adryana", email: "adryana@bcflights.com" },
  { team: "CAI 5", role: "Team Member", fullName: "Mccoy Sullivan", displayName: "Mccoy", email: "mccoy@bcflights.com" },
];

/** Lowercase-email → roster entry lookup. */
export const ROSTER_BY_EMAIL: ReadonlyMap<string, RosterEntry> = new Map(
  ROSTER.map((entry) => [entry.email.toLowerCase(), entry]),
);

/** The team names that exist as real `Team` rows in the database. */
export const TEAM_NAMES: readonly string[] = ["CAI 1", "CAI 2", "CAI 3", "CAI 4", "CAI 5"];

/** Look up a roster entry by (case-insensitive) email address. */
export function rosterEntryForEmail(email: string): RosterEntry | undefined {
  return ROSTER_BY_EMAIL.get(email.toLowerCase().trim());
}

/** Full name from the roster (null when the address is not on the roster). */
export function fullNameForEmail(email: string): string | null {
  return rosterEntryForEmail(email)?.fullName ?? null;
}

/** Display (first) name from the roster (null when not on the roster). */
export function displayNameForEmail(email: string): string | null {
  return rosterEntryForEmail(email)?.displayName ?? null;
}
