/**
 * firestoreService.forum.ts — Ж7.2
 *
 * Наставнички форум — Q&A нишки по концепти.
 * Collections:
 *   forum_threads  — главни нишки
 *   forum_replies  — одговори по нишка
 *
 * Педагошка основа: Wenger Communities of Practice,
 * Social Constructivism (Vygotsky), Peer Learning
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ForumThread {
  id: string;
  authorUid: string;
  authorName: string;
  /** Optional concept anchor */
  conceptId:    string | null;
  conceptTitle: string | null;
  title: string;
  body: string;
  createdAt: Timestamp | null;
  replyCount: number;
  /** Array of teacher UIDs who upvoted */
  upvotedBy: string[];
  /** Soft-delete */
  deleted?: boolean;
}

export interface ForumReply {
  id: string;
  threadId: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAt: Timestamp | null;
  upvotedBy: string[];
  /** Marks the accepted / best answer */
  isBestAnswer: boolean;
}

// ── Threads ───────────────────────────────────────────────────────────────────

export const createForumThread = async (data: {
  authorUid: string;
  authorName: string;
  conceptId?: string;
  conceptTitle?: string;
  title: string;
  body: string;
}): Promise<string> => {
  const ref = await addDoc(collection(db, 'forum_threads'), {
    authorUid:    data.authorUid,
    authorName:   data.authorName,
    conceptId:    data.conceptId    ?? null,
    conceptTitle: data.conceptTitle ?? null,
    title:        data.title,
    body:         data.body,
    createdAt:    serverTimestamp(),
    replyCount:   0,
    upvotedBy:    [],
    deleted:      false,
  });
  return ref.id;
};

export const fetchForumThreads = async (opts?: {
  conceptId?: string;
  limitCount?: number;
}): Promise<ForumThread[]> => {
  try {
    const constraints: any[] = [
      where('deleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(opts?.limitCount ?? 50),
    ];
    if (opts?.conceptId) {
      constraints.splice(0, 0, where('conceptId', '==', opts.conceptId));
    }
    const snap = await getDocs(query(collection(db, 'forum_threads'), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumThread));
  } catch {
    return [];
  }
};

export const fetchForumThread = async (threadId: string): Promise<ForumThread | null> => {
  const snap = await getDoc(doc(db, 'forum_threads', threadId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ForumThread;
};

export const toggleThreadUpvote = async (threadId: string, teacherUid: string, hasUpvoted: boolean): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), {
    upvotedBy: hasUpvoted ? arrayRemove(teacherUid) : arrayUnion(teacherUid),
  });
};

export const softDeleteThread = async (threadId: string): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { deleted: true });
};

/** Admin: fetch ALL threads regardless of deleted status */
export const fetchAllForumThreadsAdmin = async (limitCount = 100): Promise<ForumThread[]> => {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'forum_threads'),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      ),
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumThread));
  } catch {
    return [];
  }
};

/** Admin: hard-restore a soft-deleted thread */
export const restoreThread = async (threadId: string): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { deleted: false });
};

// ── Replies ───────────────────────────────────────────────────────────────────

export const createForumReply = async (data: {
  threadId: string;
  authorUid: string;
  authorName: string;
  body: string;
}): Promise<string> => {
  const ref = await addDoc(collection(db, 'forum_replies'), {
    threadId:     data.threadId,
    authorUid:    data.authorUid,
    authorName:   data.authorName,
    body:         data.body,
    createdAt:    serverTimestamp(),
    upvotedBy:    [],
    isBestAnswer: false,
  });
  // Increment reply counter on thread
  await updateDoc(doc(db, 'forum_threads', data.threadId), {
    replyCount: increment(1),
  });
  return ref.id;
};

export const fetchForumReplies = async (threadId: string): Promise<ForumReply[]> => {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'forum_replies'),
        where('threadId', '==', threadId),
        orderBy('createdAt', 'asc'),
      ),
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumReply));
  } catch {
    return [];
  }
};

export const toggleReplyUpvote = async (replyId: string, teacherUid: string, hasUpvoted: boolean): Promise<void> => {
  await updateDoc(doc(db, 'forum_replies', replyId), {
    upvotedBy: hasUpvoted ? arrayRemove(teacherUid) : arrayUnion(teacherUid),
  });
};

export const markBestAnswer = async (replyId: string, threadId: string): Promise<void> => {
  // Clear any existing best answer in thread first
  const replies = await fetchForumReplies(threadId);
  const batch: Promise<void>[] = replies
    .filter(r => r.isBestAnswer && r.id !== replyId)
    .map(r => updateDoc(doc(db, 'forum_replies', r.id), { isBestAnswer: false }));
  await Promise.all(batch);
  await updateDoc(doc(db, 'forum_replies', replyId), { isBestAnswer: true });
};
