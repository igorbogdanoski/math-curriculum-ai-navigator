import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Announcement, Assignment } from '../services/firestoreService';

interface StudentRealtimeData {
  announcements: Announcement[];
  assignments: Assignment[];
}

/**
 * Real-time listener for student announcements and assignments.
 * Uses onSnapshot so the UI updates instantly when the teacher posts
 * something new — no manual refresh needed.
 *
 * Accepts initial data from useStudentProgress so there is no flash
 * of empty content while the snapshot subscription connects.
 */
export function useStudentRealtime(
  teacherUid: string | undefined,
  studentName: string,
  initialAnnouncements: Announcement[] = [],
  initialAssignments: Assignment[] = [],
): StudentRealtimeData {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);

  // Sync initial data when the parent query resolves
  useEffect(() => { setAnnouncements(initialAnnouncements); }, [JSON.stringify(initialAnnouncements)]);
  useEffect(() => { setAssignments(initialAssignments); }, [JSON.stringify(initialAssignments)]);

  // Real-time announcements (by teacher)
  useEffect(() => {
    if (!teacherUid) return;
    const q = query(
      collection(db, 'announcements'),
      where('teacherUid', '==', teacherUid),
      orderBy('createdAt', 'desc'),
      limit(3),
    );
    const unsub = onSnapshot(q, snap => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }, () => { /* non-fatal — keep last known state */ });
    return unsub;
  }, [teacherUid]);

  // Real-time assignments (by student name)
  useEffect(() => {
    if (!studentName.trim() || studentName.trim().length < 2) return;
    const q = query(
      collection(db, 'assignments'),
      where('classStudentNames', 'array-contains', studentName.trim()),
      orderBy('dueDate', 'asc'),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    }, () => { /* non-fatal */ });
    return unsub;
  }, [studentName]);

  return { announcements, assignments };
}
