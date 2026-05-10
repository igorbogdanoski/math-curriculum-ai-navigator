import { test, expect, type Page } from '@playwright/test';
import { computeSubmissionSeal, verifySubmissionSeal, stableStringify } from '../utils/duggaSubmissionSeal';

/**
 * S61-F2 — Playwright smoke + behavioural spec for the Дига Final Exam mode.
 *
 * The full teacher→student happy-path requires Firestore + auth seeding which
 * lives in tests/fixtures/auth.ts and is out of scope for a smoke gate. This
 * spec instead verifies the *contractual* surface of finalExamMode that can
 * be exercised without a backend:
 *
 *   1. The Дига builder, player and library routes are auth-gated and do not
 *      crash when seeded with finalExamMode-related URL parameters.
 *   2. The builder honours the conceptId / conceptLabel / grade / topic seed
 *      shipped in S61-D2 (no JS errors when the params are present).
 *   3. The submissionSeal utility (S61-E3) is deterministic, key-order
 *      independent, detects answer tampering, and produces a 64-char hex.
 *      This is the verifiable seal that the player computes inside
 *      DuggaPlayerView.handleSubmit when finalExamMode is enabled.
 */

const expectLoginFormVisible = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15_000 });
};

const expectNoCrash = async (page: Page): Promise<void> => {
  const errorBoundary = page.locator('text=/нешто тргна наопаку/i');
  await expect(errorBoundary).not.toBeVisible();
};

const collectCriticalErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  return errors;
};

const FINAL_EXAM_ROUTES = [
  { hash: '/#/dugga/build?finalExamMode=1&grade=11&conceptId=trig-unit-circle&conceptLabel=' + encodeURIComponent('Тригонометриски кругчиња') + '&topic=' + encodeURIComponent('тригонометрија'), label: 'Builder seeded for final exam' },
  { hash: '/#/dugga/play?code=EXAM01', label: 'Player with exam share-code' },
  { hash: '/#/dugga?finalExam=1', label: 'Library filtered to final-exam tests' },
];

test.describe('S61 Дига Final Exam — route smoke (auth-gated)', () => {
  for (const { hash, label } of FINAL_EXAM_ROUTES) {
    test(`${label} is auth-gated and does not crash`, async ({ page }) => {
      const errors = collectCriticalErrors(page);
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectLoginFormVisible(page);
      await expectNoCrash(page);

      const critical = errors.filter(e =>
        !e.includes('auth/') &&
        !e.includes('firebase') &&
        !e.includes('ResizeObserver') &&
        !e.includes('MathLive'),
      );
      expect(critical, `JS errors on ${hash}: ${critical.join(' | ')}`).toHaveLength(0);
    });
  }

  test('navigating across all final-exam routes never triggers the error boundary', async ({ page }) => {
    for (const { hash } of FINAL_EXAM_ROUTES) {
      await page.goto(hash, { waitUntil: 'domcontentloaded' });
      await expectNoCrash(page);
    }
    await page.goto(FINAL_EXAM_ROUTES[0].hash, { waitUntil: 'domcontentloaded' });
    await expectNoCrash(page);
  });
});

test.describe('S61-E3 submission seal — deterministic and tamper-evident', () => {
  const baseAnswers = {
    q1: 'A',
    q2: ['x', 'y'],
    q3: 'Final answer = 42',
  };
  const input = { testId: 'EXAM-001', studentUid: 'student-uid-42', answers: baseAnswers };

  test('produces a 64-char lowercase hex SHA-256 digest', async () => {
    const seal = await computeSubmissionSeal(input);
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic across repeated calls', async () => {
    const a = await computeSubmissionSeal(input);
    const b = await computeSubmissionSeal(input);
    expect(a).toBe(b);
  });

  test('is independent of object key insertion order', async () => {
    const reordered = {
      testId: 'EXAM-001',
      studentUid: 'student-uid-42',
      answers: { q3: 'Final answer = 42', q1: 'A', q2: ['x', 'y'] },
    };
    expect(await computeSubmissionSeal(input)).toBe(await computeSubmissionSeal(reordered));
  });

  test('changes when any answer is tampered with', async () => {
    const seal = await computeSubmissionSeal(input);
    const tampered = {
      ...input,
      answers: { ...baseAnswers, q1: 'B' },
    };
    const tamperedSeal = await computeSubmissionSeal(tampered);
    expect(tamperedSeal).not.toBe(seal);
    expect(await verifySubmissionSeal(tampered, seal)).toBe(false);
    expect(await verifySubmissionSeal(input, seal)).toBe(true);
  });

  test('changes when student or test identity changes', async () => {
    const seal = await computeSubmissionSeal(input);
    const otherStudent = await computeSubmissionSeal({ ...input, studentUid: 'someone-else' });
    const otherTest = await computeSubmissionSeal({ ...input, testId: 'EXAM-002' });
    expect(otherStudent).not.toBe(seal);
    expect(otherTest).not.toBe(seal);
  });

  test('stableStringify sorts nested keys recursively', () => {
    const a = stableStringify({ b: { y: 1, x: 2 }, a: [{ z: 3, k: 4 }] });
    const b = stableStringify({ a: [{ k: 4, z: 3 }], b: { x: 2, y: 1 } });
    expect(a).toBe(b);
  });
});
