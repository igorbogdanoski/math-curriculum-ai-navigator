import React, { useEffect, useRef, useState, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { firestoreService, type ConceptMastery, ACHIEVEMENTS, type StudentGamification } from '../services/firestoreService';

const InteractiveQuizPlayer = React.lazy(() => import('../components/ai/InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer })));
import { geminiService } from '../services/geminiService';
import { doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { ICONS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurriculum } from '../hooks/useCurriculum';
import {
  Loader2, AlertCircle, Home, Star, RefreshCw, BookOpen,
  User, Users, ArrowRight, BarChart2, Sparkles, ExternalLink, Trophy,
  Zap, Target, TrendingUp, MessageSquare, Send,
} from 'lucide-react';
import { QuestionType, type DifferentiationLevel, type AdaptiveHomework } from '../types';
import { PrintableHomework } from '../components/materials/PrintableHomework';
import { getAdaptiveLevel } from '../utils/adaptiveDifficulty';
import { validateStudentName } from '../utils/validation';
import { markQuestComplete } from '../utils/dailyQuests';
import { calcFibonacciLevel, getAvatar } from '../utils/gamification';
import { getOrCreateDeviceId } from '../utils/studentIdentity';
import { SaveProgressModal } from '../components/student/SaveProgressModal';
import { RestoreProgressModal } from '../components/student/RestoreProgressModal';

type QuizResult = { percentage: number; correctCount: number; totalQuestions: number; misconceptions?: { question: string; studentAnswer: string; misconception: string }[] };

type QuizItem = { text?: string; question?: string; options?: string[]; answer: string; solution?: string; explanation?: string };
type QuizPlayData = {
  title?: string;
  questions?: QuizItem[];
  items?: QuizItem[];
  _meta: { conceptId?: string; topicId?: string; gradeLevel?: number; teacherUid?: string; [key: string]: unknown };
};

// ── Quiz session state (all post-quiz fields that reset together on RETRY) ──────

type GamificationUpdate = {
  xpGained: number;
  newAchievements: string[];
  gamification: StudentGamification;
};

type QuizSessionState = {
  quizResult: QuizResult | null;
  masteryUpdate: ConceptMastery | null;
  gamificationUpdate: GamificationUpdate | null;
  remediaQuizId: string | null;
  isGeneratingRemedia: boolean;
  quizResultDocId: string | null;
  confidence: number | null;
  aiFeedback: string | null;
  isFeedbackLoading: boolean;
  metacognitivePrompt: string | null;
  metacognitiveNote: string;
  metacognitiveSaved: boolean;
  peerSuggestions: string[];
  homework: AdaptiveHomework | null;
  isHomeworkLoading: boolean;
  homeworkError: boolean;
};

type QuizSessionAction =
  | { type: 'QUIZ_COMPLETE'; quizResult: QuizResult; docId: string; mastery: ConceptMastery | null; metacognitivePrompt: string }
  | { type: 'SET_CONFIDENCE'; confidence: number }
  | { type: 'SET_AI_FEEDBACK'; feedback: string }
  | { type: 'SET_FEEDBACK_LOADING'; loading: boolean }
  | { type: 'SET_GAMIFICATION'; update: GamificationUpdate }
  | { type: 'SET_METACOGNITIVE_NOTE'; note: string }
  | { type: 'SET_METACOGNITIVE_SAVED' }
  | { type: 'SET_PEER_SUGGESTIONS'; peers: string[] }
  | { type: 'SET_REMEDIA_QUIZ'; quizId: string }
  | { type: 'SET_GENERATING_REMEDIA'; loading: boolean }
  | { type: 'HOMEWORK_LOADING' }
  | { type: 'HOMEWORK_SUCCESS'; homework: AdaptiveHomework }
  | { type: 'HOMEWORK_ERROR' }
  | { type: 'CLOSE_HOMEWORK' }
  | { type: 'RETRY' };

export const QUIZ_SESSION_INITIAL: QuizSessionState = {
  quizResult: null,
  masteryUpdate: null,
  gamificationUpdate: null,
  remediaQuizId: null,
  isGeneratingRemedia: false,
  quizResultDocId: null,
  confidence: null,
  aiFeedback: null,
  isFeedbackLoading: false,
  metacognitivePrompt: null,
  metacognitiveNote: '',
  metacognitiveSaved: false,
  peerSuggestions: [],
  homework: null,
  isHomeworkLoading: false,
  homeworkError: false,
};

export function quizSessionReducer(state: QuizSessionState, action: QuizSessionAction): QuizSessionState {
  switch (action.type) {
    case 'QUIZ_COMPLETE':
      return { ...QUIZ_SESSION_INITIAL, quizResult: action.quizResult, quizResultDocId: action.docId, masteryUpdate: action.mastery, metacognitivePrompt: action.metacognitivePrompt, isFeedbackLoading: true };
    case 'SET_CONFIDENCE':
      return { ...state, confidence: action.confidence };
    case 'SET_AI_FEEDBACK':
      return { ...state, aiFeedback: action.feedback, isFeedbackLoading: false };
    case 'SET_FEEDBACK_LOADING':
      return { ...state, isFeedbackLoading: action.loading };
    case 'SET_GAMIFICATION':
      return { ...state, gamificationUpdate: action.update };
    case 'SET_METACOGNITIVE_NOTE':
      return { ...state, metacognitiveNote: action.note };
    case 'SET_METACOGNITIVE_SAVED':
      return { ...state, metacognitiveSaved: true };
    case 'SET_PEER_SUGGESTIONS':
      return { ...state, peerSuggestions: action.peers };
    case 'SET_REMEDIA_QUIZ':
      return { ...state, remediaQuizId: action.quizId };
    case 'SET_GENERATING_REMEDIA':
      return { ...state, isGeneratingRemedia: action.loading };
    case 'HOMEWORK_LOADING':
      return { ...state, isHomeworkLoading: true, homeworkError: false };
    case 'HOMEWORK_SUCCESS':
      return { ...state, homework: action.homework, isHomeworkLoading: false };
    case 'HOMEWORK_ERROR':
      return { ...state, homeworkError: true, isHomeworkLoading: false };
    case 'CLOSE_HOMEWORK':
      return { ...state, homework: null };
    case 'RETRY':
      return QUIZ_SESSION_INITIAL;
    default:
      return state;
  }
}

export const StudentPlayView: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { getConceptDetails } = useCurriculum();

  // Live session + teacher-tagging support — read params from URL hash query string
  const { sessionId, tid, assignId } = (() => {
    const search = window.location.hash.split('?')[1] ?? '';
    const p = new URLSearchParams(search);
    return { sessionId: p.get('sessionId'), tid: p.get('tid') ?? undefined, assignId: p.get('assignId') ?? undefined };
  })();

  const [quizData, setQuizData] = useState<QuizPlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, dispatch] = useReducer(quizSessionReducer, QUIZ_SESSION_INITIAL);
  const { quizResult, masteryUpdate, gamificationUpdate, remediaQuizId, isGeneratingRemedia, quizResultDocId, confidence, aiFeedback, isFeedbackLoading, metacognitivePrompt, metacognitiveNote, metacognitiveSaved, peerSuggestions, homework, isHomeworkLoading, homeworkError } = session;

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

  // И2: Class membership — loaded from localStorage, synced to Firestore via join code
  const [classId, setClassId] = useState<string | null>(() => {
    try { return localStorage.getItem('student_class_id'); } catch { return null; }
  });
  const [classCodeInput, setClassCodeInput] = useState('');
  const [classCodeLoading, setClassCodeLoading] = useState(false);
  const [classCodeError, setClassCodeError] = useState('');

  // Ж1: device-bound identity — created once per device, persists in localStorage
  const deviceId = getOrCreateDeviceId();

  // С1: Google UID ако ученикот веќе се логирал со Google (persistent акаунт)
  const [studentGoogleUid, setStudentGoogleUid] = useState<string | null>(() => {
    try { return localStorage.getItem('student_google_uid'); } catch { return null; }
  });

  // Live session: mark in_progress as soon as the quiz loads (once per session join)
  const inProgressMarkedRef = useRef(false);

  // Guard async state updates after component unmount (e.g. gamification .then())
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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

  // А1: If no name in localStorage, try to restore from Firestore student_identity by deviceId.
  // This covers: localStorage cleared, incognito→normal, new browser profile on same device.
  useEffect(() => {
    if (nameConfirmed) return; // already have a name — skip
    let cancelled = false;
    const restoreIdentity = async () => {
      try {
        await signInAnonymously(auth); // need auth to read the doc
        if (cancelled) return;
        const identity = await firestoreService.fetchStudentIdentityByDevice(deviceId);
        if (cancelled) return;
        if (identity?.name) {
          try { localStorage.setItem('studentName', identity.name); } catch { /* incognito */ }
          setNameInput(identity.name);
          setStudentName(identity.name);
          setNameConfirmed(true);
          setIsReturningStudent(true);
          setWizardStep(null);
        }
      } catch { /* non-fatal — student just enters their name manually */ }
    };
    restoreIdentity();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const fetchQuiz = async () => {
      if (!id) {
        if (!cancelled) { setError(t('play.error.invalidLink')); setLoading(false); }
        return;
      }
      try {
        setLoading(true);
        const quizDoc = await getDoc(doc(db, 'cached_ai_materials', id));
        if (cancelled) return;
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
          setError(t('play.error.notFound'));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Грешка при вчитување на квизот:', err);
          setError(t('play.error.connect'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchQuiz();
    return () => { cancelled = true; };
  }, [id]);

  // Mark student as in_progress in the live session the moment the quiz content is ready
  useEffect(() => {
    if (!quizData || !sessionId || !studentName || !nameConfirmed || inProgressMarkedRef.current) return;
    inProgressMarkedRef.current = true;
    firestoreService.markLiveInProgress(sessionId, studentName).catch(() => {});
  }, [quizData, sessionId, studentName, nameConfirmed]);

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
    // А1: Persist identity to Firestore so the same name is restored on any session reset
    const uid = auth.currentUser?.uid;
    if (uid) {
      firestoreService.saveStudentIdentity(deviceId, trimmed, uid).catch(() => { /* non-fatal */ });
    }
  };

  const generateRemediaQuiz = async (meta: { conceptId?: string; topicId?: string; gradeLevel?: number; teacherUid?: string }, percentage: number) => {
    if (!meta.conceptId) return;
    dispatch({ type: 'SET_GENERATING_REMEDIA', loading: true });
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
      if (newId) dispatch({ type: 'SET_REMEDIA_QUIZ', quizId: newId });
    } catch (err) {
      console.error('Грешка при генерирање следен квиз:', err);
    } finally {
      dispatch({ type: 'SET_GENERATING_REMEDIA', loading: false });
    }
  };

  const handleQuizComplete = async (score: number, correctCount: number, totalQuestions: number, misconceptions?: { question: string; studentAnswer: string; misconception: string }[]) => {
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const meta = quizData!._meta || {};

    // 1. Save quiz result
    let savedDocId = '';
    try {
      savedDocId = await firestoreService.saveQuizResult({
        quizId: id || 'unknown',
        quizTitle: quizData!.title || 'Квиз',
        score,
        correctCount,
        totalQuestions,
        percentage,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        studentName: studentName || undefined,
        teacherUid: meta.teacherUid,
        deviceId,
        differentiationLevel: meta.differentiationLevel as DifferentiationLevel | undefined,
        misconceptions,
        classId: classId || undefined,
      });
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
            conceptTitle: concept?.title ?? quizData!.title,
            topicId: meta.topicId,
            gradeLevel: meta.gradeLevel,
          },
          meta.teacherUid,
          deviceId,
        );
      } catch (err) {
        console.error('[Quiz] updateConceptMastery failed:', err);
      }
    }

    // П1 + П4 — Пресметај conceptTitle прво (користи се и за промпт и за AI feedback)
    const conceptTitleForPrompt: string = (() => {
      if (meta.conceptId) {
        const { concept } = getConceptDetails(meta.conceptId);
        return concept?.title ?? quizData?.title ?? 'концептот';
      }
      return quizData?.title ?? 'концептот';
    })();

    // П4 — Одбери metacognitive промпт врз основа на резултат и концепт
    const lowPrompts = [
      `Со кое прашање од „${conceptTitleForPrompt}" имаше најмногу тешкотии?`,
      `Што точно ти беше тешко кај „${conceptTitleForPrompt}"?`,
      `Кој дел од „${conceptTitleForPrompt}" не го разбираш добро?`,
    ];
    const highPrompts = [
      `Со свои зборови, објасни го „${conceptTitleForPrompt}".`,
      `Кај кое прашање од „${conceptTitleForPrompt}" требаше најмногу да размислуваш?`,
      `Кој дел од „${conceptTitleForPrompt}" ти е сега најјасен?`,
    ];
    const midPrompts = [
      `Што би сакал/а уште да вежбаш кај „${conceptTitleForPrompt}"?`,
      `Кое прашање те изненади кај „${conceptTitleForPrompt}"?`,
      `Напиши едно прашање за „${conceptTitleForPrompt}" за кое сè уште не знаеш одговор.`,
    ];
    const pool = percentage >= 80 ? highPrompts : percentage < 60 ? lowPrompts : midPrompts;
    const chosenPrompt = pool[Math.floor(Math.random() * pool.length)];

    // Dispatch QUIZ_COMPLETE — sets quizResult, docId, mastery, metacognitivePrompt, isFeedbackLoading=true atomically
    dispatch({ type: 'QUIZ_COMPLETE', quizResult: { percentage, correctCount, totalQuestions, misconceptions }, docId: savedDocId, mastery: freshMastery, metacognitivePrompt: chosenPrompt });

    // П1 — Генерирај AI повратна информација асинхроно (не блокира)
    if (meta.conceptId) {
      const conceptTitle = conceptTitleForPrompt;
      geminiService.generateQuizFeedback(
        studentName || 'Ученик',
        percentage,
        conceptTitle,
        correctCount,
        totalQuestions,
        misconceptions,
      ).then(feedback => {
        if (isMountedRef.current) dispatch({ type: 'SET_AI_FEEDBACK', feedback });
      }).catch(() => {
        if (isMountedRef.current) dispatch({ type: 'SET_FEEDBACK_LOADING', loading: false });
      });
    }

    // 2b. Mark assignment as completed (if arrived from an assignment link)
    if (assignId && studentName) {
      firestoreService.markAssignmentCompleted(assignId, studentName).catch(() => {});
    }

    // 2c. Mark daily quest complete if this concept was a quest for today
    if (studentName && meta.conceptId) {
      markQuestComplete(studentName, meta.conceptId);
    }

    // 3. Gamification — use freshMastery (not masteryUpdate state — old snapshot!)
    if (studentName) {
      const justMastered = !!(freshMastery?.mastered && freshMastery.consecutiveHighScores === 3);
      // Count ALL mastered concepts (not just the current one) for milestone achievements
      const allMastery = await firestoreService.fetchMasteryByStudent(studentName, deviceId).catch(() => []);
      if (!isMountedRef.current) return;
      const totalMastered = allMastery.filter(m => m.mastered).length;
      firestoreService.updateStudentGamification(studentName, percentage, justMastered, totalMastered, meta.teacherUid, deviceId)
        .then(({ xpGained, newAchievements, gamification }) => {
          if (isMountedRef.current) dispatch({ type: 'SET_GAMIFICATION', update: { xpGained, newAchievements, gamification } });
        })
        .catch(err => console.warn('[Gamification] update failed:', err));
    }

    // 3b. Spaced Repetition — update SM-2 record after every quiz attempt
    if (meta.conceptId && deviceId) {
      firestoreService.updateSpacedRepRecord(deviceId, meta.conceptId, percentage)
        .catch(err => console.warn('[SM-2] updateSpacedRepRecord failed:', err));
    }

    // 4. Submit live response if this quiz is part of a live session
    if (sessionId && studentName) {
      firestoreService.submitLiveResponse(sessionId, studentName, percentage)
        .catch(err => console.warn('[Live] submitLiveResponse failed:', err));
    }

    // П5 — Peer Learning: Ако резултатот е послаб, најди другари кои го совладале концептот
    if (percentage < 85 && meta.conceptId) {
      firestoreService.fetchMasteryByConcept(meta.conceptId, meta.teacherUid)
        .then(masteries => {
          const peers = masteries
            .filter(m => m.mastered && m.studentName !== studentName)
            .map(m => m.studentName);
          const uniquePeers = Array.from(new Set(peers));
          const selected = uniquePeers.sort(() => 0.5 - Math.random()).slice(0, 2);
          if (isMountedRef.current && selected.length > 0) {
            dispatch({ type: 'SET_PEER_SUGGESTIONS', peers: selected });
          }
        })
        .catch(err => console.warn('[Peer Learning] failed:', err));
    }

    // 5. Adaptive next quiz (all scores — level depends on percentage)
    generateRemediaQuiz(meta, percentage);
  };

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
          <h1 className="font-black text-xl tracking-tighter uppercase">{t('play.header.portal')}</h1>
        </div>
        <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          МАТЕМАТИЧКИ ПРЕДИЗВИК
        </div>
      </div>

      <main className="w-full max-w-4xl bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden md:border-8 border-white/20 relative flex flex-col min-h-[60vh] md:min-h-[500px]">
        {/* ── Name entry / Onboarding ── */}
        {!nameConfirmed && (
          <div className="flex flex-col items-center justify-center flex-1 p-6 md:p-8 text-center min-h-[60vh] md:min-h-[500px]">

            {/* А3: First-time onboarding wizard (wizardStep 0 and 1) */}
            {wizardStep === 0 && (
              <div className="animate-fade-in w-full max-w-sm">
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
                <h2 className="text-2xl font-black text-slate-800 mb-3">{t('play.onboarding.step1.title')}<br/>{t('play.onboarding.step1.subtitle')}</h2>
                <div className="space-y-3 text-left mb-8">
                  <div className="flex items-start gap-3 bg-indigo-50 rounded-2xl p-3">
                    <Zap className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t('play.onboarding.step1.opt1.title')}</p>
                      <p className="text-slate-500 text-xs">{t('play.onboarding.step1.opt1.desc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-violet-50 rounded-2xl p-3">
                    <Target className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t('play.onboarding.step1.opt2.title')}</p>
                      <p className="text-slate-500 text-xs">{t('play.onboarding.step1.opt2.desc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-emerald-50 rounded-2xl p-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t('play.onboarding.step1.opt3.title')}</p>
                      <p className="text-slate-500 text-xs">{t('play.onboarding.step1.opt3.desc')}</p>
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
                <h2 className="text-2xl font-black text-slate-800 mb-2">{t('play.onboarding.whats_your_name')}</h2>
                <p className="text-slate-500 mb-6 text-sm px-2">
                  {t('play.onboarding.name_privacy')}
                </p>
                <div className="px-2">
                  <input
                    type="text"
                    placeholder={t('play.onboarding.name_placeholder')}
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) { handleConfirmName(); setWizardStep(2); } }}
                    className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 md:py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4 min-h-[56px] md:min-h-[auto]"
                  />
                  <button
                    type="button"
                    onClick={() => { handleConfirmName(); setWizardStep(2); }}
                    disabled={!nameInput.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 md:py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[56px] md:min-h-[auto]"
                  >
                    {t('play.onboarding.confirm')} <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(0)}
                    className="mt-4 pb-2 text-sm text-slate-400 hover:text-slate-600 transition min-h-[44px]"
                  >
                    {t('play.onboarding.back')}
                  </button>
                </div>
                {/* С1: Врати напредок од Google акаунт */}
                <RestoreProgressModal
                  deviceId={deviceId}
                  onRestored={(restoredName, uid) => {
                    setStudentName(restoredName);
                    setNameInput(restoredName);
                    setNameConfirmed(true);
                    setIsReturningStudent(true);
                    setWizardStep(null);
                    setStudentGoogleUid(uid);
                  }}
                />
                <div className="flex justify-center gap-1.5 mt-4">
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                </div>
              </div>
            )}

            {/* И2: Step 2 — Optional class join code */}
            {wizardStep === 2 && (
              <div className="animate-fade-in max-w-sm w-full px-2">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 mx-auto">
                  <span className="text-4xl">🏫</span>
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">Во кое одделение си?</h2>
                <p className="text-slate-500 mb-6 text-sm text-center px-2">
                  Ако наставникот ти дал код на одделение, внеси го тука. Можеш и да прескокнеш.
                </p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Код на одделение (пр. AB12CD)"
                    value={classCodeInput}
                    onChange={e => { setClassCodeInput(e.target.value.trim().toUpperCase()); setClassCodeError(''); }}
                    maxLength={8}
                    className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 text-slate-800 font-mono font-bold text-center text-lg tracking-widest focus:outline-none focus:border-green-500 transition"
                  />
                  {classCodeError && (
                    <p className="text-xs text-red-500 text-center">{classCodeError}</p>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!classCodeInput.trim()) { setWizardStep(null); return; }
                      setClassCodeLoading(true);
                      setClassCodeError('');
                      try {
                        const cls = await firestoreService.joinClassByCode(classCodeInput.trim(), deviceId, studentName);
                        if (!cls) {
                          setClassCodeError('Кодот не е пронајден. Провери го кодот или прескокни.');
                        } else {
                          setClassId(cls.id);
                          try { localStorage.setItem('student_class_id', cls.id); } catch { /* incognito */ }
                          setWizardStep(null);
                        }
                      } catch {
                        setClassCodeError('Грешка при поврзување. Обиди се повторно.');
                      } finally {
                        setClassCodeLoading(false);
                      }
                    }}
                    disabled={classCodeLoading}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 px-6 rounded-2xl font-black text-lg hover:bg-green-700 transition disabled:opacity-40"
                  >
                    {classCodeLoading ? '⏳ Се поврзувам...' : 'Приклучи се кон одделението'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(null)}
                    className="w-full py-3 text-sm text-slate-400 hover:text-slate-600 transition"
                  >
                    Прескокни — продолжи без код
                  </button>
                </div>
                <div className="flex justify-center gap-1.5 mt-6">
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              </div>
            )}

            {/* Returning user or "Промени" — simple form (no wizard) */}
            {wizardStep === null && (
              <div className="animate-fade-in max-w-sm w-full px-2">
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6 mx-auto">
                  <User className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">{t('play.onboarding.change_name_title')}</h2>
                <p className="text-slate-500 mb-8 max-w-sm text-sm">
                  {t('play.onboarding.change_name_desc')}
                </p>
                <input
                  type="text"
                  placeholder={t('play.onboarding.name_placeholder')}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) handleConfirmName(); }}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 md:py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4 min-h-[56px] md:min-h-[auto]"
                />
                <button
                  type="button"
                  onClick={handleConfirmName}
                  disabled={!nameInput.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 md:py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[56px] md:min-h-[auto]"
                >
                  {t('play.onboarding.start_quiz')} <ArrowRight className="w-5 h-5" />
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
                {t('play.onboarding.welcome_back')}
                </span>
              )}
              <button
                type="button"
                onClick={() => { setNameConfirmed(false); setNameInput(studentName); }}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition"
              >
                {t('play.onboarding.change')}
              </button>
            </div>
            <React.Suspense fallback={<div className="p-8 text-center bg-white rounded-3xl m-6 animate-pulse"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-500 font-bold">Се вчитува квизот...</p></div>}>
              <InteractiveQuizPlayer
                title={quizData.title || 'Квиз'}
                questions={(quizData.items || quizData.questions || []).map((item: QuizItem) => ({
                  question: item.text || item.question || '',
                  options: item.options || [item.answer, 'Грешка 1', 'Грешка 2', 'Грешка 3'].sort(() => Math.random() - 0.5),                                                                                 
                  answer: item.answer,
                  explanation: item.solution || item.explanation,
                }))}
                onComplete={({ score, correctCount, totalQuestions, misconceptions }) => {      
                  handleQuizComplete(score, correctCount, totalQuestions, misconceptions);      
                }}
                onClose={() => { window.location.hash = '/'; }}
              />
            </React.Suspense>
          </>
        )}
      </main>

      {/* Mastery milestone banner */}
      {justMastered && (
        <div className="w-full max-w-4xl mt-4 bg-yellow-400 rounded-2xl p-4 flex items-center gap-3 animate-fade-in shadow-lg">
          <Trophy className="w-8 h-8 text-yellow-900 flex-shrink-0" fill="currentColor" />
          <div>
            <p className="font-black text-yellow-900 text-lg">{t('play.result.mastered')}</p>
            <p className="text-yellow-800 text-sm">
              {t('play.result.masteredDesc')}
            </p>
          </div>
        </div>
      )}

      {/* Streak badge (non-mastery) */}
      {!justMastered && consecutive > 0 && passed && (
        <div className="w-full max-w-4xl mt-4 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-300" fill="currentColor" />
<p className="text-white text-sm font-bold">
            {t('play.result.consecutive1')} {consecutive} {t('play.result.consecutive2')}
            {consecutive < 3 ? `${t('play.result.consecutive3')} ${3 - consecutive} ${t('play.result.consecutive4')}` : ''}
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
                  {t('play.result.great')} {quizResult.correctCount} / {quizResult.totalQuestions} {t('play.result.correct')}
                </p>
                <p className="text-green-700 text-sm mt-1">
                  {t('play.result.bravo')}{studentName ? `, ${studentName}` : ''}{t('play.result.bravoDesc')}
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
                    ? t('play.tryAgin.descLow')
                    : t('play.tryAgin.descMid')}
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
                    {quizResult.percentage < 60 ? t('play.tryAgin.buttonLow') : t('play.tryAgin.buttonMid')}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RETRY' })}
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

      {/* ── П1: AI персонализирана повратна информација ─────────────────── */}
      {quizResult && (isFeedbackLoading || aiFeedback) && (
        <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <p className="text-white font-bold text-sm">Повратна информација</p>
          </div>
          {isFeedbackLoading ? (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI анализира...</span>
            </div>
          ) : (
            <p className="text-white/90 text-sm leading-relaxed">{aiFeedback || 'Продолжи со вежбање — секој обид те прави подобар!'}</p>
          )}
        </div>
      )}

      {/* ── П5: Peer Learning ────────────────────────────────────────── */}
        {quizResult && peerSuggestions.length > 0 && (
          <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-emerald-300" />
              <p className="text-white font-bold text-sm">Побарај помош од другарче</p>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">
              Ова веќе го совладаа: <strong className="text-emerald-300">{peerSuggestions.join(', ')}</strong>. Можеш да ги замолиш да ти помогнат и објаснат.
            </p>
          </div>
        )}

        {/* ── П26: Confidence Self-Assessment ───────────────────────────────── */}
      {quizResult && (
        <div className="w-full max-w-lg mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm text-center">
          <p className="text-white font-bold text-sm mb-3">{t('play.confidence.title')}</p>
          <div className="flex justify-center gap-3">
            {(['😟','😐','🙂','😊','🤩'] as const).map((emoji, i) => {
              const rating = i + 1;
              const isSelected = confidence === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_CONFIDENCE', confidence: rating });
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
            <p className="text-white/70 text-xs mt-2">{t('play.confidence.saved')}</p>
          )}
        </div>
      )}

      {/* ── П4: Metacognitive промпт ─────────────────────────────────────── */}
      {quizResult && metacognitivePrompt && (
        <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-sky-300" />
            <p className="text-white font-bold text-sm">Размисли за своето учење</p>
            <span className="ml-auto text-white/40 text-xs">опционално</span>
          </div>
          <p className="text-white/80 text-sm mb-2 italic">„{metacognitivePrompt}"</p>
          {!metacognitiveSaved ? (
            <div className="flex gap-2">
              <textarea
                value={metacognitiveNote}
                onChange={e => dispatch({ type: 'SET_METACOGNITIVE_NOTE', note: e.target.value })}
                placeholder="Напиши го твојот одговор тука..."
                rows={2}
                maxLength={300}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-white/40"
              />
              <button
                type="button"
                disabled={!metacognitiveNote.trim() || !quizResultDocId}
                onClick={() => {
                  if (!quizResultDocId || !metacognitiveNote.trim()) return;
                  firestoreService.updateQuizMetacognitiveNote(quizResultDocId, metacognitiveNote);
                  dispatch({ type: 'SET_METACOGNITIVE_SAVED' });
                }}
                className="flex items-center justify-center w-10 h-10 mt-auto bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title="Зачувај"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-sky-300 text-xs font-semibold flex items-center gap-1">
              ✓ Зачувано — наставникот ќе ги види твоите размислувања.
            </p>
          )}
        </div>
      )}

      {/* ── Г1: Адаптивна домашна задача ─────────────────────────────────── */}
      {quizResult && !homework && (
        <div className="w-full max-w-4xl mt-3 space-y-1">
          <button
            type="button"
            disabled={isHomeworkLoading}
            onClick={async () => {
              if (!quizData) return;
              dispatch({ type: 'HOMEWORK_LOADING' });
              const cid = quizData._meta.conceptId;
              const cTitle = cid ? (getConceptDetails(cid).concept?.title ?? quizData.title ?? 'концептот') : (quizData.title ?? 'концептот');
              try {
                const result = await geminiService.generateAdaptiveHomework(
                  cTitle,
                  quizData._meta.gradeLevel ?? 6,
                  quizResult.percentage,
                  quizResult.misconceptions,
                );
                if (isMountedRef.current) dispatch({ type: 'HOMEWORK_SUCCESS', homework: result });
              } catch (err) {
                console.warn('[Homework] generateAdaptiveHomework failed:', err);
                if (isMountedRef.current) dispatch({ type: 'HOMEWORK_ERROR' });
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold text-sm py-3 rounded-2xl transition disabled:opacity-50"
          >
            {isHomeworkLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Генерирам домашна задача...</>
            ) : (
              <><BookOpen className="w-4 h-4" /> Генерирај домашна задача (PDF)</>
            )}
          </button>
          {homeworkError && (
            <p className="text-red-300 text-xs text-center">Грешка при генерирање — обиди се повторно.</p>
          )}
        </div>
      )}
      {quizResult && homework && (
        <PrintableHomework
          homework={homework}
          studentName={studentName || 'Ученик'}
          onClose={() => dispatch({ type: 'CLOSE_HOMEWORK' })}
        />
      )}

      {/* ── Gamification: XP + Avatar + Streak + New Achievements ──────────── */}
      {gamificationUpdate && quizResult && (() => {
        const totalXP = gamificationUpdate.gamification.totalXP;
        const newLvl = calcFibonacciLevel(totalXP);
        const oldLvl = calcFibonacciLevel(totalXP - gamificationUpdate.xpGained);
        const leveledUp = newLvl.level > oldLvl.level;
        const avatar = getAvatar(newLvl.level);
        return (
          <div className="w-full max-w-lg mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
            {/* Avatar + XP row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl select-none">{avatar.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-black text-white text-sm">{avatar.title}</span>
                  <span className="text-white/60 text-xs font-semibold">{t('play.level')}{newLvl.level}</span>
                  {leveledUp && (
                    <span className="text-xs font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full animate-bounce">
                      ⬆️ Level Up!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-xs font-semibold">+{gamificationUpdate.xpGained} XP</span>
                  <span className="text-white/50 text-xs">{totalXP} {t('play.totalXP')}</span>
                </div>
                {/* XP progress bar */}
                <div className="w-full bg-white/20 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${newLvl.progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-base">🔥</span>
                <span className="text-white font-bold text-sm">{gamificationUpdate.gamification.currentStreak}</span>
              </div>
            </div>
            {gamificationUpdate.newAchievements.length > 0 && (
              <div className="border-t border-white/20 pt-3">
                <p className="text-white/80 text-xs font-bold mb-2">{t('play.newAchievement')}</p>
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
        );
      })()}

      {/* С1: Зачувај напредок со Google — прикажи само ако квизот е завршен и нема Google акаунт */}
      {quizResult && !studentGoogleUid && (
        <div className="w-full max-w-lg">
          <SaveProgressModal
            studentName={studentName || 'Ученик'}
            deviceId={deviceId}
            onSaved={(uid) => setStudentGoogleUid(uid)}
          />
        </div>
      )}

      <footer className="mt-8 text-white/50 text-xs font-bold uppercase tracking-widest">
        Powered by Math Curriculum AI Navigator
      </footer>
    </div>
  );
};
