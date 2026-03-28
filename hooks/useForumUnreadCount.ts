/**
 * useForumUnreadCount — real-time badge for Forum nav item.
 *
 * Subscribes to the current teacher's forum threads and counts those
 * that have had activity (replies or upvotes) since the last time they
 * visited the forum. Clears automatically when the user navigates to /forum.
 *
 * Lightweight: fires at most 1 Firestore listener while logged in.
 */

import { useEffect, useRef, useState } from 'react';
import {
  collection, query, where, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const STORAGE_KEY = 'forum_last_visit_ms';

function getLastVisit(): number {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10); }
  catch { return 0; }
}

export function markForumVisited(): void {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); }
  catch { /* storage unavailable */ }
}

/**
 * Returns the count of the authenticated teacher's forum threads that
 * have had new activity since they last visited the forum.
 */
export function useForumUnreadCount(teacherUid: string | null): number {
  const [count, setCount] = useState(0);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!teacherUid) { setCount(0); return; }

    unsubRef.current?.();
    const q = query(
      collection(db, 'forum_threads'),
      where('authorUid', '==', teacherUid),
    );

    unsubRef.current = onSnapshot(q, snap => {
      const lastVisit = getLastVisit();
      let unread = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (!data.lastActivityAt || !data.replyCount) continue;
        const activityMs: number = data.lastActivityAt.toDate
          ? data.lastActivityAt.toDate().getTime()
          : 0;
        // Count threads with new activity after last visit AND has at least 1 reply
        if (activityMs > lastVisit && data.replyCount > 0) unread++;
      }
      setCount(unread);
    }, () => { setCount(0); });

    return () => { unsubRef.current?.(); };
  }, [teacherUid]);

  return count;
}
