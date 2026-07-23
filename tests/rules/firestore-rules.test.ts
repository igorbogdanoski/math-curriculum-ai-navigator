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

import { describe, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collection, query, where, getDocs, type Firestore } from 'firebase/firestore';

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

  describe('scenario_bank/{docId} — read scoped to isPublic drafts (2026-07-23 privacy fix)', () => {
    it('a private (isPublic!=true) draft is readable only by its author or an admin, not any authenticated teacher', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('scenario_bank/private1').set({ authorUid: 'author1', isPublic: false });
        await f.doc('users/admin1').set({ role: 'admin' });
      });

      const author = testEnv.authenticatedContext('author1');
      await assertSucceeds(
        (author.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } })
          .doc('scenario_bank/private1').get(),
      );

      const admin = testEnv.authenticatedContext('admin1');
      await assertSucceeds(
        (admin.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } })
          .doc('scenario_bank/private1').get(),
      );

      const otherTeacher = testEnv.authenticatedContext('teacher3');
      await assertFails(
        (otherTeacher.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } })
          .doc('scenario_bank/private1').get(),
      );
    });

    it('a public (isPublic==true) scenario is readable by any authenticated teacher', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('scenario_bank/public1').set({ authorUid: 'author1', isPublic: true });
      });
      const otherTeacher = testEnv.authenticatedContext('teacher4');
      await assertSucceeds(
        (otherTeacher.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } })
          .doc('scenario_bank/public1').get(),
      );
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

  describe('math_expressions/{doc} — owner-only', () => {
    it('the owning teacher can read/update their own saved expression; another teacher cannot', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as {
          doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
        };
        await f.doc('math_expressions/e1').set({ teacherUid: 'teacher1', latex: '\\frac{1}{2}' });
      });
      const owner = testEnv.authenticatedContext('teacher1');
      const intruder = testEnv.authenticatedContext('teacher2');
      const fOwner = owner.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> };
      };
      const fIntruder = intruder.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertSucceeds(fOwner.doc('math_expressions/e1').get());
      await assertSucceeds(fOwner.doc('math_expressions/e1').update({ latex: 'x^2' }));
      await assertFails(fIntruder.doc('math_expressions/e1').get());
      await assertFails(fIntruder.doc('math_expressions/e1').update({ latex: 'hijacked' }));
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

  describe('class_memberships/{deviceDoc} — scoped to the claimed device owner, not any anonymous session', () => {
    it('the legitimate owning anonymous uid (per student_identity) can read/write their own device\'s membership', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceX').set({ deviceId: 'deviceX', name: 'Марко', anonymousUid: 'owner-uid' });
      });
      const owner = testEnv.authenticatedContext('owner-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = owner.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown>; get(): Promise<unknown> } };
      await assertSucceeds(f.doc('class_memberships/deviceX').set({ teacherUid: 'teacher1', classId: 'c1', studentName: 'Марко' }));
      await assertSucceeds(f.doc('class_memberships/deviceX').get());
    });

    it('a different anonymous session cannot read/write a device\'s membership once that device is claimed', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceY').set({ deviceId: 'deviceY', name: 'Ана', anonymousUid: 'real-owner-uid' });
        await f.doc('class_memberships/deviceY').set({ teacherUid: 'teacher1', classId: 'c1', studentName: 'Ана' });
      });
      const impostor = testEnv.authenticatedContext('impostor-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = impostor.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown>; get(): Promise<unknown> } };
      await assertFails(f.doc('class_memberships/deviceY').set({ teacherUid: 'teacher1', classId: 'c1', studentName: 'hijacked' }));
      await assertFails(f.doc('class_memberships/deviceY').get());
    });

    it('a brand-new (unclaimed) device is first-come-first-served, and the owning teacher can always read', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const firstComer = testEnv.authenticatedContext('brand-new-anon-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = firstComer.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('class_memberships/deviceZ').set({ teacherUid: 'teacher2', classId: 'c2', studentName: 'Дарко' }));

      const teacher = testEnv.authenticatedContext('teacher2');
      const fTeacher = teacher.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertSucceeds(fTeacher.doc('class_memberships/deviceZ').get());
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

  describe('quiz_results/concept_mastery — numeric bounds on score fields', () => {
    it('rejects an out-of-range percentage but accepts a realistic one', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.authenticatedContext('anonStudent2', { firebase: { sign_in_provider: 'anonymous' } });
      const f = anon.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.collection('quiz_results').add({ studentName: 'Ана', percentage: 150, conceptId: 'c1' }));
      await assertFails(f.collection('quiz_results').add({ studentName: 'Ана', percentage: -5, conceptId: 'c1' }));
      await assertSucceeds(f.collection('quiz_results').add({ studentName: 'Ана', percentage: 95, conceptId: 'c1' }));
    });

    it('rejects correctCount exceeding totalQuestions when both are present', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.authenticatedContext('anonStudent3', { firebase: { sign_in_provider: 'anonymous' } });
      const f = anon.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.collection('quiz_results').add({ studentName: 'Ана', percentage: 50, conceptId: 'c1', correctCount: 12, totalQuestions: 10 }));
      await assertSucceeds(f.collection('quiz_results').add({ studentName: 'Ана', percentage: 50, conceptId: 'c1', correctCount: 5, totalQuestions: 10 }));
    });

    it('rejects an out-of-range bestScore/lastScore on concept_mastery but accepts realistic ones', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.authenticatedContext('anonStudent4', { firebase: { sign_in_provider: 'anonymous' } });
      const f = anon.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.collection('concept_mastery').add({ studentName: 'Ана', conceptId: 'c1', bestScore: 250 }));
      await assertFails(f.collection('concept_mastery').add({ studentName: 'Ана', conceptId: 'c1', lastScore: -10 }));
      await assertSucceeds(f.collection('concept_mastery').add({ studentName: 'Ана', conceptId: 'c1', bestScore: 90, lastScore: 80, attempts: 3 }));
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

  describe('forum_threads/{threadId} — field-scoped update (self-pin/self-approve gap fix)', () => {
    it('the thread author cannot set isPinned or moderationStatus on their own thread', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t1').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'pending',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'],
        });
      });
      const author = testEnv.authenticatedContext('author1');
      const f = author.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('forum_threads/t1').update({ isPinned: true }));
      await assertFails(f.doc('forum_threads/t1').update({ moderationStatus: 'approved' }));
    });

    it('an admin can pin and approve a thread they do not own', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('users/admin1').set({ role: 'admin' });
        await f.doc('forum_threads/t2').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'pending',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'],
        });
      });
      const admin = testEnv.authenticatedContext('admin1');
      const f = admin.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t2').update({ isPinned: true }));
      await assertSucceeds(f.doc('forum_threads/t2').update({ moderationStatus: 'approved' }));
    });

    it('a school_admin can also pin/approve (2026-07-23: forum has no schoolId to scope isSchoolAdmin against)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('users/schoolAdmin1').set({ role: 'school_admin', schoolId: 'school1' });
        await f.doc('forum_threads/t2b').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'pending',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'],
        });
      });
      const schoolAdmin = testEnv.authenticatedContext('schoolAdmin1');
      const f = schoolAdmin.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t2b').update({ isPinned: true }));
      await assertSucceeds(f.doc('forum_threads/t2b').update({ moderationStatus: 'approved' }));
    });

    it('the author can still edit title/body and soft-delete their own thread', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t3').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'approved',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'],
        });
      });
      const author = testEnv.authenticatedContext('author1');
      const f = author.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t3').update({ title: 'Нов наслов', body: 'Ново тело', editedAt: new Date() }));
      await assertSucceeds(f.doc('forum_threads/t3').update({ deleted: true }));
    });

    it('a non-author can upvote/react by toggling only their own uid, but not touch any other field', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t4').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'approved',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'],
        });
      });
      const other = testEnv.authenticatedContext('other1');
      const f = other.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t4').update({ upvotedBy: ['other1'] }));
      await assertFails(f.doc('forum_threads/t4').update({ upvotedBy: ['someoneElse'] }));
      await assertFails(f.doc('forum_threads/t4').update({ title: 'hijacked' }));
    });

    it('any authenticated user posting a reply can bump replyCount/lastActivityAt/participantUids on a thread they do not own', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t5').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'approved',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'],
        });
      });
      const replier = testEnv.authenticatedContext('replier1');
      const f = replier.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t5').update({
        replyCount: 1, lastActivityAt: new Date(), participantUids: ['author1', 'replier1'],
      }));
      // Jumping replyCount by more than 1, or dropping an existing participant, must fail.
      await assertFails(f.doc('forum_threads/t5').update({
        replyCount: 5, lastActivityAt: new Date(), participantUids: ['author1', 'replier1'],
      }));
    });
  });

  describe('forum_replies/{replyId} — isBestAnswer/feynmanBadge belong to the thread author, not the reply author', () => {
    it("the thread's author can mark a reply they did not write as the best answer", async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t6').set({ authorUid: 'asker1', title: 'Т', body: 'Б' });
        await f.doc('forum_replies/r1').set({ threadId: 't6', authorUid: 'answerer1', body: 'Одговор', isBestAnswer: false });
      });
      const asker = testEnv.authenticatedContext('asker1');
      const f = asker.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_replies/r1').update({ isBestAnswer: true }));
    });

    it('a random other teacher (not the thread author) cannot mark a reply as best answer', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t7').set({ authorUid: 'asker1', title: 'Т', body: 'Б' });
        await f.doc('forum_replies/r2').set({ threadId: 't7', authorUid: 'answerer1', body: 'Одговор', isBestAnswer: false });
      });
      const stranger = testEnv.authenticatedContext('stranger1');
      const f = stranger.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('forum_replies/r2').update({ isBestAnswer: true }));
    });

    it('the reply author can edit their own body, but not another reply\'s body', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t8').set({ authorUid: 'asker1', title: 'Т', body: 'Б' });
        await f.doc('forum_replies/r3').set({ threadId: 't8', authorUid: 'answerer1', body: 'Одговор', isBestAnswer: false });
      });
      const author = testEnv.authenticatedContext('answerer1');
      const stranger = testEnv.authenticatedContext('stranger1');
      const fAuthor = author.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      const fStranger = stranger.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(fAuthor.doc('forum_replies/r3').update({ body: 'Изменето', editedAt: new Date() }));
      await assertFails(fStranger.doc('forum_replies/r3').update({ body: 'hijacked' }));
    });

    it('any authenticated user can toggle only their own uid on a reply\'s upvotedBy', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t9').set({ authorUid: 'asker1', title: 'Т', body: 'Б' });
        await f.doc('forum_replies/r4').set({ threadId: 't9', authorUid: 'answerer1', body: 'Одговор', upvotedBy: [] });
      });
      const voter = testEnv.authenticatedContext('voter1');
      const f = voter.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_replies/r4').update({ upvotedBy: ['voter1'] }));
      await assertFails(f.doc('forum_replies/r4').update({ upvotedBy: ['someoneElse'] }));
    });
  });

  describe('live_sessions/{doc} — studentResponses scoped to the caller\'s own uid', () => {
    it('the host can update session status/timer even though they never appear in studentResponses', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('live_sessions/s1').set({ hostUid: 'host1', quizId: 'q1', quizTitle: 'Т', status: 'active', joinCode: 'AB12', studentResponses: {} });
      });
      const host = testEnv.authenticatedContext('host1');
      const f = host.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('live_sessions/s1').update({ status: 'ended' }));
    });

    it('a student can write only their own uid-keyed entry inside studentResponses', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('live_sessions/s2').set({ hostUid: 'host1', quizId: 'q1', quizTitle: 'Т', status: 'active', joinCode: 'AB12', studentResponses: {} });
      });
      const student = testEnv.authenticatedContext('student-uid-1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = student.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('live_sessions/s2').update({
        'studentResponses.student-uid-1': { displayName: 'Марко', status: 'joined' },
      }));
      // Same student later submitting a completed response — still only touching their own key.
      await assertSucceeds(f.doc('live_sessions/s2').update({
        studentResponses: { 'student-uid-1': { displayName: 'Марко', status: 'completed', percentage: 80 } },
      }));
    });

    it('a student cannot overwrite another student\'s entry, and cannot touch other session fields', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('live_sessions/s3').set({
          hostUid: 'host1', quizId: 'q1', quizTitle: 'Т', status: 'active', joinCode: 'AB12',
          studentResponses: { 'other-student-uid': { displayName: 'Ана', status: 'joined' } },
        });
      });
      const impostor = testEnv.authenticatedContext('impostor-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = impostor.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      // Trying to overwrite someone else's entry.
      await assertFails(f.doc('live_sessions/s3').update({
        studentResponses: { 'other-student-uid': { displayName: 'hijacked', status: 'completed', percentage: 100 } },
      }));
      // Trying to end the session as a non-host.
      await assertFails(f.doc('live_sessions/s3').update({ status: 'ended' }));
    });
  });

  describe('live_gamma/{pin} — host-owned session, student self-scoped writes', () => {
    it('the host can create their own session and update session state (e.g. slideIdx)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const host = testEnv.authenticatedContext('host1');
      const f = host.firestore() as unknown as {
        doc(p: string): { set(d: Record<string, unknown>): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertSucceeds(f.doc('live_gamma/111111').set({
        pin: '111111', hostUid: 'host1', topic: 'Т', gradeLevel: 5, slideIdx: 0,
        slides: [], isActive: true, responseCount: 0, handsUids: [],
      }));
      await assertSucceeds(f.doc('live_gamma/111111').update({ slideIdx: 1 }));
    });

    it('cannot create a session claiming a hostUid that is not the caller', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const impostor = testEnv.authenticatedContext('impostor-uid');
      const f = impostor.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('live_gamma/222222').set({
        pin: '222222', hostUid: 'someone-else', topic: 'Т', gradeLevel: 5, slideIdx: 0,
        slides: [], isActive: true, responseCount: 0, handsUids: [],
      }));
    });

    it('a student can toggle only their own uid in handsUids, and can update responseCount alone', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('live_gamma/333333').set({
          pin: '333333', hostUid: 'host1', topic: 'Т', gradeLevel: 5, slideIdx: 0,
          slides: [], isActive: true, responseCount: 0, handsUids: [],
        });
      });
      const student = testEnv.authenticatedContext('student-uid-1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = student.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('live_gamma/333333').update({ handsUids: ['student-uid-1'] }));
      await assertSucceeds(f.doc('live_gamma/333333').update({ responseCount: 0 }));
    });

    it('a student cannot raise another student\'s hand, and cannot touch host-only fields', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('live_gamma/444444').set({
          pin: '444444', hostUid: 'host1', topic: 'Т', gradeLevel: 5, slideIdx: 0,
          slides: [], isActive: true, responseCount: 0, handsUids: [],
        });
      });
      const impostor = testEnv.authenticatedContext('impostor-uid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = impostor.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('live_gamma/444444').update({ handsUids: ['someone-else'] }));
      await assertFails(f.doc('live_gamma/444444').update({ slideIdx: 5 }));
      await assertFails(f.doc('live_gamma/444444').update({ isActive: false }));
    });

    it('a student can only write their own responses/{uid} doc, never another student\'s', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const student = testEnv.authenticatedContext('student-uid-1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = student.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('live_gamma/555555/responses/student-uid-1').set({
        studentName: 'Марко', answer: '42', slideIdx: 0,
      }));
      await assertFails(f.doc('live_gamma/555555/responses/other-student-uid').set({
        studentName: 'hijacked', answer: '0', slideIdx: 0,
      }));
    });

    it('host_private/state: only the host can read/write it — a student cannot read the poll correct-answer before reveal (Wave 8.1)', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('live_gamma/666666').set({
          pin: '666666', hostUid: 'host1', topic: 'Т', gradeLevel: 5, slideIdx: 0,
          slides: [], isActive: true, responseCount: 0, handsUids: [],
        });
      });
      const host = testEnv.authenticatedContext('host1');
      const hf = host.firestore() as unknown as {
        doc(p: string): { set(d: Record<string, unknown>): Promise<unknown>; get(): Promise<unknown> };
      };
      await assertSucceeds(hf.doc('live_gamma/666666/host_private/state').set({ pollCorrectIndex: 1 }));
      await assertSucceeds(hf.doc('live_gamma/666666/host_private/state').get());

      const student = testEnv.authenticatedContext('student-uid-1', { firebase: { sign_in_provider: 'anonymous' } });
      const sf = student.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; set(d: Record<string, unknown>): Promise<unknown> };
      };
      await assertFails(sf.doc('live_gamma/666666/host_private/state').get());
      await assertFails(sf.doc('live_gamma/666666/host_private/state').set({ pollCorrectIndex: 1 }));
    });
  });

  describe('gamma_presentations/{id} — owner-scoped Gamma library (2026-07-12)', () => {
    it('a teacher can create their own presentation and read/update/delete it', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const teacher = testEnv.authenticatedContext('teacher1');
      const f = teacher.firestore() as unknown as {
        doc(p: string): { set(d: Record<string, unknown>): Promise<unknown>; get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown>; delete(): Promise<unknown> };
      };
      await assertSucceeds(f.doc('gamma_presentations/p1').set({
        teacherUid: 'teacher1', title: 'Т', topic: 'Дропки', gradeLevel: 5, slides: [],
      }));
      await assertSucceeds(f.doc('gamma_presentations/p1').get());
      await assertSucceeds(f.doc('gamma_presentations/p1').update({ title: 'Нов наслов' }));
      await assertSucceeds(f.doc('gamma_presentations/p1').delete());
    });

    it('cannot create a presentation claiming a teacherUid that is not the caller', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const impostor = testEnv.authenticatedContext('impostor-uid');
      const f = impostor.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('gamma_presentations/p2').set({
        teacherUid: 'someone-else', title: 'Т', topic: 'Дропки', gradeLevel: 5, slides: [],
      }));
    });

    it('an anonymous student cannot create a presentation', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const student = testEnv.authenticatedContext('student1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = student.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('gamma_presentations/p3').set({
        teacherUid: 'student1', title: 'Т', topic: 'Дропки', gradeLevel: 5, slides: [],
      }));
    });

    it('a different teacher cannot read, update, or delete someone else\'s saved presentation', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('gamma_presentations/p4').set({
          teacherUid: 'owner1', title: 'Т', topic: 'Дропки', gradeLevel: 5, slides: [],
        });
      });
      const other = testEnv.authenticatedContext('other-teacher');
      const f = other.firestore() as unknown as {
        doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown>; delete(): Promise<unknown> };
      };
      await assertFails(f.doc('gamma_presentations/p4').get());
      await assertFails(f.doc('gamma_presentations/p4').update({ title: 'Hijacked' }));
      await assertFails(f.doc('gamma_presentations/p4').delete());
    });
  });

  describe('forum_threads/forum_replies — report/flag', () => {
    it('a non-author can report a thread (sets moderationStatus=pending + their own uid in reportedBy) but cannot self-approve through the same write', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t10').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'approved',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'], reportedBy: [],
        });
      });
      const reporter = testEnv.authenticatedContext('reporter1');
      const f = reporter.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t10').update({ moderationStatus: 'pending', reportedBy: ['reporter1'] }));
      // Trying to sneak an 'approved' status through the report path must fail.
      await assertFails(f.doc('forum_threads/t10').update({ moderationStatus: 'approved', reportedBy: ['reporter1', 'reporter2'] }));
      // Trying to add someone else's uid instead of their own must fail.
      await assertFails(f.doc('forum_threads/t10').update({ moderationStatus: 'pending', reportedBy: ['someoneElse'] }));
    });

    it('an admin approving a thread clears reportedBy/reportReason', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('users/admin1').set({ role: 'admin' });
        await f.doc('forum_threads/t11').set({
          authorUid: 'author1', title: 'Т', body: 'Б', isPinned: false, moderationStatus: 'pending',
          upvotedBy: [], reactionsHelpful: [], reactionsSame: [], reactionsGreat: [], replyCount: 0, participantUids: ['author1'], reportedBy: ['reporter1'],
        });
      });
      const admin = testEnv.authenticatedContext('admin1');
      const f = admin.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_threads/t11').update({ moderationStatus: 'approved', reportedBy: [], reportReason: null }));
    });

    it('a non-author can report a reply, but cannot add someone else\'s uid or touch other fields', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('forum_threads/t12').set({ authorUid: 'asker1', title: 'Т', body: 'Б' });
        await f.doc('forum_replies/r5').set({ threadId: 't12', authorUid: 'answerer1', body: 'Одговор', reportedBy: [] });
      });
      const reporter = testEnv.authenticatedContext('reporter1');
      const f = reporter.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('forum_replies/r5').update({ reportedBy: ['reporter1'] }));
      await assertFails(f.doc('forum_replies/r5').update({ reportedBy: ['someoneElse'] }));
      await assertFails(f.doc('forum_replies/r5').update({ reportedBy: ['reporter1'], body: 'hijacked' }));
    });

    it('an admin can delete a reported reply; a non-admin cannot', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('users/admin2').set({ role: 'admin' });
        await f.doc('forum_threads/t13').set({ authorUid: 'asker1', title: 'Т', body: 'Б' });
        await f.doc('forum_replies/r6').set({ threadId: 't13', authorUid: 'answerer1', body: 'Лош одговор', reportedBy: ['reporter1'] });
      });
      const stranger = testEnv.authenticatedContext('stranger1');
      const admin = testEnv.authenticatedContext('admin2');
      const fStranger = stranger.firestore() as unknown as { doc(p: string): { delete(): Promise<unknown> } };
      const fAdmin = admin.firestore() as unknown as { doc(p: string): { delete(): Promise<unknown> } };
      await assertFails(fStranger.doc('forum_replies/r6').delete());
      await assertSucceeds(fAdmin.doc('forum_replies/r6').delete());
    });
  });

  describe('dugga_submissions/{subId} — bounds-checked create, teacher/admin-only update', () => {
    it('the submitting student can create their own submission within bounds; the score cannot exceed totalPoints', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const student = testEnv.authenticatedContext('student1');
      const f = student.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.doc('dugga_submissions/sub1').set({
        testId: 'test1', teacherUid: 'teacher1', studentUid: 'student1', studentName: 'Марко',
        score: 8, totalPoints: 10, percentage: 80,
      }));
      await assertFails(f.doc('dugga_submissions/sub2').set({
        testId: 'test1', teacherUid: 'teacher1', studentUid: 'student1', studentName: 'Марко',
        score: 15, totalPoints: 10, percentage: 150,
      }));
    });

    it('a student cannot create a submission claiming to be a different student', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const impostor = testEnv.authenticatedContext('impostor1');
      const f = impostor.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('dugga_submissions/sub3').set({
        testId: 'test1', teacherUid: 'teacher1', studentUid: 'the-real-student', studentName: 'Марко',
        score: 8, totalPoints: 10, percentage: 80,
      }));
    });

    it('the owning teacher can update; a random other teacher cannot; a student can never update', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('dugga_submissions/sub4').set({
          testId: 'test1', teacherUid: 'teacher1', studentUid: 'student1', studentName: 'Марко',
          score: 8, totalPoints: 10, percentage: 80,
        });
      });
      const owningTeacher = testEnv.authenticatedContext('teacher1');
      const otherTeacher = testEnv.authenticatedContext('teacher2');
      const student = testEnv.authenticatedContext('student1');
      const fOwner = owningTeacher.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      const fOther = otherTeacher.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      const fStudent = student.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(fOwner.doc('dugga_submissions/sub4').update({ score: 9 }));
      await assertFails(fOther.doc('dugga_submissions/sub4').update({ score: 10 }));
      await assertFails(fStudent.doc('dugga_submissions/sub4').update({ score: 10 }));
    });
  });

  describe('matura_exams / matura_questions — teacher/school_admin/admin write, any authenticated read', () => {
    it('a teacher can create and update; a plain authenticated (non-teacher) user cannot', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('users/teacherX').set({ role: 'teacher' });
        await f.doc('users/plainUserX').set({ role: 'student' });
      });
      const teacher = testEnv.authenticatedContext('teacherX');
      const plain = testEnv.authenticatedContext('plainUserX');
      const fTeacher = teacher.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      const fPlain = plain.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(fTeacher.doc('matura_exams/exam1').set({ title: 'Матура 2026' }));
      await assertFails(fPlain.doc('matura_exams/exam2').set({ title: 'Фабрикувано' }));
      await assertSucceeds(fTeacher.doc('matura_questions/exam1_q1').set({ examId: 'exam1', text: 'Прашање 1' }));
      await assertFails(fPlain.doc('matura_questions/exam1_q2').set({ examId: 'exam1', text: 'Фабрикувано' }));
    });

    it('any authenticated user can read, but only admin can delete', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('matura_exams/exam3').set({ title: 'Матура' });
        await f.doc('users/admin3').set({ role: 'admin' });
      });
      const reader = testEnv.authenticatedContext('anyReader1');
      const admin = testEnv.authenticatedContext('admin3');
      const fReader = reader.firestore() as unknown as { doc(p: string): { get(): Promise<unknown>; delete(): Promise<unknown> } };
      const fAdmin = admin.firestore() as unknown as { doc(p: string): { delete(): Promise<unknown> } };
      await assertSucceeds(fReader.doc('matura_exams/exam3').get());
      await assertFails(fReader.doc('matura_exams/exam3').delete());
      await assertSucceeds(fAdmin.doc('matura_exams/exam3').delete());
    });
  });

  describe('referrals/{newUid} — self-claim only, credit-adjacent', () => {
    it('a new user can create their own referral doc with bonusGranted=false, but not on behalf of someone else', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const newUser = testEnv.authenticatedContext('newUser1');
      const f = newUser.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };

      await assertSucceeds(f.doc('referrals/newUser1').set({ newUserUid: 'newUser1', refCode: 'referrer1', bonusGranted: false }));
      await assertFails(f.doc('referrals/someone-else').set({ newUserUid: 'someone-else', refCode: 'referrer1', bonusGranted: false }));
    });

    it('cannot self-refer, and cannot create with bonusGranted already true (client can never self-grant the bonus)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const newUser = testEnv.authenticatedContext('newUser2');
      const f = newUser.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };

      await assertFails(f.doc('referrals/newUser2').set({ newUserUid: 'newUser2', refCode: 'newUser2', bonusGranted: false }));
      await assertFails(f.doc('referrals/newUser2').set({ newUserUid: 'newUser2', refCode: 'referrer1', bonusGranted: true }));
    });

    it('only admin (i.e. the grantReferralBonus Cloud Function via Admin SDK) can update — never the client', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('referrals/newUser3').set({ newUserUid: 'newUser3', refCode: 'referrer1', bonusGranted: false });
      });
      const newUser = testEnv.authenticatedContext('newUser3');
      const f = newUser.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('referrals/newUser3').update({ bonusGranted: true }));
    });
  });

  // Regression coverage for the 2026-07-12 "teacher / Google-linked student gets
  // 'Missing or insufficient permissions' reading their own concept_mastery" fix.
  // linkWithPopup() preserves the Firebase Auth uid but flips sign_in_provider away
  // from 'anonymous', so isAnonymousStudent() alone stops recognizing a student who
  // has linked their session — these tests exercise the actual LIST-query shape
  // (collection().where().get()) that Firestore evaluates for query provability,
  // not just a single doc().get(), since that's the exact shape that broke in prod.
  describe('concept_mastery / spaced_rep — Google-linked student access (ownsDeviceViaIdentity)', () => {
    it('a Google-linked student (same uid, non-anonymous) can list their own concept_mastery via deviceId', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceLink1').set({ deviceId: 'deviceLink1', name: 'Ана', anonymousUid: 'linked-uid-1' });
        await f.doc('concept_mastery/cm1').set({ studentName: 'Ана', conceptId: 'c1', deviceId: 'deviceLink1', bestScore: 90, lastScore: 90, attempts: 1, consecutiveHighScores: 1, mastered: false });
      });
      // Same uid as anonymousUid, but sign_in_provider is now google.com — mirrors
      // what linkWithPopup() produces post-link.
      const linked = testEnv.authenticatedContext('linked-uid-1', { firebase: { sign_in_provider: 'google.com' } });
      const db = linked.firestore() as unknown as Firestore;
      const q = query(collection(db, 'concept_mastery'), where('deviceId', '==', 'deviceLink1'));
      await assertSucceeds(getDocs(q));
    });

    it('a Google-linked student can update their own concept_mastery record post-link', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceLink2').set({ deviceId: 'deviceLink2', name: 'Бојан', anonymousUid: 'linked-uid-2' });
      });
      const linked = testEnv.authenticatedContext('linked-uid-2', { firebase: { sign_in_provider: 'google.com' } });
      const f = linked.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('concept_mastery/cm2').set({ studentName: 'Бојан', conceptId: 'c1', deviceId: 'deviceLink2', bestScore: 85, lastScore: 85, attempts: 1, consecutiveHighScores: 1, mastered: false }, { merge: true } as never));
    });

    it('an unrelated authenticated caller with no device/studentUid/teacherUid claim still cannot list someone else\'s concept_mastery (regression guard)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceLink3').set({ deviceId: 'deviceLink3', name: 'Вера', anonymousUid: 'owner-uid-3' });
        await f.doc('concept_mastery/cm3').set({ studentName: 'Вера', conceptId: 'c1', deviceId: 'deviceLink3', bestScore: 70, lastScore: 70, attempts: 1, consecutiveHighScores: 0, mastered: false });
      });
      const stranger = testEnv.authenticatedContext('stranger-uid', { firebase: { sign_in_provider: 'google.com' } });
      const db = stranger.firestore() as unknown as Firestore;
      const q = query(collection(db, 'concept_mastery'), where('deviceId', '==', 'deviceLink3'));
      await assertFails(getDocs(q));
    });

    it('studentUid field: the matching student can read/write via studentUid, and cannot spoof someone else\'s uid', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      const student = testEnv.authenticatedContext('studentUid-owner', { firebase: { sign_in_provider: 'google.com' } });
      const fStudent = student.firestore() as unknown as { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown> } };

      // Can create a record stamped with their own uid.
      await assertSucceeds(fStudent.collection('concept_mastery').add({ studentName: 'Гоце', conceptId: 'c1', studentUid: 'studentUid-owner', bestScore: 80, lastScore: 80, attempts: 1, consecutiveHighScores: 1, mastered: false }));

      // Cannot create a record spoofing a different uid.
      await assertFails(fStudent.collection('concept_mastery').add({ studentName: 'Гоце', conceptId: 'c1', studentUid: 'someone-else-uid', bestScore: 80, lastScore: 80, attempts: 1, consecutiveHighScores: 1, mastered: false }));

      // Can list their own record via studentUid.
      const db = student.firestore() as unknown as Firestore;
      const q = query(collection(db, 'concept_mastery'), where('studentUid', '==', 'studentUid-owner'));
      await assertSucceeds(getDocs(q));
    });

    it('spaced_rep: a Google-linked student can list their own record via studentId (the raw deviceId field)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceSR1').set({ deviceId: 'deviceSR1', name: 'Дана', anonymousUid: 'sr-linked-uid' });
        await f.doc('spaced_rep/sr1').set({ studentId: 'deviceSR1', conceptId: 'c1', interval: 1, repetitions: 1, easeFactor: 2.5 });
      });
      const linked = testEnv.authenticatedContext('sr-linked-uid', { firebase: { sign_in_provider: 'google.com' } });
      const db = linked.firestore() as unknown as Firestore;
      const q = query(collection(db, 'spaced_rep'), where('studentId', '==', 'deviceSR1'));
      await assertSucceeds(getDocs(q));
    });
  });

  // 2026-07-18 (audit_2026_07_18_full_app_review, security finding #1): regression coverage
  // for removing the blanket isAnonymousStudent() read branch on quiz_results/concept_mastery —
  // any anonymous sign-in used to be able to dump the entire collection with an unscoped list().
  describe('quiz_results — unscoped anonymous reads are now denied; device-owner reads still work', () => {
    it('a random anonymous session cannot list the whole quiz_results collection (no where clause)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const stranger = testEnv.authenticatedContext('stranger-qr', { firebase: { sign_in_provider: 'anonymous' } });
      const db = stranger.firestore() as unknown as Firestore;
      await assertFails(getDocs(collection(db, 'quiz_results')));
    });

    it('a random anonymous session cannot list another device\'s quiz_results by deviceId', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceQR1').set({ deviceId: 'deviceQR1', name: 'Петар', anonymousUid: 'qr-owner-uid' });
        await f.doc('quiz_results/qrDeviceScoped1').set({ studentName: 'Петар', percentage: 80, conceptId: 'c1', deviceId: 'deviceQR1' });
      });
      const stranger = testEnv.authenticatedContext('stranger-qr-2', { firebase: { sign_in_provider: 'anonymous' } });
      const db = stranger.firestore() as unknown as Firestore;
      const q = query(collection(db, 'quiz_results'), where('deviceId', '==', 'deviceQR1'));
      await assertFails(getDocs(q));
    });

    it('the legitimate owning device can list its own quiz_results', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceQR2').set({ deviceId: 'deviceQR2', name: 'Петар', anonymousUid: 'qr-owner-uid-2' });
        await f.doc('quiz_results/qrDeviceScoped2').set({ studentName: 'Петар', percentage: 80, conceptId: 'c1', deviceId: 'deviceQR2' });
      });
      const owner = testEnv.authenticatedContext('qr-owner-uid-2', { firebase: { sign_in_provider: 'anonymous' } });
      const db = owner.firestore() as unknown as Firestore;
      const q = query(collection(db, 'quiz_results'), where('deviceId', '==', 'deviceQR2'));
      await assertSucceeds(getDocs(q));
    });

    it('a teacher can still list their own students\' quiz_results by teacherUid (isDocOwner, unaffected by this fix)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('quiz_results/qrTeacherScoped1').set({ studentName: 'Марко', percentage: 70, conceptId: 'c1', teacherUid: 'teacher-qr-1' });
      });
      const teacher = testEnv.authenticatedContext('teacher-qr-1');
      const db = teacher.firestore() as unknown as Firestore;
      const q = query(collection(db, 'quiz_results'), where('teacherUid', '==', 'teacher-qr-1'));
      await assertSucceeds(getDocs(q));
    });
  });

  describe('concept_mastery — unscoped anonymous reads/updates are now denied', () => {
    it('a random anonymous session cannot list the whole concept_mastery collection (no where clause)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const stranger = testEnv.authenticatedContext('stranger-cm', { firebase: { sign_in_provider: 'anonymous' } });
      const db = stranger.firestore() as unknown as Firestore;
      await assertFails(getDocs(collection(db, 'concept_mastery')));
    });

    it('a random anonymous session cannot overwrite another device\'s concept_mastery doc, even by omitting deviceId from the write', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/deviceCM1').set({ deviceId: 'deviceCM1', name: 'Ана', anonymousUid: 'cm-owner-uid' });
        await f.doc('concept_mastery/cmDeviceScoped1').set({ studentName: 'Ана', conceptId: 'c1', deviceId: 'deviceCM1', bestScore: 80, lastScore: 80, attempts: 1, consecutiveHighScores: 1, mastered: false });
      });
      const impostor = testEnv.authenticatedContext('impostor-cm', { firebase: { sign_in_provider: 'anonymous' } });
      const f = impostor.firestore() as unknown as { doc(p: string): { update(d: Record<string, unknown>): Promise<unknown> } };
      // Omits deviceId entirely from the update payload — deviceOwnershipOk() alone would have
      // let this through under the old rule (isAnonymousStudent() as an unconditional OR-branch).
      await assertFails(f.doc('concept_mastery/cmDeviceScoped1').update({ studentName: 'Ана', conceptId: 'c1', bestScore: 100, lastScore: 100 }));
    });
  });

  describe('cached_ai_materials — create ownership (audit_2026_07_18_full_app_review)', () => {
    it('cannot forge another teacher\'s uid as teacherUid on create', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const impostor = testEnv.authenticatedContext('impostor-cam');
      const f = impostor.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('cached_ai_materials/camForged1').set({ teacherUid: 'someone-elses-uid', title: 'Forged' }));
    });

    it('can create with their own teacherUid', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const teacher = testEnv.authenticatedContext('cam-owner-1');
      const f = teacher.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('cached_ai_materials/camOwned1').set({ teacherUid: 'cam-owner-1', title: 'Mine' }));
    });

    it('an anonymous student can still create a remedial-quiz doc with no teacherUid at all', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const anon = testEnv.authenticatedContext('remedia-student', { firebase: { sign_in_provider: 'anonymous' } });
      const f = anon.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('cached_ai_materials/camRemedia1').set({ title: 'Remedial quiz', isPrivate: false }));
    });
  });

  describe('solution_uploads — expiresAt is now server-bounded (audit_2026_07_18_full_app_review)', () => {
    it('rejects an expiresAt far in the future (defeats the "10-minute token" design)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const user = testEnv.authenticatedContext('su-user-1');
      const f = user.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      const farFuture = Date.now() + 24 * 60 * 60 * 1000; // +1 day
      await assertFails(f.doc('solution_uploads/tokFar').set({
        questionKey: 'q1', expiresAt: farFuture, imageUrl: '', createdAt: Date.now(),
      }));
    });

    it('rejects an expiresAt already in the past', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      const user = testEnv.authenticatedContext('su-user-2');
      const f = user.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('solution_uploads/tokPast').set({
        questionKey: 'q1', expiresAt: Date.now() - 1000, imageUrl: '', createdAt: Date.now(),
      }));
    });

    it('accepts a real ~10-minute expiresAt', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const user = testEnv.authenticatedContext('su-user-3');
      const f = user.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('solution_uploads/tokOk').set({
        questionKey: 'q1', expiresAt: Date.now() + 10 * 60 * 1000, imageUrl: '', createdAt: Date.now(),
      }));
    });
  });

  // 2026-07-20 (Tier 2 closure, follow-up to audit_2026_07_18_full_app_review finding #1):
  // isAnonymousStudent() used to grant a BLANKET read/write on assignments, announcements,
  // student_gamification, and spaced_rep — any anonymous student session, regardless of
  // which class/teacher they'd actually joined. student_teacher_link/{uid} (written by
  // joinClassByCode) now lets the rules verify "this uid is actually linked to this
  // teacherUid" and deny everyone else.
  describe('student_teacher_link/{uid} — create must be bound to caller\'s own uid and a real class', () => {
    it('a student can create their own link doc when teacherUid matches the class they claim to have joined', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('classes/classA').set({ teacherUid: 'teacherA', name: 'VIII-1' });
      });
      const ctx = testEnv.authenticatedContext('studentUid1', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('student_teacher_link/studentUid1').set({
        teacherUid: 'teacherA', classId: 'classA', linkedAt: Date.now(),
      }));
    });

    it('cannot self-assign a teacherUid that does not match the real owner of the claimed class', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('classes/classB').set({ teacherUid: 'realTeacher', name: 'VII-2' });
      });
      const ctx = testEnv.authenticatedContext('studentUid2', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('student_teacher_link/studentUid2').set({
        teacherUid: 'attackerClaimedTeacher', classId: 'classB', linkedAt: Date.now(),
      }));
    });

    it('cannot create a link doc keyed under a different uid than the caller\'s own', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('classes/classC').set({ teacherUid: 'teacherC', name: 'VI-1' });
      });
      const ctx = testEnv.authenticatedContext('studentUid3', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('student_teacher_link/someone-elses-uid').set({
        teacherUid: 'teacherC', classId: 'classC', linkedAt: Date.now(),
      }));
    });

    it('only the linked student (or admin) can read their own link doc', async () => {
      if (!testEnv) return;
      const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_teacher_link/studentUid4').set({ teacherUid: 'teacherD', classId: 'classD', linkedAt: Date.now() });
      });
      const owner = testEnv.authenticatedContext('studentUid4', { firebase: { sign_in_provider: 'anonymous' } });
      const stranger = testEnv.authenticatedContext('studentUid5', { firebase: { sign_in_provider: 'anonymous' } });
      const fOwner = owner.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      const fStranger = stranger.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertSucceeds(fOwner.doc('student_teacher_link/studentUid4').get());
      await assertFails(fStranger.doc('student_teacher_link/studentUid4').get());
    });
  });

  describe('assignments/{doc} — anonymous read/update now scoped via student_teacher_link (Tier 2 closure)', () => {
    it('a student linked to the assignment\'s own teacher can read and self-mark completion', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('assignments/linkedAssignment').set({ teacherUid: 'teacherLinked', title: 'HW1', completedBy: [] });
        await f.doc('student_teacher_link/linkedStudent').set({ teacherUid: 'teacherLinked', classId: 'classLinked', linkedAt: Date.now() });
      });
      const ctx = testEnv.authenticatedContext('linkedStudent', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('assignments/linkedAssignment').get());
      await assertSucceeds(f.doc('assignments/linkedAssignment').update({ completedBy: ['linkedStudent'] }));
    });

    it('a student linked to a DIFFERENT teacher cannot read or update this assignment (the actual fix)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('assignments/otherTeacherAssignment').set({ teacherUid: 'teacherX', title: 'HW2', completedBy: [] });
        await f.doc('student_teacher_link/wrongTeacherStudent').set({ teacherUid: 'teacherY', classId: 'classY', linkedAt: Date.now() });
      });
      const ctx = testEnv.authenticatedContext('wrongTeacherStudent', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown>; update(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('assignments/otherTeacherAssignment').get());
      await assertFails(f.doc('assignments/otherTeacherAssignment').update({ completedBy: ['wrongTeacherStudent'] }));
    });

    it('an anonymous session with no student_teacher_link doc at all cannot read any teacher\'s assignments', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('assignments/unlinkedTargetAssignment').set({ teacherUid: 'teacherZ', title: 'HW3', completedBy: [] });
      });
      const ctx = testEnv.authenticatedContext('neverJoinedAnyClass', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertFails(f.doc('assignments/unlinkedTargetAssignment').get());
    });
  });

  describe('student_gamification/{doc} — anonymous read/update now scoped via student_teacher_link (Tier 2 closure)', () => {
    it('a linked student can read a classmate\'s doc under the same teacher (leaderboard use case)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_gamification/classmateDoc').set({ studentName: 'Classmate', teacherUid: 'teacherG', totalXP: 100 });
        await f.doc('student_teacher_link/gamificationStudent').set({ teacherUid: 'teacherG', classId: 'classG', linkedAt: Date.now() });
      });
      const ctx = testEnv.authenticatedContext('gamificationStudent', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertSucceeds(f.doc('student_gamification/classmateDoc').get());
    });

    it('a student linked to a different teacher cannot read another class\'s gamification doc (the actual fix)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_gamification/otherClassDoc').set({ studentName: 'Someone', teacherUid: 'teacherH', totalXP: 50 });
        await f.doc('student_teacher_link/wrongClassStudent').set({ teacherUid: 'teacherJ', classId: 'classJ', linkedAt: Date.now() });
      });
      const ctx = testEnv.authenticatedContext('wrongClassStudent', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertFails(f.doc('student_gamification/otherClassDoc').get());
    });

    it('legacy docs without a teacherUid field are still readable by any authenticated user (unrelated fallback, unchanged)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_gamification/legacyNoTeacherUid').set({ studentName: 'Legacy', totalXP: 10 });
      });
      const ctx = testEnv.authenticatedContext('anyRandomAuthedUser');
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertSucceeds(f.doc('student_gamification/legacyNoTeacherUid').get());
    });
  });

  describe('announcements/{doc} — anonymous read now scoped via student_teacher_link (Tier 2 closure)', () => {
    it('a linked student can read their own teacher\'s announcement', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('announcements/linkedAnnouncement').set({ teacherUid: 'teacherAnn', body: 'Test due Friday' });
        await f.doc('student_teacher_link/announcementStudent').set({ teacherUid: 'teacherAnn', classId: 'classAnn', linkedAt: Date.now() });
      });
      const ctx = testEnv.authenticatedContext('announcementStudent', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertSucceeds(f.doc('announcements/linkedAnnouncement').get());
    });

    it('a student linked to a different teacher cannot read this announcement (the actual fix)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('announcements/otherTeacherAnnouncement').set({ teacherUid: 'teacherK', body: 'Private class note' });
        await f.doc('student_teacher_link/wrongAnnouncementStudent').set({ teacherUid: 'teacherL', classId: 'classL', linkedAt: Date.now() });
      });
      const ctx = testEnv.authenticatedContext('wrongAnnouncementStudent', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertFails(f.doc('announcements/otherTeacherAnnouncement').get());
    });
  });

  describe('spaced_rep/{doc} — create now requires device ownership; blanket anonymous read removed', () => {
    it('an anonymous student can create their own first-ever spaced_rep record (unclaimed device)', async () => {
      if (!testEnv) return;
      const { assertSucceeds } = await import('@firebase/rules-unit-testing');
      const ctx = testEnv.authenticatedContext('freshDeviceUid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertSucceeds(f.doc('spaced_rep/freshDevice_concept1').set({ studentId: 'freshDevice', conceptId: 'concept1', interval: 1 }));
    });

    it('cannot create a spaced_rep record claiming a studentId (deviceId) already claimed by a different uid', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('student_identity/claimedDevice').set({ deviceId: 'claimedDevice', name: 'Real Owner', anonymousUid: 'realOwnerUid' });
      });
      const ctx = testEnv.authenticatedContext('attackerUid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
      await assertFails(f.doc('spaced_rep/claimedDevice_concept1').set({ studentId: 'claimedDevice', conceptId: 'concept1', interval: 1 }));
    });

    it('an anonymous student cannot read a different, unowned device\'s spaced_rep record (blanket grant removed)', async () => {
      if (!testEnv) return;
      const { assertFails } = await import('@firebase/rules-unit-testing');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const f = ctx.firestore() as unknown as { doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> } };
        await f.doc('spaced_rep/someoneElsesDevice_concept1').set({ studentId: 'someoneElsesDevice', conceptId: 'concept1', interval: 1 });
      });
      const ctx = testEnv.authenticatedContext('unrelatedAnonUid', { firebase: { sign_in_provider: 'anonymous' } });
      const f = ctx.firestore() as unknown as { doc(p: string): { get(): Promise<unknown> } };
      await assertFails(f.doc('spaced_rep/someoneElsesDevice_concept1').get());
    });
  });
});
