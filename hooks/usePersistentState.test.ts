// This file contains tests for the usePersistentState hook.
// It uses Vitest for the test running environment and Testing Library for rendering hooks.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

// Mock localStorage
const localStorageMock = (() => {
    let store: { [key: string]: string } = {};
    return {
        getItem(key: string) {
            return store[key] || null;
        },
        setItem(key: string, value: string) {
            store[key] = value.toString();
        },
        clear() {
            store = {};
        },
        removeItem(key: string) {
            delete store[key];
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

describe('usePersistentState hook', () => {
    const KEY = 'test-key';

    beforeEach(() => {
        // Clear localStorage and restore mocks before each test
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('should initialize with initialState if localStorage is empty', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
        expect(result.current[0]).toBe('initial');
    });

    it('should initialize with value from localStorage if it exists', () => {
        window.localStorage.setItem(KEY, JSON.stringify('stored value'));
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
        expect(result.current[0]).toBe('stored value');
    });

    it('should update state and localStorage when setter is called', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));

        act(() => {
            result.current[1]('new value');
        });

        expect(result.current[0]).toBe('new value');
        expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify('new value'));
    });

    it('should handle functional updates', () => {
        const { result } = renderHook(() => usePersistentState(KEY, 10));

        act(() => {
            result.current[1](prev => prev + 5);
        });

        expect(result.current[0]).toBe(15);
        expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(15));
    });

    it('should handle complex object states', () => {
        const initialState = { count: 0, name: 'counter' };
        const { result } = renderHook(() => usePersistentState(KEY, initialState));

        const updatedState = { count: 1, name: 'updated counter' };
        act(() => {
            result.current[1](updatedState);
        });

        expect(result.current[0]).toEqual(updatedState);
        expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(updatedState));
    });

    it('should return initialState if localStorage has invalid JSON', () => {
        window.localStorage.setItem(KEY, 'invalid-json-string');
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const { result } = renderHook(() => usePersistentState(KEY, 'fallback'));
        
        expect(result.current[0]).toBe('fallback');
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
    
    it('should handle errors when setting item in localStorage', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
            throw new Error('Storage full');
        });

        const { result } = renderHook(() => usePersistentState(KEY, 'initial'));

        act(() => {
            result.current[1]('new value');
        });

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(result.current[0]).toBe('new value'); // State should still update in memory
    });
});