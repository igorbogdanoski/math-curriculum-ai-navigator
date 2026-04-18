import { test, expect, type Page } from '@playwright/test';

/**
 * Visual Regression Tests (П24, Sprint S26)
 * ─────────────────────────────────────────
 * Pixel-stable snapshots of the unauthenticated entry render for the 5
 * key route hashes. All routes are auth-gated, so the renderer settles on
 * the same login form — the snapshot therefore catches regressions in:
 *
 *   • redirect-to-login behaviour for protected routes
 *   • login form layout / typography / chrome
 *   • global background, header, and route-aware surface chrome
 *
 * When П28 (Firebase Emulator auth fixture) lands, additional `test.use`
 * blocks here will sign in and capture authenticated baselines.
 *
 * Tolerance:  maxDiffPixelRatio 0.02 (2 %) absorbs sub-pixel font rendering
 *             noise across machines without hiding real layout regressions.
 *
 * Re-baseline:  npx playwright test tests/visual-regression.spec.ts --update-snapshots
 */

const ROUTES = [
  { hash: '/#/login', label: 'Login' },
  { hash: '/#/matura', label: 'MaturaPortal' },
  { hash: '/#/library', label: 'ContentLibrary' },
  { hash: '/#/flashcard-player', label: 'FlashcardPlayer' },
  { hash: '/#/extraction', label: 'ExtractionHub' },
] as const;

const VIEWPORT = { width: 1280, height: 800 };

const settle = async (page: Page): Promise<void> => {
  // Wait for the auth-gated app shell to land on the login form.
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  // Disable CSS animations + caret blink so screenshots are deterministic.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      input { caret-color: transparent !important; }
    `,
  });
  // Tiny RAF tick for layout to settle after style injection.
  await page.waitForTimeout(150);
};

test.describe('Visual Regression: 5 key views (auth-gated baseline)', () => {
  test.use({ viewport: VIEWPORT });

  for (const { hash, label } of ROUTES) {
    test(`${label} — pixel-stable login render at ${hash}`, async ({ page }) => {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await settle(page);

      await expect(page).toHaveScreenshot(`${label}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
        // Mask out elements that may legitimately render text differently
        // across runs (e.g. live build hashes or i18n-driven copy).
        mask: [page.locator('[data-testid="build-version"]')],
      });
    });
  }
});
