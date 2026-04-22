import { describe, expect, it } from 'vitest';
import {
  buildPedagogicalVideoSegments,
  summarizeVideoSegments,
  classifySegment,
} from '../utils/videoSegmentation';

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

  it('infers DoK level and topic per segment (S38-V1)', () => {
    const segs = buildPedagogicalVideoSegments([
      { startMs: 0, endMs: 10000, text: 'Докажи дека sin^2 x + cos^2 x = 1 за секое реално x во доменот на тригонометриската функција.' },
      { startMs: 15000, endMs: 30000, text: 'Пример: пресметај ја плоштина на триаголник со основа b и висина h во геометрискиот контекст.' },
    ]);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0].dokLevel).toBe(3);
    expect(segs[0].topicMk).toBe('Тригонометрија');
    expect(segs[1].topicMk).toBe('Геометрија');
    expect(typeof segs[0].classificationConfidence).toBe('number');
    expect(Array.isArray(segs[0].matchedKeywords)).toBe(true);
  });

  it('assigns DoK 4 for research verbs', () => {
    const segs = buildPedagogicalVideoSegments([
      { startMs: 0, endMs: 10000, text: 'Истражи и генерализирај ја низата' },
    ]);
    expect(segs[0].dokLevel).toBe(4);
  });
});

describe('summarizeVideoSegments', () => {
  it('aggregates totals, durations, byType, topics, and average DoK', () => {
    const segs = buildPedagogicalVideoSegments([
      { startMs: 0, endMs: 5000, text: 'Definition: sin x function' },
      { startMs: 6000, endMs: 11000, text: 'Task: solve sin x = 0.5' },
      { startMs: 12000, endMs: 20000, text: 'Draw a graph of cos x' },
    ]);
    const stats = summarizeVideoSegments(segs);
    expect(stats.totalSegments).toBe(segs.length);
    expect(stats.totalDurationSec).toBeGreaterThan(0);
    expect(stats.dominantTopic).toBe('Тригонометрија');
    expect(stats.averageDokLevel).toBeGreaterThan(0);
  });

  it('degrades gracefully on empty input', () => {
    const stats = summarizeVideoSegments([]);
    expect(stats.totalSegments).toBe(0);
    expect(stats.averageDokLevel).toBe(0);
    expect(stats.dominantTopic).toBeUndefined();
  });
});

describe('classifySegment (back-compat)', () => {
  it('returns the same canonical types as before', () => {
    expect(classifySegment('Definition: linear function')).toBe('theory');
    expect(classifySegment('Task: solve x+2=5')).toBe('task');
    expect(classifySegment('Example: y = mx + b')).toBe('example');
    expect(classifySegment('Draw a diagram')).toBe('illustration');
    expect(classifySegment('neutral text without keywords')).toBe('mixed');
  });
});
