/**
 * S101 E2E — LessonStudyView Critical Path
 *
 * Covers: load → show form → submit observation → AI report button visibility.
 * Uses route-interception (no Firebase Emulator required).
 */

import { test, expect } from '@playwright/test';
import { setupTeacherMocks, makeFirestoreQueryResult } from './helpers';

const MOCK_OBSERVATIONS = [
  {
    id: 'obs-001',
    data: {
      scenarioId: 'Линеарни равенки',
      role: 'delivered',
      whatWorked: 'Учениците беа ангажирани при балансната метода.',
      whatToImprove: 'Треба повеќе практика за негативни броеви.',
      engagementLevel: 4,
      observedGrade: 8,
      authorUid: 'test-teacher-uid',
      authorName: 'Тест Наставник',
      schoolName: 'Тест Училиште',
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: 'obs-002',
    data: {
      scenarioId: 'Дропки',
      role: 'observed',
      whatWorked: 'Визуелниот приказ на дропки функционираше одлично.',
      whatToImprove: 'Темпото беше побрзо за некои ученици.',
      engagementLevel: 5,
      observedGrade: 6,
      authorUid: 'test-teacher-uid',
      authorName: 'Тест Наставник',
      schoolName: 'Тест Училиште',
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
  },
];

async function setupLessonStudy(
  page: Parameters<typeof setupTeacherMocks>[0],
  withObservations = false,
) {
  // Mock scenario_observations runQuery
  await page.route(/firestore\.googleapis\.com.*:runQuery/, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('scenario_observations')) {
      const docs = withObservations ? MOCK_OBSERVATIONS : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          docs.length > 0
            ? makeFirestoreQueryResult('scenario_observations', docs)
            : [{}],
        ),
      });
    } else {
      await route.fallback();
    }
  });

  await setupTeacherMocks(page);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('LessonStudyView: page load', () => {
  test('renders header and new observation button', async ({ page }) => {
    await setupLessonStudy(page);
    await page.goto('/lesson-study');

    await expect(page.getByText(/lesson study hub/i)).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: /ново набљудување/i })).toBeVisible();
  });

  test('shows empty state when no observations exist', async ({ page }) => {
    await setupLessonStudy(page);
    await page.goto('/lesson-study');

    await expect(page.getByText(/набљудувања \(0\)/i)).toBeVisible({ timeout: 10_000 });
    // AI report button should NOT be visible with 0 observations
    await expect(page.getByRole('button', { name: /ai извештај/i })).not.toBeVisible();
  });
});

test.describe('LessonStudyView: observation form', () => {
  test.beforeEach(async ({ page }) => {
    await setupLessonStudy(page);
    await page.goto('/lesson-study');
    await expect(page.getByText(/lesson study hub/i)).toBeVisible({ timeout: 12_000 });
  });

  test('clicking new observation button reveals the form', async ({ page }) => {
    await page.getByRole('button', { name: /ново набљудување/i }).click();
    await expect(page.getByText(/внеси набљудување/i)).toBeVisible();
    await expect(page.getByPlaceholder(/линеарни равенки/i)).toBeVisible();
  });

  test('form can be filled and submits successfully', async ({ page }) => {
    // Mock Firestore write for observation submission
    await page.route(/firestore\.googleapis\.com.*documents/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            name: 'projects/mock/databases/(default)/documents/scenario_observations/new-obs',
            fields: {},
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.getByRole('button', { name: /ново набљудување/i }).click();
    await expect(page.getByPlaceholder(/линеарни равенки/i)).toBeVisible();

    // Fill required fields
    await page.getByPlaceholder(/линеарни равенки/i).fill('Тест сценарио 101');

    // Select engagement star (3rd star)
    const stars = page.locator('button[type="button"]').filter({ hasText: '' }).nth(2);
    // Use role-based selector for engagement stars
    const engagementButtons = page.locator('form button[type="button"]');
    await engagementButtons.nth(2).click();

    await page.getByPlaceholder(/учениците беа ангажирани/i).fill('Активноста со групна работа функционираше одлично.');

    // Submit
    await page.getByRole('button', { name: /зачувај/i }).click();

    // Should show success notification
    await expect(page.getByText(/набљудувањето е зачувано|зачувано/i)).toBeVisible({ timeout: 8_000 });
  });

  test('cancel button hides the form', async ({ page }) => {
    await page.getByRole('button', { name: /ново набљудување/i }).click();
    await expect(page.getByText(/внеси набљудување/i)).toBeVisible();

    await page.getByRole('button', { name: /откажи/i }).click();
    await expect(page.getByText(/внеси набљудување/i)).not.toBeVisible();
  });
});

test.describe('LessonStudyView: AI report', () => {
  test('AI report button visible with 2+ observations', async ({ page }) => {
    await setupLessonStudy(page, true);
    await page.goto('/lesson-study');

    await expect(page.getByText(/набљудувања \(2\)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /ai извештај/i })).toBeVisible();
  });

  test('clicking AI report triggers report generation', async ({ page }) => {
    await setupLessonStudy(page, true);
    await page.goto('/lesson-study');

    await expect(page.getByRole('button', { name: /ai извештај/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /ai извештај/i }).click();

    // Should show loading spinner or generated text
    await expect(
      page.locator('text=/генерирам|извештај|препораки|реализацијата/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
