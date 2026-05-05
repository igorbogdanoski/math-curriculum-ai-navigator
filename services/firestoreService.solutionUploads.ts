import {
  doc, setDoc, updateDoc, getDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export interface SolutionUploadDoc {
  questionKey: string;
  expiresAt: number;  // Unix ms
  imageUrl: string | null;
  createdAt: unknown;
}

export const createSolutionToken = async (questionKey: string): Promise<string> => {
  const token = crypto.randomUUID();
  await setDoc(doc(db, 'solution_uploads', token), {
    questionKey,
    expiresAt: Date.now() + EXPIRY_MS,
    imageUrl: null,
    createdAt: serverTimestamp(),
  });
  return token;
};

export const completeSolutionUpload = async (token: string, imageUrl: string): Promise<void> => {
  await updateDoc(doc(db, 'solution_uploads', token), { imageUrl });
};

export const getSolutionUploadDoc = async (token: string): Promise<SolutionUploadDoc | null> => {
  const snap = await getDoc(doc(db, 'solution_uploads', token));
  if (!snap.exists()) return null;
  return snap.data() as SolutionUploadDoc;
};

export const subscribeSolutionUpload = (
  token: string,
  onImageUrl: (url: string) => void,
): (() => void) => {
  return onSnapshot(doc(db, 'solution_uploads', token), snap => {
    if (!snap.exists()) return;
    const data = snap.data() as SolutionUploadDoc;
    if (data.imageUrl) onImageUrl(data.imageUrl);
  });
};
