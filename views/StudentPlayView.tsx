import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { firestoreService, type ConceptMastery, ACHIEVEMENTS, type StudentGamification } from '../services/firestoreService';
import { geminiService } from '../services/geminiService';
import { doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { ICONS } from '../constants';
import { useCurriculum } from '../hooks/useCurriculum';
import {
  Loader2, AlertCircle, Home, Star, RefreshCw, BookOpen,
  User, ArrowRight, BarChart2, Sparkles, ExternalLink, Trophy,
  Zap, Target, TrendingUp,
} from 'lucide-react';
import { QuestionType, type DifferentiationLevel } from '../types';
import { getAdaptiveLevel } from '../utils/adaptiveDifficulty';
import { validateStudentName } from '../utils/validation';

type QuizResult = { percentage: number; correctCount: number; totalQuestions: number };

export const StudentPlayView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getConceptDetails } = useCurriculum();

  // Live session + teacher-tagging support — read params from URL hash query string
  const { sessionId, tid } = (() => {
    const search = window.location.hash.split('?')[1] ?? '';
    const p = new URLSearchParams(search);
    return { sessionId: p.get('sessionId'), tid: p.get('tid') ?? undefined };
  })();

  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Mastery state — updated after each quiz
  const [masteryUpdate, setMasteryUpdate] = useState<ConceptMastery | null>(null);

  // Gamification state — XP + streak + achievements earned this quiz
  const [gamificationUpdate, setGamificationUpdate] = useState<{
    xpGained: number;
    newAchievements: string[];
    gamification: StudentGamification;
  } | null>(null);

  // Adaptive remediation state
  const [remediaQuizId, setRemediaQuizId] = useState<string | null>(null);
  const [isGeneratingRemedia, setIsGeneratingRemedia] = useState(false);

  // П26 — Self-assessment confidence rating
  const [quizResultDocId, setQuizResultDocId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Student name — persisted in localStorage so they don't re-enter every time
  // Wrapped in try-catch for private/incognito browser windows where localStorage throws
  const [studentName, setStudentName] = useState<string>(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  });
  const [nameConfirmed, setNameConfirmed] = useState<boolean>(() => {
    try { return !!localStorage.getItem('studentName'); } catch { return false; }
  });
  const [nameInput, setNameInput] = useState<string>(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  });
  const [isReturningStudent, setIsReturningStudent] = useState(false);
  // А3: Onboarding wizard — shown only on very first visit (no saved name)
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | null>(() => {
    try { return localStorage.getItem('studentName') ? null : 0; } catch { return null; }
  });

  // А1: Auth re-init — if returning student (nameConfirmed from localStorage) but
  // Firebase session expired (cleared storage/browser restart), re-auth silently.
  useEffect(() => {
    if (!nameConfirmed) return;
    const ensureAuth = async () => {
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch { /* non-fatal */ }
      }
    };
    ensureAuth();
    setIsReturningStudent(true);
  }, [nameConfirmed]);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!id) {
        setError('Невалиден линк за квиз.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const quizDoc = await getDoc(doc(db, 'cached_ai_materials', id));
        if (quizDoc.exists()) {
          const data = quizDoc.data();
          setQuizData({
            ...(data.content || data),
            _meta: {
              conceptId: data.conceptId,
              topicId: data.topicId,
              gradeLevel: data.gradeLevel,
              teacherUid: tid ?? data.teacherUid ?? undefined,
              differentiationLevel: data.differentiationLevel as DifferentiationLevel | undefined,
            },
          });
        } else {
          setError('Квизот не е пронајден. Проверете го линкот со вашиот наставник.');
        }
      } catch (err) {
        console.error('Грешка при вчитување на квизот:', err);
        setError('Проблем со поврзувањето. Проверете ја интернет конекцијата.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  const handleConfirmName = async () => {
    const result = validateStudentName(nameInput);
    if (!result.valid) {
      if (result.error) setError(result.error);
      return;
    }
    setError('');
    const trimmed = nameInput.trim();
    try { localStorage.setItem('studentName', trimmed); } catch { /* incognito */ }
    // Sign in anonymously so Firestore security rules recognise the student as authenticated.
    // If already signed in (teacher or returning student), skip.
    if (!auth.currentUser) {
      try { await signInAnonymously(auth); } catch { /* non-fatal — app works without auth for now */ }
    }
    setStudentName(trimmed);
    setNameConfirmed(true);
  };

  const generateRemediaQuiz = async (meta: { conceptId?: string; topicId?: string; gradeLevel?: number; teacherUid?: string }, percentage: number) => {
    if (!meta.conceptId) return;
    setIsGeneratingRemedia(true);
    try {
      const { grade, topic, concept } = getConceptDetails(meta.conceptId);
      if (!grade || !concept) return;

      const context = {
        type: 'CONCEPT' as const,
        grade,
        topic,
        concepts: [concept],
      };

      const adaptiveLevel: DifferentiationLevel = getAdaptiveLevel(percentage);
      const customInstr = adaptiveLevel === 'support'
        ? 'РЕМЕДИЈАЛНА ВЕЖБА: Поедноставени прашања, чекор-по-чекор упатства, помал вокабулар. Ученикот не ги положи стандардните прашања.'
        : adaptiveLevel === 'advanced'
        ? 'ЗБОГАТУВАЊЕ: Предизвикувачки прашања со критичко размислување, реален контекст и повеќекорачни решенија.'
        : 'ВЕЖБА: Стандардни прашања за дополнително вежбање на концептот.';

      const result = await geminiService.generateAssessment(
        'QUIZ',
        [QuestionType.MULTIPLE_CHOICE],
        6,
        context,
        undefined,
        adaptiveLevel,
        undefined,
        undefined,
        customInstr,
      );

      const newId = await firestoreService.saveRemediaQuiz(result, {
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        sourceQuizId: id,
      }, meta.teacherUid);
      if (newId) setRemediaQuizId(newId);
    } catch (err) {
      console.error('Грешка при генерирање следен квиз:', err);
    } finally {
      setIsGeneratingRemedia(false);
    }
  };

  const handleQuizComplete = async (score: number, correctCount: number, totalQuestions: number) => {
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const meta = quizData._meta || {};

    // 1. Save quiz result
    let savedDocId = '';
    try {
      savedDocId = await firestoreService.saveQuizResult({
        quizId: id || 'unknown',
        quizTitle: quizData.title || 'Квиз',
        score,
        correctCount,
        totalQuestions,
        percentage,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        studentName: studentName || undefined,
        teacherUid: meta.teacherUid,
        differentiationLevel: meta.differentiationLevel,
      });
      setQuizResultDocId(savedDocId);
    } catch (err) {
      console.error('[Quiz] saveQuizResult failed:', err);
    }

    // 2. Update concept mastery — use returned value directly (not state snapshot)
    let freshMastery: ConceptMastery | null = null;
    if (studentName && meta.conceptId) {
      try {
        const { concept } = getConceptDetails(meta.conceptId);
        freshMastery = await firestoreService.updateConceptMastery(
          studentName,
          meta.conceptId,
          percentage,
          {
            conceptTitle: concept?.title ?? quizData.title,
            topicId: meta.topicId,
            gradeLevel: meta.gradeLevel,
          },
          meta.teacherUid
        );
        setMasteryUpdate(freshMastery);
      } catch (err) {
        console.error('[Quiz] updateConceptMastery failed:', err);
      }
    }

    setQuizResult({ percentage, correctCount, totalQuestions });

    // 3. Gamification — use freshMastery (not masteryUpdate state — old snapshot!)
    if (studentName) {
      const justMastered = !!(freshMastery?.mastered && freshMastery.consecutiveHighScores === 3);
      const totalMastered = freshMastery?.mastered ? 1 : 0;
      firestoreService.updateStudentGamification(studentName, percentage, justMastered, totalMastered, meta.teacherUid)
        .then(({ xpGained, newAchievements, gamification }) => {
          setGamificationUpdate({ xpGained, newAchievements, gamification });
        })
        .catch(err => console.warn('[Gamification] update failed:', err));
    }

    // 4. Submit live response if this quiz is part of a live session
    if (sessionId && studentName) {
      firestoreService.submitLiveResponse(sessionId, studentName, percentage)
        .catch(err => console.warn('[Live] submitLiveResponse failed:', err));
    }

    // 5. Adaptive next quiz (all scores — level depends on percentage)
    generateRemediaQuiz(meta, percentage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold animate-pulse">Се подготвува квизот...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Грешка!</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => { window.location.hash = '/'; }}
            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold mx-auto hover:bg-black transition"
          >
            <Home className="w-5 h-5" /> Назад кон почетна
          </button>
        </div>
      </div>
    );
  }

  const passed = quizResult && quizResult.percentage >= 70;
  const resultCardClass = passed
    ? 'w-full max-w-4xl mt-6 rounded-2xl p-5 border-2 animate-fade-in bg-green-50 border-green-300'
    : 'w-full max-w-4xl mt-6 rounded-2xl p-5 border-2 animate-fade-in bg-amber-50 border-amber-300';

  // Mastery milestone badges
  const justMastered = masteryUpdate?.mastered && masteryUpdate.consecutiveHighScores === 3;
  const consecutive = masteryUpdate?.consecutiveHighScores ?? 0;

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-black text-xl tracking-tighter uppercase">Ученички Портал</h1>
        </div>
        <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          МАТЕМАТИЧКИ ПРЕДИЗВИК
        </div>
      </div>

      <main className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white/20 relative min-h-[500px]">
        {/* ── Name entry / Onboarding ── */}
        {!nameConfirmed && (
          <div className="flex flex-col items-center justify-center min-h-[500px] p-8 text-center">

            {/* А3: First-time onboarding wizard (wizardStep 0 and 1) */}
            {wizardStep === 0 && (
              <div className="animate-fade-in max-w-sm">
                <div className="flex justify-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                    <Target className="w-7 h-7 text-violet-600" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-7 h-7 text-emerald-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-3">Добредојде во<br/>Математички Портал!</h2>
                <div className="space-y-3 text-left mb-8">
                  <div className="flex items-start gap-3 bg-indigo-50 rounded-2xl p-3">
                    <Zap className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Одговарај на прашања</p>
                      <p className="text-slate-500 text-xs">Квизови прилагодени на твоето ниво</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-violet-50 rounded-2xl p-3">
                    <Target className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Освојувај XP и значки</p>
                      <p className="text-slate-500 text-xs">Редови, достигнувања и напредок</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-emerald-50 rounded-2xl p-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Следи го твојот напредок</p>
                      <p className="text-slate-500 text-xs">Гледај ги сите твои резултати на едно место</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition"
                >
                  Да почнеме! <ArrowRight className="w-5 h-5" />
                </button>
                <div className="flex justify-center gap-1.5 mt-4">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="animate-fade-in max-w-sm w-full">
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6 mx-auto">
                  <User className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Как се викаш?</h2>
                <p className="text-slate-500 mb-6 text-sm">
                  Твоето ime се чува само за да го следиме твојот напредок. Никој друг не може да го гледа.
                </p>
                <input
                  type="text"
                  placeholder="Твоето ime и презиме..."
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) { setWizardStep(null); handleConfirmName(); } }}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setWizardStep(null); handleConfirmName(); }}
                  disabled={!nameInput.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Потврди <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(0)}
                  className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition"
                >
                  ← Назад
                </button>
                <div className="flex justify-center gap-1.5 mt-4">
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                </div>
              </div>
            )}

            {/* Returning user or "Промени" — simple form (no wizard) */}
            {wizardStep === null && (
              <div className="animate-fade-in max-w-sm w-full">
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6 mx-auto">
                  <User className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Промени ime</h2>
                <p className="text-slate-500 mb-8 max-w-sm text-sm">
                  Внеси го твоето ime за да го зачуваме твојот резултат.
                </p>
                <input
                  type="text"
                  placeholder="Твоето ime и презиме..."
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmName(); }}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleConfirmName}
                  disabled={!nameInput.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Почни Квизот <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quiz */}
        {nameConfirmed && quizData && (
          <>
            <div className="flex items-center gap-2 px-6 pt-5 pb-0 flex-wrap">
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-700">{studentName}</span>
              </div>
              {isReturningStudent && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                  👋 Добредојде назад!
                </span>
              )}
              <button
                type="button"
                onClick={() => { setNameConfirmed(false); setNameInput(studentName); }}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition"
              >
                Промени
              </button>
            </div>
            <InteractiveQuizPlayer
              title={quizData.title || 'Квиз'}
              questions={(quizData.items || quizData.questions || []).map((item: any) => ({
                question: item.text || item.question,
                options: item.options || [item.answer, 'Грешка 1', 'Грешка 2', 'Грешка 3'].sort(() => Math.random() - 0.5),
                answer: item.answer,
                explanation: item.solution || item.explanation,
              }))}
              onComplete={({ score, correctCount, totalQuestions }) => {
                handleQuizComplete(score, correctCount, totalQuestions);
              }}
              onClose={() => { window.location.hash = '/'; }}
            />
          </>
        )}
      </main>

      {/* Mastery milestone banner */}
      {justMastered && (
        <div className="w-full max-w-4xl mt-4 bg-yellow-400 rounded-2xl p-4 flex items-center gap-3 animate-fade-in shadow-lg">
          <Trophy className="w-8 h-8 text-yellow-900 flex-shrink-0" fill="currentColor" />
          <div>
            <p className="font-black text-yellow-900 text-lg">Концептот е СОВЛАДАН! 🏆</p>
            <p className="text-yellow-800 text-sm">
              Го постигна 85%+ три пати по ред. Кажи му на твојот наставник — ова е голем успех!
            </p>
          </div>
        </div>
      )}

      {/* Streak badge (non-mastery) */}
      {!justMastered && consecutive > 0 && passed && (
        <div className="w-full max-w-4xl mt-4 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-300" fill="currentColor" />
<p className="text-white text-sm font-bold">
            Одличен резултат {consecutive} пат{consecutive === 1 ? '' : 'и'} по ред
            {consecutive < 3 ? ` — уште ${3 - consecutive} за да го совладаш концептот!` : ''}
          </p>
        </div>
      )}

      {quizResult && (
        <div className={resultCardClass}>
          {passed ? (
            <div className="flex items-start gap-4">
              <Star className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />
              <div>
                <p className="font-black text-green-800 text-lg">
                  Одличен резултат! {quizResult.correctCount} / {quizResult.totalQuestions} точни
                </p>
                <p className="text-green-700 text-sm mt-1">
                  Браво{studentName ? `, ${studentName}` : ''}! Ги совладавте прашањата одлично. Кажи му на твојот наставник за резултатот.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => { window.location.hash = '/my-progress'; }}
                    className="flex items-center gap-2 text-xs font-bold bg-green-200 text-green-900 px-4 py-2 rounded-xl hover:bg-green-300 transition"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    Погледни го мојот прогрес
                  </button>
                  {isGeneratingRemedia && (
                    <div className="flex items-center gap-2 text-xs font-bold text-green-700 px-3 py-2">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      AI подготвува предизвик...
                    </div>
                  )}
                  {remediaQuizId && !isGeneratingRemedia && (
                    <button
                      type="button"
                      onClick={() => { window.location.hash = `/play/${remediaQuizId}`; window.location.reload(); }}
                      className="flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      🚀 Предизвик (напредни прашања)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <BookOpen className="w-8 h-8 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-amber-800 text-lg">
                  Не се откажуј! {quizResult.correctCount} / {quizResult.totalQuestions} точни
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  {quizResult.percentage < 60
                    ? 'Подготвуваме полесни прашања специјално за тебе...'
                    : 'Уште малку вежба за да го совладаш концептот...'}
                </p>

                {isGeneratingRemedia && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    AI подготвува следен квиз за тебе...
                  </div>
                )}
                {remediaQuizId && !isGeneratingRemedia && (
                  <button
                    type="button"
                    onClick={() => { window.location.hash = `/play/${remediaQuizId}`; window.location.reload(); }}
                    className="mt-3 flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {quizResult.percentage < 60 ? '📘 Поддршка (полесни прашања)' : '📖 Вежбај повторно'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setQuizResult(null); setRemediaQuizId(null); setMasteryUpdate(null); setGamificationUpdate(null); setConfidence(null); setQuizResultDocId(null); }}
                  className="mt-2 flex items-center gap-2 text-xs font-bold bg-amber-200 text-amber-900 px-4 py-2 rounded-xl hover:bg-amber-300 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Обиди се повторно
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── П26: Confidence Self-Assessment ───────────────────────────────── */}
      {quizResult && (
        <div className="w-full max-w-lg mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm text-center">
          <p className="text-white font-bold text-sm mb-3">Колку сигурен/сигурна се осеќаш за овој концепт?</p>
          <div className="flex justify-center gap-3">
            {(['😟','😐','🙂','😊','🤩'] as const).map((emoji, i) => {
              const rating = i + 1;
              const isSelected = confidence === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => {
                    setConfidence(rating);
                    if (quizResultDocId) firestoreService.updateQuizConfidence(quizResultDocId, rating);
                  }}
                  className={`text-2xl w-12 h-12 rounded-xl transition-all ${isSelected ? 'bg-white/30 scale-125 ring-2 ring-white' : 'hover:bg-white/20 hover:scale-110'}`}
                  title={`${rating}/5`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          {confidence && (
            <p className="text-white/70 text-xs mt-2">Зачувано! Благодарам за твојот одговор. ✓</p>
          )}
        </div>
      )}

      {/* ── Gamification: XP + Streak + New Achievements ─────────────────── */}
      {gamificationUpdate && quizResult && (
        <div className="w-full max-w-lg mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="font-black text-white text-sm">+{gamificationUpdate.xpGained} XP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base">🔥</span>
              <span className="text-white font-bold text-sm">{gamificationUpdate.gamification.currentStreak} {gamificationUpdate.gamification.currentStreak === 1 ? 'ден' : 'дена'} по ред</span>
            </div>
            <div className="text-white/60 text-xs font-semibold">
              {gamificationUpdate.gamification.totalXP} XP вкупно
            </div>
          </div>
          {gamificationUpdate.newAchievements.length > 0 && (
            <div className="border-t border-white/20 pt-3">
              <p className="text-white/80 text-xs font-bold mb-2">Ново достигнување!</p>
              <div className="flex flex-wrap gap-2">
                {gamificationUpdate.newAchievements.map(id => {
                  const a = ACHIEVEMENTS[id];
                  return a ? (
                    <span key={id} className="flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/40 text-yellow-200 text-xs font-bold px-2.5 py-1 rounded-full">
                      {a.icon} {a.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="mt-8 text-white/50 text-xs font-bold uppercase tracking-widest">
        Powered by Math Curriculum AI Navigator
      </footer>
    </div>
  );
};
