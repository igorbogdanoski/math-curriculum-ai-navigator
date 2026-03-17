/**
 * E2E Test Helpers — shared utilities for Playwright tests
 *
 * Strategy: Route-interception approach — no Firebase Emulator needed.
 * All Firestore REST calls and Gemini proxy calls are intercepted and
 * answered with mock data, giving full control over test scenarios.
 */

import type { Page } from '@playwright/test';

// ── Test Quiz Data ────────────────────────────────────────────────────────────

export const E2E_QUIZ_ID = 'e2e-test-quiz-001';

export const MOCK_QUIZ_CONTENT = {
  title: 'E2E Тест: Основни операции',
  items: [
    {
      text: '2 + 3 = ?',
      answer: '5',
      options: ['3', '4', '5', '6'],
      solution: '2 + 3 = 5',
    },
    {
      text: '8 - 5 = ?',
      answer: '3',
      options: ['2', '3', '4', '5'],
      solution: '8 - 5 = 3',
    },
    {
      text: '4 × 2 = ?',
      answer: '8',
      options: ['6', '7', '8', '9'],
      solution: '4 × 2 = 8',
    },
  ],
  conceptId: 'C6A1',
  gradeLevel: 6,
};

export const MOCK_QUIZ_RESULTS = Array.from({ length: 12 }, (_, i) => ({
  quizId: `quiz-${i + 1}`,
  quizTitle: `Квиз ${i + 1}`,
  percentage: 60 + (i % 4) * 10,
  correctCount: 6 + (i % 4),
  totalQuestions: 10,
  studentName: 'Тест Ученик',
  teacherUid: 'test-teacher-uid',
  conceptId: 'C6A1',
  gradeLevel: 6,
  playedAt: new Date(Date.now() - i * 86400 * 1000).toISOString(),
}));

// ── Firestore Wire Format ────────────────────────────────────────────────────

function toWire(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toWire) } };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, toWire(v)])
        ),
      },
    };
  }
  return { stringValue: String(val) };
}

export function makeFirestoreDoc(
  collection: string,
  id: string,
  data: Record<string, unknown>
) {
  return {
    name: `projects/math-nav/databases/(default)/documents/${collection}/${id}`,
    fields: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, toWire(v)])
    ),
    createTime: '2026-03-15T00:00:00.000000Z',
    updateTime: '2026-03-15T00:00:00.000000Z',
  };
}

/** runQuery (getDocs) response — array of document entries */
export function makeFirestoreQueryResult(
  collection: string,
  docs: Array<{ id: string; data: Record<string, unknown> }>
) {
  if (docs.length === 0) return [{}]; // Firestore returns [{}] for empty results
  return docs.map(({ id, data }) => ({
    document: makeFirestoreDoc(collection, id, data),
    readTime: '2026-03-15T00:00:00.000000Z',
  }));
}

// ── Route Mocking ────────────────────────────────────────────────────────────

/**
 * Mock a specific Firestore document GET and batchGet.
 *
 * Firebase Web SDK v9+ uses POST :batchGet (not a simple GET) for getDoc() calls.
 * We mock both the legacy GET path and the batchGet POST path for full coverage.
 */
export async function mockFirestoreGet(
  page: Page,
  collection: string,
  docId: string,
  data: Record<string, unknown>
) {
  const firestoreDoc = makeFirestoreDoc(collection, docId, data);

  // Legacy REST GET path (fallback / older SDK versions)
  const getPattern = new RegExp(
    `firestore\\.googleapis\\.com.+documents/${collection}/${docId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`
  );
  await page.route(getPattern, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(firestoreDoc),
      });
    } else {
      await route.fallback();
    }
  });

  // Firebase SDK v9+ batchGet path — getDoc() calls POST .../documents:batchGet
  // with document paths in the POST body. We match by checking if docId appears in body.
  await page.route(/firestore\.googleapis\.com.*:batchGet/, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes(docId)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ found: firestoreDoc, readTime: '2026-03-15T00:00:00.000000Z' }]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Mock a specific Firestore document not found (404).
 */
export async function mockFirestoreNotFound(
  page: Page,
  collection: string,
  docId: string
) {
  // Legacy REST GET path
  const getPattern = new RegExp(
    `firestore\\.googleapis\\.com.+documents/${collection}/${docId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`
  );
  await page.route(getPattern, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 404, message: 'NOT_FOUND' } }),
      });
    } else {
      await route.fallback();
    }
  });

  // Firebase SDK v9+ batchGet path
  await page.route(/firestore\.googleapis\.com.*:batchGet/, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes(docId)) {
      // SDK expects an array of results. "missing" indicates 404 for a specific document path.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ 
          missing: `projects/mock/databases/(default)/documents/${collection}/${docId}`, 
          readTime: '2026-03-15T00:00:00.000000Z' 
        }]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Mock all Firestore runQuery (getDocs) POST calls with empty results.
 * This prevents the app from hanging on collection queries during tests.
 */
export async function mockAllFirestoreQueries(page: Page) {
  await page.route(/firestore\.googleapis\.com.*:runQuery/, async (route) => {
    console.log(`[HELPERS] mockAllFirestoreQueries caught: ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{}]), // empty result set
    });
  });
}

/**
 * Mock Firestore document writes (POST/PATCH/DELETE) — always succeed silently.
 * For GET requests, falls back to the next matching handler (e.g. mockFirestoreGet)
 * so specific document mocks are not bypassed.
 */
export async function mockFirestoreWrites(page: Page) {
  console.log('[HELPERS] mockFirestoreWrites registering');
  // Use a regex that specifically avoids :runQuery and :batchGet
  await page.route(/firestore\.googleapis\.com.*documents/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    // Explicit fallback for queries and batch gets
    if (url.includes(':runQuery') || url.includes(':batchGet')) {
      await route.fallback();
      return;
    }

    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      console.log(`[E2E] mockFirestoreWrites fulfilling ${method} for: ${url}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          name: 'projects/mock/databases/(default)/documents/mock/mock',
          fields: {},
          createTime: '2026-03-15T00:00:00.000000Z',
          updateTime: '2026-03-15T00:00:00.000000Z'
        }),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Mock Firebase Auth token-refresh calls (securetoken + identitytoolkit).
 * Needed so the SDK doesn't throw on unauthenticated teacher pages.
 */
export async function mockFirebaseAuth(page: Page, teacherUid = 'test-teacher-uid') {
  // Token refresh
  await page.route(/securetoken\.googleapis\.com.*token/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: '3600',
        refresh_token: 'mock-refresh-token',
      }),
    });
  });
  // Account lookup
  await page.route(/identitytoolkit\.googleapis\.com.*accounts:lookup/, async (route) => {
    // Determine if we're looking up the student or the teacher based on request body
    const postData = route.request().postData() ?? '';
    const isStudent = postData.includes('mock-student-uid');

    if (isStudent) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{
            localId: 'mock-student-uid',
            email: 'student@test.mk',
            displayName: 'Тест Ученик',
            emailVerified: false, // Student is anonymous
            providerUserInfo: [],
          }],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{
            localId: teacherUid,
            email: 'teacher@test.mk',
            displayName: 'Тест Наставник',
            emailVerified: true,
            providerUserInfo: [{ providerId: 'google.com' }],
          }],
        }),
      });
    }
  });
  // Anonymous Sign-In / Sign-Up
  await page.route(/identitytoolkit\.googleapis\.com.*accounts:signUp/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        localId: 'mock-student-uid',
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: '3600',
      }),
    });
  });
}

/**
 * Mock the Gemini AI proxy — always returns a short МК feedback string.
 */
export async function mockGemini(page: Page) {
  await page.route(/\/api\/gemini/, async (route) => {
    const postData = route.request().postData() || '';
    let mockText = 'Одличен резултат!';
    
    // Check if it's a recommendations request (expects array)
    if (postData.includes('recommendations') || postData.includes('препораки')) {
      mockText = JSON.stringify([
        { category: 'Напредок', title: 'Продолжи со вежбање', recommendationText: 'Одлично ти оди со дропките.' }
      ]);
    } else if (postData.includes('quiz') || postData.includes('assessment')) {
      // Default mock quiz if nothing else matches
      mockText = JSON.stringify({
        title: 'Mock Quiz',
        items: [{ text: '1+1?', answer: '2', options: ['1','2','3','4'], solution: '1+1=2' }]
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        text: mockText,
        candidates: [{
          content: { parts: [{ text: mockText }] },
        }],
      }),
    });
  });
}

/** Setup complete student play environment — all mocks needed for a quiz session */
export async function setupStudentPlayMocks(page: Page, quizId = E2E_QUIZ_ID) {
  console.log(`[HELPERS] setupStudentPlayMocks starting for quizId: ${quizId}`);
  // Use direct global injection for quiz content — most reliable for E2E.
  const quizContentJson = JSON.stringify(MOCK_QUIZ_CONTENT);
  await page.addInitScript((json: string) => {
    window.__E2E_MOCK_QUIZ_CONTENT__ = JSON.parse(json);
    window.__E2E_MODE__ = true;
  }, quizContentJson);

  // Mock Gemini AI responses (used for quiz feedback after completion)
  await mockGemini(page);

  // Mock Firebase Auth for anonymous sign-in
  await mockFirebaseAuth(page);

  // Catch-all for any Firestore GET requests (batchGet or documents/)
  // This prevents the app from hanging when it tries to read concept_mastery or gamification docs
  await page.route(/firestore\.googleapis\.com.*(:batchGet|documents\/)/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    
    // Only handle GET (or batchGet POST which is semantically a GET)
    if (method === 'GET' || (method === 'POST' && url.includes(':batchGet'))) {
      console.log(`[E2E] Catch-all Firestore GET: ${url}`);
      
      // Return 404 (missing) by default — this is safe for most app logic
      // which handles new/missing documents gracefully.
      if (url.includes(':batchGet')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ missing: 'projects/mock/databases/(default)/documents/mock/mock', readTime: new Date().toISOString() }]),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 404, message: 'NOT_FOUND' } }),
        });
      }
    } else {
      await route.fallback();
    }
  });

  // Silently handle other Firestore traffic
  await page.route(/firestore\.googleapis\.com/, async (route) => {
    // If it's a batchGet (standard getDoc), check if we should fallback to other handlers
    if (route.request().url().includes(':batchGet') || route.request().url().includes('documents/')) {
      await route.fallback();
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    }
  });

  // Mock Firestore writes (POST/PATCH/DELETE) — MUST BE LAST to override catch-alls
  await mockFirestoreWrites(page);
}

/** Setup complete teacher environment — mocks auth, Firestore, and Gemini */
export async function setupTeacherMocks(page: Page, teacherUid = 'test-teacher-uid') {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('Auth')) {
      console.log(`[PAGE ${msg.type()}] ${msg.text()}`);
    }
  });

  // Mock Auth
  await mockFirebaseAuth(page, teacherUid);

  // Mock Firestore
  await mockFirestoreWrites(page);
  await mockAllFirestoreQueries(page);

  // Mock Gemini
  await mockGemini(page);

  // Inject Teacher auth state into localStorage
  const apiKey = process.env['VITE_FIREBASE_API_KEY'] || 'AIzaSyDHumbEH30zWP_GzGyyKUMa4ma1rm6oZ70';
  
  await page.addInitScript(({ uid, key, results }: { uid: string; key: string; results: any[] }) => {
    const authData = JSON.stringify({
      uid: uid,
      email: 'teacher@test.mk',
      emailVerified: true,
      isAnonymous: false,
      displayName: 'Тест Наставник',
      stsTokenManager: {
        refreshToken: 'mock-refresh-token',
        accessToken: 'mock-access-token',
        expirationTime: Date.now() + 3_600_000,
      },
    });
    localStorage.setItem(`firebase:authUser:${key}:[DEFAULT]`, authData);
    localStorage.setItem(`firebase:authUser:${key}:default`, authData);
    localStorage.setItem(`firebase:authUser:${key}`, authData);
    localStorage.setItem('firebase:authUser:mock-api-key:[DEFAULT]', authData);
    
    console.log('E2E: Set authData in localStorage for key:', key);
    // Set a flag for our mocks to know we are in teacher mode
    window.__E2E_TEACHER_MODE__ = true;
    window.__E2E_MOCK_QUIZ_RESULTS__ = results;
    window.__E2E_MOCK_MASTERY__ = [];
  }, { uid: teacherUid, key: apiKey, results: MOCK_QUIZ_RESULTS });

  // Mock the teacher profile document in Firestore
  await mockFirestoreGet(page, 'users', teacherUid, {
    name: 'Тест Наставник',
    role: 'teacher',
    aiCreditsBalance: 500,
    schoolId: 'test-school',
    schoolName: 'Тест Училиште',
    tier: 'Premium',
    isPremium: true,
    toursSeen: {
      onboarding_wizard: true,
      dashboard: true,
      generator: true,
      planner: true,
      analytics: true,
    },
  });

  // Bypass tours globally via CSS — most robust for E2E
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #react-joyride-portal, .react-joyride__overlay, .react-joyride__spotlight, #e2e-onboarding-wizard {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `;
    document.documentElement.appendChild(style);
  });
}
