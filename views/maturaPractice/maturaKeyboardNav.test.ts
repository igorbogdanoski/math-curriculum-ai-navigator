/** S37-D3 — Tests for keyboard-first MC navigation helpers. */
import { describe, it, expect } from 'vitest';
import { resolveMCKey, nextFocusedIdx } from './maturaKeyboardNav';

const ALL_CHOICES = ['А', 'Б', 'В', 'Г'];

describe('resolveMCKey', () => {
  it('returns noop for empty key', () => {
    expect(resolveMCKey('', ALL_CHOICES)).toEqual({ type: 'noop' });
  });

  it('selects via Macedonian Cyrillic letter', () => {
    expect(resolveMCKey('А', ALL_CHOICES)).toEqual({ type: 'select', choice: 'А' });
    expect(resolveMCKey('б', ALL_CHOICES)).toEqual({ type: 'select', choice: 'Б' });
  });

  it('selects via Latin letter', () => {
    expect(resolveMCKey('a', ALL_CHOICES)).toEqual({ type: 'select', choice: 'А' });
    expect(resolveMCKey('D', ALL_CHOICES)).toEqual({ type: 'select', choice: 'Г' });
  });

  it('selects via digits 1-4', () => {
    expect(resolveMCKey('1', ALL_CHOICES)).toEqual({ type: 'select', choice: 'А' });
    expect(resolveMCKey('4', ALL_CHOICES)).toEqual({ type: 'select', choice: 'Г' });
  });

  it('skips selection when target choice is not available', () => {
    expect(resolveMCKey('4', ['А', 'Б'])).toEqual({ type: 'noop' });
    expect(resolveMCKey('Г', ['А', 'Б'])).toEqual({ type: 'noop' });
  });

  it('returns cycle for ArrowDown / ArrowUp', () => {
    expect(resolveMCKey('ArrowDown', ALL_CHOICES)).toEqual({ type: 'cycle', direction: 'down' });
    expect(resolveMCKey('ArrowUp', ALL_CHOICES)).toEqual({ type: 'cycle', direction: 'up' });
  });

  it('returns submit-focused on Enter', () => {
    expect(resolveMCKey('Enter', ALL_CHOICES)).toEqual({ type: 'submit-focused' });
  });

  it('returns noop for unrelated keys', () => {
    expect(resolveMCKey('Tab', ALL_CHOICES)).toEqual({ type: 'noop' });
    expect(resolveMCKey('Escape', ALL_CHOICES)).toEqual({ type: 'noop' });
    expect(resolveMCKey('5', ALL_CHOICES)).toEqual({ type: 'noop' });
  });
});

describe('nextFocusedIdx', () => {
  it('moves down with wrap', () => {
    expect(nextFocusedIdx(0, 'down', 4)).toBe(1);
    expect(nextFocusedIdx(3, 'down', 4)).toBe(0);
  });
  it('moves up with wrap', () => {
    expect(nextFocusedIdx(2, 'up', 4)).toBe(1);
    expect(nextFocusedIdx(0, 'up', 4)).toBe(3);
  });
  it('returns 0 when total is 0', () => {
    expect(nextFocusedIdx(5, 'down', 0)).toBe(0);
  });
});
