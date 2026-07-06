import { describe, it, expect, vi } from 'vitest';
import { academyBadgesService } from './firestoreService.academyBadges';
import { getDoc, setDoc, doc } from 'firebase/firestore';

vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args) => ['doc-ref', ...args]),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

describe('academyBadgesService.getBadges', () => {
  it('returns [] when the doc does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
    const badges = await academyBadgesService.getBadges('u1');
    expect(badges).toEqual([]);
  });

  it('returns the stored completedSpecializationIds', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ completedSpecializationIds: ['inclusive-teacher', 'digital-innovator'] }),
    } as any);
    const badges = await academyBadgesService.getBadges('u1');
    expect(badges).toEqual(['inclusive-teacher', 'digital-innovator']);
  });

  it('returns [] when the read throws', async () => {
    vi.mocked(getDoc).mockRejectedValue(new Error('offline'));
    const badges = await academyBadgesService.getBadges('u1');
    expect(badges).toEqual([]);
  });

  it('returns [] when the field is missing from the doc', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({}) } as any);
    const badges = await academyBadgesService.getBadges('u1');
    expect(badges).toEqual([]);
  });
});

describe('academyBadgesService.setOwnBadges', () => {
  it('writes to academy_badges/{uid} with the full array and a server timestamp', async () => {
    await academyBadgesService.setOwnBadges('u1', ['assessment-master']);
    expect(doc).toHaveBeenCalledWith({}, 'academy_badges', 'u1');
    expect(setDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'academy_badges', 'u1'],
      { completedSpecializationIds: ['assessment-master'], updatedAt: 'server-timestamp' },
    );
  });
});
