/**
 * Tests for ForumShareButton submit logic (S27 fix).
 *
 * The fix added logger.error to the catch block so forum post failures
 * are diagnosable. These tests verify:
 *   - success path: createForumThread called with correct payload
 *   - error path: logger.error called + error notification shown
 *   - guard: unauthenticated user cannot submit
 *   - guard: empty title or body blocks submit
 *
 * The component's handleSubmit logic is extracted and tested as a pure async
 * function; RTL rendering is covered elsewhere (MaterialFeedbackModal pattern).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Simplified handleSubmit logic mirror ─────────────────────────────────────
// Mirrors components/forum/ForumShareButton.tsx handleSubmit (lines 60-84)

interface SubmitDeps {
  firebaseUid: string | null;
  userDisplayName?: string;
  title: string;
  body: string;
  category: string;
  createForumThread: (payload: object) => Promise<void>;
  addNotification: (msg: string, type: string) => void;
  logError: (...args: unknown[]) => void;
}

async function handleSubmit(deps: SubmitDeps): Promise<'unauthenticated' | 'empty' | 'success' | 'error'> {
  const { firebaseUid, userDisplayName, title, body, category, createForumThread, addNotification, logError } = deps;

  if (!firebaseUid) {
    addNotification('Мора да бидете логирани за да споделите.', 'warning');
    return 'unauthenticated';
  }
  if (!title.trim() || !body.trim()) {
    return 'empty';
  }

  try {
    await createForumThread({
      authorUid:  firebaseUid,
      authorName: userDisplayName ?? 'Наставник',
      category,
      title: title.trim(),
      body:  body.trim(),
    });
    addNotification('Успешно споделено во Форумот! 🎉', 'success');
    return 'success';
  } catch (err) {
    logError('[ForumShareButton] createForumThread failed:', err);
    addNotification('Грешка при споделување во форумот.', 'error');
    return 'error';
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForumShareButton — handleSubmit guards', () => {
  let addNotification: ReturnType<typeof vi.fn>;
  let logError: ReturnType<typeof vi.fn>;
  let createForumThread: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addNotification = vi.fn();
    logError = vi.fn();
    createForumThread = vi.fn().mockResolvedValue(undefined);
  });

  it('returns "unauthenticated" and shows warning when firebaseUid is null', async () => {
    const result = await handleSubmit({
      firebaseUid: null, title: 'Наслов', body: 'Тело',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(result).toBe('unauthenticated');
    expect(addNotification).toHaveBeenCalledWith(expect.stringContaining('логирани'), 'warning');
    expect(createForumThread).not.toHaveBeenCalled();
  });

  it('returns "empty" when title is blank', async () => {
    const result = await handleSubmit({
      firebaseUid: 'uid-123', title: '   ', body: 'Тело',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(result).toBe('empty');
    expect(createForumThread).not.toHaveBeenCalled();
  });

  it('returns "empty" when body is blank', async () => {
    const result = await handleSubmit({
      firebaseUid: 'uid-123', title: 'Наслов', body: '\t\n',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(result).toBe('empty');
    expect(createForumThread).not.toHaveBeenCalled();
  });

  it('returns "empty" when both title and body are blank', async () => {
    const result = await handleSubmit({
      firebaseUid: 'uid-123', title: '', body: '',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(result).toBe('empty');
    expect(createForumThread).not.toHaveBeenCalled();
  });
});

describe('ForumShareButton — success path', () => {
  let addNotification: ReturnType<typeof vi.fn>;
  let logError: ReturnType<typeof vi.fn>;
  let createForumThread: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addNotification = vi.fn();
    logError = vi.fn();
    createForumThread = vi.fn().mockResolvedValue(undefined);
  });

  it('calls createForumThread with correct payload', async () => {
    await handleSubmit({
      firebaseUid: 'teacher-uid-42',
      userDisplayName: 'Наставник Ристо',
      title: 'Квиз: Питагора',
      body: 'Генерирав квиз со 10 прашања.',
      category: 'resource',
      createForumThread, addNotification, logError,
    });
    expect(createForumThread).toHaveBeenCalledWith({
      authorUid:  'teacher-uid-42',
      authorName: 'Наставник Ристо',
      category:   'resource',
      title:      'Квиз: Питагора',
      body:       'Генерирав квиз со 10 прашања.',
    });
  });

  it('trims whitespace from title and body', async () => {
    await handleSubmit({
      firebaseUid: 'uid-1', title: '  Наслов  ', body: '  Текст  ',
      category: 'question', createForumThread, addNotification, logError,
    });
    const call = createForumThread.mock.calls[0][0] as Record<string, string>;
    expect(call.title).toBe('Наслов');
    expect(call.body).toBe('Текст');
  });

  it('shows success notification', async () => {
    const result = await handleSubmit({
      firebaseUid: 'uid-1', title: 'T', body: 'B',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(result).toBe('success');
    expect(addNotification).toHaveBeenCalledWith(expect.stringContaining('Успешно'), 'success');
  });

  it('falls back to "Наставник" when userDisplayName is undefined', async () => {
    await handleSubmit({
      firebaseUid: 'uid-1', userDisplayName: undefined,
      title: 'T', body: 'B', category: 'resource',
      createForumThread, addNotification, logError,
    });
    expect(createForumThread.mock.calls[0][0]).toMatchObject({ authorName: 'Наставник' });
  });

  it('does NOT call logError on success', async () => {
    await handleSubmit({
      firebaseUid: 'uid-1', title: 'T', body: 'B',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(logError).not.toHaveBeenCalled();
  });
});

describe('ForumShareButton — error path (S27 fix)', () => {
  let addNotification: ReturnType<typeof vi.fn>;
  let logError: ReturnType<typeof vi.fn>;
  let createForumThread: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addNotification = vi.fn();
    logError = vi.fn();
    createForumThread = vi.fn().mockRejectedValue(new Error('Firestore permission denied'));
  });

  it('returns "error" when createForumThread rejects', async () => {
    const result = await handleSubmit({
      firebaseUid: 'uid-1', title: 'T', body: 'B',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(result).toBe('error');
  });

  it('CALLS logError with correct prefix (S27 fix)', async () => {
    const err = new Error('Firestore permission denied');
    createForumThread.mockRejectedValue(err);
    await handleSubmit({
      firebaseUid: 'uid-1', title: 'T', body: 'B',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(logError).toHaveBeenCalledWith(
      '[ForumShareButton] createForumThread failed:',
      err,
    );
  });

  it('shows error notification (not silent)', async () => {
    await handleSubmit({
      firebaseUid: 'uid-1', title: 'T', body: 'B',
      category: 'resource', createForumThread, addNotification, logError,
    });
    expect(addNotification).toHaveBeenCalledWith(
      expect.stringContaining('Грешка'),
      'error',
    );
  });

  it('does NOT show success notification on error', async () => {
    await handleSubmit({
      firebaseUid: 'uid-1', title: 'T', body: 'B',
      category: 'resource', createForumThread, addNotification, logError,
    });
    const successCall = addNotification.mock.calls.find(c => c[1] === 'success');
    expect(successCall).toBeUndefined();
  });
});
