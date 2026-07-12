import { useState, useEffect, useCallback } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { subscribeMyDuggaTests, fetchPublicDuggaTestsPage } from '../services/firestoreService.dugga';
import type { DuggaTest } from '../services/firestoreService.dugga';
import { logger } from '../utils/logger';

export type LibraryTab = 'my' | 'public';

/** My tests: live subscription (bounded per-teacher). Public tests: paginated one-time
 *  fetch, loaded lazily when the tab switches — not a live listener, since that collection
 *  actively grows as teachers publish tests and would be unbounded. */
export function useDuggaLibraryData(teacherUid: string | undefined, tab: LibraryTab) {
  const [myTests, setMyTests] = useState<DuggaTest[]>([]);
  const [publicTests, setPublicTests] = useState<DuggaTest[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [loadingMorePublic, setLoadingMorePublic] = useState(false);
  const [publicLastDoc, setPublicLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [publicHasMore, setPublicHasMore] = useState(false);

  useEffect(() => {
    if (!teacherUid) { setLoadingMy(false); return; }
    setLoadingMy(true);
    const unsub = subscribeMyDuggaTests(teacherUid, tests => {
      setMyTests(tests);
      setLoadingMy(false);
    }, () => {
      setLoadingMy(false);
    });
    return unsub;
  }, [teacherUid]);

  useEffect(() => {
    if (tab !== 'public') return;
    let cancelled = false;
    setLoadingPublic(true);
    fetchPublicDuggaTestsPage(30).then(page => {
      if (cancelled) return;
      setPublicTests(page.items);
      setPublicLastDoc(page.lastDoc);
      setPublicHasMore(page.hasMore);
      setLoadingPublic(false);
    }).catch(err => {
      if (cancelled) return;
      logger.error('[useDuggaLibraryData] failed to load public tests', err);
      setLoadingPublic(false);
    });
    return () => { cancelled = true; };
  }, [tab]);

  const loadMorePublicTests = useCallback(async () => {
    if (!publicLastDoc || loadingMorePublic) return;
    setLoadingMorePublic(true);
    try {
      const page = await fetchPublicDuggaTestsPage(30, publicLastDoc);
      setPublicTests(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        return [...prev, ...page.items.filter(t => !existingIds.has(t.id))];
      });
      setPublicLastDoc(page.lastDoc);
      setPublicHasMore(page.hasMore);
    } finally {
      setLoadingMorePublic(false);
    }
  }, [publicLastDoc, loadingMorePublic]);

  return {
    myTests, publicTests,
    loadingMy, loadingPublic, loadingMorePublic,
    publicHasMore, loadMorePublicTests,
  };
}
