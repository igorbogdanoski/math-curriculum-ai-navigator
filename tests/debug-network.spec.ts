/**
 * Diagnostic test — captures all googleapis.com requests to find the exact
 * URL that Firebase Firestore v11 uses for getDoc() calls.
 * DELETE this file after debugging.
 */
import { test, expect } from '@playwright/test';
import { setupStudentPlayMocks, E2E_QUIZ_ID } from './helpers';

const PLAY_URL = `/#/play/${E2E_QUIZ_ID}?tid=test-teacher-uid`;

test('diagnose: log all googleapis.com request URLs', async ({ page }) => {
  const requests: string[] = [];

  // Capture ALL request URLs before any mocks
  page.on('request', (request) => {
    if (request.url().includes('googleapis.com') || request.url().includes('firestore')) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('googleapis.com') || response.url().includes('firestore')) {
      requests.push(`  → ${response.status()} ${response.url()}`);
    }
  });

  await setupStudentPlayMocks(page);
  await page.addInitScript(`localStorage.setItem('studentName', 'Test');`);
  await page.goto(PLAY_URL);
  await page.waitForTimeout(8000);

  // Fail the test so we can see the output
  expect(requests.join('\n')).toBe('NO_REQUESTS');
});
