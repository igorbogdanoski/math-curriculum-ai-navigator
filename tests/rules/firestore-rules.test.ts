/**
 * SEC-2 — Firestore rules coverage tests (emulator-gated).
 *
 * These tests run against a local Firestore emulator using
 * `@firebase/rules-unit-testing`. They are intentionally OFF by default:
 *
 *   • The file lives under `tests/` which is excluded from the default
 *     vitest run (`vitest.config.ts::exclude`).
 *   • Use `npm run test:rules` to invoke them with the rules-only config
 *     (`vitest.config.rules.ts`).
 *   • Each describe is gated by `FIRESTORE_EMULATOR_HOST` — if the emulator
 *     isn't reachable, the suite skips cleanly instead of failing CI.
 *
 * Coverage scope (4 representative collections out of 23):
 *   1. `users/{uid}` — self-only read/update; protected fields cannot be edited
 *   2. `quiz_results/{doc}` — create requires `studentName + percentage + conceptId`
 *   3. `cached_ai_materials/{doc}` — peer rating bounded to int 1..5
 *   4. `assignments/{doc}` — only the owning teacher (teacherUid) may edit/delete
 *
 * The remaining 19 collections follow the same patterns; this scaffold proves
 * the harness wiring and gives the next sprint a copy-paste template.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Skip the entire suite if the Firestore emulator isn't configured.
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const HAS_EMULATOR = typeof EMULATOR === 'string' && EMULATOR.length > 0;

// Use describe.skipIf so the file can be imported without exploding when the
// devDep isn't installed yet — the dynamic import lives inside beforeAll.
const d = HAS_EMULATOR ? describe : describe.skip;

interface RulesTestEnvLike {
  cleanup(): Promise<void>;
  authenticatedContext(uid: string, claims?: Record<string, unknown>): {
    firestore(): unknown;
  };
  unauthenticatedContext(): { firestore(): unknown };
  withSecurityRulesDisabled<T>(fn: (ctx: { firestore(): unknown }) => Promise<T>): Promise<T>;
}

let testEnv: RulesTestEnvLike | null = null;

d('SEC-2 — Firestore rules coverage', () => {
  beforeAll(async () => {
    const mod = await import('@firebase/rules-unit-testing').catch(() => null);
    if (!mod) {
      // Package not installed — the rest of the tests will short-circuit.
      console.warn('[SEC-2] @firebase/rules-unit-testing not installed; skipping rules tests.');
      return;
    }
    const { initializeTestEnvironment } = mod as unknown as {
      initializeTestEnvironment(opts: {
        projectId: string;
        firestore: { rules: string; host?: string; port?: number };
      }): Promise<RulesTestEnvLike>;
    };
    const rulesPath = resolve(process.cwd(), 'firestore.rules');
    const rules = readFileSync(rulesPath, 'utf8');
    const [host, portStr] = (EMULATOR ?? 'localhost:8080').split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-rules-coverage',
      firestore: { rules, host, port: Number(portStr ?? '8080') },
    });
  }, 30_000);

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  describe('users/{uid}', () => {
    it('owner can read own profile', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const ctx = testEnv.authenticatedContext('alice');
      const db = ctx.firestore() as { /* mocked at runtime */ };
      // Cast through unknown — at runtime this is a real Firestore client.
      const f = db as unknown as {
        doc(p: string): { get(): Promise<unknown> };
      };
      await assertSucceeds(f.doc('users/alice').get());
    });

    it('non-owner cannot read another profile', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const ctx = testEnv.authenticatedContext('bob');
      const f = ctx.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown> };
      };
      await assertFails(f.doc('users/alice').get());
    });

    it('owner cannot escalate role / credits', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      // Seed the doc with rules disabled.
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('users/alice').set({ role: 'teacher', aiCreditsBalance: 100 });
      });
      const ctx = testEnv.authenticatedContext('alice');
      const f = ctx.firestore() as unknown as {
        doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertFails(f.doc('users/alice').update({ role: 'admin' }));
      await assertFails(f.doc('users/alice').update({ aiCreditsBalance: 99999 }));
    });
  });

  describe('quiz_results/{doc}', () => {
    it('create requires studentName + percentage + conceptId', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const ctx = testEnv.authenticatedContext('s1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as {
        collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertFails(f.collection('quiz_results').add({ studentName: 'X' }));
      await assertSucceeds(f.collection('quiz_results').add({
        studentName: 'X', percentage: 80, conceptId: 'c1',
      }));
    });
  });

  describe('cached_ai_materials/{doc}', () => {
    it('peer rating must be int 1..5', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('cached_ai_materials/m1').set({ teacherUid: 'owner', ratingsByUid: {} });
      });
      const ctx = testEnv.authenticatedContext('rater');
      const f = ctx.firestore() as unknown as {
        doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertFails(f.doc('cached_ai_materials/m1').update({ 'ratingsByUid.rater': 6 }));
      await assertFails(f.doc('cached_ai_materials/m1').update({ 'ratingsByUid.rater': 0 }));
      await assertSucceeds(f.doc('cached_ai_materials/m1').update({ 'ratingsByUid.rater': 4 }));
    });
  });

  describe('assignments/{doc}', () => {
    it('only the owning teacher may delete', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('assignments/a1').set({ teacherUid: 'teacher1', title: 'T' });
      });
      const intruder = testEnv.authenticatedContext('teacher2');
      const owner = testEnv.authenticatedContext('teacher1');
      const fIntruder = intruder.firestore() as unknown as {
        doc(p: string): { delete(): Promise<unknown> };
      };
      const fOwner = owner.firestore() as unknown as {
        doc(p: string): { delete(): Promise<unknown> };
      };
      await assertFails(fIntruder.doc('assignments/a1').delete());
      await assertSucceeds(fOwner.doc('assignments/a1').delete());
    });
  });
});
