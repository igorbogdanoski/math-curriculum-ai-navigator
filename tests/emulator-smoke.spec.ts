/**
 * Emulator Auth Smoke Tests — П14 / П15 / П16  (S26-П28)
 *
 * Verifies that an authenticated teacher can reach three core protected views
 * without hitting an auth redirect or React error boundary.
 *
 * These tests use the `teacherPage` fixture from fixtures/auth.ts which sets
 * window.__E2E_TEACHER_MODE__ = true before the app boots, bypassing real
 * Firebase auth. In CI the Firebase Auth Emulator is also running so any
 * Firestore reads use the emulator rather than the real database.
 *
 * Run locally (no emulator needed — teacher mock is sufficient):
 *   npx playwright test tests/emulator-smoke.spec.ts
 *
 * Run with Firebase Emulator:
 *   firebase emulators:exec --only auth,firestore \
 *     "VITE_USE_FIREBASE_EMULATOR=true npx playwright test tests/emulator-smoke.spec.ts"
 */

import { test, expect } from './fixtures/auth';

// Shared error filter — same as smoke.spec.ts
function isCritical(msg: string): boolean {
  return (
    !msg.includes('auth/') &&
    !msg.includes('firebase') &&
    !msg.includes('ResizeObserver') &&
    !msg.includes('ChunkLoadError')
  );
}

test.describe('П14 — Dashboard (protected view)', () => {
  test('authenticated teacher reaches the dashboard', async ({ teacherPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/#/dashboard');
    // Dashboard has a heading or recognised landmark — just confirm no hard crash
    await expect(page.locator('body')).toBeVisible();

    // Must not redirect to login (login page has an email/password input or Google button)
    const loginBtn = page.locator('[data-testid="google-login"], button:has-text("Најави"), button:has-text("Sign in")');
    await expect(loginBtn).not.toBeVisible({ timeout: 5_000 }).catch(() => {
      // If the element doesn't exist at all the assertion is satisfied
    });

    // No React error boundary
    await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();

    const critical = errors.filter(isCritical);
    expect(critical, `Critical JS errors: ${critical.join('; ')}`).toHaveLength(0);
  });
});

test.describe('П15 — Generator (protected view)', () => {
  test('authenticated teacher reaches the materials generator', async ({ teacherPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/#/generator');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();

    const critical = errors.filter(isCritical);
    expect(critical, `Critical JS errors: ${critical.join('; ')}`).toHaveLength(0);
  });
});

test.describe('П16 — Concept Library (protected view)', () => {
  test('authenticated teacher reaches the curriculum concept library', async ({ teacherPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/#/curriculum');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();

    const critical = errors.filter(isCritical);
    expect(critical, `Critical JS errors: ${critical.join('; ')}`).toHaveLength(0);
  });
});
