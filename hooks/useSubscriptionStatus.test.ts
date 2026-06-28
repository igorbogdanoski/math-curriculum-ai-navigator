import { describe, it, expect } from 'vitest';
import { deriveTier, LOW_CREDITS_THRESHOLD } from './useSubscriptionStatus';
import type { TeachingProfile } from '../types';

function profile(overrides: Partial<TeachingProfile>): TeachingProfile {
  return {
    name: 'Test',
    style: 'Direct Instruction',
    experienceLevel: 'Intermediate',
    ...overrides,
  };
}

// ── deriveTier ────────────────────────────────────────────────────────────────

describe('deriveTier', () => {
  it('returns Free for null user', () => {
    expect(deriveTier(null)).toBe('Free');
  });

  it('uses tier field when present', () => {
    expect(deriveTier(profile({ tier: 'Pro' }))).toBe('Pro');
    expect(deriveTier(profile({ tier: 'School' }))).toBe('School');
    expect(deriveTier(profile({ tier: 'Unlimited' }))).toBe('Unlimited');
  });

  it('falls back to Unlimited when hasUnlimitedCredits and no tier', () => {
    expect(deriveTier(profile({ hasUnlimitedCredits: true }))).toBe('Unlimited');
  });

  it('falls back to Pro when isPremium and no tier or unlimitedCredits', () => {
    expect(deriveTier(profile({ isPremium: true }))).toBe('Pro');
  });

  it('returns Free when no premium flags', () => {
    expect(deriveTier(profile({}))).toBe('Free');
  });

  it('tier field takes precedence over isPremium', () => {
    expect(deriveTier(profile({ tier: 'School', isPremium: true }))).toBe('School');
  });
});

// ── LOW_CREDITS_THRESHOLD constant ────────────────────────────────────────────

describe('LOW_CREDITS_THRESHOLD', () => {
  it('is a positive number', () => {
    expect(LOW_CREDITS_THRESHOLD).toBeGreaterThan(0);
  });

  it('is a reasonable threshold (≤ 10)', () => {
    expect(LOW_CREDITS_THRESHOLD).toBeLessThanOrEqual(10);
  });
});
