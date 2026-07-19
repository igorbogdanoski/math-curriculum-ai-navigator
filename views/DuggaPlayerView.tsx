import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Search, Loader2, Award,
  Clock, User,
  RotateCcw, ChevronRight, Trophy,
} from 'lucide-react';
import { QuestionCard } from '../components/dugga/DuggaQuestionCard';
import { getDuggaTestByCode, submitDuggaTest } from '../services/firestoreService.dugga';
import type { DuggaTest } from '../services/firestoreService.dugga';
import { duggaAPI } from '../services/gemini/dugga';
import { autoScore, needsAIGrade, needsManualReview, buildAIGradingQuestionContext } from '../utils/duggaScoring';
import type { QResult } from '../utils/duggaScoring';
import { gradeFeynmanAnswer, feynmanScoreToPoints } from '../utils/duggaFeynmanGrading';
import { callGeminiProxy, DEFAULT_MODEL } from '../services/gemini/core';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useExamVisibilityPause } from '../hooks/useExamVisibilityPause';
import { resolveExamMode } from '../utils/duggaFinalExamMode';
import { computeSubmissionSeal } from '../utils/duggaSubmissionSeal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'code' | 'name' | 'test' | 'submitting' | 'results';

// (Answer Input Components + QuestionCard extracted to
//  components/dugga/DuggaQuestionCard.tsx — 2026-07-04 oversized-file cleanup)

// ─── Main View ────────────────────────────────────────────────────────────────

export function DuggaPlayerView() {
  const { user, firebaseUser } = useAuth();
  const { addNotification } = useNotification();

  // S65 P2-C — read `?code=XXX` from URL hash so student dashboards / share
  // links can deep-link straight into a test without manual code entry.
  const initialCode = useMemo(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const qs = hash.split('?')[1];
      if (!qs) return '';
      const params = new URLSearchParams(qs);
      return (params.get('code') ?? '').toUpperCase().trim();
    } catch { return ''; }
  }, []);

  // Pre-fill student name from prior login if available (S65 P2-A).
  const initialStudentName = useMemo(() => {
    const fromAuth = (user as any)?.displayName ?? firebaseUser?.displayName ?? '';
    if (fromAuth) return fromAuth;
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  }, [user, firebaseUser]);

  const [phase, setPhase] = useState<Phase>('code');
  const [code, setCode] = useState(initialCode);
  const [loadingTest, setLoadingTest] = useState(false);
  const [test, setTest] = useState<DuggaTest | null>(null);
  const [studentName, setStudentName] = useState(initialStudentName);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [solutionImages, setSolutionImages] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, QResult>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [pendingReviewPoints, setPendingReviewPoints] = useState(0);
  const [, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('Оценување...');

  // S61-E1/E2 — Final exam mode + visibility pause ----------------------------
  const examMode = useMemo(() => (test ? resolveExamMode(test) : null), [test]);
  const [paused, setPaused] = useState(false);
  const [pauseEvents, setPauseEvents] = useState(0);

  useExamVisibilityPause({
    enabled: phase === 'test' && examMode?.pauseOnHidden === true,
    onPause: () => {
      setPaused(true);
      setPauseEvents(n => n + 1);
    },
    onResume: () => setPaused(false),
  });

  const handleAnswer = useCallback((id: string, v: string) => {
    setAnswers(prev => ({ ...prev, [id]: v }));
  }, []);

  const handleSolutionImage = useCallback((id: string, url: string) => {
    setSolutionImages(prev => ({ ...prev, [id]: url }));
  }, []);

  const fetchTest = useCallback(async (codeToUse?: string) => {
    const c = (codeToUse ?? code).trim();
    if (!c) return;
    setLoadingTest(true);
    try {
      const t = await getDuggaTestByCode(c);
      if (!t) {
        addNotification('Тестот не е пронајден. Провери го кодот.', 'error');
        return;
      }
      setTest(t);
      // Initialize ordering questions with shuffled order
      const initAnswers: Record<string, string> = {};
      t.questions.forEach(q => {
        if (q.type === 'ordering' && q.orderItems?.length) {
          const shuffled = [...q.orderItems].sort(() => Math.random() - 0.5);
          initAnswers[q.id] = shuffled.join('|');
        }
      });
      setAnswers(initAnswers);
      setPhase('name');
    } catch {
      addNotification('Грешка при вчитување. Обиди се повторно.', 'error');
    } finally {
      setLoadingTest(false);
    }
  }, [code, addNotification]);

  // S65 P2-C — auto-load test when ?code=XXX is supplied via deep-link.
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (initialCode && initialCode.length >= 4) {
      autoLoadedRef.current = true;
      fetchTest(initialCode);
    }
  }, [initialCode, fetchTest]);

  const handleSubmit = async () => {
    if (!test) return;
    setSubmitting(true);
    setPhase('submitting');

    const qResults: Record<string, QResult> = {};
    let earned = 0;
    let maxPts = 0;

    const gradeable = test.questions.filter(q => q.type !== 'section_header');

    // 1) Auto-score all questions
    for (const q of gradeable) {
      const ans = answers[q.id] ?? '';
      const auto = autoScore(q, ans);
      if (auto) {
        qResults[q.id] = auto;
        earned += auto.earned;
      } else {
        qResults[q.id] = {
          earned: 0, maxPoints: q.points, correct: null,
          feedback: needsManualReview(q)
            ? 'Наставникот сè уште нема зачувано точен одговор за ова прашање — потребна е рачна проверка.'
            : 'Потребно дополнително оценување',
        };
      }
      maxPts += q.points;
    }

    // 2a) AI-grade essay/open questions
    const aiQs = gradeable.filter(q => needsAIGrade(q) && q.type !== 'feynman_explain' && q.type !== 'proof_critique' && q.type !== 'geometry_construct');
    if (aiQs.length > 0) {
      setSubmitStatus(`AI оценување (${aiQs.length} есеј одговори)...`);
      for (const q of aiQs) {
        try {
          const grade = await duggaAPI.gradeEssayAnswer({
            question: buildAIGradingQuestionContext(q),
            studentAnswer: answers[q.id] ?? '',
            maxPoints: q.points,
          });
          const match = grade.match(/(\d+)\s*\/\s*\d+/);
          const aiEarned = match ? Math.min(parseInt(match[1]), q.points) : 0;
          qResults[q.id] = { earned: aiEarned, maxPoints: q.points, correct: aiEarned >= q.points * 0.7, feedback: '', aiGrade: grade };
          earned += aiEarned;
        } catch {
          qResults[q.id] = { ...qResults[q.id], feedback: 'AI оценувањето не успеа. Потребна рачна оценка.' };
        }
      }
    }

    // 2b) Feynman-rubric grading
    const feynmanQs = gradeable.filter(q => q.type === 'feynman_explain');
    if (feynmanQs.length > 0) {
      setSubmitStatus(`Феинман оценување (${feynmanQs.length} одговори)...`);
      for (const q of feynmanQs) {
        try {
          const fg = await gradeFeynmanAnswer(
            q.feynmanConcept || q.text,
            answers[q.id] ?? '',
            q.points,
          );
          const pts = feynmanScoreToPoints(fg, q.points);
          qResults[q.id] = {
            earned: pts,
            maxPoints: q.points,
            correct: fg.total >= 70,
            feedback: fg.feedback,
            aiGrade: `Феинман оценка: ${fg.total}/100 (точност ${fg.accuracy}/40 · едноставност ${fg.simplicity}/25 · комплетност ${fg.completeness}/25 · без жаргон ${fg.noJargon}/10)`,
          };
          earned += pts;
        } catch {
          qResults[q.id] = { ...qResults[q.id], feedback: 'Феинман оценувањето не успеа. Потребна рачна оценка.' };
        }
      }
    }

    // 2c) proof_critique grading — deterministic step check + AI reason evaluation
    const critiqueQs = gradeable.filter(q => q.type === 'proof_critique');
    if (critiqueQs.length > 0) {
      setSubmitStatus(`Оценување анализа на доказ (${critiqueQs.length} одговори)...`);
      for (const q of critiqueQs) {
        let parsed: { step?: number; reason?: string } = {};
        try { parsed = JSON.parse(answers[q.id] ?? '{}'); } catch { /* ignore */ }
        const stepPts = parsed.step === q.proofCritiqueErrorStep ? Math.round(q.points * 0.5) : 0;
        let reasonPts = 0;
        const reason = parsed.reason?.trim() ?? '';
        if (reason.length >= 10 && parsed.step !== undefined) {
          try {
            const proofPrompt = `Ученик анализира математички доказ. Погрешниот чекор е: "${(q.proofCritiqueSteps ?? [])[q.proofCritiqueErrorStep ?? -1] ?? '?'}"
Образложение на ученикот: "${reason}"
Оцени го образложението по точност и длабочина. Врати JSON: {"score": 0-50, "feedback": "..."} (50 = совршено, 0 = нема образложение).`;
            const resp = await callGeminiProxy({
              model: DEFAULT_MODEL,
              contents: [{ parts: [{ text: proofPrompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            });
            const g = JSON.parse(resp.text ?? '{"score":0}');
            reasonPts = Math.round((g.score / 50) * q.points * 0.5);
            const total = stepPts + reasonPts;
            qResults[q.id] = {
              earned: total, maxPoints: q.points,
              correct: total >= q.points * 0.7,
              feedback: g.feedback ?? '',
              aiGrade: `Чекор: ${stepPts}/${Math.round(q.points * 0.5)} · Образложение: ${reasonPts}/${Math.round(q.points * 0.5)} · Вкупно: ${total}/${q.points}`,
            };
            earned += total;
          } catch {
            const total = stepPts;
            qResults[q.id] = { earned: total, maxPoints: q.points, correct: null, feedback: 'AI оценувањето не успеа. Потребна рачна оценка.' };
            earned += total;
          }
        } else {
          qResults[q.id] = { earned: stepPts, maxPoints: q.points, correct: stepPts > 0, feedback: stepPts > 0 ? 'Точен чекор!' : 'Погрешен чекор.' };
          earned += stepPts;
        }
      }
    }

    // 2d) geometry_construct — dedicated AI grader (description + rubric), not the generic essay grader
    const geometryQs = gradeable.filter(q => q.type === 'geometry_construct');
    if (geometryQs.length > 0) {
      setSubmitStatus(`Оценување геометриски конструкции (${geometryQs.length} одговори)...`);
      for (const q of geometryQs) {
        try {
          const grade = await duggaAPI.gradeGeometryConstruction({
            question: q.text,
            expectedDescription: q.expectedConstruction?.description ?? '',
            studentNotes: answers[q.id] ?? '',
            rubric: q.expectedConstruction?.rubric,
            maxPoints: q.points,
          });
          const match = grade.match(/(\d+)\s*\/\s*\d+/);
          const aiEarned = match ? Math.min(parseInt(match[1]), q.points) : 0;
          qResults[q.id] = { earned: aiEarned, maxPoints: q.points, correct: aiEarned >= q.points * 0.7, feedback: '', aiGrade: grade };
          earned += aiEarned;
        } catch {
          qResults[q.id] = { earned: 0, maxPoints: q.points, correct: null, feedback: 'AI оценувањето не успеа. Потребна рачна оценка.' };
        }
      }
    }

    // 2e) Points still awaiting manual review (correct === null: either a malformed
    // answer key — see needsManualReview() — or an AI-grading call that failed) must
    // not silently deflate the percentage every student sees. Excluded from the
    // denominator here; a teacher's later manual grade re-includes them (Wave 5.2).
    const pendingPts = gradeable.reduce((sum, q) => sum + (qResults[q.id]?.correct === null ? q.points : 0), 0);
    const gradedMaxPts = maxPts - pendingPts;

    // 3) Save to Firestore (with optional tamper-evident seal in finalExamMode)
    setSubmitStatus('Зачувување...');
    const studentUid = firebaseUser?.uid ?? `anon_${Date.now()}`;
    // Merge QR solution-photo URLs into answers as `{qId}__photo` keys
    const mergedAnswers: Record<string, string> = { ...answers };
    Object.entries(solutionImages).forEach(([qId, url]) => {
      if (url) mergedAnswers[`${qId}__photo`] = url;
    });
    let submissionSeal: string | undefined;
    let submissionSealedAt: string | undefined;
    if (examMode?.sealSubmission) {
      try {
        submissionSeal = await computeSubmissionSeal({
          testId: test.id,
          studentUid,
          answers,
        });
        submissionSealedAt = new Date().toISOString();
      } catch {
        // Sealing failure is non-fatal; the answer payload is still saved.
      }
    }
    try {
      await submitDuggaTest({
        testId: test.id,
        testTitle: test.title,
        teacherUid: test.teacherUid,
        studentUid,
        studentName: studentName.trim() || 'Анонимен ученик',
        answers: mergedAnswers,
        score: earned,
        totalPoints: maxPts,
        percentage: gradedMaxPts > 0 ? Math.round((earned / gradedMaxPts) * 100) : 0,
        pendingReviewPoints: pendingPts,
        questionResults: qResults,
        aiGradeNotes: Object.values(qResults).filter(r => r.aiGrade).map(r => r.aiGrade).join('\n---\n'),
        ...(submissionSeal ? { submissionSeal, submissionSealedAt } : {}),
      });
    } catch {
      // Non-critical
    }

    setResults(qResults);
    setTotalScore(earned);
    setMaxScore(maxPts);
    setPendingReviewPoints(pendingPts);
    setSubmitting(false);
    setPhase('results');
  };

  const gradedMaxScore = maxScore - pendingReviewPoints;
  const pct = gradedMaxScore > 0 ? Math.round((totalScore / gradedMaxScore) * 100) : 0;
  const gradeLabel = pct >= 90 ? 'Одличен (5)' : pct >= 75 ? 'Многу добар (4)' : pct >= 60 ? 'Добар (3)' : pct >= 50 ? 'Задоволителен (2)' : 'Недоволен (1)';
  const answeredCount = test ? test.questions.filter(q => q.type !== 'section_header' && (answers[q.id] ?? '').length > 0).length : 0;
  const totalAnswerable = test ? test.questions.filter(q => q.type !== 'section_header').length : 0;

  // ── Phase: CodeEntry ──────────────────────────────────────────────────────
  if (phase === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Дига Тест</h1>
            <p className="text-gray-500 mt-2">Внеси го кодот за тестот добиен од наставникот</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Код за тест</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') fetchTest(); }}
                maxLength={6}
                placeholder="пр. AB3K7Z"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="w-full text-center text-2xl sm:text-3xl font-mono font-bold tracking-widest uppercase rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none py-4 px-4 transition-all"
              />
            </div>
            <button type="button"
              onClick={() => fetchTest()}
              disabled={loadingTest || code.length < 4}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-3">
              {loadingTest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {loadingTest ? 'Барање...' : 'Влези во тестот'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: NameEntry ──────────────────────────────────────────────────────
  if (phase === 'name' && test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{test.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {test.questions.filter(q => q.type !== 'section_header').length} прашања · {test.totalPoints} поени · ~{test.estimatedMinutes} мин
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Твоето ime и презиме</label>
              <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setPhase('test')}
                placeholder="пр. Ана Петровска"
                className="w-full rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none px-4 py-3 text-sm transition-all" />
            </div>
            {test.description && (
              <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-800 border border-indigo-200">
                {test.description}
              </div>
            )}
            <button type="button" onClick={() => setPhase('test')} disabled={!studentName.trim()}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              Започни го тестот
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Test ───────────────────────────────────────────────────────────
  if (phase === 'test' && test) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* S61-E2 — Visibility pause overlay (final-exam mode only) */}
        {paused && examMode?.pauseOnHidden && (
          <div data-testid="exam-pause-overlay"
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Тестот е паузиран</h2>
              <p className="text-sm text-gray-600">
                Излегувањето од прозорецот не е дозволено за време на завршниот испит.
                Врати се за да продолжиш.
              </p>
              {pauseEvents > 1 && (
                <p className="text-xs text-red-600 font-semibold">
                  Забележани се {pauseEvents} обиди за излез — ова ќе биде пријавено на наставникот.
                </p>
              )}
            </div>
          </div>
        )}
        {examMode?.finalExam && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
            <p className="text-xs font-semibold text-amber-800">
              🔒 Завршен испит: излегувањето од прозорецот ја паузира сесијата.
            </p>
          </div>
        )}
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm truncate">{test.title}</h1>
              <p className="text-xs text-gray-500">{studentName}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-xs text-gray-600 font-medium">
                <span className={answeredCount === totalAnswerable ? 'text-green-600 font-bold' : ''}>
                  {answeredCount}
                </span>/{totalAnswerable} одговорено
              </div>
              <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div role="progressbar" aria-label="Напредок"
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${totalAnswerable > 0 ? (answeredCount / totalAnswerable) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
          {test.questions.map((q, idx) => (
            <QuestionCard key={q.id} q={q} idx={idx} answer={answers[q.id] ?? ''}
              onChange={handleAnswer} result={results[q.id]} showResults={false}
              solutionImageUrl={solutionImages[q.id]}
              onSolutionImage={q.type === 'essay' ? handleSolutionImage : undefined} />
          ))}
        </div>

        {/* Sticky submit bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 pt-4 pb-[max(1rem,_env(safe-area-inset-bottom))] z-20">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              {totalAnswerable - answeredCount > 0
                ? <span className="text-amber-600 font-medium">{totalAnswerable - answeredCount} прашање(а) без одговор</span>
                : <span className="text-green-600 font-medium">Сите прашања одговорени</span>}
            </p>
            <button type="button" onClick={handleSubmit}
              className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg">
              Предај тест
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Submitting ─────────────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl animate-pulse">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Оценување...</h2>
          <p className="text-gray-500 text-sm">{submitStatus}</p>
        </div>
      </div>
    );
  }

  // ── Phase: Results ────────────────────────────────────────────────────────
  if (phase === 'results' && test) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        {/* Score banner */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
          <div className="max-w-2xl mx-auto px-4 py-10 text-center">
            <Award className="w-14 h-14 mx-auto mb-4 opacity-90" />
            <h1 className="text-2xl font-bold mb-1">{test.title}</h1>
            <p className="text-indigo-200 text-sm mb-6">{studentName}</p>
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-5xl font-black">{totalScore}</div>
                <div className="text-indigo-200 text-sm">/ {maxScore} поени</div>
              </div>
              <div className="w-px h-16 bg-white/20" />
              <div>
                <div className="text-5xl font-black">{pct}%</div>
                <div className={`text-base font-bold mt-1 ${pct >= 90 ? 'text-green-300' : pct >= 60 ? 'text-yellow-300' : 'text-red-300'}`}>
                  {gradeLabel}
                </div>
              </div>
            </div>
            {pendingReviewPoints > 0 && (
              <p className="text-xs text-indigo-100/90 mt-4 bg-white/10 inline-block px-3 py-1.5 rounded-full">
                ⏳ {pendingReviewPoints} {pendingReviewPoints === 1 ? 'поен чека' : 'поени чекаат'} рачна проверка од наставникот — процентот погоре е сметан само од веќе оценетите прашања.
              </p>
            )}
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <h2 className="text-base font-bold text-gray-700">Детален преглед</h2>
          {test.questions.map((q, idx) => (
            <QuestionCard key={q.id} q={q} idx={idx} answer={answers[q.id] ?? ''}
              onChange={handleAnswer} result={results[q.id]} showResults={true}
              solutionImageUrl={solutionImages[q.id]} />
          ))}

          {/* Retry button */}
          <div className="pt-4 text-center">
            <button type="button"
              onClick={() => {
                setPhase('code');
                setCode('');
                setTest(null);
                setAnswers({});
                setResults({});
                setTotalScore(0);
                setMaxScore(0);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
              <RotateCcw className="w-4 h-4" />
              Нов тест
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
