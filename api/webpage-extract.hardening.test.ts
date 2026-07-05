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

  it('blocks bracketed IPv6 loopback/link-local/unique-local hosts (URL.hostname keeps the brackets)', () => {
    expect(__testables.isPrivateOrUnsafeHost('[::1]')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('::1')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('[fe80::1]')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('[fc00::1]')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('[fdff::1]')).toBe(true);
  });

  it('blocks the full 127.0.0.0/8 loopback range, not just 127.0.0.1', () => {
    expect(__testables.isPrivateOrUnsafeHost('127.0.0.2')).toBe(true);
    expect(__testables.isPrivateOrUnsafeHost('127.255.255.255')).toBe(true);
  });

  it('enforces 20 requests per minute per identifier', () => {
    const uid = 'teacher-rate-window';
    for (let i = 0; i < 20; i++) {
      expect(__testables.isRateLimited(uid)).toBe(false);
    }
    expect(__testables.isRateLimited(uid)).toBe(true);
  });
});
