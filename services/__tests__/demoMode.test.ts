/**
 * services/__tests__/demoMode.test.ts — S41-D2 unit tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectDemoFromUrl,
  isDemoMode,
  setDemoMode,
  getDemoCredentials,
  _resetDemoModeForTests,
  DEMO_TEACHER_EMAIL,
} from '../demoMode';

describe('demoMode.detectDemoFromUrl (pure)', () => {
  it('detects ?demo=mon in standard query string', () => {
    expect(detectDemoFromUrl('https://x.test/?demo=mon')).toBe(true);
    expect(detectDemoFromUrl('https://x.test/?foo=bar&demo=mon')).toBe(true);
  });

  it('detects ?demo=mon inside the hash fragment', () => {
    expect(detectDemoFromUrl('https://x.test/#/login?demo=mon')).toBe(true);
    expect(detectDemoFromUrl('https://x.test/#?demo=mon')).toBe(true);
  });

  it('rejects missing or wrong values', () => {
    expect(detectDemoFromUrl('https://x.test/')).toBe(false);
    expect(detectDemoFromUrl('https://x.test/?demo=other')).toBe(false);
    expect(detectDemoFromUrl('https://x.test/#/login')).toBe(false);
    expect(detectDemoFromUrl('')).toBe(false);
  });
});

describe('demoMode.isDemoMode + setDemoMode', () => {
  beforeEach(() => _resetDemoModeForTests());
  afterEach(() => _resetDemoModeForTests());

  it('defaults to false when no URL hint and no storage', () => {
    expect(isDemoMode()).toBe(false);
  });

  it('persists when activated explicitly', () => {
    setDemoMode(true);
    expect(isDemoMode()).toBe(true);
    _resetDemoModeForTests();
    expect(isDemoMode()).toBe(false);
  });

  it('returns canonical demo credentials', () => {
    const creds = getDemoCredentials();
    expect(creds.email).toBe(DEMO_TEACHER_EMAIL);
    expect(creds.password.length).toBeGreaterThan(0);
  });
});
