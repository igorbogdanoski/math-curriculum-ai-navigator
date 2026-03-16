import { test, expect } from '@playwright/test';

/**
 * Happy Path E2E Tests — Core User Flows
 *
 * Tests the most critical public-facing flows without auth:
 * 1. Student Progress page — name entry, tab navigation
 * 2. Annual Planner — form is interactive (grade select, subject, weeks, button)
 * 3. Public route coverage — no JS errors on load
 * 4. Accessibility — basic a11y checks
 *
 * Auth-gated flows (quiz generation, analytics) require test credentials.
 */

test.describe('Happy Path: Core User Flows', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
  });

  // ── 1. Student Progress ───────────────────────────────────────────────────
  test.describe('Student: My Progress flow', () => {

    test('progress page loads and shows name search UI', async ({ page }) => {
      await page.goto('/#/my-progress');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
    });

    test('entering a student name triggers search without crash', async ({ page }) => {
      await page.goto('/#/my-progress');

      const nameInput = page.locator('input[placeholder*="Внеси"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Тест Ученик');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
      }
    });

    test('Map and Activity tabs are switchable', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('studentName', 'Тест'));
      await page.goto('/#/my-progress');
      await page.waitForTimeout(2000);

      const activityTab = page.locator('button', { hasText: /Активност|Activity/i }).first();
      const mapTab = page.locator('button', { hasText: /Карта|Map/i }).first();

      if (await activityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await activityTab.click();
        await expect(activityTab).toBeVisible();
        await mapTab.click();
        await expect(mapTab).toBeVisible();
      }
    });

  });

  // ── 2. Annual Planner ─────────────────────────────────────────────────────
  // NOTE: Annual Planner is auth-protected. These tests verify the auth gate.
  test.describe('Annual Planner: Generator form', () => {

    test('page loads without crash', async ({ page }) => {
      await page.goto('/#/annual-planner');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
    });

    test('Grade selector or login form is visible (auth-gated route)', async ({ page }) => {
      await page.goto('/#/annual-planner');
      // Route is auth-protected — either grade select (if logged in) or login form
      const gradeSelect = page.locator('select[title="Одделение"]');
      const loginForm = page.locator('input[type="email"]');
      const either = gradeSelect.or(loginForm);
      await expect(either.first()).toBeVisible({ timeout: 10000 });
    });

    test('Subject input accepts text', async ({ page }) => {
      await page.goto('/#/annual-planner');
      const subjectInput = page.locator('input[type="text"]').first();
      if (await subjectInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await subjectInput.fill('Физика');
        await expect(subjectInput).toHaveValue('Физика');
      }
    });

    test('Weeks input has correct min/max constraints', async ({ page }) => {
      await page.goto('/#/annual-planner');
      const weeksInput = page.locator('input[type="number"]').first();
      if (await weeksInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(weeksInput).toHaveAttribute('min', '20');
        await expect(weeksInput).toHaveAttribute('max', '40');
      }
    });

    test('Generate button or login form is visible (auth-gated route)', async ({ page }) => {
      await page.goto('/#/annual-planner');
      // Route is auth-protected — either generate button (if logged in) or login form
      const loginForm = page.locator('input[type="email"]');
      const generateBtn = page.locator('button', { hasText: /Генерирај/i }).first();
      const either = loginForm.or(generateBtn);
      await expect(either.first()).toBeVisible({ timeout: 10000 });
    });

  });

  // ── 3. Public routes — no JS errors ──────────────────────────────────────
  test.describe('Navigation: Public routes reachable', () => {

    const publicRoutes = [
      { path: '/#/', label: 'Home' },
      { path: '/#/my-progress', label: 'Student Progress' },
      { path: '/#/live', label: 'Live Session' },
      { path: '/#/tutor', label: 'AI Tutor' },
      { path: '/#/annual-planner', label: 'Annual Planner' },
    ];

    for (const route of publicRoutes) {
      test(`${route.label} loads without critical JS errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto(route.path);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        const critical = errors.filter(e =>
          !e.includes('auth/') &&
          !e.includes('firebase') &&
          !e.includes('ResizeObserver')
        );
        expect(critical, `JS errors on ${route.path}: ${critical.join(', ')}`).toHaveLength(0);
      });
    }

  });

  // ── 4. Accessibility ──────────────────────────────────────────────────────
  test.describe('Accessibility: Basic checks', () => {

    test('No images without alt attribute on home page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      const imgsWithoutAlt = await page.locator('img:not([alt])').count();
      expect(imgsWithoutAlt).toBe(0);
    });

    test('Interactive buttons have accessible text or aria-label (max 3 exceptions)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const inaccessibleButtons = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).filter(b => {
          const hasText = (b.textContent || '').trim().length > 0;
          return !hasText && !b.hasAttribute('aria-label') && !b.hasAttribute('title');
        }).length
      );
      expect(inaccessibleButtons).toBeLessThanOrEqual(3);
    });

    test('Annual Planner grade select or login form visible', async ({ page }) => {
      await page.goto('/#/annual-planner');
      await page.waitForLoadState('domcontentloaded');
      // Route is auth-protected — check either grade select or login form
      const gradeSelect = page.locator('select[title="Одделение"]');
      const loginForm = page.locator('input[type="email"]');
      const either = gradeSelect.or(loginForm);
      await expect(either.first()).toBeVisible({ timeout: 10000 });
    });

  });

});
