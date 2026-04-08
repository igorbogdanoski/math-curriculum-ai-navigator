import { beforeEach, describe, expect, it } from 'vitest';
import { __testables } from './webpage-extract';

describe('webpage-extract hardening helpers', () => {
  beforeEach(() => {
    __testables.resetRateLimitState();
  });

  it('blocks unsafe/internal hosts and allows public hosts', () => {
    expect(__testables.isPrivateOrUnsafeHost('localhost')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('127.0.0.1')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('10.0.1.5')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('172.16.10.4')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('192.168.1.20')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('169.254.169.254')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('metadata.google.internal')).toBe(true);

    expect(__testables.isPrivateOrUnsafeHost('example.com')).toBe(false);
    expect(__testables.isPrivateOrUnsafeHost('academy.khan.org')).toBe(false);
  });

  it('enforces 20 requests per minute per identifier', () => {
    const uid = 'teacher-rate-window';
    for (let i = 0; i < 20; i++) {
      expect(__testables.isRateLimited(uid)).toBe(false);
    }
    expect(__testables.isRateLimited(uid)).toBe(true);
  });
});
