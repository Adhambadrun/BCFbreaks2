import { cache } from "react";
import type { Team, User } from "@/generated/prisma/client";
import { prisma } from "./db";
import { auth0 } from "./auth0";
import { readImpersonationCookie } from "./impersonation";
import { defaultNameForEmail, getRoleForEmail, normalizeEmail } from "./permissions";

/**
 * Session -> database user resolution (server-only).
 *
 * Zero-trust: middleware guarantees every request carries an Auth0 session;
 * these helpers additionally guarantee every authenticated identity exists in
 * the persistent database with its role provisioned by the role engine.
 */

type SessionUserInfo = {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};


export type UserWithTeam = User & { team: Team | null };

async function ensureDbUser(sessionUser: SessionUserInfo): Promise<UserWithTeam | null> {
  const email = sessionUser.email;
  if (!email) return null;

  const clean = normalizeEmail(email);
  const existing = await prisma.user.findUnique({
    where: { email: clean },
    include: { team: true },
  });
  if (existing) return existing as UserWithTeam;

  // First sign-in: provision the account with the role resolved by the engine.
  const created = await prisma.user.create({
    data: {
      email: clean,
      name: sessionUser.name?.trim() || defaultNameForEmail(clean),
      role: getRoleForEmail(clean),
    },
  });
  const withTeam = await prisma.user.findUnique({
    where: { id: created.id },
    include: { team: true },
  });
  return withTeam as UserWithTeam;
}

/**
 * The REAL authenticated user (never the impersonation target).
 * Provisioned into the database on first sight.
 */
export const getSessionUser = cache(async (): Promise<UserWithTeam | null> => {
  const session = await auth0.getSession();
  if (!session || !session.user) return null;
  return ensureDbUser(session.user);
});

/**
 * The user whose view is currently rendered. For the Developer this may be an
 * impersonated user (read-only point of view — actions are attributed to the
 * real developer identity where it matters).
 */
export const getEffectiveUser = cache(async (): Promise<{ user: UserWithTeam | null; impersonating: boolean }> => {
  const real = await getSessionUser();
  if (!real) return { user: null, impersonating: false };

  const targetEmail = await readImpersonationCookie();
  if (!targetEmail || real.role !== "DEV" || normalizeEmail(targetEmail) === real.email) {
    return { user: real, impersonating: false };
  }

  const target = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { team: true },
  });
  if (!target) return { user: real, impersonating: false };

  return { user: target as UserWithTeam, impersonating: true };
});

export async function requireUser(): Promise<User> {
  const { user } = await getEffectiveUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
