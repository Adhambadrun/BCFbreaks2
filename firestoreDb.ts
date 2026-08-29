import {
  db,
  doc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  getDocs,
  deleteDoc,
} from './firebase';
import {
  User,
  Team,
  BreakRecord,
  WCTracking,
  Warning,
  SNNHeadline,
  ShiftConfig,
  ChatMessage,
  Broadcast,
  AuditLogEntry,
  ShiftNote,
} from '../types';

// Helper to sanitize Firestore document ID
const sanitizeDocId = (id: string) => id.replace(/[/\\#?]/g, '_');

// Realtime listeners
export function subscribeToFirestoreTeams(callback: (teams: Team[]) => void) {
  try {
    const colRef = collection(db, 'teams');
    return onSnapshot(colRef, (snapshot) => {
      const records: Team[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as Team);
      });
      if (records.length > 0) {
        callback(records);
      }
    }, (err) => {
      console.warn('Firestore teams subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

export function subscribeToFirestoreUsers(callback: (users: User[]) => void) {
  try {
    const colRef = collection(db, 'users');
    return onSnapshot(colRef, (snapshot) => {
      const records: User[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as User);
      });
      if (records.length > 0) {
        callback(records);
      }
    }, (err) => {
      console.warn('Firestore users subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

export function subscribeToFirestoreBreaks(callback: (breaks: BreakRecord[]) => void) {
  try {
    const colRef = collection(db, 'breaks');
    return onSnapshot(colRef, (snapshot) => {
      const records: BreakRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as BreakRecord);
      });
      if (records.length > 0) {
        callback(records);
      }
    }, (err) => {
      console.warn('Firestore breaks subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

export function subscribeToFirestoreWCTracking(callback: (tracking: Record<string, WCTracking>) => void) {
  try {
    const colRef = collection(db, 'wcTracking');
    return onSnapshot(colRef, (snapshot) => {
      const result: Record<string, WCTracking> = {};
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as WCTracking;
        result[item.agentEmail] = item;
      });
      if (Object.keys(result).length > 0) {
        callback(result);
      }
    }, (err) => {
      console.warn('Firestore wcTracking subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

export function subscribeToFirestoreHeadlines(callback: (headlines: SNNHeadline[]) => void) {
  try {
    const colRef = collection(db, 'headlines');
    return onSnapshot(colRef, (snapshot) => {
      const items: SNNHeadline[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as SNNHeadline);
      });
      if (items.length > 0) {
        items.sort((a, b) => b.timestamp - a.timestamp);
        callback(items);
      }
    }, (err) => {
      console.warn('Firestore headlines subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

export function subscribeToFirestoreBroadcasts(callback: (broadcasts: Broadcast[]) => void) {
  try {
    const colRef = collection(db, 'broadcasts');
    return onSnapshot(colRef, (snapshot) => {
      const items: Broadcast[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Broadcast);
      });
      if (items.length > 0) {
        items.sort((a, b) => b.sentAt - a.sentAt);
        callback(items);
      }
    }, (err) => {
      console.warn('Firestore broadcasts subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

export function subscribeToFirestoreConfig(callback: (config: ShiftConfig) => void) {
  try {
    const docRef = doc(db, 'config', 'current_shift');
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as ShiftConfig);
      }
    }, (err) => {
      console.warn('Firestore config subscription warning:', err);
    });
  } catch (e) {
    console.warn('Firestore subscription unavailable:', e);
    return () => {};
  }
}

// Writers
export async function firestoreSaveBreak(breakRecord: BreakRecord) {
  try {
    const docRef = doc(db, 'breaks', sanitizeDocId(breakRecord.breakId));
    await setDoc(docRef, breakRecord, { merge: true });
  } catch (err) {
    console.error('Failed to persist break to Firestore:', err);
  }
}

export async function firestoreSaveWCTracking(tracking: WCTracking) {
  try {
    const docRef = doc(db, 'wcTracking', sanitizeDocId(tracking.agentEmail));
    await setDoc(docRef, tracking, { merge: true });
  } catch (err) {
    console.error('Failed to persist WC tracking to Firestore:', err);
  }
}

export async function firestoreSaveWarning(warning: Warning) {
  try {
    const docRef = doc(db, 'warnings', sanitizeDocId(warning.warningId));
    await setDoc(docRef, warning, { merge: true });
  } catch (err) {
    console.error('Failed to persist warning to Firestore:', err);
  }
}

export async function firestoreSaveHeadline(headline: SNNHeadline) {
  try {
    const docRef = doc(db, 'headlines', sanitizeDocId(headline.headlineId));
    await setDoc(docRef, headline, { merge: true });
  } catch (err) {
    console.error('Failed to persist headline to Firestore:', err);
  }
}

export async function firestoreSaveConfig(config: ShiftConfig) {
  try {
    const docRef = doc(db, 'config', 'current_shift');
    await setDoc(docRef, config, { merge: true });
  } catch (err) {
    console.error('Failed to persist shift config to Firestore:', err);
  }
}

export async function firestoreSaveBroadcast(broadcast: Broadcast) {
  try {
    const docRef = doc(db, 'broadcasts', sanitizeDocId(broadcast.broadcastId));
    await setDoc(docRef, broadcast, { merge: true });
  } catch (err) {
    console.error('Failed to persist broadcast to Firestore:', err);
  }
}

export async function firestoreSaveTeam(team: Team) {
  try {
    const docRef = doc(db, 'teams', sanitizeDocId(team.teamId));
    await setDoc(docRef, team, { merge: true });
  } catch (err) {
    console.error('Failed to persist team to Firestore:', err);
  }
}

export async function firestoreDeleteTeam(teamId: string) {
  try {
    const docRef = doc(db, 'teams', sanitizeDocId(teamId));
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete team from Firestore:', err);
  }
}

export async function firestoreSaveUser(user: User) {
  try {
    const docRef = doc(db, 'users', sanitizeDocId(user.email));
    await setDoc(docRef, user, { merge: true });
  } catch (err) {
    console.error('Failed to persist user to Firestore:', err);
  }
}
