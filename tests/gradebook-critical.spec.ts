/**
 * S101 E2E — GradeBookView Critical Path
 *
 * Covers:
 *  - Grade model tab switching (Traditional → Mastery → SBG)
 *  - Adding an entry via the form
 *  - BROCoveragePanel always visible
 *  - MaturaReadinessPanel visible for grade ≥ 8 with entries
 *  - SBG standard tagging UI visible when SBG model is active
 *
 * Uses route-interception (no Firebase Emulator required).
 */

import { test, expect } from '@playwright/test';
import { setupTeacherMocks } from './helpers';

async function fillAndSubmitEntry(page: import('@playwright/test').Page) {
  await page.getByPlaceholder(/пр\. Марко|ученик/i).fill('Тест Ученик');
  await page.getByPlaceholder(/пр\. Функции|тест/i).fill('Тест 1 — Равенки');
  // Fill "освоени поени" and "максимум"
  const scoreInputs = page.locator('input[type="number"]');
  await scoreInputs.nth(0).fill('75');
  await scoreInputs.nth(1).fill('100');
  await page.getByRole('button', { name: /додај|add/i }).click();
}

test.describe('GradeBookView: page load', () => {
  test('renders grade model tab buttons', async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto('/grade-book');

    await expect(page.getByText(/традиционален/i)).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/мастери|bloom/i)).toBeVisible();
    await expect(page.getByText(/sbg/i)).toBeVisible();
  });

  test('shows entry form fields on load', async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto('/grade-book');

    await expect(page.getByPlaceholder(/пр\. Марко|ученик/i)).toBeVisible({ timeout: 12_000 });
    await expect(page.getByPlaceholder(/пр\. Функции|тест/i)).toBeVisible();
  });
});

test.describe('GradeBookView: grade model switching', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto('/grade-book');
    await expect(page.getByText(/традиционален/i)).toBeVisible({ timeout: 12_000 });
  });

  test('switch to Mastery model updates active tab', async ({ page }) => {
    await page.getByText(/мастери|bloom/i).click();
    // Mastery theory text should appear
    await expect(page.getByText(/80%\+.*совладано/i)).toBeVisible({ timeout: 5_000 });
  });

  test('switch to SBG model shows standard tagging UI', async ({ page }) => {
    await page.getByText(/sbg/i).click();
    // SBG theory block
    await expect(page.getByText(/скала 1–4/i)).toBeVisible({ timeout: 5_000 });
    // Standard code input appears for grade ≤ 9
    await expect(page.getByPlaceholder(/пр\. III-А\.5|стандард|iii/i)).toBeVisible();
  });
});

test.describe('GradeBookView: entry form + panels', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto('/grade-book');
    await expect(page.getByPlaceholder(/пр\. Марко|ученик/i)).toBeVisible({ timeout: 12_000 });
  });

  test('adding an entry shows it in the table', async ({ page }) => {
    await fillAndSubmitEntry(page);
    await expect(page.getByText('Тест Ученик')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Тест 1 — Равенки')).toBeVisible();
  });

  test('BROCoveragePanel is always visible on the page', async ({ page }) => {
    // BROCoveragePanel renders regardless of entries
    await expect(page.getByText(/бро покриеност|стандарди.*iii-а|coverage/i)).toBeVisible({ timeout: 10_000 });
  });

  test('MaturaReadinessPanel appears for grade 8+ after adding an entry', async ({ page }) => {
    // Change grade to 9
    await page.selectOption('#gb-grade-level', '9');

    // Add one entry
    await fillAndSubmitEntry(page);

    // MaturaReadinessPanel should now be visible
    await expect(page.getByText(/матура.*подготвеност|matura|матурска/i)).toBeVisible({ timeout: 8_000 });
  });

  test('validation prevents empty student name submission', async ({ page }) => {
    // Click add without filling anything
    await page.getByRole('button', { name: /додај|add/i }).click();
    await expect(page.getByText(/внесете го името/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('GradeBookView: SBG proficiency UI', () => {
  test('SBG proficiency toggle is visible when SBG model active', async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto('/grade-book');
    await expect(page.getByText(/sbg/i)).toBeVisible({ timeout: 12_000 });

    await page.getByText(/sbg/i).click();

    // Proficiency 1–4 buttons should appear
    await expect(page.getByText(/1.*2.*3.*4|proficiency|ниво/i).or(
      page.locator('button').filter({ hasText: /^[1-4]$/ }).first()
    )).toBeVisible({ timeout: 5_000 });
  });
});
