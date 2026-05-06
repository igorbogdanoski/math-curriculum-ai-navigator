/**
 * Playwright spec for the AI Vision grading routes (T1.8).
 *
 * Routes covered:
 *   - /#/vision-assessment    AIVisionGraderView (photo → Gemini grading)
 *   - /#/test-review          WrittenTestReviewView
 *
 * Strategy: smoke-level guarantees consistent with the existing playwright
 * conventions — verifies the routes are auth-gated, do not throw, and do not
 * surface SilentErrorBoundary. Mocked photo-upload + rubric assertion is
 * gated on the future authenticated fixture (T2.x).
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

test.describe('Matura AI Vision grading — auth-gated route smoke', () => {
  test('/#/vision-assessment is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/vision-assessment', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors, `Unexpected JS errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('/#/test-review (AI written-test reviewer) is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/test-review', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('navigating between vision routes never produces a React error boundary', async ({ page }) => {
    for (const hash of [
      '/#/vision-assessment',
      '/#/test-review',
      '/#/vision-assessment',
    ]) {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectNoCrash(page);
    }
  });

  test('vision routes do not leak teacher dashboard chrome when unauthenticated', async ({ page }) => {
    await page.goto('/#/vision-assessment', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    // The login form must be the visible UI — sidebar/topbar must not be
    // rendered when unauthenticated.
    const sidebarHeader = page.locator('text=/Главна навигација/i');
    await expect(sidebarHeader).not.toBeVisible();
  });
});
