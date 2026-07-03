import { useState, useCallback } from 'react';

/** Persists the student's chosen difficulty level per lab across visits (localStorage). */
export function useLabDifficulty(labId: string) {
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(() => {
    try {
      const s = localStorage.getItem(`lab_diff_${labId}`);
      return (s === '1' || s === '2' || s === '3') ? +s as 1 | 2 | 3 : 1;
    } catch { return 1; }
  });
  const setAndPersist = useCallback((d: 1 | 2 | 3) => {
    setDifficulty(d);
    try { localStorage.setItem(`lab_diff_${labId}`, String(d)); } catch { /* incognito */ }
  }, [labId]);
  return [difficulty, setAndPersist] as const;
}
