/**
 * BCFbreaks identity service.
 * ===========================================================================
 * Auth0 is no longer touched in the browser at all. Sign-in, token validation and
 * access-tier decisions live in `serverAuth.ts`; what remains here is the mapping
 * from an already-verified session identity to the application's `User` record,
 * merged with any profile stored in Firestore.
 *
 * History: this file used to run Firebase Auth (Google popup + One Tap), then briefly
 * `@auth0/auth0-react`. Both client-side identity paths were removed when the gate moved
 * server-side, because a client-side "am I allowed?" check is not a security boundary —
 * the code doing the checking is delivered to the person being checked.
 *
 * Firestore stays as the data layer. `firestore.rules` grants access unconditionally
 * (`allow read, write: if true`), so no read ever depended on a Firebase ID token.
 * That also means the *only* thing standing between an anonymous visitor and every
 * document in this database is this gate — see AUTH0.md before changing either.
 */
import { db, doc, getDoc, setDoc } from './firebase';
import { determineRoleForEmail, sanitizeIdentityId, type AccessLevel } from './accessLevels';
import type { SessionUser } from './sessionApi';
import type { User as AppUser } from './types';
import { INITIAL_USERS } from './storage';

// Policy helpers moved to `accessLevels.ts` so the server and the browser share one
// definition. Re-exported here for existing import sites.
export { isEmailAllowedToLogin, getUserAccessLevel, determineRoleForEmail } from './accessLevels';

/**
 * Builds (and persists) the application `User` from a verified session.
 *
 * The role is taken from the session, NOT re-derived here: the server already
 * applied the tier clamp that stops a Preview-tier `…-admin@gmail.com` from picking
 * up admin privileges through the email pattern in `determineRoleForEmail()`.
 */
export async function syncClaimsToAppUser(user: SessionUser, accessLevel: AccessLevel): Promise<AppUser> {
  const email = String(user.email || '').toLowerCase().trim();
  const subjectId = String(user.sub || '').trim();
  if (!subjectId || !email) {
    throw new Error('The verified session is missing an identity; reload to sign in again.');
  }

  const userDocRef = doc(db, 'users', sanitizeIdentityId(subjectId));
  const meta = determineRoleForEmail(email);

  let existingData: Partial<AppUser> = {};
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) existingData = snap.data() as Partial<AppUser>;
  } catch (err) {
    console.warn('Firestore read error (using fallback defaults):', err);
  }

  const seeded = INITIAL_USERS.find(u => u.email.toLowerCase() === email);

  const userObj: AppUser = {
    id: subjectId,
    name: user.name || meta.name || seeded?.name || email.split('@')[0],
    email,
    role: user.role || (existingData.role as AppUser['role']) || meta.role,
    teamId: user.teamId || existingData.teamId || seeded?.teamId || meta.teamId,
    accessLevel,
    avatarUrl:
      user.picture ||
      existingData.avatarUrl ||
      seeded?.avatarUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    personalMotto: existingData.personalMotto || seeded?.personalMotto || 'Sales Floor Champion 🚀',
    powerEmoji: existingData.powerEmoji || seeded?.powerEmoji || '⚡',
    podColorTheme: existingData.podColorTheme || seeded?.podColorTheme || '#00E5FF',
    preferredLanguage: existingData.preferredLanguage || seeded?.preferredLanguage || 'en',
    themeMode: existingData.themeMode || seeded?.themeMode || 'dark',
    notificationsEnabled: existingData.notificationsEnabled ?? true,
    soundEnabled: existingData.soundEnabled ?? true,
    reducedMotion: existingData.reducedMotion ?? false,
    reducedTransparency: existingData.reducedTransparency ?? false,
    fontSize: existingData.fontSize || 'md',
    isOnline: true,
    isBlocked: existingData.isBlocked ?? false,
    blockReason: existingData.blockReason,
    lastSeen: new Date().toISOString(),
    totalBreaksTaken: existingData.totalBreaksTaken ?? seeded?.totalBreaksTaken ?? 0,
    totalBreakTime: existingData.totalBreakTime ?? seeded?.totalBreakTime ?? 0,
    totalWarnings: existingData.totalWarnings ?? seeded?.totalWarnings ?? 0,
    totalBonusReceived: existingData.totalBonusReceived ?? seeded?.totalBonusReceived ?? 0,
    currentStreak: existingData.currentStreak ?? seeded?.currentStreak ?? 1,
    longestStreak: existingData.longestStreak ?? seeded?.longestStreak ?? 5,
  };

  // Persist the profile. Firestore rejects `undefined` field values outright
  // (`blockReason` is routinely undefined), and the previous implementation passed
  // them straight through — so this write threw on every new signer and was
  // swallowed by the catch, meaning first-time profiles were never saved.
  try {
    await setDoc(userDocRef, omitUndefined(userObj), { merge: true });
  } catch (err) {
    console.warn('Firestore setDoc failed:', err);
  }

  return userObj;
}

/** Shallow copy without `undefined` values, which Firestore refuses to store. */
function omitUndefined<T extends Record<string, any>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}
