/**
 * 2026-07-19 (audit_2026_07_18_full_app_review, Wave 6.3): locks in the doc-ID
 * scoping fix — weekly_plans documents are keyed by {uid}_{annualPlanId}_{week},
 * not {uid}_{gradeId}_{week}. The old scheme meant two different annual plans
 * for the same grade (e.g. last year's vs. a freshly copied "new school year"
 * plan) would collide on the same document the moment both saved the same
 * week number, silently overwriting one teacher's prior-year data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveWeeklyPlan, loadWeeklyPlan, subscribeSharedWeeklyPlan } from './firestoreService.weeklyPlans';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

describe('firestoreService.weeklyPlans — doc ID scoping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saveWeeklyPlan keys the document by annualPlanId, not gradeId', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    await saveWeeklyPlan('uid-1', 'grade-8', 8, 5, 'annual-plan-A', [1, 1, 1, 1, 0], []);
    expect(doc).toHaveBeenCalledWith({}, 'weekly_plans', 'uid-1_annual-plan-A_w5');
  });

  it('two different annual plans for the same grade get different document IDs for the same week', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    await saveWeeklyPlan('uid-1', 'grade-8', 8, 5, 'annual-plan-2025', [1, 1, 1, 1, 0], []);
    await saveWeeklyPlan('uid-1', 'grade-8', 8, 5, 'annual-plan-2026', [1, 1, 1, 1, 0], []);
    const ids = (doc as ReturnType<typeof vi.fn>).mock.calls.map(call => call[2]);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids).toEqual(['uid-1_annual-plan-2025_w5', 'uid-1_annual-plan-2026_w5']);
  });

  it('loadWeeklyPlan reads by annualPlanId', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false });
    await loadWeeklyPlan('uid-1', 'annual-plan-A', 3);
    expect(doc).toHaveBeenCalledWith({}, 'weekly_plans', 'uid-1_annual-plan-A_w3');
  });

  it('subscribeSharedWeeklyPlan subscribes by annualPlanId', () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    subscribeSharedWeeklyPlan('owner-uid', 'annual-plan-A', 7, () => {});
    expect(doc).toHaveBeenCalledWith({}, 'weekly_plans', 'owner-uid_annual-plan-A_w7');
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('still stores gradeId/gradeLevel as plain fields for querying/display', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    await saveWeeklyPlan('uid-1', 'grade-8', 8, 5, 'annual-plan-A', [1, 1, 1, 1, 0], []);
    expect(setDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
      gradeId: 'grade-8',
      gradeLevel: 8,
      annualPlanId: 'annual-plan-A',
    }));
  });
});
