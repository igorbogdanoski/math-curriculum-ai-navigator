/**
 * Generic Firestore cursor-pagination helper.
 *
 * Wraps the boilerplate of `where(...) + orderBy(...) + limit(N+1)` with
 * cursor-based "has more" detection. The +1 trick fetches one extra doc to
 * cheaply determine if another page exists without an additional roundtrip.
 *
 * Usage:
 *   const { items, hasMore, lastDoc } = await firestorePage<MyType>({
 *     collectionName: 'forum_threads',
 *     constraints: [where('category', '==', 'question'), orderBy('createdAt', 'desc')],
 *     pageSize: 20,
 *     cursor: lastVisible,
 *     mapper: (d) => ({ id: d.id, ...d.data() } as MyType),
 *     filter: (m) => !m.deleted,
 *   });
 */
import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { logger } from '../utils/logger';

export interface FirestorePageResult<T> {
  items: T[];
  hasMore: boolean;
  lastDoc: QueryDocumentSnapshot | null;
}

export interface FirestorePageOptions<T> {
  collectionName: string;
  constraints: QueryConstraint[];
  pageSize?: number;
  cursor?: QueryDocumentSnapshot;
  /** Map raw doc to domain type. Defaults to `{ id, ...data() }`. */
  mapper?: (doc: QueryDocumentSnapshot) => T;
  /** Optional client-side filter (e.g. exclude soft-deleted/archived). */
  filter?: (item: T) => boolean;
  /** Tag passed to logger on errors. */
  errorTag?: string;
}

const defaultMapper = <T>(d: QueryDocumentSnapshot): T =>
  ({ id: d.id, ...d.data() } as unknown as T);

export async function firestorePage<T>({
  collectionName,
  constraints,
  pageSize = 50,
  cursor,
  mapper,
  filter,
  errorTag,
}: FirestorePageOptions<T>): Promise<FirestorePageResult<T>> {
  try {
    const finalConstraints = [...constraints, limit(pageSize + 1)];
    const q = cursor
      ? query(collection(db, collectionName), ...finalConstraints, startAfter(cursor))
      : query(collection(db, collectionName), ...finalConstraints);
    const snap = await getDocs(q);
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const map = mapper ?? defaultMapper<T>;
    let items = docs.map(map);
    if (filter) items = items.filter(filter);
    return {
      items,
      hasMore,
      lastDoc: docs.length > 0 ? (docs[docs.length - 1] as QueryDocumentSnapshot) : null,
    };
  } catch (error) {
    logger.error(`Error fetching ${errorTag ?? collectionName} page:`, error);
    return { items: [], hasMore: false, lastDoc: null };
  }
}
