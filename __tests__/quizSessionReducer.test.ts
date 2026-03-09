/**
 * Unit tests for quizSessionReducer (StudentPlayView).
 * Heavy module deps (Firebase, hooks) are mocked so only the pure
 * reducer logic is exercised.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks — must be at top level before any imports that trigger Firebase
// ---------------------------------------------------------------------------
vi.mock('../firebaseConfig', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
}));
vi.mock('firebase/auth', () => ({ signInAnonymously: vi.fn() }));
vi.mock('../services/firestoreService', () => ({
  firestoreService: {},
  ACHIEVEMENTS: {},
}));
vi.mock('../services/geminiService', () => ({ geminiService: {} }));
vi.mock('../hooks/useCurriculum', () => ({ useCurriculum: vi.fn() }));
vi.mock('../i18n/LanguageContext', () => ({ useLanguage: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: vi.fn(() => ({ id: 'test-id' })) }));
vi.mock('../utils/studentIdentity', () => ({ getOrCreateDeviceId: vi.fn(() => 'device-123') }));
vi.mock('../utils/dailyQuests', () => ({ markQuestComplete: vi.fn() }));
vi.mock('../components/materials/PrintableHomework', () => ({ PrintableHomework: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------
import { quizSessionReducer, QUIZ_SESSION_INITIAL } from '../views/StudentPlayView';
import type { QuizResult } from '../services/firestoreService.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeQuizResult = (overrides: Partial<QuizResult> = {}): QuizResult => ({
  teacherUid: 'teacher-1',
  studentName: 'Марија',
  quizId: 'q1',
  quizTitle: 'Делење',
  grade: '6',
  percentage: 80,
  correctCount: 8,
  totalQuestions: 10,
  answers: [],
  playedAt: null as any,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('quizSessionReducer', () => {

  it('starts with the correct initial state', () => {
    const state = QUIZ_SESSION_INITIAL;
    expect(state.quizResult).toBeNull();
    expect(state.isFeedbackLoading).toBe(false);
    expect(state.homeworkError).toBe(false);
    expect(state.metacognitiveNote).toBe('');
    expect(state.peerSuggestions).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // QUIZ_COMPLETE
  // -------------------------------------------------------------------------
  describe('QUIZ_COMPLETE', () => {
    it('sets quizResult and docId atomically', () => {
      const result = makeQuizResult();
      const next = quizSessionReducer(QUIZ_SESSION_INITIAL, {
        type: 'QUIZ_COMPLETE',
        quizResult: result,
        docId: 'doc-abc',
        mastery: null,
        metacognitivePrompt: 'Како се чувствуваш?',
      });
      expect(next.quizResult).toEqual(result);
      expect(next.quizResultDocId).toBe('doc-abc');
      expect(next.masteryUpdate).toBeNull();
      expect(next.metacognitivePrompt).toBe('Како се чувствуваш?');
    });

    it('sets isFeedbackLoading to true immediately', () => {
      const next = quizSessionReducer(QUIZ_SESSION_INITIAL, {
        type: 'QUIZ_COMPLETE',
        quizResult: makeQuizResult(),
        docId: 'doc-abc',
        mastery: null,
        metacognitivePrompt: '',
      });
      expect(next.isFeedbackLoading).toBe(true);
    });

    it('resets all other session fields to initial on new quiz completion', () => {
      // Start with some dirty state
      const dirtyState = {
        ...QUIZ_SESSION_INITIAL,
        aiFeedback: 'Some old feedback',
        confidence: 4,
        metacognitiveNote: 'Old note',
        homeworkError: true,
        peerSuggestions: ['Peer A', 'Peer B'],
      };
      const next = quizSessionReducer(dirtyState, {
        type: 'QUIZ_COMPLETE',
        quizResult: makeQuizResult(),
        docId: 'new-doc',
        mastery: null,
        metacognitivePrompt: '',
      });
      expect(next.aiFeedback).toBeNull();
      expect(next.confidence).toBeNull();
      expect(next.metacognitiveNote).toBe('');
      expect(next.homeworkError).toBe(false);
      expect(next.peerSuggestions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // SET_AI_FEEDBACK
  // -------------------------------------------------------------------------
  describe('SET_AI_FEEDBACK', () => {
    it('sets feedback and clears loading flag', () => {
      const loading = { ...QUIZ_SESSION_INITIAL, isFeedbackLoading: true };
      const next = quizSessionReducer(loading, { type: 'SET_AI_FEEDBACK', feedback: 'Одличен резултат!' });
      expect(next.aiFeedback).toBe('Одличен резултат!');
      expect(next.isFeedbackLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // SET_CONFIDENCE
  // -------------------------------------------------------------------------
  describe('SET_CONFIDENCE', () => {
    it('stores confidence rating', () => {
      const next = quizSessionReducer(QUIZ_SESSION_INITIAL, { type: 'SET_CONFIDENCE', confidence: 3 });
      expect(next.confidence).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // SET_METACOGNITIVE_NOTE / SET_METACOGNITIVE_SAVED
  // -------------------------------------------------------------------------
  describe('metacognitive note flow', () => {
    it('updates the note on each keystroke', () => {
      let state = quizSessionReducer(QUIZ_SESSION_INITIAL, { type: 'SET_METACOGNITIVE_NOTE', note: 'Научив' });
      expect(state.metacognitiveNote).toBe('Научив');
      state = quizSessionReducer(state, { type: 'SET_METACOGNITIVE_NOTE', note: 'Научив нешто ново.' });
      expect(state.metacognitiveNote).toBe('Научив нешто ново.');
    });

    it('marks saved after submission', () => {
      let state = quizSessionReducer(QUIZ_SESSION_INITIAL, { type: 'SET_METACOGNITIVE_NOTE', note: 'Note' });
      state = quizSessionReducer(state, { type: 'SET_METACOGNITIVE_SAVED' });
      expect(state.metacognitiveSaved).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // HOMEWORK lifecycle
  // -------------------------------------------------------------------------
  describe('homework lifecycle', () => {
    it('sets loading on HOMEWORK_LOADING', () => {
      const next = quizSessionReducer(QUIZ_SESSION_INITIAL, { type: 'HOMEWORK_LOADING' });
      expect(next.isHomeworkLoading).toBe(true);
      expect(next.homeworkError).toBe(false);
    });

    it('sets homework on HOMEWORK_SUCCESS and clears loading', () => {
      const hw = { title: 'Домашна', exercises: [], level: 'standard' as any, conceptTitle: 'A' };
      const loading = { ...QUIZ_SESSION_INITIAL, isHomeworkLoading: true };
      const next = quizSessionReducer(loading, { type: 'HOMEWORK_SUCCESS', homework: hw });
      expect(next.homework).toEqual(hw);
      expect(next.isHomeworkLoading).toBe(false);
    });

    it('sets homeworkError on HOMEWORK_ERROR and clears loading', () => {
      const loading = { ...QUIZ_SESSION_INITIAL, isHomeworkLoading: true };
      const next = quizSessionReducer(loading, { type: 'HOMEWORK_ERROR' });
      expect(next.homeworkError).toBe(true);
      expect(next.isHomeworkLoading).toBe(false);
    });

    it('clears homework on CLOSE_HOMEWORK', () => {
      const hw = { title: 'Домашна', exercises: [], level: 'standard' as any, conceptTitle: 'A' };
      const withHw = { ...QUIZ_SESSION_INITIAL, homework: hw };
      const next = quizSessionReducer(withHw, { type: 'CLOSE_HOMEWORK' });
      expect(next.homework).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // RETRY — the critical "start over" action
  // -------------------------------------------------------------------------
  describe('RETRY', () => {
    it('resets all session state to initial', () => {
      const dirty = {
        ...QUIZ_SESSION_INITIAL,
        quizResult: makeQuizResult(),
        aiFeedback: 'feedback',
        confidence: 5,
        homeworkError: true,
        metacognitiveNote: 'some note',
        peerSuggestions: ['A'],
        isGeneratingRemedia: true,
      };
      const next = quizSessionReducer(dirty, { type: 'RETRY' });
      expect(next).toEqual(QUIZ_SESSION_INITIAL);
    });
  });

  // -------------------------------------------------------------------------
  // SET_PEER_SUGGESTIONS
  // -------------------------------------------------------------------------
  it('stores peer suggestions', () => {
    const peers = ['Peer A работи на ова', 'Peer B може да помогне'];
    const next = quizSessionReducer(QUIZ_SESSION_INITIAL, { type: 'SET_PEER_SUGGESTIONS', peers });
    expect(next.peerSuggestions).toEqual(peers);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  it('handles QUIZ_COMPLETE with zero totalQuestions (no division-by-zero risk)', () => {
    const result = makeQuizResult({ totalQuestions: 0, correctCount: 0, percentage: 0 });
    const next = quizSessionReducer(QUIZ_SESSION_INITIAL, {
      type: 'QUIZ_COMPLETE',
      quizResult: result,
      docId: 'doc-zero',
      mastery: null,
      metacognitivePrompt: '',
    });
    expect(next.quizResult?.percentage).toBe(0);
    expect(next.quizResultDocId).toBe('doc-zero');
  });
});
