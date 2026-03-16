/**
 * Global type declarations for runtime-injected properties.
 * E2E test flags set by Playwright before page load (see tests/helpers.ts).
 */
interface Window {
  /** Set to true by Playwright to enable E2E mode (bypasses Firestore, uses mocks) */
  __E2E_MODE__?: boolean;
  /** Set to true by Playwright to enable teacher-side E2E mode */
  __E2E_TEACHER_MODE__?: boolean;
  /** Mock quiz results injected by Playwright for analytics tests */
  __E2E_MOCK_QUIZ_RESULTS__?: import('./services/firestoreService.types').QuizResult[];
  /** Mock mastery data injected by Playwright */
  __E2E_MOCK_MASTERY__?: import('./services/firestoreService.types').ConceptMastery[];
  /** When true, only load quizzes from IndexedDB cache (no Firestore read) */
  __E2E_USE_CACHE_ONLY__?: boolean;
  /** Mock quiz content injected by Playwright */
  __E2E_MOCK_QUIZ_CONTENT__?: Record<string, unknown>;
}
