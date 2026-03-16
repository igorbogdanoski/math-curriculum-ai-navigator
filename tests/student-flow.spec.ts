import { test, expect } from '@playwright/test';

/**
 * Student Flow Tests
 * Covers all public routes accessible without teacher authentication.
 * Tests the student onboarding wizard, name entry, and live session join.
 */
test.describe('Student Flow: Public Routes', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure fresh state (no saved studentName)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
  });

  // ---------------------------------------------------------------------------
  // /play/:id — Student Quiz Play
  // ---------------------------------------------------------------------------
  test.describe('/play/:id — Student Play Route', () => {

    test('route is public — no login form shown', async ({ page }) => {
      await page.goto('/#/play/test-quiz-id');
      await page.waitForTimeout(2000);

      // Login form must NOT appear (this is a public route)
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).not.toBeVisible();
    });

    test('invalid quiz ID shows graceful error — no crash', async ({ page }) => {
      await page.goto('/#/play/test-quiz-id');

      // No React error boundary
      const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
      await expect(errorBoundary).not.toBeVisible();
    });

    test('invalid quiz ID shows "back to home" button', async ({ page }) => {
      await page.goto('/#/play/test-quiz-id');

      // Error screen has a "Назад кон почетна" button (needs time for Firestore to return not-found)
      const backBtn = page.locator('button', { hasText: 'Назад кон почетна' });
      await expect(backBtn).toBeVisible({ timeout: 15000 });
    });

    test('"back to home" button navigates away from play route', async ({ page }) => {
      await page.goto('/#/play/test-quiz-id');

      const backBtn = page.locator('button', { hasText: 'Назад кон почетна' });
      await expect(backBtn).toBeVisible({ timeout: 15000 });
      await backBtn.click();

      // After clicking, should no longer be on /play route
      await page.waitForTimeout(1000);
      expect(page.url()).not.toContain('/play/');
    });

  });

  // ---------------------------------------------------------------------------
  // /my-progress — Student Progress
  // ---------------------------------------------------------------------------
  test.describe('/my-progress — Student Progress Route', () => {

    test('loads without crash', async ({ page }) => {
      await page.goto('/#/my-progress');

      const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
      await expect(errorBoundary).not.toBeVisible();
    });

    test('page body is visible', async ({ page }) => {
      await page.goto('/#/my-progress');
      await expect(page.locator('body')).toBeVisible();
    });

  });

  // ---------------------------------------------------------------------------
  // /live — Live Session Join
  // ---------------------------------------------------------------------------
  test.describe('/live — Live Session Route', () => {

    test('loads without crash', async ({ page }) => {
      await page.goto('/#/live');

      const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
      await expect(errorBoundary).not.toBeVisible();
    });

    test('shows name input field', async ({ page }) => {
      await page.goto('/#/live');

      // Live view has a name input
      const nameInput = page.locator('input[placeholder*="име"]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 });
    });

    test('shows 4-digit session code input', async ({ page }) => {
      await page.goto('/#/live');

      // Session code input
      const codeInput = page.locator('input[placeholder*="AB3K"]');
      await expect(codeInput).toBeVisible({ timeout: 5000 });
    });

    test('join button is disabled without name and code', async ({ page }) => {
      await page.goto('/#/live');

      // The join button should be disabled when inputs are empty
      const disabledBtn = page.locator('button[disabled]').first();
      await expect(disabledBtn).toBeVisible({ timeout: 5000 });
    });

  });

  // ---------------------------------------------------------------------------
  // /tutor — AI Student Tutor
  // ---------------------------------------------------------------------------
  test.describe('/tutor — Student AI Tutor Route', () => {

    test('loads without crash', async ({ page }) => {
      await page.goto('/#/tutor');

      const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
      await expect(errorBoundary).not.toBeVisible();
    });

    test('page body is visible', async ({ page }) => {
      await page.goto('/#/tutor');
      await expect(page.locator('body')).toBeVisible();
    });

  });

});
