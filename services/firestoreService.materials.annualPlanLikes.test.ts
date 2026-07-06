import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toggleAnnualPlanLike } from './firestoreService.materials';
import { getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ __ref: 'doc' })),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  arrayUnion: vi.fn((...items) => ({ __op: 'arrayUnion', items })),
  arrayRemove: vi.fn((...items) => ({ __op: 'arrayRemove', items })),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

describe('toggleAnnualPlanLike — per-uid dedup', () => {
  it('adds the uid via arrayUnion when not already liked', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ likedByUid: ['other-uid'] }) } as never);

    const result = await toggleAnnualPlanLike('plan-1', 'my-uid');

    expect(result).toEqual({ liked: true });
    expect(arrayUnion).toHaveBeenCalledWith('my-uid');
    expect(updateDoc).toHaveBeenCalledWith({ __ref: 'doc' }, { likedByUid: { __op: 'arrayUnion', items: ['my-uid'] } });
  });

  it('removes the uid via arrayRemove when already liked (toggle off)', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ likedByUid: ['my-uid', 'other-uid'] }) } as never);

    const result = await toggleAnnualPlanLike('plan-1', 'my-uid');

    expect(result).toEqual({ liked: false });
    expect(arrayRemove).toHaveBeenCalledWith('my-uid');
  });

  it('treats a missing likedByUid field as an empty list (first like on an old doc)', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({}) } as never);

    const result = await toggleAnnualPlanLike('plan-1', 'my-uid');

    expect(result).toEqual({ liked: true });
    expect(arrayUnion).toHaveBeenCalledWith('my-uid');
  });
});
