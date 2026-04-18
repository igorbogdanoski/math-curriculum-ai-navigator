/**
 * Playwright auth fixture for Firebase Emulator E2E tests (П28).
 *
 * Provides an authenticated `teacherPage` fixture that:
 *  1. Creates a test teacher user in the Auth Emulator via REST (idempotent).
 *  2. Sets window.__E2E_TEACHER_MODE__ before the app boots so AuthContext
 *     skips real Firebase auth (same mechanism used by other E2E helpers).
 *  3. Bypasses onboarding tours via CSS injection.
 *
 * Usage:
 *   import { test, expect } from './fixtures/auth';
 *   test('reaches dashboard', async ({ teacherPage }) => { ... });
 */

import { test as base, expect, type Page } from '@playwright/test';

const EMULATOR_AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';
const EMULATOR_BASE      = `http://${EMULATOR_AUTH_HOST}`;
const EMULATOR_API_KEY   = 'emulator-test-key'; // any string works against the emulator
const TEST_EMAIL         = 'teacher-e2e@test.local';
const TEST_PASSWORD      = 'TestPassword-E2E-123!';

/**
 * Ensure the test teacher user exists in the Auth Emulator.
 * Ignores EMAIL_EXISTS errors so the call is safe to repeat across test runs.
 */
async function ensureEmulatorUser(): Promise<void> {
  try {
    await fetch(
      `${EMULATOR_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${EMULATOR_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, returnSecureToken: false }),
      },
    );
  } catch {
    // Emulator not running — fixture will still work via __E2E_TEACHER_MODE__
  }
}

/** Apply the teacher auth bypass and suppress onboarding tours. */
async function applyTeacherModeInitScript(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // AuthContext reads this flag and injects a mocked TeachingProfile.
    (window as any).__E2E_TEACHER_MODE__ = true;

    // Suppress onboarding / tour overlays via inline style injection.
    const style = document.createElement('style');
    style.textContent = `
      #react-joyride-portal,
      .react-joyride__overlay,
      .react-joyride__spotlight,
      #e2e-onboarding-wizard { display: none !important; }
    `;
    document.documentElement.appendChild(style);
  });
}

type AuthFixtures = {
  /** A page pre-authenticated as a teacher (E2E mock profile). */
  teacherPage: Page;
};

export const test = base.extend<AuthFixtures>({
  teacherPage: async ({ page }, use) => {
    // Attempt to create the emulator user (no-op when emulator is absent).
    await ensureEmulatorUser();
    await applyTeacherModeInitScript(page);
    await use(page);
  },
});

export { expect };
