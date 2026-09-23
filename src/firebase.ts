import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer,
  writeBatch,
  query,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Attendee, ClassCounts, ClassCapacities, OperationType } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export function getFirestoreConfigInfo() {
  return {
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
    appId: firebaseConfig.appId
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const q = query(collection(db, 'attendees'), limit(1));
    await getDocs(q);
    return true;
  } catch (error) {
    console.warn('Firestore connection check:', error);
    return false;
  }
}

// Fetch attendees once directly from server
export async function fetchAttendeesOnce(): Promise<Attendee[]> {
  try {
    const colRef = collection(db, 'attendees');
    const snapshot = await getDocs(colRef);
    const list: Attendee[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.name && data.grade) {
        list.push({
          id: docSnap.id,
          grade: Number(data.grade),
          classNum: Number(data.classNum),
          name: String(data.name),
          relations: Array.isArray(data.relations) ? data.relations : [String(data.relations || '학부모')],
          attendeeCount: Number(data.attendeeCount || 1),
          createdAt: String(data.createdAt || '')
        });
      }
    });
    list.sort((a, b) => b.id.localeCompare(a.id));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'attendees');
    throw error;
  }
}

// Subscribe to Attendees collection in real-time
export function subscribeAttendees(
  onData: (attendees: Attendee[]) => void,
  onError?: (err: unknown) => void
) {
  const colRef = collection(db, 'attendees');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Attendee[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.name && data.grade) {
          list.push({
            id: docSnap.id,
            grade: Number(data.grade),
            classNum: Number(data.classNum),
            name: String(data.name),
            relations: Array.isArray(data.relations) ? data.relations : [String(data.relations || '학부모')],
            attendeeCount: Number(data.attendeeCount || 1),
            createdAt: String(data.createdAt || '')
          });
        }
      });
      // Sort newest first by id or timestamp if available
      list.sort((a, b) => b.id.localeCompare(a.id));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendees');
      if (onError) onError(error);
    }
  );
}

// Fetch latest attendees once directly (useful for mobile tab focus or manual refresh)
export async function getLatestAttendees(): Promise<Attendee[]> {
  try {
    const colRef = collection(db, 'attendees');
    const snapshot = await getDocs(colRef);
    const list: Attendee[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.name && data.grade) {
        list.push({
          id: docSnap.id,
          grade: Number(data.grade),
          classNum: Number(data.classNum),
          name: String(data.name),
          relations: Array.isArray(data.relations) ? data.relations : [String(data.relations || '학부모')],
          attendeeCount: Number(data.attendeeCount || 1),
          createdAt: String(data.createdAt || '')
        });
      }
    });
    list.sort((a, b) => b.id.localeCompare(a.id));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'attendees');
    return [];
  }
}

// Add an Attendee document
export async function addAttendeeDoc(attendee: Attendee): Promise<void> {
  const docRef = doc(db, 'attendees', attendee.id);
  try {
    await setDoc(docRef, {
      id: attendee.id,
      grade: Number(attendee.grade),
      classNum: Number(attendee.classNum),
      name: String(attendee.name).trim(),
      relations: attendee.relations,
      attendeeCount: Number(attendee.attendeeCount),
      createdAt: String(attendee.createdAt)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `attendees/${attendee.id}`);
    throw error;
  }
}

// Delete single Attendee document
export async function deleteAttendeeDoc(id: string): Promise<void> {
  const docRef = doc(db, 'attendees', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendees/${id}`);
    throw error;
  }
}

// Batch reset all attendees
export async function resetAllAttendees(): Promise<void> {
  try {
    const colRef = collection(db, 'attendees');
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'attendees');
    throw error;
  }
}

// Batch add multiple sample attendees
export async function batchAddAttendees(attendees: Attendee[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    attendees.forEach((att) => {
      const docRef = doc(db, 'attendees', att.id);
      batch.set(docRef, {
        id: att.id,
        grade: Number(att.grade),
        classNum: Number(att.classNum),
        name: String(att.name).trim(),
        relations: att.relations,
        attendeeCount: Number(att.attendeeCount),
        createdAt: String(att.createdAt)
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'attendees');
    throw error;
  }
}

// Subscribe to Settings
export function subscribeSettings(
  onData: (settings: {
    schoolName?: string;
    classCounts?: ClassCounts;
    capacities?: ClassCapacities;
  }) => void
) {
  const colRef = collection(db, 'settings');
  return onSnapshot(
    colRef,
    (snapshot) => {
      let schoolName: string | undefined;
      let classCounts: ClassCounts | undefined;
      let capacities: ClassCapacities | undefined;

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();
        if (id === 'schoolName' && data && data.data) {
          schoolName = data.data;
        } else if (id === 'classCounts' && data && data.data) {
          try {
            classCounts = JSON.parse(data.data);
          } catch (e) {
            console.error('Failed to parse classCounts', e);
          }
        } else if (id === 'capacities' && data && data.data) {
          try {
            capacities = JSON.parse(data.data);
          } catch (e) {
            console.error('Failed to parse capacities', e);
          }
        }
      });

      onData({ schoolName, classCounts, capacities });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    }
  );
}

// Save a setting document
export async function saveSettingDoc(
  key: 'schoolName' | 'classCounts' | 'capacities',
  value: any
): Promise<void> {
  const docRef = doc(db, 'settings', key);
  const dataStr = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    await setDoc(docRef, {
      key,
      data: dataStr,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `settings/${key}`);
    throw error;
  }
}
