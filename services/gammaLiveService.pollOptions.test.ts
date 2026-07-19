import { describe, it, expect, vi } from 'vitest';
import { setGammaPollOptions, revealGammaPollResults, broadcastGammaSlide, sendGammaExitTicket, setGammaPacingMode, addGammaAnnotationStroke, clearGammaAnnotationStrokes, tallyPollResponses, type GammaLiveResponse, type GammaAnnotationStroke } from './gammaLiveService';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { AIGeneratedAssessment } from '../types';

vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args) => ['doc-ref', ...args]),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
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
  it('writes options to the public doc with pollCorrectIndex always null (never leaked publicly)', async () => {
    await setGammaPollOptions('123456', ['А', 'Б']);
    expect(doc).toHaveBeenCalledWith({}, 'live_gamma', '123456');
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { pollOptions: ['А', 'Б'], pollCorrectIndex: null, pollRevealed: false },
    );
  });

  it('writes the real correctIndex only to the host-private subdoc', async () => {
    await setGammaPollOptions('123456', ['А', 'Б', 'В'], 1);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { pollOptions: ['А', 'Б', 'В'], pollCorrectIndex: null, pollRevealed: false },
    );
    expect(setDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456', 'host_private', 'state'],
      { pollCorrectIndex: 1 },
    );
  });

  it('clears the poll by writing null to both docs', async () => {
    await setGammaPollOptions('123456', null);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { pollOptions: null, pollCorrectIndex: null, pollRevealed: false },
    );
    expect(setDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456', 'host_private', 'state'],
      { pollCorrectIndex: null },
    );
  });

  it('swallows write failures (best-effort, matches every other function in this file)', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(setGammaPollOptions('123456', ['А'])).resolves.toBeUndefined();
  });
});

describe('revealGammaPollResults', () => {
  it('reads the host-private correctIndex and copies it onto the public doc alongside pollRevealed', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ pollCorrectIndex: 2 }) } as never);
    await revealGammaPollResults('123456');
    expect(getDoc).toHaveBeenCalledWith(['doc-ref', {}, 'live_gamma', '123456', 'host_private', 'state']);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { pollRevealed: true, pollCorrectIndex: 2 },
    );
  });

  it('falls back to null when the host-private doc has no correctIndex (opinion poll)', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never);
    await revealGammaPollResults('123456');
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { pollRevealed: true, pollCorrectIndex: null },
    );
  });

  it('swallows write failures', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(revealGammaPollResults('123456')).resolves.toBeUndefined();
  });
});

describe('broadcastGammaSlide', () => {
  it('resets pollOptions, pollCorrectIndex, pollRevealed, and annotationStrokes alongside responseCount and handsUids', async () => {
    await broadcastGammaSlide('123456', 3);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { slideIdx: 3, responseCount: 0, handsUids: [], pollOptions: null, pollCorrectIndex: null, pollRevealed: false, annotationStrokes: [] },
    );
  });

  it('also clears the host-private correctIndex so a stale answer never lingers into the next slide', async () => {
    await broadcastGammaSlide('123456', 3);
    expect(setDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456', 'host_private', 'state'],
      { pollCorrectIndex: null },
    );
  });
});

describe('addGammaAnnotationStroke', () => {
  const stroke: GammaAnnotationStroke = { mode: 'draw', points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }], color: '#ef4444', width: 3 };

  it('array-unions the stroke onto annotationStrokes', async () => {
    await addGammaAnnotationStroke('123456', stroke);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { annotationStrokes: { __op: 'arrayUnion', v: stroke } },
    );
  });

  it('swallows write failures', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(addGammaAnnotationStroke('123456', stroke)).resolves.toBeUndefined();
  });
});

describe('clearGammaAnnotationStrokes', () => {
  it('resets annotationStrokes to an empty array', async () => {
    await clearGammaAnnotationStrokes('123456');
    expect(updateDoc).toHaveBeenCalledWith(['doc-ref', {}, 'live_gamma', '123456'], { annotationStrokes: [] });
  });

  it('swallows write failures', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(clearGammaAnnotationStrokes('123456')).resolves.toBeUndefined();
  });
});

describe('sendGammaExitTicket', () => {
  const ticket = { title: 'Exit Ticket', questions: [] } as unknown as AIGeneratedAssessment;

  it('writes the exit ticket to the session doc', async () => {
    await sendGammaExitTicket('123456', ticket);
    expect(updateDoc).toHaveBeenCalledWith(
      ['doc-ref', {}, 'live_gamma', '123456'],
      { exitTicket: ticket },
    );
  });

  it('swallows write failures', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(sendGammaExitTicket('123456', ticket)).resolves.toBeUndefined();
  });
});

describe('setGammaPacingMode', () => {
  it('writes the pacing mode to the session doc', async () => {
    await setGammaPacingMode('123456', 'free');
    expect(updateDoc).toHaveBeenCalledWith(['doc-ref', {}, 'live_gamma', '123456'], { pacingMode: 'free' });
  });

  it('swallows write failures', async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(setGammaPacingMode('123456', 'locked')).resolves.toBeUndefined();
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
