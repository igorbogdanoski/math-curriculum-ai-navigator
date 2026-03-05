import { test, expect } from '@playwright/test';

test.describe('E2E Critical Flow: Teacher Application Loads', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('Teacher should be able to see main application mount', async ({ page }) => {
    // 1. Verify App Mounts and title
    await expect(page).toHaveTitle(/Math Navigator|Math Curriculum AI Navigator|Vite/i);
    
    // Wait for the main UI or at least the sidebar/menu to appear
    const mainBody = page.locator('body');
    await expect(mainBody).toBeVisible();

    // Check that we aren't showing the React Error Boundary
    const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
    await expect(errorBoundary).not.toBeVisible();
  });

  test('Student mode test route should not crash', async ({ page }) => {
    await page.goto('/#/play/test-id-1234');
    
    const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
    await expect(errorBoundary).not.toBeVisible();
  });

});
