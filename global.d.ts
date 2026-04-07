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
  /** Mock class list injected by Playwright for teacher flows */
  __E2E_MOCK_CLASSES__?: import('./services/firestoreService.types').SchoolClass[];
  /** Captured assignment payloads injected/read by Playwright teacher tests */
  __E2E_ASSIGNMENT_WRITES__?: Array<Omit<import('./services/firestoreService.types').Assignment, 'id' | 'createdAt'>>;
  /** When true, only load quizzes from IndexedDB cache (no Firestore read) */
  __E2E_USE_CACHE_ONLY__?: boolean;
  /** Mock quiz content injected by Playwright */
  __E2E_MOCK_QUIZ_CONTENT__?: Record<string, unknown>;

  // Third-party libraries loaded via CDN script tags
  /** GeoGebra applet constructor — loaded from deployggb.js */
  GGBApplet?: new (params: Record<string, unknown>, html5codebase: boolean) => { inject(id: string): void };
  /** GeoGebra applet instance exposed globally after inject */
  ggbApplet?: { getBase64?(anim: boolean): string };
  /** Desmos graphing calculator API */
  Desmos?: { GraphingCalculator(el: HTMLElement, opts?: Record<string, unknown>): { screenshot(opts?: Record<string, unknown>): string; destroy(): void } };
  /** KaTeX math typesetting library — loaded via CDN script tag */
  katex?: { renderToString(latex: string, options?: { output?: string; throwOnError?: boolean; displayMode?: boolean; strict?: boolean | string; trust?: boolean }): string };
}
