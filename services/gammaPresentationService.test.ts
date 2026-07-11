import { describe, it, expect, vi } from 'vitest';
import { saveGammaPresentation, fetchGammaPresentations } from './gammaPresentationService';
import { addDoc, getDocs, collection, where, orderBy } from 'firebase/firestore';
import type { AIGeneratedPresentation } from '../types';

vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn().mockResolvedValue({ id: 'new-doc' }),
  getDocs: vi.fn(),
  collection: vi.fn((...args) => ['collection-ref', ...args]),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

const presentation: AIGeneratedPresentation = {
  title: 'Дропки — вовед',
  topic: 'Дропки',
  gradeLevel: 5,
  slides: [{ type: 'title', title: 'Дропки', content: [] }],
};

describe('saveGammaPresentation', () => {
  it('writes the presentation fields plus teacherUid and a server timestamp', async () => {
    await saveGammaPresentation('teacher-1', presentation);
    expect(collection).toHaveBeenCalledWith({}, 'gamma_presentations');
    expect(addDoc).toHaveBeenCalledWith(
      ['collection-ref', {}, 'gamma_presentations'],
      {
        teacherUid: 'teacher-1',
        title: 'Дропки — вовед',
        topic: 'Дропки',
        gradeLevel: 5,
        slides: presentation.slides,
        createdAt: 'server-timestamp',
      },
    );
  });

  it('swallows write failures (best-effort — must never block presenting)', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(saveGammaPresentation('teacher-1', presentation)).resolves.toBeUndefined();
  });
});

describe('fetchGammaPresentations', () => {
  it('queries scoped to the given teacherUid, ordered newest-first', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        { id: 'p1', data: () => ({ teacherUid: 'teacher-1', title: 'A', topic: 'T', gradeLevel: 5, slides: [], createdAt: null }) },
      ],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await fetchGammaPresentations('teacher-1');

    expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher-1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(result).toEqual([{ id: 'p1', teacherUid: 'teacher-1', title: 'A', topic: 'T', gradeLevel: 5, slides: [], createdAt: null }]);
  });

  it('returns an empty array when the read fails', async () => {
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('offline'));
    const result = await fetchGammaPresentations('teacher-1');
    expect(result).toEqual([]);
  });
});
