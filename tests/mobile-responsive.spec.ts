import { test, expect, type Page } from '@playwright/test';

/**
 * S40-M2 — Mobile Responsive Audit
 * ────────────────────────────────
 * Verifies that 5 critical flows render without:
 *   • horizontal overflow (scrollWidth > clientWidth + 4 px tolerance)
 *   • React error boundary fallback (SilentErrorBoundary copy)
 *   • runtime page errors (filtered for known auth/firebase noise)
 *
 * across three viewports:
 *   • iPhone (375 × 812)
 *   • iPad   (768 × 1024)
 *   • Desktop (1440 × 900)
 *
 * Routes are auth-protected — the smoke target is the login surface
 * which must remain usable / readable on every viewport.
 */

const VIEWPORTS = [
  { name: 'iPhone-375',  width: 375,  height: 812  },
  { name: 'iPad-768',    width: 768,  height: 1024 },
  { name: 'Desktop-1440', width: 1440, height: 900  },
] as const;

const FLOWS = [
  { hash: '/',                  label: 'Login surface' },
  { hash: '/#/my-lessons',      label: 'My Lessons (auth-gated)' },
  { hash: '/#/materials',       label: 'Materials Generator (auth-gated)' },
  { hash: '/#/matura',          label: 'Matura Practice (auth-gated)' },
  { hash: '/#/extraction',      label: 'Extraction Hub (auth-gated)' },
] as const;

async function expectNoErrorBoundary(page: Page): Promise<void> {
  const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
  await expect(errorBoundary).not.toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  // Allow 4px tolerance for scrollbar / sub-pixel rounding artefacts.
  const overflow = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const cliW = document.documentElement.clientWidth;
    return docW - cliW;
  });
  expect(overflow, `Horizontal overflow detected: scrollWidth-clientWidth=${overflow}px`).toBeLessThanOrEqual(4);
}

async function expectAppMounted(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test.describe(`Mobile audit @ ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const flow of FLOWS) {
      test(`${flow.label} renders without overflow / crash`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto(flow.hash, { waitUntil: 'domcontentloaded' });
        await expectAppMounted(page);
        // Allow lazy-loaded chunks to settle before measuring layout.
        await page.waitForTimeout(800);

        await expectNoErrorBoundary(page);
        await expectNoHorizontalOverflow(page);

        const critical = errors.filter(e =>
          !e.includes('auth/') &&
          !e.includes('firebase') &&
          !e.includes('ResizeObserver'),
        );
        expect(
          critical,
          `Unexpected JS errors on ${flow.hash} @ ${vp.name}: ${critical.join(' | ')}`,
        ).toHaveLength(0);
      });
    }
  });
}
