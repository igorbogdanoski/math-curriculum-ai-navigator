import { useEffect, useState, useMemo } from 'react';
import { firestoreService, type ConceptMastery } from '../services/firestoreService';
import { isDueForReview, sortByReviewUrgency, getNextReviewLabel, type SpacedRepRecord } from '../utils/spacedRepetition';

/**
 * Правец 14: Spaced Repetition (SM-2) — fetches the student's real SM-2 records and
 * derives "review today" (falls back to a timestamp-based heuristic when no SM-2
 * records exist yet, matching the original pre-SM-2 logic).
 */
export function useStudentSpacedRepetition(studentName: string, masteryRecords: ConceptMastery[]) {
  const [sm2Records, setSm2Records] = useState<SpacedRepRecord[]>([]);

  useEffect(() => {
    if (!studentName) return;
    // Use device ID from localStorage as studentId (same key as StudentPlayView)
    const studentId = (() => { try { return localStorage.getItem('deviceId') || studentName; } catch { return studentName; } })();
    firestoreService.fetchSpacedRepRecords(studentId)
      .then(records => setSm2Records(records))
      .catch(() => {/* non-critical, fall back to timestamp logic */});
  }, [studentName]);

  const reviewToday = useMemo(() => {
    // If we have real SM-2 records from Firestore, use the algorithm
    if (sm2Records.length > 0) {
      const dueRecords = sortByReviewUrgency(sm2Records.filter(isDueForReview));
      return dueRecords.map(r => {
        const mastery = masteryRecords.find(m => m.conceptId === r.conceptId);
        return { ...mastery, conceptId: r.conceptId, conceptTitle: mastery?.conceptTitle || r.conceptId, sm2Label: getNextReviewLabel(r) };
      }).filter(m => m.conceptId);
    }
    // Fallback: timestamp-based heuristic (original logic)
    const now = Date.now();
    return masteryRecords.filter(m => {
      if (!m.updatedAt) return false;
      const lastMs = m.updatedAt.toDate().getTime();
      const daysSince = (now - lastMs) / 86_400_000;
      return m.mastered ? daysSince > 30 : (daysSince > 7 && m.attempts > 0);
    });
  }, [masteryRecords, sm2Records]);

  return { sm2Records, reviewToday };
}
