/**
 * S101 E2E — ClassroomView Critical Path
 *
 * Covers: start class → phase timer → end class → AI recommendation card.
 * Uses route-interception (no Firebase Emulator required).
 */

import { test, expect } from '@playwright/test';
import { setupTeacherMocks, makeFirestoreQueryResult } from './helpers';

const PLAN_ID = 'e2e-classroom-plan-001';

const MOCK_PLAN_DATA = {
  id: PLAN_ID,
  title: 'Линеарни равенки',
  theme: 'Линеарни равенки со една непозната',
  grade: 8,
  subject: 'Математика',
  scenario: {
    introductory: { text: 'Воведна активност: поставете го проблемот.' },
    main: [{ text: 'Главна активност: решавање со балансна метода.' }],
    concluding: { text: 'Exit ticket: 3 брзи равенки.' },
  },
};

async function setupWithPlan(page: Parameters<typeof setupTeacherMocks>[0]) {
  // Register plan query mock BEFORE setupTeacherMocks adds its catch-all,
  // so this handler wins for lessonPlans runQuery requests.
  await page.route(/firestore\.googleapis\.com.*:runQuery/, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('lessonPlans')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeFirestoreQueryResult(`users/test-teacher-uid/lessonPlans`, [
            { id: PLAN_ID, data: MOCK_PLAN_DATA },
          ])
        ),
      });
    } else {
      await route.fallback();
    }
  });

  await setupTeacherMocks(page);

  // Silence streaming AI proxy — returns plain text so the suggestion card renders
  await page.route(/\/api\/gemini/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        text: '1. Повтори ги равенките. 2. Направи Exit ticket. 3. Примени кооперативно учење.',
      }),
    });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('ClassroomView: no plan fallback', () => {
  test('shows fallback card when no planId is provided', async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto('/classroom/nonexistent-plan');
    await expect(page.getByText(/планот не е пронајден|нема избран план/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/кон подготовка за час/i)).toBeVisible();
  });
});

test.describe('ClassroomView: happy path', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithPlan(page);
  });

  test('renders 3 phase cards after plan loads', async ({ page }) => {
    await page.goto(`/classroom/${PLAN_ID}`);
    await expect(page.getByText('Вовод')).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText('Главен дел')).toBeVisible();
    await expect(page.getByText('Завршница')).toBeVisible();
  });

  test('start button triggers timer on first phase', async ({ page }) => {
    await page.goto(`/classroom/${PLAN_ID}`);

    // Wait for phase cards to render
    await expect(page.getByText('Вовод')).toBeVisible({ timeout: 12_000 });

    // Find and click the start / стартувај button
    const startBtn = page.getByRole('button', { name: /стартувај|старт|start/i }).first();
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // After starting, a countdown timer (MM:SS pattern) should appear
    await expect(page.locator('text=/\\d{2}:\\d{2}/')).toBeVisible({ timeout: 5_000 });
  });

  test('End class shows completion screen with AI suggestion card', async ({ page }) => {
    await page.goto(`/classroom/${PLAN_ID}`);
    await expect(page.getByText('Вовод')).toBeVisible({ timeout: 12_000 });

    const startBtn = page.getByRole('button', { name: /стартувај|старт|start/i }).first();
    await startBtn.click();

    // Click End Class / Заврши час button
    const endBtn = page.getByRole('button', { name: /заврши час|end class/i });
    await expect(endBtn).toBeVisible({ timeout: 5_000 });
    await endBtn.click();

    // Completion screen
    await expect(page.getByText(/часот е завршен/i)).toBeVisible({ timeout: 8_000 });

    // AI suggestions card should appear (even if content is still loading)
    await expect(page.getByText(/препораки за следниот час/i)).toBeVisible({ timeout: 8_000 });
  });
});
