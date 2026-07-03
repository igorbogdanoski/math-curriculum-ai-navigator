import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hotScore,
  createForumThread,
  approveForumThread,
  rejectForumThread,
  fetchForumThreads,
  fetchForumThread,
  fetchForumStats,
  toggleThreadUpvote,
  toggleForumReaction,
  softDeleteThread,
  pinThread,
  restoreThread,
  fetchPendingForumThreads,
  createForumReply,
  toggleReplyUpvote,
  updateForumThread,
  updateForumReply,
  toggleFeynmanBadge,
  markBestAnswer,
  type ForumThread,
  type ForumReply,
} from './firestoreService.forum';
import {
  doc, addDoc, getDoc, getDocs, updateDoc,
  where, orderBy, limit,
  getCountFromServer,
} from 'firebase/firestore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(),
  collection: vi.fn(() => 'col-ref'),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  arrayUnion: vi.fn((...args) => ['arrayUnion', ...args]),
  arrayRemove: vi.fn((...args) => ['arrayRemove', ...args]),
  increment: vi.fn((n) => ['increment', n]),
  getCountFromServer: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

// ─── hotScore (pure function) ──────────────────────────────────────────────────

describe('hotScore', () => {
  function makeThread(overrides: Partial<ForumThread>): ForumThread {
    return {
      id: 't1', authorUid: 'u1', authorName: 'A', conceptId: null, conceptTitle: null,
      category: 'question', title: 'T', body: 'B', createdAt: null, lastActivityAt: null,
      replyCount: 0, hasBestAnswer: false, upvotedBy: [], reactionsHelpful: [],
      reactionsSame: [], reactionsGreat: [], isPinned: false,
      ...overrides,
    };
  }

  it('returns raw engagement score when createdAt is missing', () => {
    const thread = makeThread({ upvotedBy: ['a', 'b'], replyCount: 3, reactionsHelpful: ['c'] });
    // 2 upvotes + 3*2 replies + 1 reaction = 9
    expect(hotScore(thread)).toBe(9);
  });

  it('decays score as the thread ages', () => {
    const now = Date.now();
    const fresh = makeThread({
      upvotedBy: ['a'], replyCount: 1,
      createdAt: { toDate: () => new Date(now) } as any,
    });
    const old = makeThread({
      upvotedBy: ['a'], replyCount: 1,
      createdAt: { toDate: () => new Date(now - 48 * 3_600_000) } as any,
    });
    expect(hotScore(fresh)).toBeGreaterThan(hotScore(old));
  });

  it('never divides by zero at age=0 (uses +2 hour offset)', () => {
    const thread = makeThread({
      upvotedBy: ['a'], replyCount: 0,
      createdAt: { toDate: () => new Date(Date.now()) } as any,
    });
    expect(Number.isFinite(hotScore(thread))).toBe(true);
  });
});

// ─── createForumThread ──────────────────────────────────────────────────────────

describe('createForumThread', () => {
  it('writes minimal required fields and defaults category/moderation', async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'thread-1' });

    const id = await createForumThread({
      authorUid: 'u1', authorName: 'Ана', title: 'Прашање', body: 'Текст',
    });

    expect(id).toBe('thread-1');
    const payload = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.category).toBe('question');
    expect(payload.moderationStatus).toBe('pending');
    expect(payload.conceptId).toBeNull();
    expect(payload.dokLevel).toBeUndefined();
    expect(payload.scenarioId).toBeUndefined();
  });

  it('skips moderation queue when skipModeration is true', async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'thread-2' });
    await createForumThread({
      authorUid: 'u1', authorName: 'A', title: 'T', body: 'B', skipModeration: true,
    });
    const payload = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.moderationStatus).toBe('approved');
  });

  it('only includes optional fields (dokLevel, scenarioId, etc.) when provided', async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'thread-3' });
    await createForumThread({
      authorUid: 'u1', authorName: 'A', title: 'T', body: 'B',
      dokLevel: 3, scenarioId: 'sc-1', scenarioTitle: 'Сценарио',
      forumImageUrl: 'https://x/img.png', shape3dShape: 'cube',
    });
    const payload = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.dokLevel).toBe(3);
    expect(payload.scenarioId).toBe('sc-1');
    expect(payload.scenarioTitle).toBe('Сценарио');
    expect(payload.forumImageUrl).toBe('https://x/img.png');
    expect(payload.shape3dShape).toBe('cube');
  });

  it('seeds participantUids with the author', async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'thread-4' });
    await createForumThread({ authorUid: 'u-42', authorName: 'A', title: 'T', body: 'B' });
    const payload = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.participantUids).toEqual(['u-42']);
  });
});

// ─── moderation actions ─────────────────────────────────────────────────────────

describe('approveForumThread / rejectForumThread', () => {
  it('approveForumThread sets moderationStatus to approved', async () => {
    await approveForumThread('t-1');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { moderationStatus: 'approved' });
  });

  it('rejectForumThread soft-deletes and marks rejected', async () => {
    await rejectForumThread('t-1');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { deleted: true, moderationStatus: 'rejected' });
  });
});

// ─── fetchForumThreads ──────────────────────────────────────────────────────────

describe('fetchForumThreads', () => {
  it('applies deleted=false + createdAt desc + limit by default', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });
    await fetchForumThreads();
    expect(where).toHaveBeenCalledWith('deleted', '==', false);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(80);
  });

  it('adds a conceptId filter when provided', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });
    await fetchForumThreads({ conceptId: 'c-1' });
    expect(where).toHaveBeenCalledWith('conceptId', '==', 'c-1');
  });

  it('backfills missing legacy fields with safe defaults', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
      docs: [{ id: 'd1', data: () => ({ authorUid: 'u1', title: 'T' }) }],
    });
    const threads = await fetchForumThreads();
    expect(threads[0]).toMatchObject({
      id: 'd1', reactionsHelpful: [], reactionsSame: [], reactionsGreat: [],
      isPinned: false, hasBestAnswer: false, category: 'question',
    });
  });

  it('swallows errors and returns an empty array', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    await expect(fetchForumThreads()).resolves.toEqual([]);
  });
});

describe('fetchForumThread', () => {
  it('returns null when the doc does not exist', async () => {
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false });
    expect(await fetchForumThread('missing')).toBeNull();
  });

  it('backfills defaults on a found doc', async () => {
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true, id: 'd1', data: () => ({ title: 'T' }),
    });
    const thread = await fetchForumThread('d1');
    expect(thread).toMatchObject({ id: 'd1', category: 'question', isPinned: false });
  });
});

describe('fetchForumStats', () => {
  it('returns total + weekly counts', async () => {
    (getCountFromServer as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: () => ({ count: 42 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 5 }) });
    expect(await fetchForumStats()).toEqual({ totalThreads: 42, activeThisWeek: 5 });
  });

  it('returns zeroed stats on error', async () => {
    (getCountFromServer as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
    expect(await fetchForumStats()).toEqual({ totalThreads: 0, activeThisWeek: 0 });
  });
});

// ─── reactions / upvotes ────────────────────────────────────────────────────────

describe('toggleThreadUpvote', () => {
  it('adds the uid via arrayUnion when not yet upvoted', async () => {
    await toggleThreadUpvote('t-1', 'u-1', false);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { upvotedBy: ['arrayUnion', 'u-1'] });
  });

  it('removes the uid via arrayRemove when already upvoted', async () => {
    await toggleThreadUpvote('t-1', 'u-1', true);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { upvotedBy: ['arrayRemove', 'u-1'] });
  });
});

describe('toggleForumReaction', () => {
  it('toggles the given reaction field on the given collection', async () => {
    await toggleForumReaction('forum_replies', 'r-1', 'reactionsHelpful', 'u-1', false);
    expect(doc).toHaveBeenCalledWith({}, 'forum_replies', 'r-1');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { reactionsHelpful: ['arrayUnion', 'u-1'] });
  });
});

// ─── admin actions ──────────────────────────────────────────────────────────────

describe('softDeleteThread / pinThread / restoreThread', () => {
  it('softDeleteThread sets deleted=true', async () => {
    await softDeleteThread('t-1');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { deleted: true });
  });

  it('pinThread sets isPinned to the given value', async () => {
    await pinThread('t-1', true);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { isPinned: true });
  });

  it('restoreThread sets deleted=false', async () => {
    await restoreThread('t-1');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { deleted: false });
  });
});

describe('fetchPendingForumThreads', () => {
  it('filters on moderationStatus=pending, oldest first', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });
    await fetchPendingForumThreads();
    expect(where).toHaveBeenCalledWith('moderationStatus', '==', 'pending');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'asc');
  });
});

// ─── replies ────────────────────────────────────────────────────────────────────

describe('createForumReply', () => {
  it('writes the reply and bumps the parent thread reply count + lastActivityAt', async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'reply-1' });

    const id = await createForumReply({
      threadId: 't-1', authorUid: 'u-1', authorName: 'A', body: 'Одговор',
    });

    expect(id).toBe('reply-1');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', {
      replyCount: ['increment', 1],
      lastActivityAt: 'SERVER_TS',
      participantUids: ['arrayUnion', 'u-1'],
    });
  });
});

describe('toggleReplyUpvote', () => {
  it('adds/removes the uid symmetrically to toggleThreadUpvote', async () => {
    await toggleReplyUpvote('r-1', 'u-1', false);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { upvotedBy: ['arrayUnion', 'u-1'] });
  });
});

describe('updateForumThread / updateForumReply', () => {
  it('updateForumThread stamps editedAt alongside the patch', async () => {
    await updateForumThread('t-1', { title: 'Нов наслов' });
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { title: 'Нов наслов', editedAt: 'SERVER_TS' });
  });

  it('updateForumReply stamps editedAt alongside the new body', async () => {
    await updateForumReply('r-1', { body: 'Нов текст' });
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { body: 'Нов текст', editedAt: 'SERVER_TS' });
  });
});

describe('toggleFeynmanBadge', () => {
  it('flips the current boolean', async () => {
    await toggleFeynmanBadge('r-1', false);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { feynmanBadge: true });
  });
});

// ─── markBestAnswer ─────────────────────────────────────────────────────────────

describe('markBestAnswer', () => {
  function reply(overrides: Partial<ForumReply>): ForumReply {
    return {
      id: 'r1', threadId: 't1', authorUid: 'u1', authorName: 'A', body: 'B',
      createdAt: null, upvotedBy: [], reactionsHelpful: [], reactionsSame: [],
      reactionsGreat: [], isBestAnswer: false,
      ...overrides,
    };
  }

  it('marks a reply as best answer and sets hasBestAnswer on the thread', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
      docs: [{ id: 'r1', data: () => reply({ id: 'r1', isBestAnswer: false }) }],
    });

    await markBestAnswer('r1', 't1');

    // Last updateDoc call sets hasBestAnswer=true on the thread
    const calls = (updateDoc as ReturnType<typeof vi.fn>).mock.calls;
    const threadUpdate = calls[calls.length - 1];
    expect(threadUpdate[1]).toEqual({ hasBestAnswer: true });
  });

  it('un-marks (toggles off) when the reply is already the best answer', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
      docs: [{ id: 'r1', data: () => reply({ id: 'r1', isBestAnswer: true }) }],
    });

    await markBestAnswer('r1', 't1');

    const calls = (updateDoc as ReturnType<typeof vi.fn>).mock.calls;
    // The reply itself gets isBestAnswer: false
    const replySelfUpdate = calls.find(c => 'isBestAnswer' in (c[1] as object) && c === calls[calls.length - 2]);
    expect(replySelfUpdate?.[1]).toEqual({ isBestAnswer: false });
    const threadUpdate = calls[calls.length - 1];
    expect(threadUpdate[1]).toEqual({ hasBestAnswer: false });
  });

  it('clears a previously-best sibling reply when marking a new one', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
      docs: [
        { id: 'r1', data: () => reply({ id: 'r1', isBestAnswer: true }) },
        { id: 'r2', data: () => reply({ id: 'r2', isBestAnswer: false }) },
      ],
    });

    await markBestAnswer('r2', 't1');

    const calls = (updateDoc as ReturnType<typeof vi.fn>).mock.calls;
    // r1 (the old best) should have been cleared
    expect(doc).toHaveBeenCalledWith({}, 'forum_replies', 'r1');
    const r1Clear = calls.find(c => JSON.stringify(c[1]) === JSON.stringify({ isBestAnswer: false }));
    expect(r1Clear).toBeTruthy();
  });
});
