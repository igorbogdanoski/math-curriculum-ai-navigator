/**
 * S96.1 — useLessonResources
 *
 * Aggregates all platform resources relevant to the current lesson plan:
 * BRO scenarios, Dugga tests, extracted tasks (cached_ai_materials type='problems'),
 * and AI presentations (type='package' | 'outline').
 *
 * Queries run in parallel; client-side keyword filtering bridges the gap where
 * Firestore doesn't store a unified topicId.
 */

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ScenarioBankEntry } from '../services/firestoreService.scenarioBank';
import type { DuggaTest } from '../services/firestoreService.dugga';
import type { CachedMaterial } from '../services/firestoreService.types';

export interface LessonResources {
  scenarios: ScenarioBankEntry[];
  tests: DuggaTest[];
  extractedTasks: CachedMaterial[];
  presentations: CachedMaterial[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fuzzy keyword match — checks if any word from `keywords` (≥3 chars) appears
 * in `text` (case-insensitive, substring).
 */
export function keywordMatch(text: string, keywords: string): boolean {
  if (!text || !keywords) return false;
  const words = keywords
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3);
  if (words.length === 0) return false;
  const haystack = text.toLowerCase();
  return words.some(w => haystack.includes(w));
}

interface UseLessonResourcesInput {
  grade: number | null | undefined;
  topicId?: string | null;
  theme?: string | null;
  uid: string | null | undefined;
}

const EMPTY: LessonResources = {
  scenarios: [],
  tests: [],
  extractedTasks: [],
  presentations: [],
  isLoading: false,
  error: null,
};

export function useLessonResources({
  grade,
  topicId,
  theme,
  uid,
}: UseLessonResourcesInput): LessonResources {
  const [result, setResult] = useState<LessonResources>(EMPTY);

  useEffect(() => {
    // Need at least grade + uid to do anything useful
    if (!grade || !uid) {
      setResult(EMPTY);
      return;
    }

    let cancelled = false;
    setResult(prev => ({ ...prev, isLoading: true, error: null }));

    const fetchAll = async () => {
      try {
        const [scenarioSnap, materialsSnap, testsSnap] = await Promise.all([
          // 1. Scenario bank — all public/verified for this grade (client filter by topic)
          getDocs(
            query(
              collection(db, 'scenario_bank'),
              where('grade', '==', grade),
              where('deleted', '==', false),
              orderBy('publishedAt', 'desc'),
              limit(50),
            ),
          ),

          // 2. Teacher's cached materials for this grade (problems + presentations)
          getDocs(
            query(
              collection(db, 'cached_ai_materials'),
              where('teacherUid', '==', uid),
              where('gradeLevel', '==', grade),
              orderBy('createdAt', 'desc'),
              limit(100),
            ),
          ),

          // 3. Dugga tests created by this teacher for this grade
          getDocs(
            query(
              collection(db, 'dugga_tests'),
              where('teacherUid', '==', uid),
              where('grade', '==', grade),
              orderBy('createdAt', 'desc'),
              limit(50),
            ),
          ),
        ]);

        if (cancelled) return;

        const keyword = theme ?? '';

        // Filter scenarios by topicTitle keyword match
        const scenarios = scenarioSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ScenarioBankEntry))
          .filter(s =>
            !topicId
              ? keywordMatch(s.topicTitle, keyword)
              : keywordMatch(s.topicTitle, keyword) || s.topicTitle.includes(topicId),
          );

        // Split materials into extracted tasks vs presentations
        const allMaterials = materialsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CachedMaterial));

        const extractedTasks = allMaterials.filter(m => {
          const typeMatch = m.type === 'problems' || m.type === 'quiz';
          const topicMatch = topicId
            ? m.topicId === topicId
            : keyword
            ? keywordMatch(m.title ?? '', keyword)
            : true;
          return typeMatch && topicMatch;
        });

        const presentations = allMaterials.filter(m => {
          const typeMatch = m.type === 'package' || m.type === 'outline' || m.type === 'ideas';
          const topicMatch = topicId
            ? m.topicId === topicId
            : keyword
            ? keywordMatch(m.title ?? '', keyword)
            : true;
          return typeMatch && topicMatch;
        });

        // Filter Dugga tests by topics[] keyword match
        const tests = testsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as DuggaTest))
          .filter(t =>
            keyword
              ? keywordMatch(t.title, keyword) ||
                t.topics.some(tp => keywordMatch(tp, keyword))
              : true,
          );

        setResult({
          scenarios,
          tests,
          extractedTasks,
          presentations,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          scenarios: [],
          tests: [],
          extractedTasks: [],
          presentations: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Грешка при вчитување ресурси',
        });
      }
    };

    void fetchAll();
    return () => { cancelled = true; };
  }, [grade, topicId, theme, uid]);

  return result;
}
