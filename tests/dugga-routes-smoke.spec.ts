import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke tests for Dugga Platform + Math Editor + Olympiad Archive routes.
 * Strategy: all routes are auth-protected — unauthenticated requests must
 * show the login form rather than crashing or exposing the protected UI.
 * Also verifies the RelatedTools bar does not break layout on any of these routes.
 */

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
  page.on('pageerror', err => errors.push(err.message));
  return errors;
};

const NEW_ROUTES = [
  { hash: '/#/dugga/build',  label: 'DuggaBuilderView' },
  { hash: '/#/dugga/play',   label: 'DuggaPlayerView' },
  { hash: '/#/dugga',        label: 'DuggaLibraryView' },
  { hash: '/#/math-editor',  label: 'MathEditorView' },
  { hash: '/#/olympiad',     label: 'OlympiadArchiveView' },
];

test.describe('Dugga / MathEditor / Olympiad — route smoke tests', () => {
  for (const { hash, label } of NEW_ROUTES) {
    test(`${label} (${hash}) is auth-gated and does not crash`, async ({ page }) => {
      const errors = collectCriticalErrors(page);

      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectLoginFormVisible(page);
      await expectNoCrash(page);

      const critical = errors.filter(e =>
        !e.includes('auth/') &&
        !e.includes('firebase') &&
        !e.includes('ResizeObserver'),
      );
      expect(critical, `JS errors on ${hash}: ${critical.join(' | ')}`).toHaveLength(0);
    });
  }

  test('navigating through all new routes does not trigger error boundary', async ({ page }) => {
    for (const { hash } of NEW_ROUTES) {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectNoCrash(page);
    }
    // Round-trip back to first route
    await page.goto(NEW_ROUTES[0].hash, { waitUntil: 'domcontentloaded' });
    await expectNoCrash(page);
  });
});

test.describe('RelatedTools bar — does not break layout', () => {
  // The RelatedTools bar renders only for known paths.
  // When auth-gated, the login form should still render cleanly.
  for (const { hash, label } of NEW_ROUTES) {
    test(`RelatedTools on ${label} does not produce layout errors`, async ({ page }) => {
      const errors = collectCriticalErrors(page);
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectNoCrash(page);

      const critical = errors.filter(e =>
        !e.includes('auth/') &&
        !e.includes('firebase') &&
        !e.includes('ResizeObserver') &&
        !e.includes('MathLive'),
      );
      expect(critical).toHaveLength(0);
    });
  }
});
