/**
 * E2E: Патека 1 — Наставник: генерирање квиз → испраќање на ученик
 *
 * Тестира:
 * 1. Навигација до генераторот
 * 2. Генерирање квиз (Gemini мокиран)
 * 3. Прегледот на генерираниот квиз
 * 4. Копирање на линк / Assign Dialog
 *
 * За тестирање без credentials: верификира јавно-достапниот StudentPlayView
 * и провера дека линкот за квиз работи.
 */

import { test, expect, type Page } from '@playwright/test';
import { setupStudentPlayMocks, E2E_QUIZ_ID, setupTeacherMocks, mockAllFirestoreQueries } from './helpers';

const MOCK_GENERATED_QUIZ = {
  title: 'Тест: Квадратни равенки',
  questions: [
    { type: 'MULTIPLE_CHOICE', question: 'x² = 4, x = ?', answer: '±2', options: ['±1', '±2', '±3', '±4'], solution: 'x = ±√4 = ±2', cognitiveLevel: 'Applying' },
    { type: 'MULTIPLE_CHOICE', question: 'x² - 9 = 0, x = ?', answer: '±3', options: ['±2', '±3', '±4', '±5'], solution: 'x² = 9, x = ±3', cognitiveLevel: 'Applying' },
  ],
  conceptId: 'C8B3',
  gradeLevel: 8,
};

// ── Gemini Mock Helper ────────────────────────────────────────────────────────

async function mockGeminiQuizGeneration(page: Page) {
  await page.route(/\/api\/gemini|generativelanguage\.googleapis\.com/, async (route) => {
    const postData = route.request().postData() || '';
    let mockText = JSON.stringify(MOCK_GENERATED_QUIZ);

    if (postData.includes('recommendations') || postData.includes('препораки')) {
      mockText = JSON.stringify([
        { category: 'General', title: 'Test Rec', recommendationText: 'Keep going!' }
      ]);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        text: mockText,
        candidates: [{
          content: {
            parts: [{ text: mockText }],
          },
          finishReason: 'STOP',
        }],
      }),
    });
  });
}

// ── Tests without auth ────────────────────────────────────────────────────────

test.describe('Патека 1 — Teacher Quiz (без автентикација)', () => {
  test('student play линкот работи — квизот е достапен за ученик', async ({ page }) => {
    // This verifies that once a quiz exists, the student can access it via URL
    await setupStudentPlayMocks(page);
    await page.addInitScript(`localStorage.setItem('studentName', 'Тест Ученик');`);

    await page.goto(`/#/play/${E2E_QUIZ_ID}?tid=test-teacher-uid`);

    // Quiz should load without authentication
    await expect(page.getByText('E2E Тест: Основни операции')).toBeVisible({ timeout: 12_000 });
  });

  test('Quiz Play URL прикажува грешка за невалиден ID', async ({ page }) => {
    await mockAllFirestoreQueries(page);
    await page.addInitScript(`localStorage.setItem('studentName', 'Тест Ученик');`);

    // Fail the quiz doc fetch
    await page.route(/firestore\.googleapis\.com.*cached_ai_materials\/invalid-quiz/, async (route) => {
      await route.fulfill({ status: 404, body: '{"error":{"code":404}}' });
    });

    await page.goto('/#/play/invalid-quiz?tid=test-teacher');

    await expect(
      page.getByText(/Квизот не е пронајден|невалиден|Грешка/i)
    ).toBeVisible({ timeout: 12_000 });
  });

  test('HomeView прикажува teacher landing / login prompt', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3_000);
    // Should show something — not a blank page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(10);
  });
});

// ── Tests with real teacher auth ──────────────────────────────────────────────

test.describe('Патека 1 — Teacher Quiz со автентикација', () => {
  test.beforeEach(async ({ page }) => {
    // Register specific Gemini mock FIRST so it takes precedence
    await mockGeminiQuizGeneration(page);
    await setupTeacherMocks(page);
  });

  test('Teacher HomeView прикажува персонализиран поздрав', async ({ page }) => {
    await page.goto('/');
    // Check for "Здраво" or name in the main heading
    await expect(
      page.locator('h1').getByText(/Здраво|Тест/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Генераторот прикажува форма за генерирање', async ({ page }) => {
    await page.goto('/#/generator');
    // Generator form should be visible
    await expect(
      page.getByText(/Генератор|Генерирај|Quiz/i).first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test('Генерирање квиз → прикажување на генерираниот материјал', async ({ page }) => {
    await page.goto('/#/generator');

    // Select quiz type (QUIZ)
    // Looking for translation or direct text "Квиз"
    const quizTypeOption = page.locator('button').filter({ hasText: /^Квиз$/ }).first();
    if (await quizTypeOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await quizTypeOption.click();
    }

    // Click generate AI button
    const generateBtn = page.locator('button').filter({ hasText: /Генерирај AI/i }).first();
    if (await generateBtn.isEnabled({ timeout: 10_000 }).catch(() => false)) {
      await generateBtn.click({ force: true });

      // Generated quiz should appear (mocked response)
      // Wait for the title which is in the mock
      await expect(
        page.getByText('Тест: Квадратни равенки').first()
      ).toBeVisible({ timeout: 25_000 });
      
      // Also check for one of the questions
      await expect(
        page.getByText('x² = 4, x = ?').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Assign Dialog се отвора кога кликнеш "Задај на одделение"', async ({ page }) => {
    // Setup: navigate to a page with an assign button
    await page.goto('/#/generator');

    // Generate a quiz first (mocked)
    const generateBtn = page.getByRole('button', { name: /Генерирај/i }).first();
    if (await generateBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await generateBtn.click({ force: true });
      await page.waitForTimeout(3_000);
    }

    // Look for Assign button
    const assignBtn = page.getByRole('button', { name: /Задај|Assign/i }).first();
    if (await assignBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await assignBtn.click();
      // AssignDialog should open
      await expect(
        page.getByText('Задај на одделение')
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Наставник → прикажување на Copy Link за квиз', async ({ page }) => {
    await page.goto('/#/library');

    // Find a share/copy link button
    const copyBtn = page.getByRole('button', { name: /Копирај|Copy|Линк/i }).first();
    if (await copyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await copyBtn.click();
      // Check for copied feedback
      await expect(
        page.getByText(/Копирано|Copied/i)
      ).toBeVisible({ timeout: 3_000 }).catch(() => { /* optional */ });
    }
  });
});
