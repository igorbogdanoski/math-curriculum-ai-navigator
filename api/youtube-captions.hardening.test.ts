import { beforeEach, describe, expect, it } from 'vitest';
import { __testables } from './youtube-captions';

describe('youtube-captions hardening helpers', () => {
  beforeEach(() => {
    __testables.resetRateLimitState();
  });

  it('enforces per-user 20/minute rate limit', () => {
    const uid = 'captions-user-1';
    for (let i = 0; i < 20; i++) {
      expect(__testables.isRateLimited(uid)).toBe(false);
    }
    expect(__testables.isRateLimited(uid)).toBe(true);
  });

  it('tracks different users independently', () => {
    const userA = 'captions-user-a';
    const userB = 'captions-user-b';

    for (let i = 0; i < 20; i++) {
      __testables.isRateLimited(userA);
    }

    expect(__testables.isRateLimited(userA)).toBe(true);
    expect(__testables.isRateLimited(userB)).toBe(false);
  });
});
