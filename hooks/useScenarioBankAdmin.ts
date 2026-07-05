import { useCallback, useEffect, useState } from 'react';
import type { DocumentSnapshot } from 'firebase/firestore';
import { fetchAllAdmin, type ScenarioBankEntry } from '../services/firestoreService.scenarioBank';
import { useNotification } from '../contexts/NotificationContext';

/**
 * Admin-only cursor-paginated fetch of the full scenario_bank collection.
 * Extracted out of ScenarioBankView — the hook fetches on mount, so the caller
 * should only mount the component using this hook while the admin tab is active.
 */
export function useScenarioBankAdmin() {
  const { addNotification } = useNotification();
  const [entries, setEntries] = useState<ScenarioBankEntry[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (nextCursor?: DocumentSnapshot) => {
    setLoading(true);
    try {
      const res = await fetchAllAdmin(30, nextCursor);
      setEntries(prev => (nextCursor ? [...prev, ...res.entries] : res.entries));
      setCursor(res.lastDoc);
      setHasMore(res.hasMore);
    } catch {
      addNotification('Грешка при вчитување (admin).', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (cursor) load(cursor);
  }, [cursor, load]);

  const refresh = useCallback(() => {
    setEntries([]);
    setCursor(null);
    load();
  }, [load]);

  return { entries, hasMore, loading, loadMore, refresh };
}
