import { describe, it, expect } from 'vitest';
import { recoverTruncatedJson, isUsableJson } from './jsonRecovery';

describe('recoverTruncatedJson', () => {
  it('recovers an array truncated mid-way through its last (incomplete) string element', () => {
    const truncated = '{"title":"Тест","questions":["Прашање 1","Прашање 2 unfinis';
    const recovered = recoverTruncatedJson(truncated);
    expect(recovered).toEqual({ title: 'Тест', questions: ['Прашање 1'] });
  });

  it('returns null for text that is not recoverable JSON at all', () => {
    expect(recoverTruncatedJson('Извинете, не можам да генерирам одговор.')).toBeNull();
  });

  it('returns null for a truncated array missing its opening bracket context entirely', () => {
    expect(recoverTruncatedJson('')).toBeNull();
  });
});

describe('isUsableJson', () => {
  it('is true for valid JSON', () => {
    expect(isUsableJson('{"a":1}')).toBe(true);
  });

  it('is true for recoverable truncated JSON', () => {
    expect(isUsableJson('{"items":["a","b unfinis')).toBe(true);
  });

  it('is false for empty or unparseable/unrecoverable text', () => {
    expect(isUsableJson('')).toBe(false);
    expect(isUsableJson('   ')).toBe(false);
    expect(isUsableJson('not json and not recoverable either')).toBe(false);
  });
});
