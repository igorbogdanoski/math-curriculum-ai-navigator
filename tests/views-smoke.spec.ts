import { test, expect, type Page } from '@playwright/test';

/**
 * View Smoke Tests (П14–П16)
 * ───────────────────────────
 * Smoke checks for the three new views shipped in S24/S25:
 *   • SmartOCRView          (#/smart-ocr)
 *   • ExtractionHubView     (#/extraction)
 *   • FlashcardPlayerView   (#/flashcard-player)
 *
 * Strategy: hash routes are auth-protected. Without authentication, the
 * router should keep showing the login form rather than crashing or
 * exposing the protected UI.  This catches regressions in the lazy-loading
 * boundaries, route registration, and SilentErrorBoundary fallbacks.
 */

const expectLoginFormVisible = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15_000 });
};

const expectNoCrash = async (page: Page): Promise<void> => {
  // SilentErrorBoundary fallback copy — must NOT appear on any new view
  const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
  await expect(errorBoundary).not.toBeVisible();
};

test.describe('View Smoke: Smart OCR / Extraction Hub / Flashcard Player', () => {
  const protectedNewRoutes = [
    { hash: '/#/smart-ocr', label: 'Smart OCR' },
    { hash: '/#/extraction', label: 'Extraction Hub' },
    { hash: '/#/flashcard-player', label: 'Flashcard Player' },
  ];

  for (const { hash, label } of protectedNewRoutes) {
    test(`${label} route (${hash}) is auth-gated and does not crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectLoginFormVisible(page);
      await expectNoCrash(page);

      // Filter out known non-critical noise (Firebase auth init, ResizeObserver)
      const critical = errors.filter(e =>
        !e.includes('auth/') &&
        !e.includes('firebase') &&
        !e.includes('ResizeObserver'),
      );
      expect(critical, `Unexpected JS errors on ${hash}: ${critical.join(' | ')}`).toHaveLength(0);
    });
  }

  test('switching between the three new routes never produces a React error boundary', async ({ page }) => {
    for (const { hash } of [
      { hash: '/#/smart-ocr' },
      { hash: '/#/extraction' },
      { hash: '/#/flashcard-player' },
      { hash: '/#/smart-ocr' },
    ]) {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectNoCrash(page);
    }
  });
});
