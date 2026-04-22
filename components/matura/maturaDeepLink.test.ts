/**
 * S37-C4 — Tests for matura library deep-link helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  parseMaturaDeepLink,
  buildMaturaDeepLink,
  inferTopicAreaFromTheme,
} from './maturaDeepLink';

describe('parseMaturaDeepLink', () => {
  it('returns empty object on empty search', () => {
    expect(parseMaturaDeepLink('')).toEqual({});
    expect(parseMaturaDeepLink('?')).toEqual({});
  });

  it('parses tab=ucilisna&topic=algebra&dok=2', () => {
    expect(parseMaturaDeepLink('?tab=ucilisna&topic=algebra&dok=2')).toEqual({
      tab: 'ucilisna', topic: 'algebra', dok: 2,
    });
  });

  it('accepts URLSearchParams instance', () => {
    const p = new URLSearchParams('tab=teacher');
    expect(parseMaturaDeepLink(p)).toEqual({ tab: 'teacher' });
  });

  it('rejects invalid tab', () => {
    expect(parseMaturaDeepLink('?tab=foo')).toEqual({});
  });

  it('rejects unknown topicArea slug', () => {
    expect(parseMaturaDeepLink('?topic=physics')).toEqual({});
  });

  it('rejects out-of-range DoK', () => {
    expect(parseMaturaDeepLink('?dok=0')).toEqual({});
    expect(parseMaturaDeepLink('?dok=5')).toEqual({});
    expect(parseMaturaDeepLink('?dok=abc')).toEqual({});
  });

  it('parses partial params', () => {
    expect(parseMaturaDeepLink('?topic=geometrija')).toEqual({ topic: 'geometrija' });
    expect(parseMaturaDeepLink('?dok=4')).toEqual({ dok: 4 });
  });

  it('handles search with leading ?', () => {
    expect(parseMaturaDeepLink('?tab=dim')).toEqual({ tab: 'dim' });
  });

  it('handles search without leading ?', () => {
    expect(parseMaturaDeepLink('tab=dim')).toEqual({ tab: 'dim' });
  });
});

describe('buildMaturaDeepLink', () => {
  it('returns bare /matura-library on empty params', () => {
    expect(buildMaturaDeepLink({})).toBe('/matura-library');
  });

  it('builds full URL', () => {
    expect(buildMaturaDeepLink({ tab: 'ucilisna', topic: 'algebra', dok: 2 }))
      .toBe('/matura-library?tab=ucilisna&topic=algebra&dok=2');
  });

  it('omits invalid topic', () => {
    expect(buildMaturaDeepLink({ tab: 'ucilisna', topic: 'unknown' as any }))
      .toBe('/matura-library?tab=ucilisna');
  });

  it('omits out-of-range dok', () => {
    expect(buildMaturaDeepLink({ tab: 'ucilisna', dok: 9 as any }))
      .toBe('/matura-library?tab=ucilisna');
  });

  it('round-trips through parse', () => {
    const params = { tab: 'ucilisna' as const, topic: 'trigonometrija', dok: 3 as const };
    const url = buildMaturaDeepLink(params);
    const search = url.split('?')[1] ?? '';
    expect(parseMaturaDeepLink('?' + search)).toEqual(params);
  });
});

describe('inferTopicAreaFromTheme', () => {
  it('returns undefined for empty/null', () => {
    expect(inferTopicAreaFromTheme(undefined)).toBeUndefined();
    expect(inferTopicAreaFromTheme(null)).toBeUndefined();
    expect(inferTopicAreaFromTheme('')).toBeUndefined();
  });

  it('matches Macedonian algebra terms', () => {
    expect(inferTopicAreaFromTheme('Квадратни равенки')).toBe('algebra');
    expect(inferTopicAreaFromTheme('Линеарни функции')).toBe('algebra');
  });

  it('matches geometry', () => {
    expect(inferTopicAreaFromTheme('Плоштина на триаголник')).toBe('geometrija');
  });

  it('matches trigonometry', () => {
    expect(inferTopicAreaFromTheme('Sin и cos функции')).toBe('trigonometrija');
    expect(inferTopicAreaFromTheme('Тригонометриски идентитети')).toBe('trigonometrija');
  });

  it('matches analiza', () => {
    expect(inferTopicAreaFromTheme('Извод на функција')).toBe('analiza');
    expect(inferTopicAreaFromTheme('Интеграл')).toBe('analiza');
  });

  it('matches matrici-vektori', () => {
    expect(inferTopicAreaFromTheme('Детерминанта на матрица')).toBe('matrici-vektori');
  });

  it('returns undefined for unrelated themes', () => {
    expect(inferTopicAreaFromTheme('Историја на математиката')).toBeUndefined();
  });
});
