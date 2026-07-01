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
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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
      // Use allSettled so a single failing query (missing index, offline, permission)
      // does not block the remaining queries from returning results.
      // orderBy is omitted from each query to avoid composite-index requirements;
      // client-side sort is applied instead.
      const [scenarioRes, materialsRes, testsRes] = await Promise.allSettled([
        // 1. Scenario bank — equality filters only, no orderBy → no composite index needed
        getDocs(
          query(
            collection(db, 'scenario_bank'),
            where('grade', '==', grade),
            where('deleted', '==', false),
            limit(80),
          ),
        ),

        // 2. Teacher's cached materials for this grade
        getDocs(
          query(
            collection(db, 'cached_ai_materials'),
            where('teacherUid', '==', uid),
            where('gradeLevel', '==', grade),
            limit(120),
          ),
        ),

        // 3. Dugga tests created by this teacher for this grade
        getDocs(
          query(
            collection(db, 'dugga_tests'),
            where('teacherUid', '==', uid),
            where('grade', '==', grade),
            limit(60),
          ),
        ),
      ]);

      if (cancelled) return;

      const keyword = theme ?? '';

      // Scenarios — sort by publishedAt desc client-side
      const scenarios: ScenarioBankEntry[] = scenarioRes.status === 'fulfilled'
        ? scenarioRes.value.docs
            .map(d => ({ id: d.id, ...d.data() } as ScenarioBankEntry))
            .sort((a, b) => {
              const ta = (a.publishedAt as any)?.seconds ?? 0;
              const tb = (b.publishedAt as any)?.seconds ?? 0;
              return tb - ta;
            })
            .filter(s =>
              !topicId
                ? keywordMatch(s.topicTitle, keyword)
                : keywordMatch(s.topicTitle, keyword) || s.topicTitle.includes(topicId),
            )
        : [];

      // Materials — sort by createdAt desc client-side, then split by type
      const allMaterials: CachedMaterial[] = materialsRes.status === 'fulfilled'
        ? materialsRes.value.docs
            .map(d => ({ id: d.id, ...d.data() } as CachedMaterial))
            .sort((a, b) => {
              const ta = (a.createdAt as any)?.seconds ?? 0;
              const tb = (b.createdAt as any)?.seconds ?? 0;
              return tb - ta;
            })
        : [];

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

      // Dugga tests — sort by createdAt desc client-side
      const tests: DuggaTest[] = testsRes.status === 'fulfilled'
        ? testsRes.value.docs
            .map(d => ({ id: d.id, ...d.data() } as DuggaTest))
            .sort((a, b) => {
              const ta = (a.createdAt as any)?.seconds ?? 0;
              const tb = (b.createdAt as any)?.seconds ?? 0;
              return tb - ta;
            })
            .filter(t =>
              keyword
                ? keywordMatch(t.title, keyword) ||
                  t.topics.some(tp => keywordMatch(tp, keyword))
                : true,
            )
        : [];

      // Only surface an error banner if every single query failed
      const allFailed =
        scenarioRes.status === 'rejected' &&
        materialsRes.status === 'rejected' &&
        testsRes.status === 'rejected';

      setResult({
        scenarios,
        tests,
        extractedTasks,
        presentations,
        isLoading: false,
        error: allFailed ? 'Грешка при вчитување ресурси' : null,
      });
    };

    void fetchAll();
    return () => { cancelled = true; };
  }, [grade, topicId, theme, uid]);

  return result;
}
