/**
 * Firebase is now used *only* as the Firestore data layer for BCFbreaks.
 *
 * Firebase Auth and Google One Tap have been removed: sign-in is handled by Auth0
 * (`auth0Config.ts` + `authService.ts`). Nothing in this file touches auth anymore,
 * so no Firebase credentials or ID tokens end up in the bundle's request path.
 *
 * Safe to keep Firestore unauthenticated: `firestore.rules` grants access
 * unconditionally (`allow read, write: if true`), so no document read or write
 * ever depended on a Firebase user being signed in. If you later tighten those
 * rules to require auth, do not put Firebase Auth back in the browser — mint
 * tokens from a server instead, or move access control to Auth0-authorized
 * server routes.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  query,
  updateDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// The generated `firebase-applet-config.json` omits the optional keys this app has
// historically probed for. Typing them here keeps the pre-existing `tsc --noEmit`
// failure from surviving this rewrite (oAuthClientId is now unused entirely: it
// configured Google One Tap, which Auth0 replaced).
type FirebaseAppletConfig = typeof firebaseConfig & {
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
};
const appletConfig = firebaseConfig as FirebaseAppletConfig;

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestore with custom database ID from config if present
export const db = appletConfig.firestoreDatabaseId
  ? getFirestore(app, appletConfig.firestoreDatabaseId)
  : getFirestore(app);

export { doc, getDoc, setDoc, collection, onSnapshot, query, updateDoc, getDocs, deleteDoc };
