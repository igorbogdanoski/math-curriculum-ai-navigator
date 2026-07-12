import { logger } from '../utils/logger';
import { useEffect, useState, useMemo } from 'react';
import { firestoreService, type ConceptMastery } from '../services/firestoreService';

/**
 * П5: Peer Learning — fetches students who mastered the same concepts the current
 * student struggles with (attempted >=2 times, not yet mastered), so the UI can
 * suggest "ask this classmate for help."
 */
export function useStudentPeerHelpers(
  teacherUid: string | undefined,
  studentName: string,
  masteryRecords: ConceptMastery[],
) {
  const [peerHelpers, setPeerHelpers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!teacherUid || !studentName || masteryRecords.length === 0) return;
    const struggling = masteryRecords.filter(m => !m.mastered && m.attempts >= 2).slice(0, 3);
    if (struggling.length === 0) return;
    let cancelled = false;
    (async () => {
      const results: Record<string, string[]> = {};
      try {
        const conceptIds = struggling.map(m => m.conceptId);
        const allPeers = await firestoreService.fetchMasteryByConceptBulk(conceptIds, teacherUid);
        for (const m of struggling) {
          const helpers = allPeers
            .filter(p => p.conceptId === m.conceptId && p.mastered && p.studentName !== studentName)
            .map(p => p.studentName)
            .filter(Boolean)
            .slice(0, 3) as string[];
          if (helpers.length > 0) results[m.conceptId] = helpers;
        }
      } catch (err) { logger.warn('[PeerLearning] fetchMasteryByConceptBulk failed:', err); }
      if (!cancelled) setPeerHelpers(results);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherUid, studentName, masteryRecords.length]);

  const peerHelpConcepts = useMemo(() =>
    masteryRecords.filter(m => !m.mastered && m.attempts >= 2 && (peerHelpers[m.conceptId]?.length ?? 0) > 0),
    [masteryRecords, peerHelpers]
  );

  return { peerHelpers, peerHelpConcepts };
}
