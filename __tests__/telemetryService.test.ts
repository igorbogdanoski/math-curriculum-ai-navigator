import { describe, it, expect } from 'vitest';
import {
  sanitizeProps,
  sampleRateForRole,
  shouldSampleEvent,
  hasFirstEventBeenRecorded,
  markFirstEventRecorded,
  shouldEmitQuotaWarning,
  assignExperimentBucket,
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

// ─── S39-F2: activation funnel helpers ───────────────────────────────────────

function makeMemStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
  };
}

describe('telemetryService.firstEvent storage', () => {
  it('returns false when storage is null', () => {
    expect(hasFirstEventBeenRecorded(null, 'uid-1', 'first_quiz_generated')).toBe(false);
  });

  it('roundtrips mark/has on a real storage shim', () => {
    const s = makeMemStorage();
    expect(hasFirstEventBeenRecorded(s, 'uid-x', 'first_lesson_saved')).toBe(false);
    markFirstEventRecorded(s, 'uid-x', 'first_lesson_saved');
    expect(hasFirstEventBeenRecorded(s, 'uid-x', 'first_lesson_saved')).toBe(true);
  });

  it('isolates per uid and per event', () => {
    const s = makeMemStorage();
    markFirstEventRecorded(s, 'uid-A', 'first_quiz_generated');
    expect(hasFirstEventBeenRecorded(s, 'uid-A', 'first_quiz_generated')).toBe(true);
    expect(hasFirstEventBeenRecorded(s, 'uid-B', 'first_quiz_generated')).toBe(false);
    expect(hasFirstEventBeenRecorded(s, 'uid-A', 'first_lesson_saved')).toBe(false);
  });
});

describe('telemetryService.shouldEmitQuotaWarning', () => {
  it('fires when crossing from above to at-threshold', () => {
    expect(shouldEmitQuotaWarning(11, 10)).toBe(true);
    expect(shouldEmitQuotaWarning(15, 5)).toBe(true);
  });

  it('does not fire when already below threshold', () => {
    expect(shouldEmitQuotaWarning(10, 9)).toBe(false);
    expect(shouldEmitQuotaWarning(5, 4)).toBe(false);
  });

  it('does not fire when balance stays above threshold', () => {
    expect(shouldEmitQuotaWarning(20, 15)).toBe(false);
  });

  it('respects custom threshold', () => {
    expect(shouldEmitQuotaWarning(6, 4, 5)).toBe(true);
    expect(shouldEmitQuotaWarning(6, 6, 5)).toBe(false);
  });

  it('does not fire on negative balance', () => {
    expect(shouldEmitQuotaWarning(5, -1)).toBe(false);
  });
});

// ─── S39-F6: experiment bucketing ────────────────────────────────────────────

describe('telemetryService.assignExperimentBucket', () => {
  it('returns A for splitPercent=1 (control everywhere)', () => {
    expect(assignExperimentBucket('uid-x', 'exp1', 1)).toBe('A');
    expect(assignExperimentBucket('uid-y', 'exp1', 1)).toBe('A');
  });

  it('returns B for splitPercent=0 (kill-switch fully on)', () => {
    expect(assignExperimentBucket('uid-x', 'exp1', 0)).toBe('B');
    expect(assignExperimentBucket('uid-y', 'exp1', 0)).toBe('B');
  });

  it('is deterministic for same uid+experiment', () => {
    const a = assignExperimentBucket('uid-stable', 'onboarding_v1', 0.5);
    const b = assignExperimentBucket('uid-stable', 'onboarding_v1', 0.5);
    expect(a).toBe(b);
  });

  it('roughly 50/50 across a population at split=0.5', () => {
    let A = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (assignExperimentBucket(`uid-${i}`, 'onboarding_v1', 0.5) === 'A') A++;
    }
    const rate = A / N;
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.6);
  });

  it('different experiments may bucket the same uid differently', () => {
    let differs = 0;
    for (let i = 0; i < 200; i++) {
      const a = assignExperimentBucket(`uid-${i}`, 'expA', 0.5);
      const b = assignExperimentBucket(`uid-${i}`, 'expB', 0.5);
      if (a !== b) differs++;
    }
    // Independent hashes → ~50% should differ
    expect(differs).toBeGreaterThan(60);
  });
});
