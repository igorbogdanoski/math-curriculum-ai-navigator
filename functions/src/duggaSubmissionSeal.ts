/**
 * Server-side copy of utils/duggaSubmissionSeal.ts (kept in sync manually — this
 * project builds separately from the main app, see duggaVerification.ts for why).
 * Verifies the tamper-evident seal a final-exam-mode submission was stored with.
 * Uses Node's built-in `crypto` (rather than the client's Web Crypto `subtle.digest`)
 * since this runs in a Cloud Function, not a browser — same SHA-256 algorithm, so
 * digests computed here are identical to ones the client already stored.
 */
import { createHash } from 'crypto';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(v => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export interface SealInput {
  testId: string;
  studentUid: string;
  answers: Record<string, string | string[]>;
}

export function computeSubmissionSeal(input: SealInput): string {
  const payload = `${input.testId}|${input.studentUid}|${stableStringify(input.answers)}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function verifySubmissionSeal(input: SealInput, storedSeal: string): boolean {
  return computeSubmissionSeal(input) === storedSeal.toLowerCase();
}
