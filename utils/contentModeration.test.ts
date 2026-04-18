import { describe, it, expect } from 'vitest';
import {
  scanString,
  moderateMaterial,
  MAX_MATERIAL_BYTES,
} from './contentModeration';

describe('scanString', () => {
  it('accepts clean math content', () => {
    expect(scanString('Реши ја равенката 2x + 3 = 7').ok).toBe(true);
  });

  it('rejects empty strings', () => {
    const r = scanString('   ');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('empty');
  });

  it('rejects profanity (EN)', () => {
    const r = scanString('this is fuck bad');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('profanity');
  });

  it('rejects profanity (MK cyrillic)', () => {
    const r = scanString('нема да ти кажам курац');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('profanity');
  });

  it('rejects email addresses (PII)', () => {
    const r = scanString('Контакт: student@example.com за повеќе');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('pii');
  });

  it('rejects phone numbers (PII)', () => {
    const r = scanString('Јавете се на +389 70 123 456');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('pii');
  });

  it('rejects long digit runs', () => {
    const r = scanString('ID: 12345678901234');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('pii');
  });
});

describe('moderateMaterial', () => {
  it('accepts a clean nested material', () => {
    const r = moderateMaterial({
      title: 'Квадратни равенки',
      content: {
        intro: 'Разгледуваме ax² + bx + c = 0',
        items: [{ q: 'Реши x² - 4 = 0', a: 'x = ±2' }],
      },
    });
    expect(r.ok).toBe(true);
  });

  it('blocks profanity in nested content', () => {
    const r = moderateMaterial({
      title: 'OK title',
      content: { body: { deep: ['safe', 'fuck this'] } },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('profanity');
  });

  it('blocks profanity in title', () => {
    const r = moderateMaterial({
      title: 'fuck math',
      content: { x: 1 },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('profanity');
  });

  it('rejects oversized payloads', () => {
    const huge = 'a'.repeat(MAX_MATERIAL_BYTES + 10);
    const r = moderateMaterial({ title: 'T', content: { huge } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('oversized');
  });

  it('skips huge single string leaves (likely base64) but still checks others', () => {
    const bigBlob = 'x'.repeat(30000); // skipped by scan
    const r = moderateMaterial({
      title: 'Clean',
      content: { image: bigBlob, note: 'all good' },
    });
    expect(r.ok).toBe(true);
  });

  it('detects PII buried deep in the object tree', () => {
    const r = moderateMaterial({
      title: 'Lesson',
      content: {
        sections: [
          { name: 'Intro', text: 'fine' },
          { name: 'Contact', text: 'Email me at a@b.co for help' },
        ],
      },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('pii');
  });

  it('handles non-serializable content gracefully', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const r = moderateMaterial({ title: 'T', content: circular });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('oversized');
  });
});
