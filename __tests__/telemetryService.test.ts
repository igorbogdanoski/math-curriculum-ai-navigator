import { describe, it, expect } from 'vitest';
import {
  sanitizeProps,
  sampleRateForRole,
  shouldSampleEvent,
} from '../services/telemetryService';

describe('telemetryService.sanitizeProps', () => {
  it('drops undefined and null values', () => {
    const out = sanitizeProps({ a: 1, b: undefined, c: null, d: 'x' });
    expect(out).toEqual({ a: 1, d: 'x' });
  });

  it('clamps long strings to 256 chars', () => {
    const long = 'x'.repeat(500);
    const out = sanitizeProps({ s: long });
    expect((out.s as string).length).toBe(256);
    expect((out.s as string).endsWith('...')).toBe(true);
  });

  it('keeps short strings, numbers, booleans untouched', () => {
    const out = sanitizeProps({ s: 'short', n: 42, b: true });
    expect(out).toEqual({ s: 'short', n: 42, b: true });
  });
});

describe('telemetryService.sampleRateForRole', () => {
  it('teachers always tracked (1.0)', () => {
    expect(sampleRateForRole('teacher')).toBe(1);
  });

  it('students sampled at 0.5', () => {
    expect(sampleRateForRole('student')).toBe(0.5);
  });

  it('unknown / school_admin fall to 0.25', () => {
    expect(sampleRateForRole('unknown')).toBe(0.25);
    expect(sampleRateForRole(undefined)).toBe(0.25);
  });
});

describe('telemetryService.shouldSampleEvent', () => {
  it('teachers always sampled in', () => {
    expect(shouldSampleEvent('uid-1', 'first_quiz_generated', 'teacher')).toBe(true);
  });

  it('deterministic for same uid+event', () => {
    const a = shouldSampleEvent('uid-stable', 'credit_consumed', 'student');
    const b = shouldSampleEvent('uid-stable', 'credit_consumed', 'student');
    expect(a).toBe(b);
  });

  it('over a population, student sample rate is approx 0.5', () => {
    let hits = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (shouldSampleEvent(`uid-${i}`, 'credit_consumed', 'student')) hits++;
    }
    const rate = hits / N;
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.6);
  });
});
