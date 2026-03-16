/**
 * Unit tests for utils/errors.ts — structured error system
 * R3-Г: covers AppError subclasses, ErrorCode values, МК user messages, toAppError classifier
 */
import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  AppError,
  OfflineError,
  QuotaError,
  PermissionError,
  AIServiceError,
  NotFoundError,
  FirestoreError,
  toAppError,
} from '../utils/errors';

// ── AppError base ────────────────────────────────────────────────────────────
describe('AppError', () => {
  it('stores message, code, userMessage and retryable flag', () => {
    const err = new AppError('dev msg', ErrorCode.UNKNOWN, 'MK msg', true);
    expect(err.message).toBe('dev msg');
    expect(err.code).toBe(ErrorCode.UNKNOWN);
    expect(err.userMessage).toBe('MK msg');
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('defaults retryable to false', () => {
    const err = new AppError('m', ErrorCode.UNKNOWN, 'u');
    expect(err.retryable).toBe(false);
  });

  it('is instance of Error', () => {
    expect(new AppError('m', ErrorCode.UNKNOWN, 'u')).toBeInstanceOf(Error);
  });
});

// ── OfflineError ─────────────────────────────────────────────────────────────
describe('OfflineError', () => {
  it('has OFFLINE code and is retryable', () => {
    const err = new OfflineError();
    expect(err.code).toBe(ErrorCode.OFFLINE);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('OfflineError');
  });

  it('userMessage contains МК text', () => {
    expect(new OfflineError().userMessage).toContain('интернет');
  });
});

// ── QuotaError ───────────────────────────────────────────────────────────────
describe('QuotaError', () => {
  it('has QUOTA_EXHAUSTED code and is NOT retryable', () => {
    const err = new QuotaError();
    expect(err.code).toBe(ErrorCode.QUOTA_EXHAUSTED);
    expect(err.retryable).toBe(false);
  });

  it('stores optional meta.nextResetMs', () => {
    const err = new QuotaError('limit', { nextResetMs: 12345 });
    expect(err.meta?.nextResetMs).toBe(12345);
  });

  it('userMessage mentions 09:00', () => {
    expect(new QuotaError().userMessage).toContain('09:00');
  });
});

// ── PermissionError ──────────────────────────────────────────────────────────
describe('PermissionError', () => {
  it('has PERMISSION_DENIED code', () => {
    const err = new PermissionError('fetchClasses');
    expect(err.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(err.retryable).toBe(false);
  });

  it('includes operation name in dev message', () => {
    const err = new PermissionError('fetchClasses', 'no role');
    expect(err.message).toContain('fetchClasses');
    expect(err.message).toContain('no role');
  });
});

// ── AIServiceError ───────────────────────────────────────────────────────────
describe('AIServiceError', () => {
  it('has AI_PARSE_FAILED code and is retryable', () => {
    const err = new AIServiceError();
    expect(err.code).toBe(ErrorCode.AI_PARSE_FAILED);
    expect(err.retryable).toBe(true);
  });
});

// ── NotFoundError ─────────────────────────────────────────────────────────────
describe('NotFoundError', () => {
  it('has NOT_FOUND code and includes resource name', () => {
    const err = new NotFoundError('quiz/abc123');
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
    expect(err.userMessage).toContain('quiz/abc123');
  });
});

// ── FirestoreError ────────────────────────────────────────────────────────────
describe('FirestoreError', () => {
  it('read → FIRESTORE_READ, retryable', () => {
    const err = new FirestoreError('read', 'timeout');
    expect(err.code).toBe(ErrorCode.FIRESTORE_READ);
    expect(err.retryable).toBe(true);
    expect(err.message).toContain('timeout');
  });

  it('write → FIRESTORE_WRITE, retryable', () => {
    const err = new FirestoreError('write');
    expect(err.code).toBe(ErrorCode.FIRESTORE_WRITE);
    expect(err.retryable).toBe(true);
  });
});

// ── toAppError ────────────────────────────────────────────────────────────────
describe('toAppError', () => {
  it('passes through AppError unchanged', () => {
    const orig = new OfflineError();
    expect(toAppError(orig)).toBe(orig);
  });

  it('classifies "offline" message → OfflineError', () => {
    const result = toAppError(new Error('Network offline'));
    expect(result.code).toBe(ErrorCode.OFFLINE);
    expect(result.retryable).toBe(true);
  });

  it('classifies "network" message → OfflineError', () => {
    const result = toAppError(new Error('network request failed'));
    expect(result.code).toBe(ErrorCode.OFFLINE);
  });

  it('classifies "quota" message → QuotaError', () => {
    const result = toAppError(new Error('quota exceeded'));
    expect(result.code).toBe(ErrorCode.QUOTA_EXHAUSTED);
  });

  it('classifies "429" message → QuotaError', () => {
    const result = toAppError(new Error('HTTP 429 Too Many Requests'));
    expect(result.code).toBe(ErrorCode.QUOTA_EXHAUSTED);
  });

  it('classifies "permission" message → PermissionError', () => {
    const result = toAppError(new Error('permission denied'));
    expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('classifies "403" message → PermissionError', () => {
    const result = toAppError(new Error('403 Forbidden'));
    expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('wraps unknown plain errors → UNKNOWN', () => {
    const result = toAppError(new Error('something weird happened'));
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.message).toBe('something weird happened');
  });

  it('wraps non-Error values → UNKNOWN with МК message', () => {
    const result = toAppError('random string error');
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.userMessage).toContain('непозната');
  });

  it('handles null/undefined → UNKNOWN', () => {
    expect(toAppError(null).code).toBe(ErrorCode.UNKNOWN);
    expect(toAppError(undefined).code).toBe(ErrorCode.UNKNOWN);
  });
});
