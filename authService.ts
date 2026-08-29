import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  db,
  doc,
  getDoc,
  setDoc,
  GoogleAuthProvider,
  FirebaseUser,
} from './firebase';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from './storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Domain security validation: Only name@bcflights.com allowed
export function isEmailAllowedToLogin(email: string): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  // Allowed domain is @bcflights.com (with developer god mode override)
  return lower.endsWith('@bcflights.com') || lower === 'adhambadraan@gmail.com';
}

// Helper to determine role from email or defaults
export function determineRoleForEmail(email: string): { role: UserRole; teamId: string; name?: string } {
  const lower = email.toLowerCase();
  // Developer override (Adham)
  if (lower === 'adhambadraan@gmail.com' || lower === 'adham@bcflights.com') {
    return { role: 'developer', teamId: 'team_strikers', name: 'Adham Badran' };
  }
  // Admin
  if (lower.includes('admin') || lower === 'karim.admin@bcflights.com' || lower === 'maya.admin@bcflights.com') {
    return { role: 'admin', teamId: 'team_strikers' };
  }
  // Supervisors
  if (lower.includes('supervisor') || lower === 'tarek.zaki@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_strikers' };
  }
  if (lower === 'rania.fawzy@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_titans' };
  }
  if (lower === 'omar.nabil@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_apex' };
  }
  if (lower === 'dina.helmy@bcflights.com') {
    return { role: 'supervisor', teamId: 'team_phantom' };
  }
  // Check if matches any existing seeded user
  const seeded = INITIAL_USERS.find(u => u.email.toLowerCase() === lower);
  if (seeded) {
    return { role: seeded.role, teamId: seeded.teamId, name: seeded.name };
  }
  // Default to agent on team strikers
  return { role: 'agent', teamId: 'team_strikers' };
}

/**
 * Creates or synchronizes an application User object from a Firebase User
 */
export async function syncFirebaseUserToApp(fbUser: FirebaseUser): Promise<User> {
  const email = fbUser.email || `${fbUser.uid}@google.auth`;

  // Enforce Domain Restriction: only name@bcflights.com allowed
  if (!isEmailAllowedToLogin(email)) {
    await logoutFirebaseAuth();
    throw new Error(
      `Access Denied: ${email} is not authorized. Only accounts with the @bcflights.com domain (e.g. name@bcflights.com) are allowed to log into the floor.`
    );
  }

  const userDocRef = doc(db, 'users', fbUser.uid);

  const meta = determineRoleForEmail(email);

  let existingData: Partial<User> = {};
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      existingData = docSnap.data() as Partial<User>;
    }
  } catch (err) {
    console.warn('Firestore read error (using fallback defaults):', err);
  }

  // Look for match in seeded list to preserve badges/history if present
  const seeded = INITIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());

  const userObj: User = {
    id: fbUser.uid,
    name: fbUser.displayName || meta.name || seeded?.name || email.split('@')[0],
    email: email,
    role: existingData.role || seeded?.role || meta.role,
    teamId: existingData.teamId || seeded?.teamId || meta.teamId,
    avatarUrl: fbUser.photoURL || existingData.avatarUrl || seeded?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
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

  // Persist back to Firestore asynchronously
  try {
    await setDoc(userDocRef, userObj, { merge: true });
  } catch (err) {
    console.warn('Firestore setDoc failed:', err);
  }

  return userObj;
}

/**
 * Sign in using Firebase Google Popup
 */
export async function loginWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return await syncFirebaseUserToApp(result.user);
}

/**
 * Sign in using Google Identity Services ID Token (One-Tap / GSI credential)
 */
export async function loginWithGoogleCredential(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return await syncFirebaseUserToApp(result.user);
}

/**
 * Firebase Sign Out
 */
export async function logoutFirebaseAuth(): Promise<void> {
  await signOut(auth);
}

/**
 * Initialize Google One Tap / Sign In with Google button
 */
export function initGoogleOneTap(onSuccess: (user: User) => void, onError?: (err: any) => void) {
  if (typeof window === 'undefined') return;

  const clientId = (firebaseConfig as any).oAuthClientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.warn('No oAuthClientId configured for Google One Tap');
    return;
  }

  const handleCredentialResponse = async (response: any) => {
    try {
      if (response.credential) {
        const user = await loginWithGoogleCredential(response.credential);
        onSuccess(user);
      }
    } catch (err) {
      console.error('Google One Tap authentication error:', err);
      if (onError) onError(err);
    }
  };

  // Wait until window.google is ready
  const checkGoogle = setInterval(() => {
    const google = (window as any).google;
    if (google && google.accounts && google.accounts.id) {
      clearInterval(checkGoogle);
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Prompt One-Tap overlay
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google One Tap suppressed or dismissed:', notification.getNotDisplayedReason?.());
          }
        });

        // Render official button if container exists
        const btnContainer = document.getElementById('google-signin-button');
        if (btnContainer) {
          google.accounts.id.renderButton(btnContainer, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            width: 320,
            logo_alignment: 'left',
          });
        }
      } catch (e) {
        console.warn('Error configuring Google Identity Services:', e);
      }
    }
  }, 300);

  // Clear timeout after 10s
  setTimeout(() => clearInterval(checkGoogle), 10000);
}
