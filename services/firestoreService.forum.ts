/**
 * firestoreService.forum.ts — Ж7.2 (upgraded Сесија 10)
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
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  getCountFromServer,
  type Timestamp,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThreadCategory = 'question' | 'resource' | 'idea' | 'success' | 'discussion';

export const CATEGORY_CONFIG: Record<ThreadCategory, { label: string; emoji: string; color: string; border: string }> = {
  question:   { label: 'Прашање',   emoji: '❓', color: 'bg-blue-100 text-blue-700',    border: 'border-blue-200' },
  resource:   { label: 'Ресурс',    emoji: '📚', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  idea:       { label: 'Идеја',     emoji: '💡', color: 'bg-amber-100 text-amber-700',   border: 'border-amber-200' },
  success:    { label: 'Успех',     emoji: '🏆', color: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  discussion: { label: 'Дискусија', emoji: '💬', color: 'bg-rose-100 text-rose-700',     border: 'border-rose-200' },
};

export const REACTIONS = [
  { field: 'reactionsHelpful' as const, emoji: '💡', label: 'Корисно' },
  { field: 'reactionsSame'    as const, emoji: '❓', label: 'Имам исто' },
  { field: 'reactionsGreat'   as const, emoji: '🎉', label: 'Одлично' },
];

export type ReactionField = 'reactionsHelpful' | 'reactionsSame' | 'reactionsGreat';

export interface ForumThread {
  id: string;
  authorUid: string;
  authorName: string;
  /** Optional concept anchor */
  conceptId:    string | null;
  conceptTitle: string | null;
  /** Category tag */
  category: ThreadCategory;
  title: string;
  body: string;
  createdAt: Timestamp | null;
  /** Updated on every new reply — used for "Активно" sort */
  lastActivityAt: Timestamp | null;
  replyCount: number;
  /** Denormalized: true when any reply is marked isBestAnswer */
  hasBestAnswer: boolean;
  /** Array of teacher UIDs who upvoted */
  upvotedBy: string[];
  /** Quick reactions */
  reactionsHelpful: string[];
  reactionsSame: string[];
  reactionsGreat: string[];
  /** Admin-pinned threads appear at top */
  isPinned: boolean;
  /** Soft-delete */
  deleted?: boolean;
  /** Moderation: 'pending' = awaiting admin review, 'approved' = visible to all.
   *  Absent on legacy threads → treated as approved. */
  moderationStatus?: 'pending' | 'approved';
  /** Webb's DoK level tag (optional) */
  dokLevel?: 1 | 2 | 3 | 4;
  /** Attached Algebra Tiles PNG (Firebase Storage URL) */
  forumImageUrl?: string | null;
  /** Attached 3D shape name for inline Shape3DViewer */
  shape3dShape?: string | null;
}

export interface ForumReply {
  id: string;
  threadId: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAt: Timestamp | null;
  upvotedBy: string[];
  reactionsHelpful: string[];
  reactionsSame: string[];
  reactionsGreat: string[];
  /** Marks the accepted / best answer */
  isBestAnswer: boolean;
}

export interface ForumStats {
  totalThreads: number;
  activeThisWeek: number;
}

// ── Hot score (client-side ranking) ──────────────────────────────────────────

/** Reddit-style hot score weighted by upvotes + replies, decays by age (days). */
export function hotScore(thread: ForumThread): number {
  const score = thread.upvotedBy.length + thread.replyCount * 2
    + thread.reactionsHelpful.length + thread.reactionsSame.length + thread.reactionsGreat.length;
  if (!thread.createdAt) return score;
  const ageHours = (Date.now() - thread.createdAt.toDate().getTime()) / 3_600_000;
  return score / Math.pow(ageHours + 2, 1.5);
}

// ── Threads ───────────────────────────────────────────────────────────────────

export const createForumThread = async (data: {
  authorUid: string;
  authorName: string;
  conceptId?: string;
  conceptTitle?: string;
  category?: ThreadCategory;
  title: string;
  body: string;
  dokLevel?: 1 | 2 | 3 | 4;
  forumImageUrl?: string;
  shape3dShape?: string;
  /** Pass true for admin/school_admin authors to skip moderation queue */
  skipModeration?: boolean;
}): Promise<string> => {
  const ref = await addDoc(collection(db, 'forum_threads'), {
    authorUid:        data.authorUid,
    authorName:       data.authorName,
    conceptId:        data.conceptId    ?? null,
    conceptTitle:     data.conceptTitle ?? null,
    category:         data.category ?? 'question',
    title:            data.title,
    body:             data.body,
    createdAt:        serverTimestamp(),
    lastActivityAt:   serverTimestamp(),
    replyCount:       0,
    participantUids:  [data.authorUid],
    hasBestAnswer:    false,
    upvotedBy:        [],
    reactionsHelpful: [],
    reactionsSame:    [],
    reactionsGreat:   [],
    isPinned:         false,
    deleted:          false,
    moderationStatus: data.skipModeration ? 'approved' : 'pending',
    ...(data.dokLevel     ? { dokLevel:      data.dokLevel }     : {}),
    ...(data.forumImageUrl? { forumImageUrl: data.forumImageUrl }: {}),
    ...(data.shape3dShape ? { shape3dShape:  data.shape3dShape }  : {}),
  });
  return ref.id;
};

export const approveForumThread = async (threadId: string): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { moderationStatus: 'approved' });
};

export const rejectForumThread = async (threadId: string): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { deleted: true, moderationStatus: 'rejected' });
};

export const fetchForumThreads = async (opts?: {
  conceptId?: string;
  limitCount?: number;
}): Promise<ForumThread[]> => {
  try {
    const constraints: QueryConstraint[] = [
      where('deleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(opts?.limitCount ?? 80),
    ];
    if (opts?.conceptId) {
      constraints.splice(0, 0, where('conceptId', '==', opts.conceptId));
    }
    const snap = await getDocs(query(collection(db, 'forum_threads'), ...constraints));
    return snap.docs.map(d => ({
      reactionsHelpful: [],
      reactionsSame: [],
      reactionsGreat: [],
      isPinned: false,
      hasBestAnswer: false,
      category: 'question' as ThreadCategory,
      lastActivityAt: null,
      ...d.data(),
      id: d.id,
    } as unknown as ForumThread));
  } catch {
    return [];
  }
};

/**
 * Real-time listener for forum threads.
 * Returns an unsubscribe function. Calls `onUpdate` on every change.
 */
export const subscribeForumThreads = (
  opts: { conceptId?: string; limitCount?: number },
  onUpdate: (threads: ForumThread[]) => void,
): Unsubscribe => {
  const constraints: QueryConstraint[] = [
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(opts.limitCount ?? 80),
  ];
  if (opts.conceptId) constraints.splice(0, 0, where('conceptId', '==', opts.conceptId));
  const q = query(collection(db, 'forum_threads'), ...constraints);

  return onSnapshot(q, snap => {
    const threads = snap.docs
      .map(d => ({
        reactionsHelpful: [],
        reactionsSame: [],
        reactionsGreat: [],
        isPinned: false,
        hasBestAnswer: false,
        category: 'question' as ThreadCategory,
        lastActivityAt: null,
        ...d.data(),
        id: d.id,
      } as unknown as ForumThread))
      // Client-side moderation filter: hide pending (legacy threads without field → visible)
      .filter(t => !t.moderationStatus || t.moderationStatus === 'approved');
    onUpdate(threads);
  }, () => { /* ignore permission errors — returns empty */ });
};

export const fetchForumThread = async (threadId: string): Promise<ForumThread | null> => {
  const snap = await getDoc(doc(db, 'forum_threads', threadId));
  if (!snap.exists()) return null;
  return {
    reactionsHelpful: [],
    reactionsSame: [],
    reactionsGreat: [],
    isPinned: false,
    hasBestAnswer: false,
    category: 'question' as ThreadCategory,
    lastActivityAt: null,
    ...snap.data(),
    id: snap.id,
  } as unknown as ForumThread;
};

export const fetchForumStats = async (): Promise<ForumStats> => {
  try {
    const [totalSnap, weekSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'forum_threads'), where('deleted', '==', false))),
      getCountFromServer(query(
        collection(db, 'forum_threads'),
        where('deleted', '==', false),
        where('createdAt', '>=', new Date(Date.now() - 7 * 86400000)),
      )),
    ]);
    return {
      totalThreads: totalSnap.data().count,
      activeThisWeek: weekSnap.data().count,
    };
  } catch {
    return { totalThreads: 0, activeThisWeek: 0 };
  }
};

export const toggleThreadUpvote = async (threadId: string, teacherUid: string, hasUpvoted: boolean): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), {
    upvotedBy: hasUpvoted ? arrayRemove(teacherUid) : arrayUnion(teacherUid),
  });
};

export const toggleForumReaction = async (
  collectionName: 'forum_threads' | 'forum_replies',
  docId: string,
  field: ReactionField,
  uid: string,
  hasReacted: boolean,
): Promise<void> => {
  await updateDoc(doc(db, collectionName, docId), {
    [field]: hasReacted ? arrayRemove(uid) : arrayUnion(uid),
  });
};

export const softDeleteThread = async (threadId: string): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { deleted: true });
};

export const pinThread = async (threadId: string, pinned: boolean): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { isPinned: pinned });
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
    return snap.docs.map(d => ({
      reactionsHelpful: [],
      reactionsSame: [],
      reactionsGreat: [],
      isPinned: false,
      hasBestAnswer: false,
      category: 'question' as ThreadCategory,
      lastActivityAt: null,
      ...d.data(),
      id: d.id,
    } as unknown as ForumThread));
  } catch {
    return [];
  }
};

/** Admin: hard-restore a soft-deleted thread */
export const restoreThread = async (threadId: string): Promise<void> => {
  await updateDoc(doc(db, 'forum_threads', threadId), { deleted: false });
};

/** Admin: fetch threads awaiting moderation approval */
export const fetchPendingForumThreads = async (limitCount = 50): Promise<ForumThread[]> => {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'forum_threads'),
        where('moderationStatus', '==', 'pending'),
        orderBy('createdAt', 'asc'),
        limit(limitCount),
      ),
    );
    return snap.docs.map(d => ({
      reactionsHelpful: [],
      reactionsSame: [],
      reactionsGreat: [],
      isPinned: false,
      hasBestAnswer: false,
      category: 'question' as ThreadCategory,
      lastActivityAt: null,
      ...d.data(),
      id: d.id,
    } as unknown as ForumThread));
  } catch {
    return [];
  }
};

// ── Replies ───────────────────────────────────────────────────────────────────

export const createForumReply = async (data: {
  threadId: string;
  authorUid: string;
  authorName: string;
  body: string;
}): Promise<string> => {
  const ref = await addDoc(collection(db, 'forum_replies'), {
    threadId:         data.threadId,
    authorUid:        data.authorUid,
    authorName:       data.authorName,
    body:             data.body,
    createdAt:        serverTimestamp(),
    upvotedBy:        [],
    reactionsHelpful: [],
    reactionsSame:    [],
    reactionsGreat:   [],
    isBestAnswer:     false,
  });
  // Update thread: increment reply count + refresh lastActivityAt
  await updateDoc(doc(db, 'forum_threads', data.threadId), {
    replyCount:     increment(1),
    lastActivityAt: serverTimestamp(),
    participantUids: arrayUnion(data.authorUid),
  });
  return ref.id;
};

export const subscribeForumReplies = (
  threadId: string,
  onUpdate: (replies: ForumReply[]) => void,
): Unsubscribe => {
  const q = query(
    collection(db, 'forum_replies'),
    where('threadId', '==', threadId),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, snap => {
    const replies = snap.docs.map(d => ({
      reactionsHelpful: [],
      reactionsSame:    [],
      reactionsGreat:   [],
      ...d.data(),
      id: d.id,
    } as unknown as ForumReply));
    onUpdate(replies);
  }, () => { /* ignore permission errors */ });
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
    return snap.docs.map(d => ({
      reactionsHelpful: [],
      reactionsSame:    [],
      reactionsGreat:   [],
      ...d.data(),
      id: d.id,
    } as unknown as ForumReply));
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
  // Fetch existing replies, clear previous best answer
  const replies = await fetchForumReplies(threadId);
  const wasAlreadyBest = replies.find(r => r.id === replyId)?.isBestAnswer ?? false;
  const batch: Promise<void>[] = replies
    .filter(r => r.isBestAnswer && r.id !== replyId)
    .map(r => updateDoc(doc(db, 'forum_replies', r.id), { isBestAnswer: false }));
  await Promise.all(batch);
  // Toggle this reply's best answer
  const newValue = !wasAlreadyBest;
  await updateDoc(doc(db, 'forum_replies', replyId), { isBestAnswer: newValue });
  // Update denormalized hasBestAnswer on thread
  const hasBest = newValue || replies.some(r => r.id !== replyId && r.isBestAnswer);
  await updateDoc(doc(db, 'forum_threads', threadId), { hasBestAnswer: hasBest });
};
