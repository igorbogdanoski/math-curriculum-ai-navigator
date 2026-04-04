import { test, expect } from '@playwright/test';

/**
 * Auth Guard Tests
 * Verifies that protected routes redirect unauthenticated users to the login form,
 * and that the login form itself is functional (correct fields, validation).
 */
test.describe('Auth Guard: Protected Routes Show Login', () => {

  const expectLoginFormVisible = async (page: Parameters<Parameters<typeof test>[1]>[0]['page']) => {
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible({ timeout: 15000 });
  };

  const protectedRoutes = ['/', '/#/analytics', '/#/generator', '/#/planner', '/#/settings'];
  const expectLoginFormHidden = async (page: Parameters<Parameters<typeof test>[1]>[0]['page']) => {
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveCount(0);
  };

  for (const route of protectedRoutes) {
    test(`route "${route}" shows login form when not authenticated`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expectLoginFormVisible(page);
    });
  }

  test('login form has email and password inputs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);
  });

  test('login form has "E-poshta" label', async ({ page }) => {
    await page.goto('/');
    // Use exact text match to avoid matching "или со е-пошта"
    await expect(page.getByText(/^Е-пошта$/)).toBeVisible({ timeout: 10000 });
  });

  test('login form has "Lozinka" label', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/^Лозинка$/)).toBeVisible({ timeout: 10000 });
  });

  test('submit button exists on login form', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectLoginFormVisible(page);

    // Login button (type=submit or button with login text)
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();
  });

  test('protected route does NOT show teacher dashboard when unauthenticated', async ({ page }) => {
    await page.goto('/#/analytics', { waitUntil: 'domcontentloaded' });

    // Analytics dashboard content should NOT be visible
    const analyticsHeading = page.locator('text=/Аналитика|Analytics/i');
    // Either login form is shown, or analytics is hidden
    await expectLoginFormVisible(page);
    await expect(analyticsHeading).not.toBeVisible();
  });

  const publicRoutes = [
    '/#/pricing',
    '/#/privacy',
    '/#/terms',
    '/#/share/invalid-data',
    '/#/share/annual/invalid-data',
    '/#/quiz/invalid-data',
  ];

  for (const route of publicRoutes) {
    test(`public route "${route}" does not redirect to login`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expectLoginFormHidden(page);
      await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }

});
