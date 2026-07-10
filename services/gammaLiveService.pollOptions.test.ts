import { describe, it, expect, vi } from 'vitest';
import { setGammaPollOptions, broadcastGammaSlide, tallyPollResponses, type GammaLiveResponse } from './gammaLiveService';
import { doc, updateDoc } from 'firebase/firestore';

vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args) => ['doc-ref', ...args]),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  arrayUnion: vi.fn((v) => ({ __op: 'arrayUnion', v })),
  arrayRemove: vi.fn((v) => ({ __op: 'arrayRemove', v })),
}));

describe('setGammaPollOptions', () => {
  it('writes the given options to the session doc', async () => {
    await setGammaPollOptions('123456', ['А', 'Б']);
    expect(doc).toHaveBeenCalledWith({}, 'live_gamma', '123456');
    expect(updateDoc).toHaveBeenCalledWith(['doc-ref', {}, 'live_gamma', '123456'], { pollOptions: ['А', 'Б'] });
  });

  it('clears the poll by writing null', async () => {
    await setGammaPollOptions('123456', null);
    expect(updateDoc).toHaveBeenCalledWith(['doc-ref', {}, 'live_gamma', '123456'], { pollOptions: null });
  });

  it('swallows write failures (best-effort, matches every other function in this file)', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(setGammaPollOptions('123456', ['А'])).resolves.toBeUndefined();
  });
});

describe('broadcastGammaSlide', () => {
  it('resets pollOptions to null alongside responseCount and handsUids', async () => {
    await broadcastGammaSlide('123456', 3);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { slideIdx: 3, responseCount: 0, handsUids: [], pollOptions: null },
    );
  });
});

describe('tallyPollResponses', () => {
  const responses: GammaLiveResponse[] = [
    { studentId: 's1', studentName: 'Ана', answer: 'А', slideIdx: 2, submittedAt: null },
    { studentId: 's2', studentName: 'Бојан', answer: 'Б', slideIdx: 2, submittedAt: null },
    { studentId: 's3', studentName: 'Вера', answer: 'А', slideIdx: 2, submittedAt: null },
    { studentId: 's4', studentName: 'Горан', answer: 'А', slideIdx: 5, submittedAt: null },
  ];

  it('counts votes per option, scoped to the given slideIdx', () => {
    expect(tallyPollResponses(responses, 2)).toEqual({ А: 2, Б: 1 });
  });

  it('returns an empty tally when nothing was submitted for that slide', () => {
    expect(tallyPollResponses(responses, 9)).toEqual({});
  });

  it('does not leak votes from a different slide', () => {
    const tally = tallyPollResponses(responses, 5);
    expect(tally).toEqual({ А: 1 });
  });
});
