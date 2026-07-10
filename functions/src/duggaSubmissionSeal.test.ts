import { describe, it, expect } from 'vitest';
import { stableStringify, computeSubmissionSeal, verifySubmissionSeal, type SealInput } from './duggaSubmissionSeal';

describe('stableStringify', () => {
  it('produces the same output regardless of key insertion order', () => {
    const a = { b: 1, a: 2 };
    const b = { a: 2, b: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('recurses into arrays and nested objects', () => {
    expect(stableStringify({ z: [1, { y: 2, x: 3 }] })).toBe('{"z":[1,{"x":3,"y":2}]}');
  });

  it('handles primitives and null', () => {
    expect(stableStringify('a')).toBe('"a"');
    expect(stableStringify(5)).toBe('5');
    expect(stableStringify(null)).toBe('null');
  });
});

describe('computeSubmissionSeal / verifySubmissionSeal', () => {
  const input: SealInput = { testId: 't1', studentUid: 'u1', answers: { q1: 'a', q2: ['x', 'y'] } };

  it('is deterministic for the same input', () => {
    expect(computeSubmissionSeal(input)).toBe(computeSubmissionSeal(input));
  });

  it('produces a different seal for different answers (tamper detection)', () => {
    const tampered: SealInput = { ...input, answers: { ...input.answers, q1: 'b' } };
    expect(computeSubmissionSeal(input)).not.toBe(computeSubmissionSeal(tampered));
  });

  it('is insensitive to answer-object key order (same answers, different insertion order)', () => {
    const reordered: SealInput = { testId: 't1', studentUid: 'u1', answers: { q2: ['x', 'y'], q1: 'a' } };
    expect(computeSubmissionSeal(input)).toBe(computeSubmissionSeal(reordered));
  });

  it('verifySubmissionSeal accepts a matching seal and rejects a mismatched one', () => {
    const seal = computeSubmissionSeal(input);
    expect(verifySubmissionSeal(input, seal)).toBe(true);
    expect(verifySubmissionSeal({ ...input, answers: { q1: 'tampered' } }, seal)).toBe(false);
  });

  it('verifySubmissionSeal is case-insensitive on the stored seal (defensive against case-mangled storage)', () => {
    const seal = computeSubmissionSeal(input);
    expect(verifySubmissionSeal(input, seal.toUpperCase())).toBe(true);
  });
});
