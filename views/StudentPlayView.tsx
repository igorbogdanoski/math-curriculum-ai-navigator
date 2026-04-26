/**
 * StudentPlayView — thin orchestrator for the student quiz experience.
 * Business logic lives in: useStudentIdentity, useStudentQuiz, useQuizSession.
 * UI components: StudentOnboardingWizard, QuizResultPanel.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, Home, User, Users } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { ICONS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useStudentIdentity } from '../hooks/useStudentIdentity';
import { useStudentQuiz } from '../hooks/useStudentQuiz';
import { useQuizSession } from '../hooks/useQuizSession';
import { StudentOnboardingWizard } from '../components/student/StudentOnboardingWizard';
import { QuizResultPanel } from '../components/student/QuizResultPanel';

// Re-export reducer primitives so existing tests (quizSessionReducer.test.ts) keep working
export { quizSessionReducer, QUIZ_SESSION_INITIAL } from '../components/student/quizSessionReducer';
export type { QuizSessionState, QuizSessionAction } from '../components/student/quizSessionReducer';

const InteractiveQuizPlayer = React.lazy(() =>
  import('../components/ai/InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer }))
);

export const StudentPlayView: React.FC = () => {
  const { t } = useLanguage();
  const { getConceptDetails } = useCurriculum();

  // ── URL parsing ──────────────────────────────────────────────────────────────
  const id = (() => {
    const match = window.location.hash.match(/\/play\/([^?/#]+)/);
    return match ? match[1] : undefined;
  })();

  const { sessionId, tid, assignId } = (() => {
    const search = window.location.hash.split('?')[1] ?? '';
    const p = new URLSearchParams(search);
    return { sessionId: p.get('sessionId'), tid: p.get('tid') ?? undefined, assignId: p.get('assignId') ?? undefined };
  })();

  // ── Live session timer — fetched once when joining a live session ─────────────
  const [liveTimerSeconds, setLiveTimerSeconds] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    firestoreService.getLiveSessionById(sessionId).then(s => {
      if (alive && s?.timerPerQuestion != null) setLiveTimerSeconds(s.timerPerQuestion);
    }).catch(() => { /* non-fatal — fall back to default timer */ });
    return () => { alive = false; };
  }, [sessionId]);

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const identity = useStudentIdentity();
  const { quizData, loading, error, usingCachedContent } = useStudentQuiz(id, tid);
  const { session, dispatch, handleQuizComplete, isMountedRef } = useQuizSession({
    quizData,
    quizId: id,
    studentName: identity.studentName,
    deviceId: identity.deviceId,
    classId: identity.classId,
    sessionId,
    assignId,
    getConceptDetails,
  });

  // ── Live session: mark in_progress once quiz + name are ready ────────────────
  const inProgressMarkedRef = useRef(false);
  useEffect(() => {
    if (!quizData || !sessionId || !identity.studentName || !identity.nameConfirmed || inProgressMarkedRef.current) return;
    inProgressMarkedRef.current = true;
    if (!window.__E2E_MODE__) {
      firestoreService.markLiveInProgress(sessionId, identity.studentName).catch(() => {});
    }
  }, [quizData, sessionId, identity.studentName, identity.nameConfirmed]);

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold animate-pulse">{t('play.loadingText')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">{t('play.errorTitle')}</h2>
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

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-black text-xl tracking-tighter uppercase">{t('play.header.portal')}</h1>
        </div>
        <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          МАТЕМАТИЧКИ ПРЕДИЗВИК
        </div>
      </div>

      {/* Main card */}
      <main className="w-full max-w-4xl bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden md:border-8 border-white/20 relative flex flex-col min-h-[60vh] md:min-h-[500px]">

        {/* Onboarding / name entry */}
        {!identity.nameConfirmed && (
          <StudentOnboardingWizard
            wizardStep={identity.wizardStep}
            setWizardStep={identity.setWizardStep}
            nameInput={identity.nameInput}
            setNameInput={identity.setNameInput}
            nameError={identity.nameError}
            handleConfirmName={identity.handleConfirmName}
            classCodeInput={identity.classCodeInput}
            setClassCodeInput={identity.setClassCodeInput}
            classCodeLoading={identity.classCodeLoading}
            classCodeError={identity.classCodeError}
            handleJoinClass={identity.handleJoinClass}
            deviceId={identity.deviceId}
            setStudentName={identity.setStudentName}
            setNameConfirmed={identity.setNameConfirmed}
            setIsReturningStudent={identity.setIsReturningStudent}
            setStudentGoogleUid={identity.setStudentGoogleUid}
          />
        )}

        {/* Quiz player */}
        {identity.nameConfirmed && quizData && (
          <>
            <div className="flex items-center gap-2 px-6 pt-5 pb-0 flex-wrap">
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-700">{identity.studentName}</span>
              </div>
              {identity.isReturningStudent && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                  {t('play.onboarding.welcome_back')}
                </span>
              )}
              <button
                type="button"
                onClick={() => { identity.setNameConfirmed(false); identity.setNameInput(identity.studentName); }}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition"
              >
                {t('play.onboarding.change')}
              </button>
            </div>

            {/* П-Г: IEP accessibility banner */}
            {identity.isIEP && (
              <div className="mx-6 mt-4 flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5">
                <span className="text-lg" aria-hidden="true">🧩</span>
                <p className="text-violet-800 font-bold text-sm">Без ограничување на времето — можеш да работиш со свое темпо.</p>
              </div>
            )}

            {usingCachedContent && (
              <div className="mx-6 mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <span className="text-base" aria-hidden="true">📶</span>
                <p className="text-amber-800 text-xs font-medium">Офлајн режим — квизот се прикажува од локалниот кеш. Резултатите ќе се синхронизираат при повторно поврзување.</p>
              </div>
            )}

            <React.Suspense fallback={
              <div className="p-8 text-center bg-white rounded-3xl m-6 animate-pulse">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-bold">Се вчитува квизот...</p>
              </div>
            }>
              <div className={identity.isIEP ? 'text-lg [&_.quiz-question-text]:text-xl [&_.quiz-option]:text-base [&_.quiz-option]:py-3' : ''}>
                <InteractiveQuizPlayer
                  title={quizData.title || 'Квиз'}
                  questions={(quizData.items || quizData.questions || []).map(item => ({
                    question: item.text || item.question || '',
                    options: item.options || [item.answer, 'Грешка 1', 'Грешка 2', 'Грешка 3'].sort(() => Math.random() - 0.5),
                    answer: item.answer,
                    explanation: item.solution || item.explanation,
                  }))}
                  secondsPerQuestion={identity.isIEP ? undefined : liveTimerSeconds}
                  onComplete={({ score, correctCount, totalQuestions, misconceptions, answers }) => {
                    handleQuizComplete(score, correctCount, totalQuestions, misconceptions, answers);
                  }}
                  onClose={() => { window.location.hash = '/'; }}
                />
              </div>
            </React.Suspense>
          </>
        )}
      </main>

      {/* Post-quiz panels */}
      <QuizResultPanel
        session={session}
        dispatch={dispatch}
        studentName={identity.studentName}
        deviceId={identity.deviceId}
        quizData={quizData}
        studentGoogleUid={identity.studentGoogleUid}
        setStudentGoogleUid={identity.setStudentGoogleUid}
        isMountedRef={isMountedRef}
        getConceptDetails={getConceptDetails}
      />

      <footer className="mt-8 text-white/50 text-xs font-bold uppercase tracking-widest">
        Powered by Math Curriculum AI Navigator
      </footer>
    </div>
  );
};
