import { describe, expect, it } from 'vitest';
import { buildPedagogicalVideoSegments } from '../utils/videoSegmentation';

describe('buildPedagogicalVideoSegments', () => {
  it('classifies segments into pedagogical types and emits illustration prompts', () => {
    const segments = buildPedagogicalVideoSegments([
      { startMs: 0, endMs: 5000, text: 'Definition: linear function y = mx + b' },
      { startMs: 7000, endMs: 12000, text: 'Example: solve y when x = 2' },
      { startMs: 15000, endMs: 22000, text: 'Draw a graph and diagram of the function' },
      { startMs: 23000, endMs: 30000, text: 'Task: calculate slope from two points' },
    ]);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.some((s) => s.segmentType !== 'mixed')).toBe(true);
    expect(segments.some((s) => s.segmentType === 'illustration')).toBe(true);
    expect(segments.some((s) => typeof s.illustrationPrompt === 'string')).toBe(true);
  });

  it('merges tiny adjacent chunks into fewer meaningful segments', () => {
    const merged = buildPedagogicalVideoSegments([
      { startMs: 0, endMs: 1000, text: 'Let us' },
      { startMs: 1100, endMs: 2000, text: 'solve this' },
      { startMs: 2100, endMs: 2800, text: 'problem now' },
    ]);

    expect(merged.length).toBe(1);
    expect(merged[0].text).toContain('solve this problem');
  });
});
