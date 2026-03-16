/**
 * Structured error system — typed errors with Macedonian user messages.
 * Builds on top of services/apiErrors.ts (AI-specific errors).
 *
 * Usage:
 *   throw new OfflineError();
 *   throw new QuotaError('Daily limit reached', { nextResetMs: ... });
 *   throw new PermissionError('fetchClasses', 'Teacher auth required');
 */

export enum ErrorCode {
  // Network / connectivity
  OFFLINE = 'OFFLINE',
  TIMEOUT = 'TIMEOUT',

  // AI / quota
  QUOTA_EXHAUSTED = 'QUOTA_EXHAUSTED',
  AI_PARSE_FAILED = 'AI_PARSE_FAILED',
  AI_UNAVAILABLE = 'AI_UNAVAILABLE',

  // Auth / permissions
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Data
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  FIRESTORE_WRITE = 'FIRESTORE_WRITE',
  FIRESTORE_READ = 'FIRESTORE_READ',

  // Generic
  UNKNOWN = 'UNKNOWN',
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class OfflineError extends AppError {
  constructor(message = 'No network connection') {
    super(
      message,
      ErrorCode.OFFLINE,
      'Нема интернет врска. Проверете ја конекцијата и обидете се повторно.',
      true,
    );
    this.name = 'OfflineError';
  }
}

export class QuotaError extends AppError {
  constructor(message = 'AI daily quota exhausted', public readonly meta?: { nextResetMs?: number }) {
    super(
      message,
      ErrorCode.QUOTA_EXHAUSTED,
      'Дневната AI квота е исцрпена. Квотата се обновува во полноќ по Тихоокеанско време (09:00 МК).',
      false,
    );
    this.name = 'QuotaError';
  }
}

export class PermissionError extends AppError {
  constructor(operation: string, detail?: string) {
    super(
      `Permission denied for operation: ${operation}${detail ? ` — ${detail}` : ''}`,
      ErrorCode.PERMISSION_DENIED,
      'Немате дозвола за оваа акција. Проверете дали сте најавени со соодветна сметка.',
      false,
    );
    this.name = 'PermissionError';
  }
}

export class AIServiceError extends AppError {
  constructor(message = 'AI service failed to parse response') {
    super(
      message,
      ErrorCode.AI_PARSE_FAILED,
      'AI сервисот врати неочекуван одговор. Обидете се повторно.',
      true,
    );
    this.name = 'AIServiceError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      `Resource not found: ${resource}`,
      ErrorCode.NOT_FOUND,
      `Бараниот ресурс (${resource}) не е пронајден.`,
      false,
    );
    this.name = 'NotFoundError';
  }
}

export class FirestoreError extends AppError {
  constructor(operation: 'read' | 'write', detail?: string) {
    super(
      `Firestore ${operation} failed${detail ? `: ${detail}` : ''}`,
      operation === 'read' ? ErrorCode.FIRESTORE_READ : ErrorCode.FIRESTORE_WRITE,
      operation === 'read'
        ? 'Грешка при читање на податоци. Проверете ја врската и обидете се повторно.'
        : 'Грешка при зачувување. Проверете ја врската и обидете се повторно.',
      true,
    );
    this.name = 'FirestoreError';
  }
}

/**
 * Classify an unknown caught error into an AppError.
 * Use at the outermost catch boundary to convert raw errors to user-friendly ones.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes('offline') || err.message.toLowerCase().includes('network')) {
      return new OfflineError(err.message);
    }
    if (err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('429')) {
      return new QuotaError(err.message);
    }
    if (err.message.toLowerCase().includes('permission') || err.message.toLowerCase().includes('403')) {
      return new PermissionError('unknown', err.message);
    }
    return new AppError(err.message, ErrorCode.UNKNOWN, err.message, false);
  }
  return new AppError('Unknown error', ErrorCode.UNKNOWN, 'Настана непозната грешка. Обидете се повторно.', false);
}
