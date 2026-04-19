/**
 * М3 — Matura Community Solutions
 * Firestore: matura_community_solutions/{solutionId}
 *
 * Students submit text solutions to matura questions.
 * Other students can upvote them (one vote per user per solution).
 */
import {
  collection, addDoc, updateDoc, doc, query, where,
  orderBy, getDocs, serverTimestamp, arrayUnion, arrayRemove,
  increment,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { logger } from '../utils/logger';

const COL = 'matura_community_solutions';

export interface CommunitySolution {
  id: string;
  questionDocId: string;
  authorUid: string;
  authorName: string;
  text: string;
  upvotes: number;
  upvoterUids: string[];
  createdAt: Date | null;
}

interface RawSolution {
  questionDocId: string;
  authorUid: string;
  authorName: string;
  text: string;
  upvotes: number;
  upvoterUids: string[];
  createdAt: { toDate?: () => Date } | null;
}

export async function submitCommunitySolution(
  questionDocId: string,
  authorUid: string,
  authorName: string,
  text: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    questionDocId,
    authorUid,
    authorName,
    text: text.trim(),
    upvotes: 0,
    upvoterUids: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCommunitySolutions(questionDocId: string): Promise<CommunitySolution[]> {
  try {
    const q = query(
      collection(db, COL),
      where('questionDocId', '==', questionDocId),
      orderBy('upvotes', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const raw = d.data() as RawSolution;
      return {
        id: d.id,
        questionDocId: raw.questionDocId,
        authorUid: raw.authorUid,
        authorName: raw.authorName,
        text: raw.text,
        upvotes: raw.upvotes ?? 0,
        upvoterUids: raw.upvoterUids ?? [],
        createdAt: raw.createdAt?.toDate?.() ?? null,
      };
    });
  } catch (err) {
    logger.warn('[Community] getCommunitySolutions failed:', err);
    return [];
  }
}

export async function upvoteCommunitySolution(solutionId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, COL, solutionId), {
      upvotes: increment(1),
      upvoterUids: arrayUnion(uid),
    });
  } catch (err) {
    logger.warn('[Community] upvote failed:', err);
  }
}

export async function downvoteCommunitySolution(solutionId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, COL, solutionId), {
      upvotes: increment(-1),
      upvoterUids: arrayRemove(uid),
    });
  } catch (err) {
    logger.warn('[Community] downvote failed:', err);
  }
}
