import { test, expect } from '@playwright/test';

/**
 * Smoke Tests — App Health
 * Verifies that the app loads correctly and doesn't throw errors on startup.
 * These tests run without any authentication.
 */
test.describe('Smoke: App Health', () => {

  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Math|Navigator|Vite/i);
  });

  test('body is visible and app mounts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('no React error boundary shown on root load', async ({ page }) => {
    await page.goto('/');
    // SilentErrorBoundary shows this text on crash
    const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
    await expect(errorBoundary).not.toBeVisible();
  });

  test('no unhandled JS errors on root load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    // Wait for initial render to settle
    await page.waitForTimeout(1500);
    // Filter out known non-critical warnings (e.g. Firebase auth init delay)
    const criticalErrors = errors.filter(e =>
      !e.includes('auth/') &&
      !e.includes('firebase') &&
      !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('app loads within acceptable time', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    // Should load within 10 seconds in dev mode
    expect(elapsed).toBeLessThan(10_000);
  });

});
