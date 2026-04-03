import { test, expect } from '@playwright/test';
import { setupTeacherMocks } from './helpers';

test.describe.skip('E1: Video Extractor Runtime Smoke', () => {
  test('URL -> preview -> generate -> save note flow works', async ({ page }) => {
    await page.addInitScript(() => {
      // Keep startup quiet: disable home auto AI calls that can occupy queue in E2E.
      localStorage.setItem('auto_ai_suggestions', 'false');
      localStorage.setItem('ai_daily_quota_exhausted', JSON.stringify({
        exhaustedAt: new Date().toISOString(),
        nextResetMs: Date.now() + 60 * 60 * 1000,
      }));
    });

    await page.route(/firestore\.googleapis\.com.*:batchGet/, async (route) => {
      const body = route.request().postData() ?? '';
      if (body.includes('/documents/users/')) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            missing: 'projects/mock/databases/(default)/documents/cache/missing',
            readTime: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route(/firestore\.googleapis\.com.*documents\//, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 404, message: 'NOT_FOUND' } }),
        });
        return;
      }
      await route.fallback();
    });

    const dismissCoachmarks = async () => {
      for (let i = 0; i < 5; i += 1) {
        const skipTour = page.getByRole('button', { name: /Прескокни|Skip/i });
        if (await skipTour.count()) {
          await skipTour.first().click({ force: true });
        } else {
          break;
        }
        await page.waitForTimeout(120);
      }

      await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
        for (const el of candidates) {
          const txt = (el.textContent || '').trim();
          if (!txt) continue;
          if (!txt.includes('Чекор') && !txt.includes('Step')) continue;
          if (!txt.includes('Прескокни') && !txt.includes('Skip')) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 240 && rect.height > 120) {
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
          }
        }
      });
    };

    await setupTeacherMocks(page);

    await page.route(/securetoken\.googleapis\.com.*token/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_token: 'mock-id-token',
          refresh_token: 'mock-refresh-token',
          expires_in: '3600',
          user_id: 'test-teacher-uid',
          project_id: 'mock-project-id',
          token_type: 'Bearer',
        }),
      });
    });

    await page.route(/youtube\.com\/oembed/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Питагорова теорема — видео лекција',
          author_name: 'Math Channel MK',
          thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        }),
      });
    });

    await page.route(/deductCredits/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { success: true } }),
      });
    });

    await page.route(/\/api\/imagen/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [{ imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZP8kAAAAASUVORK5CYII=' }],
        }),
      });
    });

    await page.route(/\/api\/gemini/, async (route) => {
      const postData = route.request().postData() ?? '';

      if (postData.includes('recommendations') || postData.includes('препораки')) {
        const recs = [
          {
            category: 'Напредок',
            title: 'Продолжи со вежбање',
            recommendationText: 'Одлична работа, продолжи со примена на концептот во практични задачи.',
          },
        ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: JSON.stringify(recs),
            candidates: [{ content: { parts: [{ text: JSON.stringify(recs) }] } }],
          }),
        });
        return;
      }

      const scenario = {
        title: 'Видео-сценарио: Питагорова теорема',
        openingActivity: 'Краток вовед со прашање за правоаголен триаголник.',
        mainActivity: [
          { text: 'Учениците анализираат примери од видеото и препознаваат катети/хипотенуза.', bloomsLevel: 'Understanding' },
          { text: 'Решаваат 2 задачи со примена на формулата a^2 + b^2 = c^2.', bloomsLevel: 'Applying' },
        ],
        differentiation: 'Поддршка со визуелни шеми; предизвик со комплексни задачи.',
        assessmentIdea: 'Exit ticket со една задача и кратко објаснување.',
        assessmentStandards: ['MATH.8.G.1'],
        concepts: ['Питагорова теорема'],
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: JSON.stringify(scenario),
          candidates: [{ content: { parts: [{ text: JSON.stringify(scenario) }] } }],
        }),
      });
    });

    await page.goto('/');

    await page.addStyleTag({
      content: '#react-joyride-portal, .react-joyride__overlay, .react-joyride__spotlight, [role="dialog"][aria-label*="колачиња"] { display: none !important; pointer-events: none !important; }',
    });

    await dismissCoachmarks();

    const acceptCookie = page.getByRole('button', { name: /Прифати/i });
    if (await acceptCookie.count()) {
      await acceptCookie.first().click();
    }

    await page.getByRole('button', { name: /AI Генератор/i }).first().click();
    await expect(page.getByRole('heading', { name: /AI Генератор/i })).toBeVisible();
    await dismissCoachmarks();

    await page.getByRole('button', { name: /Video Extractor \(MVP\)/i }).click();
    await dismissCoachmarks();
    await page.getByRole('button', { name: /Следно/i }).click();
    await dismissCoachmarks();

    const gradeSelect = page.locator('select').nth(0);
    await expect(gradeSelect).toBeVisible();
    const gradeValues = await gradeSelect.locator('option').evaluateAll((opts) =>
      opts.map((opt) => (opt as HTMLOptionElement).value).filter((v) => v.trim().length > 0),
    );
    if (gradeValues.length === 0) {
      throw new Error('No grade options available for generator smoke test.');
    }
    await gradeSelect.selectOption(gradeValues[0]);
    await dismissCoachmarks();

    await page.getByRole('button', { name: /По твоја идеја/i }).click();
    await page.locator('textarea[placeholder*="Сакам да направам час"], textarea[placeholder*="сценарио"]').first().fill('Сценарио базирано на видео лекција за Питагорова теорема.');

    await page.getByRole('button', { name: /Следно/i }).click();
    await dismissCoachmarks();

    await expect(page.locator('#videoUrl')).toBeVisible();
    await page.locator('#videoUrl').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('button', { name: /^Preview$/i }).click();
    await expect(page.getByText(/Preview потврден/i)).toBeVisible();

    await page.getByRole('button', { name: /Генерирај AI/i }).click();
    await expect(page.getByText(/Видео-сценарио: Питагорова теорема/i)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /Зачувај како белешка/i }).click();
    await expect(page.getByText(/успешно зачувана како белешка/i)).toBeVisible({ timeout: 15000 });
  });
});