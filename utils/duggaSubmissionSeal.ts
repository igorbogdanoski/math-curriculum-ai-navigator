/**
 * S61-E3 — Tamper-evident SHA-256 seal for Дига submissions.
 *
 * Produces a deterministic hex digest of the canonical (`testId | studentUid |
 * stable-JSON answers`) tuple. Re-computing the same digest later proves the
 * submission has not been altered after the student pressed Submit.
 *
 * The hashing primitive is the platform `crypto.subtle` Web Crypto API,
 * available both in the browser (Vite dev/prod) and in Node ≥ 18 (used by
 * Vitest and any future server-side verification).
 */

/** Stable stringify: sorts object keys recursively so equivalent payloads
 * always serialise identically regardless of key insertion order. */
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

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Resolve a SubtleCrypto in either browser or Node test runners. */
function getSubtle(): SubtleCrypto {
  const g: { crypto?: { subtle?: SubtleCrypto } } = globalThis as unknown as {
    crypto?: { subtle?: SubtleCrypto };
  };
  if (!g.crypto?.subtle) {
    throw new Error('Web Crypto SubtleCrypto API is not available in this environment.');
  }
  return g.crypto.subtle;
}

export interface SealInput {
  testId: string;
  studentUid: string;
  answers: Record<string, string | string[]>;
}

/**
 * Compute the seal hex string. Asynchronous because SubtleCrypto.digest
 * returns a promise.
 */
export async function computeSubmissionSeal(input: SealInput): Promise<string> {
  const payload = `${input.testId}|${input.studentUid}|${stableStringify(input.answers)}`;
  const encoded = new TextEncoder().encode(payload);
  const digest = await getSubtle().digest('SHA-256', encoded);
  return bytesToHex(digest);
}

/** Verify a previously stored seal against a re-computed digest. */
export async function verifySubmissionSeal(
  input: SealInput,
  storedSeal: string,
): Promise<boolean> {
  const fresh = await computeSubmissionSeal(input);
  return fresh === storedSeal.toLowerCase();
}
