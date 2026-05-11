import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getReferralLink,
  getPendingReferralCode,
  clearPendingReferralCode,
  useReferral,
} from './useReferral';

const STORAGE_KEY = 'pending_referral_code';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

// ─── getReferralLink ──────────────────────────────────────────────────────────
describe('getReferralLink', () => {
  it('includes ref param with teacher UID', () => {
    const link = getReferralLink('uid123');
    expect(link).toContain('ref=uid123');
  });

  it('URL-encodes special characters in UID', () => {
    const link = getReferralLink('uid with spaces');
    // encodeURIComponent uses %20, not +
    expect(link).toContain('ref=uid%20with%20spaces');
  });

  it('returns empty string for empty UID', () => {
    expect(getReferralLink('')).toBe('');
  });
});

// ─── getPendingReferralCode / clearPendingReferralCode ────────────────────────
describe('getPendingReferralCode', () => {
  it('returns empty string when nothing stored', () => {
    expect(getPendingReferralCode()).toBe('');
  });

  it('returns stored code', () => {
    localStorage.setItem(STORAGE_KEY, 'TEACHER_UID');
    expect(getPendingReferralCode()).toBe('TEACHER_UID');
  });
});

describe('clearPendingReferralCode', () => {
  it('removes the stored code', () => {
    localStorage.setItem(STORAGE_KEY, 'SOME_CODE');
    clearPendingReferralCode();
    expect(getPendingReferralCode()).toBe('');
  });

  it('is a no-op when nothing is stored', () => {
    expect(() => clearPendingReferralCode()).not.toThrow();
  });
});

// ─── useReferral hook ─────────────────────────────────────────────────────────
describe('useReferral', () => {
  it('reads existing code from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'EXISTING_CODE');
    const { result } = renderHook(() => useReferral());
    expect(result.current.code).toBe('EXISTING_CODE');
  });

  it('returns empty code when localStorage is empty', () => {
    const { result } = renderHook(() => useReferral());
    expect(result.current.code).toBe('');
  });

  it('clear() removes code from localStorage and state', () => {
    localStorage.setItem(STORAGE_KEY, 'MY_CODE');
    const { result } = renderHook(() => useReferral());
    expect(result.current.code).toBe('MY_CODE');

    act(() => result.current.clear());

    expect(result.current.code).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
