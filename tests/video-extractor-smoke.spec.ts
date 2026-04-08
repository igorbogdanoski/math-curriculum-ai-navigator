import { test, expect } from '@playwright/test';
import { setupTeacherMocks } from './helpers';

test.describe('E1: Video Extractor Runtime Smoke', () => {
  test('URL -> preview flow works', async ({ page }) => {
    test.setTimeout(220_000);

    await page.addInitScript(() => {
      // Keep startup quiet: disable home auto AI calls that can occupy queue in E2E.
      localStorage.setItem('auto_ai_suggestions', 'false');
      localStorage.setItem('preferred_language', 'mk');
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
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

    await page.route(/firestore\.googleapis\.com.*:commit/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          writeResults: [{ updateTime: new Date().toISOString() }],
          commitTime: new Date().toISOString(),
        }),
      });
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
          access_token: 'mock-access-token',
          id_token: 'mock-id-token',
          refresh_token: 'mock-refresh-token',
          user_id: 'test-teacher-uid',
          project_id: 'mock-project-id',
          expires_in: '3600',
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

    await page.goto('/#/generator');
    await page.waitForFunction(() => document.documentElement.lang === 'mk');

    await page.addStyleTag({
      content: '#react-joyride-portal, .react-joyride__overlay, .react-joyride__spotlight, [role="dialog"][aria-label*="колачиња"] { display: none !important; pointer-events: none !important; }',
    });

    await dismissCoachmarks();

    const acceptCookie = page.getByRole('button', { name: /Прифати/i });
    if (await acceptCookie.count()) {
      await acceptCookie.first().click();
    }

    await expect(page.getByRole('heading', { name: /AI Генератор/i })).toBeVisible();
    await dismissCoachmarks();

    await page.getByRole('button', { name: /Video Extractor \(MVP\)/i }).click();
    await dismissCoachmarks();
    await page.getByRole('button', { name: /Следно/i }).click();
    await dismissCoachmarks();

    const contextStep = page.locator('[data-tour="generator-step-2"]');
    if (await contextStep.first().isVisible()) {
      await expect(contextStep.first()).toBeVisible({ timeout: 15000 });

      const gradeSelect = contextStep.first().locator('select').first();
      await expect(gradeSelect).toBeVisible();
      const gradeValues = await gradeSelect.locator('option').evaluateAll((opts) =>
        opts.map((opt) => (opt as HTMLOptionElement).value).filter((v) => v.trim().length > 0),
      );
      if (gradeValues.length === 0) {
        throw new Error('No grade options available for generator smoke test.');
      }
      await gradeSelect.selectOption(gradeValues[0]);
      await dismissCoachmarks();

      const scenarioTab = contextStep.first().getByRole('button', { name: /По твоја идеја|Од ваша идеја|По моја идеја/i });
      if (await scenarioTab.count()) {
        await scenarioTab.first().click({ force: true });
      }
      const scenarioInput = contextStep.first().locator('textarea').first();
      await expect(scenarioInput).toBeVisible({ timeout: 15000 });
      await scenarioInput.fill('Сценарио базирано на видео лекција за Питагорова теорема.');

      await page.getByRole('button', { name: /Следно/i }).click();
      await dismissCoachmarks();
    }

    await expect(page.locator('#videoUrl')).toBeVisible();
    await page.locator('#videoUrl').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('button', { name: /^Анализирај$/i }).click();
    await expect(page.getByText(/Math Channel MK/i)).toBeVisible();
  });
});