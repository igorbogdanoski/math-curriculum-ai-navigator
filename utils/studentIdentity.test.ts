import { describe, it, expect } from 'vitest';
import { membershipKey } from './studentIdentity';

describe('membershipKey', () => {
  it('produces different keys for two different students on the same device', () => {
    const a = membershipKey('device-1', 'Марко');
    const b = membershipKey('device-1', 'Ана');
    expect(a).not.toBe(b);
  });

  it('is stable for the same device+name pair regardless of case/whitespace', () => {
    expect(membershipKey('device-1', 'Марко')).toBe(membershipKey('device-1', '  марко  '));
  });

  it('falls back to a generic slug when no name is given', () => {
    expect(membershipKey('device-1', undefined)).toBe('device-1__student');
    expect(membershipKey('device-1', '')).toBe('device-1__student');
  });
});
