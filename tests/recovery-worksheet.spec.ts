import { expect, test, type Page } from '@playwright/test';

import { makeFirestoreQueryResult, setupTeacherMocks } from './helpers';

const EXAM_ID = 'dim-gymnasium-2021-august-mk';

const MOCK_MATURA_RESULT = {
  examId: EXAM_ID,
  examTitle: 'ДИМ Гимназиско — Август 2021 (МК)',
  grades: {
    1: { score: 0, maxPoints: 1 },
    2: { score: 0, maxPoints: 1 },
    3: { score: 0, maxPoints: 1 },
    4: { score: 1, maxPoints: 1 },
  },
  totalScore: 1,
  maxScore: 4,
  durationSeconds: 1800,
  completedAt: '2026-04-07T10:00:00.000Z',
  completedAtTs: Date.parse('2026-04-07T10:00:00.000Z'),
};

async function mockMaturaFirestore(page: Page) {
  await page.route(/firestore\.googleapis\.com.*/, async (route) => {
    const url = route.request().url();
    const body = route.request().postData() ?? '';

    if (url.includes(':runQuery') && body.includes('teacherUid')) {
      const response = makeFirestoreQueryResult('classes', [
        {
          id: 'class-6a',
          data: {
            name: 'VI-a',
            gradeLevel: 6,
            teacherUid: 'test-teacher-uid',
            studentNames: ['Ана', 'Борис'],
            createdAt: { seconds: 1712448000, nanoseconds: 0 },
          },
        },
      ]);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 500, message: 'E2E forced fallback' } }),
    });
  });
}

async function mockRecoveryWorksheetGeneration(page: Page) {
  await page.route(/\/api\/gemini/, async (route) => {
    const postData = route.request().postData() ?? '';

    if (postData.includes('Recovery Worksheet')) {
      const mockHtml = `
        <div class="worksheet">
          <h1>Recovery Worksheet</h1>
          <p class="subtitle">Персонализирано по твоите резултати</p>
          <section class="concept-section">
            <h2>1. Бројни изрази</h2>
            <div class="theory-box">
              <h3>Теорија</h3>
              <p>Пази на редоследот на операции и знаците кога имаш негативни броеви.</p>
            </div>
            <div class="tasks">
              <div class="task">
                <span class="task-label">Задача 1 (основна)</span>
                <p>Пресметај: 3 - 2 · (-4)</p>
                <div class="answer-space"></div>
              </div>
            </div>
          </section>
          <section class="challenge-section">
            <h2>Предизвик задача</h2>
            <p>Објасни зошто редоследот на операции е важен.</p>
            <div class="answer-space large"></div>
          </section>
        </div>
      `.trim();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: mockHtml,
          candidates: [{ content: { parts: [{ text: mockHtml }] } }],
        }),
      });
      return;
    }

    await route.fallback();
  });
}

async function setupMaturaRecoveryPage(page: Page) {
  await setupTeacherMocks(page);
  await mockMaturaFirestore(page);
  await mockRecoveryWorksheetGeneration(page);

  await page.addInitScript(({ examId, result }) => {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem(`matura_sim_result_${examId}`, JSON.stringify(result));
    window.__E2E_ASSIGNMENT_WRITES__ = [];
    window.__E2E_MOCK_CLASSES__ = [
      {
        id: 'class-6a',
        name: 'VI-a',
        gradeLevel: 6,
        teacherUid: 'test-teacher-uid',
        studentNames: ['Ана', 'Борис'],
      },
    ];
  }, { examId: EXAM_ID, result: MOCK_MATURA_RESULT });
}

test.describe('Matura Recovery Worksheet modal', () => {
  test('opens, generates preview, and submits recovery assignment', async ({ page }) => {
    await setupMaturaRecoveryPage(page);

    await page.goto('/#/matura-stats');

    await expect(page.getByRole('heading', { name: /Matura Analytics/i })).toBeVisible({ timeout: 20000 });

    const openWorksheetButton = page.getByRole('button', { name: /^Recovery Worksheet$/i });
    await expect(openWorksheetButton).toBeVisible({ timeout: 15000 });
    await openWorksheetButton.click();

    await expect(page.getByText(/Ќе се генерира worksheet за овие концепти:/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Генерирај со AI/i }).click();

    await expect(page.getByText(/Пази на редоследот на операции/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Печати \/ Зачувај PDF/i })).toBeVisible();

    const sendToggle = page.locator('button[title="Испрати на ученици"]');
    await expect(sendToggle).toBeVisible();
    await sendToggle.click();

    const classPicker = page.locator('select[title="Избери клас"]');
    await expect(classPicker).toBeVisible({ timeout: 10000 });
    await classPicker.selectOption('class-6a');

    const sendButton = page.getByRole('button', { name: /Испрати Assignment/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect.poll(async () => page.evaluate(() => window.__E2E_ASSIGNMENT_WRITES__?.length ?? 0)).toBe(1);
    await expect.poll(async () => page.evaluate(() => window.__E2E_ASSIGNMENT_WRITES__?.[0]?.materialType ?? '')).toBe('RECOVERY_WORKSHEET');
    await expect.poll(async () => page.evaluate(() => window.__E2E_ASSIGNMENT_WRITES__?.[0]?.classId ?? '')).toBe('class-6a');
    await expect(page.getByText(/Испрати Recovery Assignment до клас/i)).toHaveCount(0);
  });

  test('Recovery button opens Matura practice with recovery prefill banner', async ({ page }) => {
    await setupMaturaRecoveryPage(page);

    await page.goto('/#/matura-stats');

    await expect(page.getByRole('heading', { name: /Matura Analytics/i })).toBeVisible({ timeout: 20000 });

    const recoveryButton = page.getByRole('button', { name: /^Recovery$/i }).first();
    await expect(recoveryButton).toBeVisible({ timeout: 15000 });
    await recoveryButton.click();

    await expect(page).toHaveURL(/#\/matura-practice/);
    await expect(page.getByRole('heading', { name: /Адаптивна практика/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Recovery Session/i)).toBeVisible();
    await expect(page.getByText(/Препорачан фокус од M5 аналитика/i)).toBeVisible();
  });

  test('starts 7-day Recovery Plan from M5 weak concepts card', async ({ page }) => {
    await setupMaturaRecoveryPage(page);

    await page.goto('/#/matura-stats');

    await expect(page.getByRole('heading', { name: /Matura Analytics/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: /Започни 7-дневен Recovery Plan/i })).toBeVisible({ timeout: 15000 });

    const startPlanButton = page.getByRole('button', { name: /^План за:/i }).first();
    await expect(startPlanButton).toBeVisible({ timeout: 15000 });
    await startPlanButton.click();

    await expect(page.getByRole('heading', { name: /7-дневен Recovery Plan/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Фокус:/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Вежбај/i })).toBeVisible();
  });
});