import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabDifficulty } from './useLabDifficulty';

describe('useLabDifficulty', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to difficulty 1 when localStorage is empty', () => {
    const { result } = renderHook(() => useLabDifficulty('geometry-3d'));
    expect(result.current[0]).toBe(1);
  });

  it('restores a previously persisted difficulty for that labId', () => {
    window.localStorage.setItem('lab_diff_geometry-3d', '3');
    const { result } = renderHook(() => useLabDifficulty('geometry-3d'));
    expect(result.current[0]).toBe(3);
  });

  it('persists difficulty changes to localStorage under a labId-scoped key', () => {
    const { result } = renderHook(() => useLabDifficulty('calculus'));
    act(() => { result.current[1](2); });
    expect(result.current[0]).toBe(2);
    expect(window.localStorage.getItem('lab_diff_calculus')).toBe('2');
  });

  it('keeps separate persisted state per labId', () => {
    const { result: geo } = renderHook(() => useLabDifficulty('geometry-3d'));
    const { result: calc } = renderHook(() => useLabDifficulty('calculus'));
    act(() => { geo.current[1](3); });
    act(() => { calc.current[1](1); });
    expect(window.localStorage.getItem('lab_diff_geometry-3d')).toBe('3');
    expect(window.localStorage.getItem('lab_diff_calculus')).toBe('1');
  });

  it('falls back to 1 for a corrupt/unexpected stored value', () => {
    window.localStorage.setItem('lab_diff_trigonometry', 'not-a-level');
    const { result } = renderHook(() => useLabDifficulty('trigonometry'));
    expect(result.current[0]).toBe(1);
  });

  it('does not throw when localStorage.setItem fails (e.g. incognito)', () => {
    const { result } = renderHook(() => useLabDifficulty('probability'));
    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => act(() => { result.current[1](2); })).not.toThrow();
    // In-memory state still updates even though persistence failed
    expect(result.current[0]).toBe(2);
  });
});
