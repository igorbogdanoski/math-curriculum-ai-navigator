/**
 * С1 — Persistent студентски акаунт
 * Колекција: `student_accounts/{googleUid}`
 *
 * Овозможува cross-device sync: Google Sign-In го линкува сите deviceIds
 * на еден ученик и ги зачувува резултатите на секој нов уред.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { StudentAccount } from '../types';

const COLLECTION = 'student_accounts';

/**
 * Вчитај студентски акаунт по Google UID.
 * Враќа null ако акаунтот не постои (прв пат на нов уред).
 */
export async function fetchStudentAccount(uid: string): Promise<StudentAccount | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    return { uid, ...snap.data() } as StudentAccount;
  } catch {
    return null;
  }
}

/**
 * Создај нов студентски акаунт или ажурирај постоечки.
 * Повикува се кога ученикот прв пат се логира со Google.
 */
export async function createOrUpdateStudentAccount(
  uid: string,
  name: string,
  deviceId: string,
  opts?: { email?: string; photoURL?: string; grade?: number }
): Promise<void> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Акаунтот постои — само додај нов deviceId и ажурирај ime ако е сменето
    await updateDoc(ref, {
      linkedDeviceIds: arrayUnion(deviceId),
      updatedAt: serverTimestamp(),
      // Ажурирај ime само ако е различно (корисникот може да го промени)
      name,
    });
  } else {
    // Нов акаунт
    const account: Omit<StudentAccount, 'uid'> = {
      name,
      email: opts?.email,
      photoURL: opts?.photoURL,
      grade: opts?.grade,
      linkedDeviceIds: [deviceId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    // Отстрани undefined полиња пред запишување
    const clean = Object.fromEntries(
      Object.entries(account).filter(([, v]) => v !== undefined)
    );
    await setDoc(ref, clean);
  }
}

/**
 * Линкувај нов deviceId кон постоечки акаунт.
 * Повикува се кога ученик се логира на нов уред.
 */
export async function linkDeviceToStudentAccount(
  uid: string,
  deviceId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), {
    linkedDeviceIds: arrayUnion(deviceId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Врати ги сите поврзани deviceIds за одреден студентски акаунт.
 * Корисно при вчитување на резултати од сите уреди.
 */
export async function fetchLinkedDeviceIds(uid: string): Promise<string[]> {
  const account = await fetchStudentAccount(uid);
  return account?.linkedDeviceIds ?? [];
}

export const studentAccountService = {
  fetchStudentAccount,
  createOrUpdateStudentAccount,
  linkDeviceToStudentAccount,
  fetchLinkedDeviceIds,
};
