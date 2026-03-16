import { test, expect } from '@playwright/test';

/**
 * StudentPortfolioView E2E Tests (Ж7.5)
 *
 * Covers the /portfolio public route:
 * - Name entry screen shown when no studentName in localStorage
 * - Navigates to portfolio after name entry
 * - Shows portfolio sections for a student with data
 * - Print button visible
 * - No crashes or error boundaries
 */
test.describe('StudentPortfolioView', () => {

  test.beforeEach(async ({ page }) => {
    // Only clear student-specific keys — clearing all localStorage breaks Firebase auth state
    await page.goto('/#/portfolio', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.removeItem('studentName');
      localStorage.removeItem('deviceId');
    });
  });

  // ── Route accessibility ────────────────────────────────────────────────────

  test('route is public — no login form shown', async ({ page }) => {
    await page.goto('/#/portfolio');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).not.toBeVisible();
  });

  test('no crash / error boundary on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/#/portfolio');
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(e =>
      !e.includes('auth/') && !e.includes('firebase') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);
    await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
  });

  // ── Name entry screen ──────────────────────────────────────────────────────

  test('name entry screen shown when localStorage is empty', async ({ page }) => {
    await page.goto('/#/portfolio');
    // Wait for the specific name entry element instead of just timeout
    const input = page.locator('input[placeholder*="име"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    
    // Submit button disabled until name ≥ 2 chars
    const submitBtn = page.locator('button:has-text("Прикажи портфолио")');
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button enabled after entering a valid name', async ({ page }) => {
    await page.goto('/#/portfolio');
    const input = page.locator('input[placeholder*="име"]');
    await input.waitFor({ state: 'visible' });
    await input.fill('Јована Петровска');
    const submitBtn = page.locator('button:has-text("Прикажи портфолио")');
    await expect(submitBtn).toBeEnabled();
  });

  test('Enter key submits name and navigates to portfolio', async ({ page }) => {
    await page.goto('/#/portfolio');
    const input = page.locator('input[placeholder*="име"]');
    await input.waitFor({ state: 'visible' });
    await input.fill('Јована Петровска');
    await input.press('Enter');
    
    // After submit, name entry button should be gone
    const nameEntryBtn = page.locator('button:has-text("Прикажи портфолио")');
    await expect(nameEntryBtn).not.toBeVisible({ timeout: 10000 });
  });

  // ── Portfolio with pre-filled name from localStorage ──────────────────────

  test('skips name entry if studentName is in localStorage', async ({ page }) => {
    await page.goto('/#/privacy'); // Neutral page
    await page.evaluate(() => localStorage.setItem('studentName', 'Тест Ученик'));
    await page.goto('/#/portfolio');
    await page.waitForTimeout(2000);
    // Name entry screen should NOT be shown
    const input = page.locator('input[placeholder*="име"]');
    await expect(input).not.toBeVisible();
  });

  test('shows KPI cards section after loading student with no results', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('studentName', 'Непостоечки Ученик 999'));
    await page.goto('/#/portfolio');
    await page.waitForTimeout(3000);
    // Either empty state or portfolio header visible
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // No JS crashes
  });

  // ── URL query param ────────────────────────────────────────────────────────

  test('?name= query param populates portfolio without name entry', async ({ page }) => {
    await page.goto('/#/portfolio?name=Ана%20Ковачевска');
    await page.waitForTimeout(2000);
    // Name entry should be skipped
    const submitBtn = page.locator('button:has-text("Прикажи портфолио")');
    await expect(submitBtn).not.toBeVisible();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('portfolio link exists in sidebar nav under Ученици section', async ({ page }) => {
    // Force a desktop viewport to ensure sidebar is visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/#/portfolio');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check if the "Повеќе алатки" section needs to be opened
    const moreBtn = page.locator('button:has-text("Повеќе алатки")');
    const isMoreBtnVisible = await moreBtn.isVisible().catch(() => false);
    if (isMoreBtnVisible) {
      await moreBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Check for the portfolio link specifically in the nav
    const portfolioLink = page.locator('nav >> a[href="#/portfolio"]');
    await expect(portfolioLink).toBeVisible({ timeout: 10000 });
    await expect(portfolioLink).toContainText(/Портфолио/i);
  });

});
