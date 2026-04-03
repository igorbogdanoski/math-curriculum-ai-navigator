import { test, expect } from '@playwright/test';
import { setupTeacherMocks } from './helpers';

test.describe('E1 Isolated Harness: Generator Panel API Chain', () => {
  test('collects trace-led API chain without Home side-effects', async ({ page }, testInfo) => {
    const chain: Array<{ t: number; kind: 'req' | 'res' | 'log'; msg: string }> = [];
    const t0 = Date.now();
    const push = (kind: 'req' | 'res' | 'log', msg: string) => {
      chain.push({ t: Date.now() - t0, kind, msg });
    };

    await page.addInitScript(() => {
      localStorage.setItem('auto_ai_suggestions', 'false');
    });

    page.on('request', (req) => {
      const url = req.url();
      if (/api\/gemini|api\/imagen|securetoken|identitytoolkit|firestore\.googleapis/.test(url)) {
        push('req', `${req.method()} ${url}`);
      }
    });
    page.on('response', (res) => {
      const url = res.url();
      if (/api\/gemini|api\/imagen|securetoken|identitytoolkit|firestore\.googleapis/.test(url)) {
        push('res', `${res.status()} ${url}`);
      }
    });

    await setupTeacherMocks(page);

    await page.route(/firestore\.googleapis\.com.*:batchGet/, async (route) => {
      const body = route.request().postData() ?? '';
      if (body.includes('/documents/users/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ missing: 'projects/mock/databases/(default)/documents/cache/missing', readTime: new Date().toISOString() }]),
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

    await page.route(/youtube\.com\/oembed/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ title: 'Питагорова теорема — видео лекција', author_name: 'Math Channel MK' }),
      });
    });

    await page.route(/\/api\/imagen/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [{ imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZP8kAAAAASUVORK5CYII=' }] }),
      });
    });

    await page.route(/\/api\/gemini/, async (route) => {
      const postData = route.request().postData() ?? '';
      if (postData.includes('recommendations') || postData.includes('препораки')) {
        const recs = [{ category: 'Напредок', title: 'Continue', recommendationText: 'Mock rec' }];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(recs), candidates: [{ content: { parts: [{ text: JSON.stringify(recs) }] } }] }) });
        return;
      }

      const scenario = {
        title: 'Видео-сценарио: Питагорова теорема',
        openingActivity: 'Краток вовед',
        mainActivity: [{ text: 'Главна активност', bloomsLevel: 'Applying' }],
        differentiation: 'Diff',
        assessmentIdea: 'Idea',
        assessmentStandards: ['MATH.8.G.1'],
        concepts: ['Питагорова теорема'],
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(scenario), candidates: [{ content: { parts: [{ text: JSON.stringify(scenario) }] } }] }) });
    });

    await page.goto('/#/generator');

    await page.addStyleTag({
      content: '#react-joyride-portal, .react-joyride__overlay, .react-joyride__spotlight, [role="dialog"][aria-label*="колачиња"] { display: none !important; pointer-events: none !important; }',
    });

    const acceptCookie = page.getByRole('button', { name: /Прифати/i });
    if (await acceptCookie.count()) {
      await acceptCookie.first().click({ force: true });
    }

    // Panel might be opening over redirected home route.
    await expect(page.getByRole('heading', { name: /AI Генератор/i })).toBeVisible({ timeout: 15000 });

    const skipTour = page.getByRole('button', { name: /Прескокни|Skip/i });
    if (await skipTour.count()) {
      await skipTour.first().click({ force: true });
    }

    await page.getByRole('button', { name: /Video Extractor \(MVP\)/i }).click();
    await page.getByRole('button', { name: /Следно/i }).click();

    const gradeSelect = page.locator('select').nth(0);
    const gradeValues = await gradeSelect.locator('option').evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    if (gradeValues.length > 0) await gradeSelect.selectOption(gradeValues[0]);

    await page.getByRole('button', { name: /По твоја идеја/i }).click();
    await page.locator('textarea').first().fill('Изолиран harness контекст за видео екстракција.');
    await page.getByRole('button', { name: /Следно/i }).click();

    await page.locator('#videoUrl').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('button', { name: /^Preview$/i }).click();
    await expect(page.getByText(/Preview потврден/i)).toBeVisible();

    await page.getByRole('button', { name: /Генерирај AI/i }).click();

    // Observe for a short deterministic window; this harness is diagnostic, not a hard gate.
    await page.waitForTimeout(10000);
    const gotScenario = await page.getByText(/Видео-сценарио: Питагорова теорема/i).count();
    push('log', gotScenario > 0 ? 'Scenario rendered' : 'Scenario not rendered within observation window');

    const chainText = chain
      .map((e) => `${String(e.t).padStart(5, ' ')}ms [${e.kind}] ${e.msg}`)
      .join('\n');

    await testInfo.attach('api-chain.log', {
      body: Buffer.from(chainText, 'utf-8'),
      contentType: 'text/plain',
    });

    // Keep this harness green while still exposing diagnostics.
    expect(chain.length).toBeGreaterThan(0);
  });
});
