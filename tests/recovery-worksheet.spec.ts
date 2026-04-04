import { expect, test, type Page } from '@playwright/test';

import { setupTeacherMocks } from './helpers';

const MOCK_RECOVERY_RESULTS = [
  {
    quizId: 'rw-1',
    quizTitle: 'Квиз: Дропки',
    percentage: 42,
    correctCount: 4,
    totalQuestions: 10,
    studentName: 'Ана',
    teacherUid: 'test-teacher-uid',
    conceptId: 'fractions-e2e',
    gradeLevel: 6,
    playedAt: new Date().toISOString(),
    confidence: 2,
    misconceptions: [
      { question: '1/2 + 1/3', studentAnswer: '2/5', misconception: 'Собира броители и именители директно' },
    ],
  },
  {
    quizId: 'rw-2',
    quizTitle: 'Квиз: Дропки',
    percentage: 38,
    correctCount: 3,
    totalQuestions: 10,
    studentName: 'Борис',
    teacherUid: 'test-teacher-uid',
    conceptId: 'fractions-e2e',
    gradeLevel: 6,
    playedAt: new Date(Date.now() - 3600_000).toISOString(),
    confidence: 2,
    misconceptions: [
      { question: '2/3 - 1/6', studentAnswer: '1/3', misconception: 'Не порамнува именители' },
    ],
  },
];

async function setupRecoveryMocks(page: Page, recoveryFlag: boolean) {
  await setupTeacherMocks(page);

  await page.addInitScript(({ results, enabled }) => {
    window.__E2E_MOCK_QUIZ_RESULTS__ = results;
    localStorage.setItem('recovery_worksheet_enabled', String(enabled));
  }, { results: MOCK_RECOVERY_RESULTS, enabled: recoveryFlag });

  await page.route(/\/api\/gemini/, async (route) => {
    const postData = route.request().postData() || '';

    if (postData.includes('recovery worksheet')) {
      const mockText = JSON.stringify({
        title: 'Recovery Worksheet: Дропки',
        questions: [
          {
            id: 1,
            type: 'multiple-choice',
            question: 'Кој е правилниот прв чекор за 1/2 + 1/3?',
            options: ['Собери ги директно', 'Израмни ги именителите', 'Помножи ги броителите', 'Скрати веднаш'],
            answer: 'Израмни ги именителите',
            solution: 'Најпрво ги порамнуваме именителите на 6.',
            cognitiveLevel: 'Understanding',
            difficulty_level: 'support',
          },
          {
            id: 2,
            type: 'short-answer',
            question: 'Пресметај 2/3 - 1/6.',
            answer: '1/2',
            solution: '2/3 = 4/6, па 4/6 - 1/6 = 3/6 = 1/2.',
            cognitiveLevel: 'Applying',
            difficulty_level: 'support',
          },
        ],
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: mockText,
          candidates: [{ content: { parts: [{ text: mockText }] } }],
        }),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe('E2 recovery worksheet routing', () => {
  test('flag OFF keeps legacy remedial assignment modal', async ({ page }) => {
    await setupRecoveryMocks(page, false);

    await page.goto('/#/analytics');
    await page.getByRole('button', { name: /концепт/i }).click();
    await expect(page.getByText(/Додели на засегнати/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Додели на засегнати/i }).click();

    await expect(page.getByText(/Додели ремедијален квиз/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Recovery Worksheet/i)).toHaveCount(0);
  });

  test('flag ON opens recovery worksheet preview modal', async ({ page }) => {
    await setupRecoveryMocks(page, true);

    await page.goto('/#/analytics');
    await page.getByRole('button', { name: /концепт/i }).click();
    await expect(page.getByText(/Додели на засегнати/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Додели на засегнати/i }).click();

    await expect(page.getByText(/Recovery Worksheet — teacher confirm/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Recovery Worksheet: Дропки/i)).toBeVisible({ timeout: 10000 });
  });
});