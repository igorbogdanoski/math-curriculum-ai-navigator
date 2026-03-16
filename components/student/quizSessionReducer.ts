/**
 * Quiz session reducer — extracted from StudentPlayView for testability.
 * Pure TypeScript (no React) — safe to import in unit tests without mocks.
 */
import type { ConceptMastery, StudentGamification } from '../../services/firestoreService';
import type { AdaptiveHomework } from '../../types';

export type QuizResult = {
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  misconceptions?: { question: string; studentAnswer: string; misconception: string }[];
};

export type QuizItem = {
  text?: string;
  question?: string;
  options?: string[];
  answer: string;
  solution?: string;
  explanation?: string;
};

export type QuizPlayData = {
  title?: string;
  questions?: QuizItem[];
  items?: QuizItem[];
  _meta: {
    conceptId?: string;
    topicId?: string;
    gradeLevel?: number;
    teacherUid?: string;
    differentiationLevel?: string;
    [key: string]: unknown;
  };
};

export type GamificationUpdate = {
  xpGained: number;
  newAchievements: string[];
  gamification: StudentGamification;
};

export type QuizSessionState = {
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

export type QuizSessionAction =
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
