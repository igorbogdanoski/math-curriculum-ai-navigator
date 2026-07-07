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

  describe('academic_annual_plans/{doc} — like/unlike toggle scoping', () => {
    it('any authenticated user may add/remove only their own uid to likedByUid, not arbitrary uids', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('academic_annual_plans/p1').set({ userId: 'author1', isPublic: true, likedByUid: [] });
      });
      const liker = testEnv.authenticatedContext('liker1');
      const fLiker = liker.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };

      // Adding someone else's uid instead of their own must fail.
      await assertFails(fLiker.doc('academic_annual_plans/p1').update({ likedByUid: ['someoneElse'] }));
      // Adding their own uid (the toggle "like" path) must succeed.
      await assertSucceeds(fLiker.doc('academic_annual_plans/p1').update({ likedByUid: ['liker1'] }));
      // Removing their own uid (the toggle "unlike" path) must succeed.
      await assertSucceeds(fLiker.doc('academic_annual_plans/p1').update({ likedByUid: [] }));
      // Bumping likedByUid by more than one entry at once must fail.
      await assertFails(fLiker.doc('academic_annual_plans/p1').update({ likedByUid: ['liker1', 'someoneElse'] }));
    });
  });

  describe('cached_ai_materials/{doc} — peer rating cannot wipe other ratings', () => {
    it("setting only the caller's own rating entry succeeds; overwriting the whole map fails", async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('cached_ai_materials/m1').set({ teacherUid: 'author1', ratingsByUid: { other1: 4 } });
      });
      const rater = testEnv.authenticatedContext('rater1');
      const fRater = rater.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };

      // Adding only their own key, preserving other1's, must succeed.
      await assertSucceeds(fRater.doc('cached_ai_materials/m1').update({ 'ratingsByUid.rater1': 5 }));
      // Wiping the whole map down to just their own entry must fail.
      await assertFails(fRater.doc('cached_ai_materials/m1').update({ ratingsByUid: { rater1: 5 } }));
    });
  });

  describe('scenario_bank/{docId} — community fields scoped per-uid', () => {
    it('rating only touches the caller\'s own key; save/unsave only touches the caller\'s own uid', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('scenario_bank/s2').set({
          authorUid: 'author1', deleted: false, isFeatured: false,
          ratingsByUid: { other1: 4 }, savedByUids: ['other1'], forkCount: 0, usageCount: 0,
        });
      });
      const teacher = testEnv.authenticatedContext('teacher2');
      const f = teacher.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.doc('scenario_bank/s2').update({ 'ratingsByUid.teacher2': 5 }));
      await assertFails(f.doc('scenario_bank/s2').update({ ratingsByUid: { teacher2: 5 } }));
      await assertSucceeds(f.doc('scenario_bank/s2').update({ savedByUids: ['other1', 'teacher2'] }));
      await assertFails(f.doc('scenario_bank/s2').update({ savedByUids: ['teacher2'] })); // drops other1
      await assertSucceeds(f.doc('scenario_bank/s2').update({ forkCount: 1 }));
      await assertFails(f.doc('scenario_bank/s2').update({ forkCount: 100 }));
    });
  });

  describe('matura_community_solutions/{solutionId} — upvote toggle scoped per-uid', () => {
    it('upvotes must move in lockstep with the caller\'s own uid in upvoterUids', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('matura_community_solutions/sol1').set({ authorUid: 'author1', upvotes: 1, upvoterUids: ['other1'] });
      });
      const voter = testEnv.authenticatedContext('voter1');
      const f = voter.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.doc('matura_community_solutions/sol1').update({ upvotes: 2, upvoterUids: ['other1', 'voter1'] }));
      // Setting the count directly without a matching membership change must fail.
      await assertFails(f.doc('matura_community_solutions/sol1').update({ upvotes: 999, upvoterUids: ['other1'] }));
    });
  });

  describe('matura_ai_grades/{cacheKey} — direct client writes always denied', () => {
    it('grading + cache writes now only happen server-side via /api/matura-grade (Admin SDK)', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const student = testEnv.authenticatedContext('student1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = student.firestore() as unknown as {
        doc(p: string): { set(d: Record<string, unknown>): Promise<unknown>; get(): Promise<unknown> };
      };
      // A client precomputing the deterministic cache key and writing a fabricated grade must fail.
      await assertFails(f.doc('matura_ai_grades/exam1_q1_abc123').set({ score: 4, maxPoints: 4, feedback: 'fake' }));

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const admin = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await admin.doc('matura_ai_grades/exam1_q1_abc123').set({ score: 2, maxPoints: 4, feedback: 'real' });
      });
      // Reading an already-cached (server-written) grade is still allowed.
      await assertSucceeds(f.doc('matura_ai_grades/exam1_q1_abc123').get());
    });
  });

  describe('mind_maps/{doc} — owner-only', () => {
    it('the owning teacher can read/update their own mind map; another teacher cannot', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('mind_maps/m1').set({ teacherUid: 'teacher1', topic: 'Дропки', gradeLevel: 6, nodes: [] });
      });
      const owner = testEnv.authenticatedContext('teacher1');
      const intruder = testEnv.authenticatedContext('teacher2');
      const fOwner = owner.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> };
      };
      const fIntruder = intruder.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertSucceeds(fOwner.doc('mind_maps/m1').get());
      await assertSucceeds(fOwner.doc('mind_maps/m1').update({ topic: 'Дропки и децимали' }));
      await assertFails(fIntruder.doc('mind_maps/m1').get());
      await assertFails(fIntruder.doc('mind_maps/m1').update({ topic: 'Хакирано' }));
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

  describe('student_identity/{deviceId} — create must be bound to the caller\'s own uid', () => {
    it('a caller cannot create a student_identity doc claiming a different anonymousUid', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const caller = testEnv.authenticatedContext('anon-real-uid');
      const f = caller.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.doc('student_identity/device1').set({ deviceId: 'device1', name: 'Learner', anonymousUid: 'someone-elses-uid' }));
      await assertSucceeds(f.doc('student_identity/device1').set({ deviceId: 'device1', name: 'Learner', anonymousUid: 'anon-real-uid' }));
    });
  });

  describe('saved_questions/{doc} — school-admin null-guard consistency', () => {
    it('a school_admin without their own schoolId set cannot read/delete a question missing schoolId', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('users/schoolAdminNoSchool').set({ role: 'school_admin' });
        await f.doc('saved_questions/q1').set({ teacherUid: 'someTeacher' }); // no schoolId field at all
      });
      const admin = testEnv.authenticatedContext('schoolAdminNoSchool');
      const f = admin.firestore() as unknown as { doc(p: string): { get(): Promise<unknown>; delete(): Promise<unknown> } };
      await assertFails(f.doc('saved_questions/q1').get());
      await assertFails(f.doc('saved_questions/q1').delete());
    });
  });

  describe('student_gamification/{doc} — numeric bounds on XP/streaks', () => {
    it('rejects absurd totalXP/streak values but accepts realistic ones', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.authenticatedContext('anonStudent1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = anon.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.doc('student_gamification/g1').set({ studentName: 'Ana', totalXP: 99999999 }));
      await assertFails(f.doc('student_gamification/g2').set({ studentName: 'Ana', currentStreak: -1 }));
      await assertSucceeds(f.doc('student_gamification/g3').set({ studentName: 'Ana', totalXP: 500, currentStreak: 5, longestStreak: 10 }));
    });
  });

  describe('quiz_results/concept_mastery/student_gamification — deviceId bound to student_identity', () => {
    it('an anonymous student cannot claim a deviceId already bound to a different uid', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceA').set({ deviceId: 'deviceA', name: 'Ана', anonymousUid: 'the-real-owner' });
      });
      const impostor = testEnv.authenticatedContext('a-different-anon-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = impostor.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.collection('quiz_results').add({ studentName: 'Ана', percentage: 90, conceptId: 'c1', deviceId: 'deviceA' }));
      await assertFails(f.collection('concept_mastery').add({ studentName: 'Ана', conceptId: 'c1', deviceId: 'deviceA' }));
    });

    it('a deviceId with no student_identity doc yet is first-come-first-served (covers live-PIN-join before the first confirm completes)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const firstComer = testEnv.authenticatedContext('brand-new-anon-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = firstComer.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.collection('quiz_results').add({ studentName: 'Марко', percentage: 70, conceptId: 'c1', deviceId: 'brand-new-device' }));
    });

    it('the legitimate owning anonymous uid can write under their own claimed deviceId', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceB').set({ deviceId: 'deviceB', name: 'Ива', anonymousUid: 'owner-uid' });
      });
      const owner = testEnv.authenticatedContext('owner-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = owner.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.collection('quiz_results').add({ studentName: 'Ива', percentage: 85, conceptId: 'c1', deviceId: 'deviceB' }));
    });

    it('a teacher (non-anonymous) referencing a student device bound to someone else stays exempt', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceC').set({ deviceId: 'deviceC', name: 'Дарко', anonymousUid: 'student-uid' });
      });
      const teacher = testEnv.authenticatedContext('teacher-uid');
      const f = teacher.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.collection('concept_mastery').add({ studentName: 'Дарко', conceptId: 'c1', deviceId: 'deviceC', teacherUid: 'teacher-uid' }));
    });

    it('a write with no deviceId field at all (lab session shape) is unaffected', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.authenticatedContext('lab-anon-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = anon.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.collection('quiz_results').add({ studentName: 'Лаб Ученик', percentage: 60, conceptId: 'lab-c1' }));
    });

    it('quiz_results update: a non-owning anonymous student cannot set confidence on another device\'s result', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceD').set({ deviceId: 'deviceD', name: 'Сара', anonymousUid: 'sara-uid' });
        await f.doc('quiz_results/qr1').set({ studentName: 'Сара', percentage: 90, conceptId: 'c1', deviceId: 'deviceD' });
      });
      const impostor = testEnv.authenticatedContext('not-sara', { firebase: { sign_in_provider: 'anonymous' } });
      const owner = testEnv.authenticatedContext('sara-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const fImpostor = impostor.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      const fOwner = owner.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(fImpostor.doc('quiz_results/qr1').update({ confidence: 3 }));
      await assertSucceeds(fOwner.doc('quiz_results/qr1').update({ confidence: 4 }));
    });
  });
});
