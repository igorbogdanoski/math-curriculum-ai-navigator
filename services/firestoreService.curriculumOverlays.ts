/**
 * Curriculum Overlays — S93-D "Мои Бележки"
 *
 * Personal teacher notes attached to individual topics in the annual plan.
 * Stored per teacher, per topic. Surfaced as a sticky-note overlay in
 * AnnualPlanGeneratorView without modifying the static curriculum.
 *
 * Collection: curriculum_overlays
 * Document:   {uid}_{gradeId}_{topicIndex}
 */

import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface TopicOverlay {
  id: string;
  uid: string;
  gradeId: string;
  topicIndex: number;
  topicTitle: string;
  note: string;
  color: 'yellow' | 'blue' | 'green' | 'pink';
  updatedAt: Timestamp | null;
}

const COLLECTION = 'curriculum_overlays';

const docId = (uid: string, gradeId: string, topicIndex: number) =>
  `${uid}_${gradeId}_t${topicIndex}`;

export async function saveTopicOverlay(
  uid: string,
  gradeId: string,
  topicIndex: number,
  topicTitle: string,
  note: string,
  color: TopicOverlay['color'] = 'yellow',
): Promise<void> {
  const id = docId(uid, gradeId, topicIndex);
  await setDoc(doc(db, COLLECTION, id), {
    id,
    uid,
    gradeId,
    topicIndex,
    topicTitle,
    note,
    color,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTopicOverlay(uid: string, gradeId: string, topicIndex: number): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, docId(uid, gradeId, topicIndex)));
}

export async function fetchTopicOverlaysForGrade(uid: string, gradeId: string): Promise<TopicOverlay[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('uid', '==', uid), where('gradeId', '==', gradeId)),
    );
    return snap.docs.map(d => d.data() as TopicOverlay);
  } catch {
    return [];
  }
}
