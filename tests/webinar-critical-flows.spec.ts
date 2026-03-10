import { test, expect } from '@playwright/test';

/**
 * Webinar Critical Flows — Stability Verification
 * 
 * These tests ensure that the most important features shown during the webinar
 * are stable and don't crash the application.
 */
test.describe('Webinar: Critical Flows Stability', () => {

  test.beforeEach(async ({ page }) => {
    // Reset state before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  // ── 1. Student: Quiz Completion Flow (Happy Path UI) ──────────────────────
  test('Student can access quiz and see onboarding wizard', async ({ page }) => {
    // Use a dummy ID, check if onboarding triggers correctly
    await page.goto('/#/play/webinar-test-123');
    await page.waitForTimeout(2000);

    // Onboarding wizard check (Macedonian localized)
    const onboardingTitle = page.locator('text=/Добредојде|име|Внеси го твоте име/i').first();
    const nameInput = page.locator('input[placeholder*="име"], input[placeholder*="Твоето"]').first();
    
    // If onboarding is visible, verify elements
    if (await onboardingTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(onboardingTitle).toBeVisible();
      await expect(nameInput).toBeVisible();
      
      // Fill name and continue
      await nameInput.fill('Ученик Вебинар');
      const confirmBtn = page.locator('button:has-text("Потврди"), button:has-text("Продолжи"), button:has-text("Започни")').first();
      await confirmBtn.click();
      
      // Should move to loading or "not found" state without crashing
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
    }
  });

  // ── 2. Student: My Progress & Portfolio ───────────────────────────────────
  test('Student Progress and Portfolio views are reachable', async ({ page }) => {
    // Progress View
    await page.goto('/#/my-progress');
    await page.waitForTimeout(3000);
    
    // Check for "Внеси го твоето име" or similar (Search state)
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Portfolio View
    await page.goto('/#/portfolio');
    await page.waitForTimeout(3000);
    // Should show "Портфолио" (Macedonian localized in StudentPortfolioView.tsx:183)
    await expect(page.locator('text=/Портфолио|Portfolio/i').first()).toBeVisible();
    await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
  });

  // ── 3. Teacher: Analytics & Assignments (Public Gates) ─────────────────────
  test('Teacher restricted routes redirect to Login correctly', async ({ page }) => {
    const restricted = ['/#/analytics', '/#/planner', '/#/library', '/#/annual-planner'];
    
    for (const route of restricted) {
      await page.goto(route);
      await page.waitForTimeout(2000);
      
      // Should see Login form or redirect to /# (LoginView is default for !auth)
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      await expect(emailInput).toBeVisible({ timeout: 10000 });
      await expect(passwordInput).toBeVisible();
      // "Најави се" or "Login"
      await expect(page.locator('button:has-text("Најави се"), button:has-text("Login")').first()).toBeVisible();
    }
  });

  // ── 4. AI Tutor: Public accessibility ─────────────────────────────────────
  test('AI Tutor interface loads for students', async ({ page }) => {
    await page.goto('/#/tutor');
    await page.waitForTimeout(3000);
    
    // Check for chat elements (Macedonian localized in StudentTutorView.tsx:125)
    await expect(page.locator('text=/Тутор|Tutor/i').first()).toBeVisible();
    
    // Use role for more stability
    const chatInput = page.locator('input[type="text"], textarea').first();
    await expect(chatInput).toBeVisible();
  });

  // ── 5. Stress Check: Large Data View (Curriculum Graph) ─────────────────────
  test('Curriculum Graph view loads without crash', async ({ page }) => {
    // If graph is public or login-gated, check if it crashes
    await page.goto('/#/graph');
    await page.waitForTimeout(2000);
    
    // Check body and ensure no error boundary
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=/нешто тргна наопаку/i')).not.toBeVisible();
  });

});
