import { useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { persistScanArtifactWithObservability } from '../services/scanArtifactPersistence';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import {
  DEFAULT_QUESTIONS, readFileAsDataURL,
  type TestQuestion, type GradeResult, type StudentSubmission, type Mode,
} from '../components/writtentest/testGradingTypes';

interface UseTestGradingParams {
  firebaseUid: string | undefined;
  schoolId: string | undefined;
}

/**
 * Bundles the AI Written-Test-Review grading flow (single + batch modes): question
 * setup, single/batch grading calls with retry, per-submission persistence, and the
 * question auto-extraction path — extracted out of WrittenTestReviewView's ~990-line
 * render function.
 */
export function useTestGrading({ firebaseUid, schoolId }: UseTestGradingParams) {
  const [mode, setMode] = useState<Mode>('single');
  const [questions, setQuestions] = useState<TestQuestion[]>(DEFAULT_QUESTIONS);
  const [expandedSetup, setExpandedSetup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single mode
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [singleResults, setSingleResults] = useState<GradeResult[]>([]);
  const [isGrading, setIsGrading] = useState(false);

  // Batch mode
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isBatchGrading, setIsBatchGrading] = useState(false);

  // Auto-extract
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const persistTestArtifact = useCallback(async (
    mimeType: string,
    results: GradeResult[],
    meta?: { sourceUrl?: string }
  ) => {
    if (!firebaseUid || results.length === 0) return;

    const totalEarned = results.reduce((sum, r) => sum + r.earnedPoints, 0);
    const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
    const feedbackText = results
      .map((r, i) => `П${i + 1}: ${r.feedback}`)
      .join('\n');

    const outcome = await persistScanArtifactWithObservability({
      teacherUid: firebaseUid,
      schoolId,
      mode: 'test_grading',
      sourceType: 'image',
      sourceUrl: meta?.sourceUrl,
      mimeType,
      extractedText: feedbackText,
      normalizedText: feedbackText.trim(),
      pedagogicalFeedback: results.map((r, i) => ({
        itemRef: r.questionId || `q-${i + 1}`,
        misconceptionType: r.misconception,
        feedback: r.feedback,
      })),
      gradingSummary: {
        earnedPoints: totalEarned,
        maxPoints: totalMax,
        percentage,
      },
      artifactQuality: {
        score: percentage >= 80 ? 0.9 : percentage >= 60 ? 0.78 : percentage >= 40 ? 0.65 : 0.5,
        label: percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : percentage >= 40 ? 'fair' : 'poor',
        truncated: false,
      },
    }, {
      flow: 'written_test_review',
      stage: 'vision_grade_submission',
    });

    if (!outcome.ok) {
      throw outcome.error ?? new Error('scan-artifact-persist-failed');
    }
  }, [firebaseUid, schoolId]);

  // ── Question helpers ──
  const addQuestion = () => {
    const newId = String(questions.length + 1);
    setQuestions(prev => [...prev, { id: newId, text: '', points: 10, correctAnswer: '' }]);
  };
  const removeQuestion = (id: string) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };
  const updateQuestion = (id: string, field: keyof TestQuestion, value: string | number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };
  const validQuestions = questions.filter(q => q.text.trim() && q.correctAnswer.trim());

  // ── Auto-extract questions from test document ──
  const handleExtractQuestions = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setExtractError('Максимум 10MB.'); return; }
    setIsExtracting(true);
    setExtractError(null);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isDocx = file.name.endsWith('.docx') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      let extracted: Array<{ text: string; correctAnswer: string; points: number }>;

      if (isDocx) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        if (!text.trim()) { setExtractError('Документот е празен.'); return; }
        extracted = await geminiService.extractTestQuestions({ kind: 'text', text });
      } else {
        // image or PDF — both via Gemini inline data
        const dataUrl = await readFileAsDataURL(file);
        const base64 = dataUrl.split(',')[1];
        const mimeType = isPdf ? 'application/pdf' : file.type;
        extracted = await geminiService.extractTestQuestions({ kind: isPdf ? 'pdf' : 'image', base64, mimeType });
      }

      if (!extracted.length) { setExtractError('AI не најде прашања во документот. Провери дали документот е тест.'); return; }
      setQuestions(extracted.map((q, i) => ({ id: String(i + 1), ...q })));
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Грешка при извлекување. Обиди се повторно.');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // ── Single mode ──
  const handleSingleFile = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (!file.type.startsWith('image/') && !isPdf) { setError('Поддржани: слики (JPG, PNG, WebP) и PDF.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Максимум 10MB.'); return; }
    setImageFile(file);
    setError(null);
    setSingleResults([]);
    const preview = await readFileAsDataURL(file);
    setImagePreview(preview);
  }, []);

  const handleSingleGrade = async () => {
    if (!imageFile || !imagePreview) return;
    if (validQuestions.length === 0) { setError('Внесете барем едно прашање со точен одговор.'); return; }
    setIsGrading(true);
    setError(null);
    try {
      const base64 = imagePreview.split(',')[1];
      const mimeType = imageFile.type === 'application/pdf' || imageFile.name.endsWith('.pdf')
        ? 'application/pdf'
        : imageFile.type;
      const results = await geminiService.gradeTestWithVision(
        base64, mimeType,
        validQuestions.map(q => ({ id: q.id, text: q.text, points: q.points, correctAnswer: q.correctAnswer }))
      );
      if (!results.length) {
        throw new Error('AI не врати валидни оценки. Обидете се повторно со појасна фотографија.');
      }
      setSingleResults(results);
      setExpandedSetup(false);
      try {
        await persistTestArtifact(imageFile.type, results);
      } catch (persistErr) {
        logger.warn('Failed to persist written-test artifact', persistErr);
        setError('Оценувањето е успешно, но зачувувањето на артефактот не успеа. Обидете се повторно.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Грешка при прегледувањето. Обидете се повторно.';
      setError(message);
    } finally {
      setIsGrading(false);
    }
  };

  // ── Batch mode ──
  const handleBatchFiles = useCallback(async (files: FileList) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 30);
    if (arr.length === 0) { setError('Изберете слики (JPG, PNG, WebP).'); return; }
    setError(null);
    const newSubs: StudentSubmission[] = await Promise.all(
      arr.map(async (file, i) => ({
        id: crypto.randomUUID(),
        name: `Ученик ${i + 1}`,
        file,
        preview: await readFileAsDataURL(file),
        status: 'pending' as const,
      }))
    );
    setSubmissions(prev => [...prev, ...newSubs]);
  }, []);

  // Uses the shared rate-limit/network-aware retry helper (utils/retryWithBackoff.ts) —
  // a submission that fails outright gets up to 2 more attempts before being marked
  // 'error', instead of the batch silently leaving a gap the teacher only discovers by
  // scanning thumbnails. Deterministic failures (e.g. the AI genuinely returning no
  // gradable results) aren't retried — same philosophy as the shared helper: retrying a
  // non-transient failure just wastes time.
  const gradeSubmissionWithRetry = useCallback(async (
    sub: StudentSubmission,
    qList: { id: string; text: string; points: number; correctAnswer: string }[],
  ): Promise<GradeResult[] | null> => {
    const base64 = sub.preview.split(',')[1];
    try {
      const results = await retryWithBackoff(
        () => geminiService.gradeTestWithVision(base64, sub.file.type, qList),
        { maxRetries: 2, baseDelayMs: 1000 },
      );
      return results.length ? results : null;
    } catch {
      return null;
    }
  }, []);

  const handleBatchGrade = async () => {
    if (submissions.length === 0 || validQuestions.length === 0) {
      setError('Додајте слики и пополнете ги прашањата.');
      return;
    }
    setIsBatchGrading(true);
    setBatchProgress(0);
    setError(null);

    const qList = validQuestions.map(q => ({ id: q.id, text: q.text, points: q.points, correctAnswer: q.correctAnswer }));

    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'processing' } : s));
      const results = await gradeSubmissionWithRetry(sub, qList);
      if (results) {
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'done', results } : s));
        try {
          await persistTestArtifact(sub.file.type, results);
        } catch (persistErr) {
          logger.warn('Failed to persist batch written-test artifact', persistErr);
        }
      } else {
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'error' } : s));
      }
      setBatchProgress(i + 1);
      // Small delay to respect rate limits
      if (i < submissions.length - 1) await new Promise(r => setTimeout(r, 600));
    }
    setIsBatchGrading(false);
    setExpandedSetup(false);
  };

  /** Retries a single failed submission without re-running the whole batch. */
  const handleRetryOne = async (subId: string) => {
    const sub = submissions.find(s => s.id === subId);
    if (!sub || validQuestions.length === 0) return;
    const qList = validQuestions.map(q => ({ id: q.id, text: q.text, points: q.points, correctAnswer: q.correctAnswer }));
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'processing' } : s));
    const results = await gradeSubmissionWithRetry(sub, qList);
    if (results) {
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'done', results } : s));
      try {
        await persistTestArtifact(sub.file.type, results);
      } catch (persistErr) {
        logger.warn('Failed to persist retried written-test artifact', persistErr);
      }
    } else {
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'error' } : s));
    }
  };

  const resetAll = () => {
    setSubmissions([]);
    setSingleResults([]);
    setExpandedSetup(true);
    setError(null);
    setBatchProgress(0);
  };

  return {
    mode, setMode,
    questions, expandedSetup, setExpandedSetup, error, setError,
    imageFile, imagePreview, singleResults, isGrading,
    submissions, setSubmissions, batchProgress, isBatchGrading,
    isExtracting, extractError,
    validQuestions,
    addQuestion, removeQuestion, updateQuestion,
    handleExtractQuestions, handleSingleFile, handleSingleGrade,
    handleBatchFiles, handleBatchGrade, handleRetryOne,
    resetAll,
  };
}
