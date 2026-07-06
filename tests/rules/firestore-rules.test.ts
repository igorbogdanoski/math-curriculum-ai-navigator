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

    it('owner cannot self-create with an elevated role or credits (create-path escalation)', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const ctx = testEnv.authenticatedContext('carol');
      const f = ctx.firestore() as unknown as {
        doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertFails(f.doc('users/carol').set({ role: 'admin', name: 'Carol' }));
      await assertFails(f.doc('users/carol').set({ role: 'teacher', isPremium: true, name: 'Carol' }));
      await assertFails(f.doc('users/carol').set({ role: 'teacher', aiCreditsBalance: 99999, name: 'Carol' }));
      await assertSucceeds(f.doc('users/carol').set({ role: 'teacher', aiCreditsBalance: 50, tier: 'Free', isPremium: false, hasUnlimitedCredits: false, name: 'Carol' }));
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

  describe('class_memberships/{deviceDoc}', () => {
    it('a plain authenticated (non-anonymous) user cannot read/write another device\'s membership', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('class_memberships/device1').set({ deviceId: 'device1', teacherUid: 'teacher1', classId: 'c1' });
      });
      const ctx = testEnv.authenticatedContext('randomUser');
      const f = ctx.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; set(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertFails(f.doc('class_memberships/device1').get());
      await assertFails(f.doc('class_memberships/device2').set({ deviceId: 'device2', teacherUid: 'teacher1', classId: 'c1' }));
    });

    it('an anonymous student session can read/write class_memberships', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const ctx = testEnv.authenticatedContext('anonDevice', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as {
        doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertSucceeds(f.doc('class_memberships/anonDevice').set({ deviceId: 'anonDevice', teacherUid: 'teacher1', classId: 'c1' }));
    });

    it('the owning teacher can read their class memberships (GDPR self-service delete path)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('class_memberships/device3').set({ deviceId: 'device3', teacherUid: 'teacherX', classId: 'c1' });
      });
      const ctx = testEnv.authenticatedContext('teacherX');
      const f = ctx.firestore() as unknown as { doc(p: string): { delete(): Promise<unknown> } };
      await assertSucceeds(f.doc('class_memberships/device3').delete());
    });
  });

  describe('saved_questions/{doc} — admin moderation workflow', () => {
    it('admin can approve (full review field set); a random authenticated user cannot', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('users/admin1').set({ role: 'admin' });
        await f.doc('saved_questions/q1').set({ teacherUid: 'teacher1', isApproved: false });
      });
      const admin = testEnv.authenticatedContext('admin1');
      const intruder = testEnv.authenticatedContext('someoneElse');
      const fAdmin = admin.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      const fIntruder = intruder.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(fIntruder.doc('saved_questions/q1').update({ isApproved: true, isVerified: true, reviewStatus: 'approved' }));
      await assertSucceeds(fAdmin.doc('saved_questions/q1').update({
        isApproved: true, isVerified: true, isPublic: true, reviewStatus: 'approved',
        reviewedBy: 'admin1', reviewedAt: new Date(),
      }));
    });

    it('a school_admin can read/approve saved_questions scoped to their own school, but not another school\'s', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('users/schoolAdminA').set({ role: 'school_admin', schoolId: 'school-A' });
        await f.doc('saved_questions/qA').set({ teacherUid: 'teacher1', schoolId: 'school-A', isApproved: false });
        await f.doc('saved_questions/qB').set({ teacherUid: 'teacher2', schoolId: 'school-B', isApproved: false });
      });
      const schoolAdminA = testEnv.authenticatedContext('schoolAdminA');
      const fSchoolAdminA = schoolAdminA.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertSucceeds(fSchoolAdminA.doc('saved_questions/qA').get());
      await assertSucceeds(fSchoolAdminA.doc('saved_questions/qA').update({
        isApproved: true, isVerified: true, isPublic: true, reviewStatus: 'approved',
        reviewedBy: 'schoolAdminA', reviewedAt: new Date(),
      }));
      await assertFails(fSchoolAdminA.doc('saved_questions/qB').get());
      await assertFails(fSchoolAdminA.doc('saved_questions/qB').update({ isApproved: true, reviewStatus: 'approved' }));
    });
  });

  describe('scenario_bank/{docId} — moderation fields scoping', () => {
    it('any authenticated teacher may bump community counters, but not flip deleted/isFeatured', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('scenario_bank/s1').set({ authorUid: 'author1', forkCount: 0, deleted: false, isFeatured: false });
      });
      const ctx = testEnv.authenticatedContext('someTeacher');
      const f = ctx.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('scenario_bank/s1').update({ forkCount: 1 }));
      await assertFails(f.doc('scenario_bank/s1').update({ deleted: true }));
      await assertFails(f.doc('scenario_bank/s1').update({ isFeatured: true }));
    });
  });

  describe('previously-unruled collections (now fixed)', () => {
    it('school_inquiries: public create succeeds; only admin can read', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.unauthenticatedContext();
      const fAnon = anon.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(fAnon.collection('school_inquiries').add({ schoolName: 'Test School', teacherCount: 5 }));

      const ctx = testEnv.authenticatedContext('randomTeacher');
      const f = ctx.firestore() as unknown as { collection(p: string): { get(): Promise<unknown> } };
      await assertFails(f.collection('school_inquiries').get());
    });

    it('grade_books: only the owning teacher can read/write their gradebook', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('grade_books/gb1').set({ teacherUid: 'teacherY', className: 'X' });
      });
      const owner = testEnv.authenticatedContext('teacherY');
      const intruder = testEnv.authenticatedContext('nosyTeacher');
      const fOwner = owner.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      const fIntruder = intruder.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertSucceeds(fOwner.doc('grade_books/gb1').get());
      await assertFails(fIntruder.doc('grade_books/gb1').get());
    });

    it('academy_badges: any authenticated user can read, only the owner can write', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('academy_badges/teacherY').set({ completedSpecializationIds: ['inclusive-teacher'] });
      });
      const owner = testEnv.authenticatedContext('teacherY');
      const otherTeacher = testEnv.authenticatedContext('anotherTeacher');
      const fOwner = owner.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; set(d: Record<string, unknown>): Promise<unknown> };
      };
      const fOther = otherTeacher.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; set(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertSucceeds(fOwner.doc('academy_badges/teacherY').get());
      await assertSucceeds(fOther.doc('academy_badges/teacherY').get());
      await assertSucceeds(fOwner.doc('academy_badges/teacherY').set({ completedSpecializationIds: ['inclusive-teacher', 'digital-innovator'] }));
      await assertFails(fOther.doc('academy_badges/teacherY').set({ completedSpecializationIds: [] }));
    });
  });
});
