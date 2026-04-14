import { logger } from '../utils/logger';
/**
 * useStudentQuiz — loads quiz content from Firestore / IndexedDB / E2E mock.
 * Extracted from StudentPlayView for single-responsibility.
 */
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getCachedQuizContent, precacheQuizContent } from '../services/indexedDBService';
import type { DifferentiationLevel } from '../types';
import type { QuizPlayData } from '../components/student/quizSessionReducer';
import { useLanguage } from '../i18n/LanguageContext';

export function useStudentQuiz(id: string | undefined, tid?: string) {
  const { t } = useLanguage();
  const [quizData, setQuizData] = useState<QuizPlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingCachedContent, setUsingCachedContent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchQuiz = async () => {
      if (!id) {
        if (!cancelled) { setError(t('play.error.invalidLink')); setLoading(false); }
        return;
      }
      try {
        setLoading(true);
        let usedCache = false;

        // E2E: direct mock injection
        if (window.__E2E_MOCK_QUIZ_CONTENT__) {
          setQuizData({
            ...(window.__E2E_MOCK_QUIZ_CONTENT__ as Partial<QuizPlayData>),
            _meta: { teacherUid: tid ?? undefined, conceptId: undefined, topicId: undefined, gradeLevel: undefined, differentiationLevel: undefined },
          } as QuizPlayData);
          setUsingCachedContent(true);
          setLoading(false);
          return;
        }

        // E2E: skip Firestore, use IndexedDB only
        if (window.__E2E_USE_CACHE_ONLY__) {
          const cached = await getCachedQuizContent(id);
          if (cached && !cancelled) {
            setQuizData({ ...cached, _meta: { teacherUid: tid ?? undefined, conceptId: undefined, topicId: undefined, gradeLevel: undefined, differentiationLevel: undefined } });
            usedCache = true;
          } else if (!cancelled) {
            setError(t('play.error.notFound'));
          }
          if (!cancelled) setUsingCachedContent(usedCache);
          if (!cancelled) setLoading(false);
          return;
        }

        try {
          const quizDoc = await getDoc(doc(db, 'cached_ai_materials', id));
          if (cancelled) return;
          if (quizDoc.exists()) {
            const data = quizDoc.data();
            const content = data.content || data;
            setQuizData({
              ...content,
              _meta: {
                conceptId: data.conceptId,
                topicId: data.topicId,
                gradeLevel: data.gradeLevel,
                teacherUid: tid ?? data.teacherUid ?? undefined,
                differentiationLevel: data.differentiationLevel as DifferentiationLevel | undefined,
              },
            });
            precacheQuizContent(id, content).catch(() => {});
          } else {
            setError(t('play.error.notFound'));
          }
        } catch (err) {
          // Firestore failed — try offline cache
          const cached = await getCachedQuizContent(id);
          if (cached && !cancelled) {
            setQuizData({
              ...cached,
              _meta: { conceptId: undefined, topicId: undefined, gradeLevel: undefined, teacherUid: tid ?? undefined, differentiationLevel: undefined },
            });
            usedCache = true;
          } else if (!cancelled) {
            logger.error('Грешка при вчитување на квизот:', err);
            setError(t('play.error.connect'));
          }
        }
        if (!cancelled) setUsingCachedContent(usedCache);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchQuiz();
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { quizData, loading, error, usingCachedContent };
}
