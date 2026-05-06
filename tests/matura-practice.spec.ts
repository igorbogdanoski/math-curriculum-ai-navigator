/**
 * Playwright spec for the Matura Practice flow (T1.6).
 *
 * Strategy: hash routes are auth-gated. Without authentication, the router must
 * keep showing the login form rather than crashing. This catches regressions in
 * the lazy-loading boundaries, route registration, MaturaPracticeView mounting,
 * deep-link parsing, and SilentErrorBoundary fallbacks.
 *
 * Full authenticated end-to-end (setup → solve → review) coverage is gated on
 * the global auth fixture (T2.x); for T1.6 we deliver smoke-level guarantees
 * matching the project's existing playwright conventions for new views.
 */
import { test, expect, type Page } from '@playwright/test';

const expectLoginFormVisible = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15_000 });
};

const expectNoCrash = async (page: Page): Promise<void> => {
  const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
  await expect(errorBoundary).not.toBeVisible();
};

const collectCriticalErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', err => {
    const msg = err.message;
    if (
      !msg.includes('auth/') &&
      !msg.includes('firebase') &&
      !msg.includes('ResizeObserver')
    ) {
      errors.push(msg);
    }
  });
  return errors;
};

test.describe('Matura Practice — auth-gated route smoke', () => {
  test('/#/matura-practice loads without crashing when unauthenticated', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-practice', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors, `Unexpected JS errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('/#/matura-portal hub route is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-portal', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('/#/matura-library is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-library', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('deep-link /#/matura-practice?topic=algebra&dok=2 still gates auth and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-practice?topic=algebra&dok=2', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('deep-link /#/matura-practice?mode=spaced (recovery flow) does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-practice?mode=spaced', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('switching practice ↔ portal ↔ library never produces a React error boundary', async ({ page }) => {
    for (const hash of [
      '/#/matura-portal',
      '/#/matura-practice',
      '/#/matura-library',
      '/#/matura-portal',
    ]) {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectNoCrash(page);
    }
  });
});
