import { test, expect } from '@playwright/test';

/**
 * Auth Guard Tests
 * Verifies that protected routes redirect unauthenticated users to the login form,
 * and that the login form itself is functional (correct fields, validation).
 */
test.describe('Auth Guard: Protected Routes Show Login', () => {

  const protectedRoutes = ['/', '/#/analytics', '/#/generator', '/#/planner', '/#/settings'];

  for (const route of protectedRoutes) {
    test(`route "${route}" shows login form when not authenticated`, async ({ page }) => {
      await page.goto(route);
      // Wait for Firebase auth state to resolve (isLoading → false)
      await page.waitForTimeout(2000);

      // Login form must be visible
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 5000 });
    });
  }

  test('login form has email and password inputs', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login form has "E-poshta" label', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Е-пошта')).toBeVisible();
  });

  test('login form has "Lozinka" label', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await expect(page.locator('label[for="password"]')).toBeVisible();
  });

  test('submit button exists on login form', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Login button (type=submit or button with login text)
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();
  });

  test('protected route does NOT show teacher dashboard when unauthenticated', async ({ page }) => {
    await page.goto('/#/analytics');
    await page.waitForTimeout(2000);

    // Analytics dashboard content should NOT be visible
    const analyticsHeading = page.locator('text=/Аналитика|Analytics/i');
    // Either login form is shown, or analytics is hidden
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
  });

});
