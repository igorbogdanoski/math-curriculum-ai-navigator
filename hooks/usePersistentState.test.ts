// Tests for the usePersistentState hook.
// Hook stores values wrapped in { data, timestamp } in localStorage.
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

const KEY = 'test-persistent-key';

/** Extract the stored data value (ignoring the timestamp wrapper). */
const getStoredData = (key: string) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Hook wraps values: { data: ..., timestamp: number }
    return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
};

describe('usePersistentState hook', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('initialises with initialState when localStorage is empty', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
        expect(result.current[0]).toBe('initial');
    });

    it('initialises from plain JSON stored by older code (backwards compat)', () => {
        // Plain value (no wrapper) — legacy format
        window.localStorage.setItem(KEY, JSON.stringify('legacy value'));
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
        expect(result.current[0]).toBe('legacy value');
    });

    it('initialises from wrapped { data, timestamp } format', () => {
        window.localStorage.setItem(KEY, JSON.stringify({ data: 'wrapped value', timestamp: Date.now() }));
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
        expect(result.current[0]).toBe('wrapped value');
    });

    it('persists updated state to localStorage under data key', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));

        act(() => { result.current[1]('new value'); });

        expect(result.current[0]).toBe('new value');
        expect(getStoredData(KEY)).toBe('new value');
    });

    it('supports functional updates (prev → next)', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 10));

        act(() => { result.current[1](prev => prev + 5); });

        expect(result.current[0]).toBe(15);
        expect(getStoredData(KEY)).toBe(15);
    });

    it('persists complex object state', () => {
        const initial = { count: 0, name: 'counter' };
        const { result } = renderHook(() => usePersistentState(KEY, initial));

        const updated = { count: 1, name: 'updated' };
        act(() => { result.current[1](updated); });

        expect(result.current[0]).toEqual(updated);
        expect(getStoredData(KEY)).toEqual(updated);
    });

    it('falls back to initialState when localStorage contains invalid JSON', () => {
        window.localStorage.setItem(KEY, 'not-json!!');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => usePersistentState(KEY, 'fallback'));

        expect(result.current[0]).toBe('fallback');
        expect(spy).toHaveBeenCalled();
    });

    it('keeps in-memory state when localStorage.setItem throws (e.g. incognito)', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));

        // Replace setItem with a throwing version for the next call only
        vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
            throw new Error('QuotaExceededError');
        });

        act(() => { result.current[1]('still updated'); });

        // State must update in memory even when localStorage fails
        expect(result.current[0]).toBe('still updated');
    });

    it('clear() resets state to initialState', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));

        act(() => { result.current[1]('something'); });
        expect(getStoredData(KEY)).toBe('something');

        act(() => { result.current[2](); }); // clear()

        // State resets; useEffect re-writes localStorage with initialState immediately
        expect(result.current[0]).toBe('initial');
        expect(getStoredData(KEY)).toBe('initial');
    });

    it('lastSaved timestamp is set after first write', () => {
        const before = Date.now();
        const { result } = renderHook(() => usePersistentState(KEY, 'x'));
        // lastSaved is result.current[3]
        expect(result.current[3]).toBeGreaterThanOrEqual(before);
    });
});
