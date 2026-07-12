import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../featureFlags/globalConfig', () => ({
  getGlobalDefault: vi.fn(() => undefined),
}));

const mockGetConceptContext = vi.fn(async (..._args: unknown[]) => '');
const mockGetTopicContext = vi.fn(async (..._args: unknown[]) => '');
const mockSearchSimilarContext = vi.fn(async (..._args: unknown[]) => [] as { context: string; conceptId?: string }[]);
vi.mock('../ragService', () => ({
  ragService: {
    getConceptContext: (...args: unknown[]) => mockGetConceptContext(...args),
    getTopicContext: (...args: unknown[]) => mockGetTopicContext(...args),
    searchSimilarContext: (...args: unknown[]) => mockSearchSimilarContext(...args),
  },
}));

import {
  getAILanguageRule, withLangRule, getResolvedTextSystemInstruction,
  isMacedonianContextEnabled, setMacedonianContextEnabled,
  isRecoveryWorksheetEnabled, setRecoveryWorksheetEnabled,
  getSecondaryTrackContext, buildDynamicSystemInstruction,
  TEXT_SYSTEM_INSTRUCTION,
} from './core.instructions';
import { getGlobalDefault } from '../featureFlags/globalConfig';

describe('getAILanguageRule', () => {
  afterEach(() => localStorage.clear());

  it('defaults to Macedonian when no preference is stored', () => {
    expect(getAILanguageRule()).toMatch(/литературен македонски/i);
  });

  it.each([
    ['sq', /АЛБАНСКИ/i],
    ['tr', /ТУРСКИ/i],
    ['en', /АНГЛИСКИ/i],
  ])('returns the %s-language instruction when preferred_language=%s', (lang, expected) => {
    localStorage.setItem('preferred_language', lang);
    expect(getAILanguageRule()).toMatch(expected);
  });

  it('falls back to Macedonian for an unrecognized stored value', () => {
    localStorage.setItem('preferred_language', 'fr');
    expect(getAILanguageRule()).toMatch(/литературен македонски/i);
  });
});

describe('withLangRule', () => {
  afterEach(() => localStorage.clear());

  it('appends the language rule to the given instruction', () => {
    const result = withLangRule('BASE');
    expect(result.startsWith('BASE')).toBe(true);
    expect(result).toContain('ЈАЗИК НА ОДГОВОР:');
  });
});

describe('getResolvedTextSystemInstruction', () => {
  afterEach(() => localStorage.clear());

  it('substitutes {{LANGUAGE_RULE}} in TEXT_SYSTEM_INSTRUCTION', () => {
    expect(TEXT_SYSTEM_INSTRUCTION).toContain('{{LANGUAGE_RULE}}');
    const resolved = getResolvedTextSystemInstruction();
    expect(resolved).not.toContain('{{LANGUAGE_RULE}}');
    expect(resolved).toContain('литературен македонски');
  });
});

describe('isMacedonianContextEnabled / setMacedonianContextEnabled', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getGlobalDefault).mockReturnValue(undefined);
  });

  it('defaults to true when nothing is stored and no global default is set', () => {
    expect(isMacedonianContextEnabled()).toBe(true);
  });

  it('respects a global default of false when no local override exists', () => {
    vi.mocked(getGlobalDefault).mockReturnValue(false);
    expect(isMacedonianContextEnabled()).toBe(false);
  });

  it('a local override wins over the global default', () => {
    vi.mocked(getGlobalDefault).mockReturnValue(true);
    setMacedonianContextEnabled(false);
    expect(isMacedonianContextEnabled()).toBe(false);
  });

  it('round-trips true/false through set + is', () => {
    setMacedonianContextEnabled(false);
    expect(isMacedonianContextEnabled()).toBe(false);
    setMacedonianContextEnabled(true);
    expect(isMacedonianContextEnabled()).toBe(true);
  });
});

describe('isRecoveryWorksheetEnabled / setRecoveryWorksheetEnabled', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getGlobalDefault).mockReturnValue(undefined);
  });

  it('defaults to false when nothing is stored and no global default is set', () => {
    expect(isRecoveryWorksheetEnabled()).toBe(false);
  });

  it('a local override wins over the global default', () => {
    vi.mocked(getGlobalDefault).mockReturnValue(false);
    setRecoveryWorksheetEnabled(true);
    expect(isRecoveryWorksheetEnabled()).toBe(true);
  });
});

describe('getSecondaryTrackContext', () => {
  it('returns an empty string for a null/undefined track', () => {
    expect(getSecondaryTrackContext(null)).toBe('');
    expect(getSecondaryTrackContext(undefined)).toBe('');
  });

  it('returns track-specific pedagogical context for each known track', () => {
    for (const track of ['gymnasium', 'gymnasium_elective', 'vocational4', 'vocational3', 'vocational2'] as const) {
      const ctx = getSecondaryTrackContext(track);
      expect(ctx).toContain('ОБРАЗОВЕН КОНТЕКСТ');
      expect(ctx.length).toBeGreaterThan(50);
    }
  });
});

describe('buildDynamicSystemInstruction', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetConceptContext.mockClear().mockResolvedValue('');
    mockGetTopicContext.mockClear().mockResolvedValue('');
    mockSearchSimilarContext.mockClear().mockResolvedValue([]);
    vi.mocked(getGlobalDefault).mockReturnValue(undefined);
  });

  it('substitutes the language rule placeholder', async () => {
    const result = await buildDynamicSystemInstruction('Base {{LANGUAGE_RULE}} end');
    expect(result).toContain('литературен македонски');
    expect(result).not.toContain('{{LANGUAGE_RULE}}');
  });

  it('calls getConceptContext when both gradeLevel and conceptId are given', async () => {
    await buildDynamicSystemInstruction('Base', 6, 'concept-1');
    expect(mockGetConceptContext).toHaveBeenCalledWith(6, 'concept-1');
    expect(mockGetTopicContext).not.toHaveBeenCalled();
  });

  it('falls back to getTopicContext when only topicId is given (no conceptId)', async () => {
    await buildDynamicSystemInstruction('Base', 6, undefined, 'topic-1');
    expect(mockGetTopicContext).toHaveBeenCalledWith(6, 'topic-1');
    expect(mockGetConceptContext).not.toHaveBeenCalled();
  });

  it('filters out the current conceptId from semantic RAG results and appends the rest', async () => {
    mockSearchSimilarContext.mockResolvedValue([
      { context: 'same concept', conceptId: 'concept-1' },
      { context: 'related concept', conceptId: 'concept-2' },
    ]);
    const result = await buildDynamicSystemInstruction('Base', 6, 'concept-1', undefined, undefined, 'query text');
    expect(result).toContain('related concept');
    expect(result).not.toContain('same concept');
  });

  it('appends secondary-track context when a track is given', async () => {
    const result = await buildDynamicSystemInstruction('Base', undefined, undefined, undefined, 'gymnasium');
    expect(result).toContain('гимназиско');
  });

  it('appends the Macedonian local-context snippet when enabled (the default)', async () => {
    const result = await buildDynamicSystemInstruction('Base');
    expect(result).toContain('МАКЕДОНСКИ ЛОКАЛЕН КОНТЕКСТ');
  });

  it('omits the Macedonian local-context snippet when explicitly disabled', async () => {
    setMacedonianContextEnabled(false);
    const result = await buildDynamicSystemInstruction('Base');
    expect(result).not.toContain('МАКЕДОНСКИ ЛОКАЛЕН КОНТЕКСТ');
  });

  it('appends an early-grade simplification note for gradeLevel <= 3', async () => {
    const result = await buildDynamicSystemInstruction('Base', 2);
    expect(result).toMatch(/рана училишна возраст/);
  });

  it('does not append the early-grade note for gradeLevel > 3', async () => {
    const result = await buildDynamicSystemInstruction('Base', 6);
    expect(result).not.toMatch(/рана училишна возраст/);
  });
});
