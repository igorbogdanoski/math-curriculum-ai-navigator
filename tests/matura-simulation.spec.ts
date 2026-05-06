/**
 * Playwright spec for the Matura Simulation route (T1.7).
 *
 * Strategy: smoke-level guarantees that match the existing playwright
 * conventions for new auth-gated views — verifies route registration, lazy
 * boundaries, and that the SilentErrorBoundary fallback never appears.
 *
 * Full 90-min simulation flow (setup → 40 questions → auto-submit) is gated
 * on the future authenticated test fixture; for T1.7 we ship the regression
 * guard that catches any structural regression on the simulation route.
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

test.describe('Matura Simulation — auth-gated route smoke', () => {
  test('/#/matura (90-min simulation) is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors, `Unexpected JS errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('/#/matura-stats analytics route is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-stats', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('/#/matura-assignments student assignment view is auth-gated and does not crash', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    await page.goto('/#/matura-assignments', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('VITE_E2E_FAST_TIMER deep-link does not crash at gate', async ({ page }) => {
    const errors = collectCriticalErrors(page);
    // The simulation respects an env-level fast-timer flag; the route itself
    // must not parse-fail on extra query params.
    await page.goto('/#/matura?fastTimer=1', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
    await expectNoCrash(page);
    expect(errors).toHaveLength(0);
  });

  test('round-trip /#/matura → /#/matura-stats → /#/matura preserves auth gate', async ({ page }) => {
    for (const hash of ['/#/matura', '/#/matura-stats', '/#/matura']) {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectLoginFormVisible(page);
      await expectNoCrash(page);
    }
  });
});
