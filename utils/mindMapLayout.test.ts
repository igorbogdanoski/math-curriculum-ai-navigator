import { describe, it, expect } from 'vitest';
import { findGroundingTopic, clampVbWidth, MIN_VB_W, MAX_VB_W } from './mindMapLayout';
import type { Topic } from '../types';

describe('findGroundingTopic', () => {
  const topics: Topic[] = [
    {
      id: 't1', title: 'Дропки',
      concepts: [
        { id: 'c1', title: 'Собирање дропки', description: '' },
        { id: 'c2', title: 'Множење дропки', description: '' },
      ],
    } as unknown as Topic,
    {
      id: 't2', title: 'Триаголници и агли',
      concepts: [{ id: 'c3', title: 'Собирање агли', description: '' }],
    } as unknown as Topic,
  ];

  it('matches directly by topic title first', () => {
    expect(findGroundingTopic(topics, 'Дропки')?.id).toBe('t1');
  });

  it('falls back to a per-concept scan when no topic title matches (a teacher types a concept name)', () => {
    expect(findGroundingTopic(topics, 'Собирање агли')?.id).toBe('t2');
  });

  it('returns undefined rather than guessing when nothing matches at all', () => {
    expect(findGroundingTopic(topics, 'Веројатност и статистика')).toBeUndefined();
  });
});

describe('clampVbWidth', () => {
  it('clamps to the minimum zoomed-in width', () => {
    expect(clampVbWidth(10)).toBe(MIN_VB_W);
  });

  it('clamps to the maximum zoomed-out width', () => {
    expect(clampVbWidth(999999)).toBe(MAX_VB_W);
  });

  it('leaves in-range widths untouched', () => {
    const mid = (MIN_VB_W + MAX_VB_W) / 2;
    expect(clampVbWidth(mid)).toBe(mid);
  });
});
