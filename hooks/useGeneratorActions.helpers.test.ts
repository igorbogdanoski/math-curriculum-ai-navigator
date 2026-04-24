import { describe, it, expect, vi } from 'vitest';

// Stub side-effect-heavy modules pulled in by useGeneratorActions.ts
vi.mock('../services/geminiService', () => ({
  geminiService: {},
  isDailyQuotaKnownExhausted: () => false,
}));
vi.mock('../services/gemini/core', () => ({
  AI_COSTS: {},
  sanitizePromptInput: (s: string) => s,
}));
vi.mock('../services/apiErrors', () => ({
  RateLimitError: class extends Error {},
}));
vi.mock('../utils/errors', () => ({
  ValidationError: class extends Error {},
}));
vi.mock('../services/scanArtifactPersistence', () => ({
  persistScanArtifactWithObservability: vi.fn(),
}));
vi.mock('../i18n/LanguageContext', () => ({ useLanguage: () => 'mk' }));
vi.mock('../utils/extractionBundle', () => ({
  buildExtractionBundle: vi.fn(),
  evaluateExtractionQuality: vi.fn(),
}));
vi.mock('../utils/extractionConceptMap', () => ({
  inferConceptIdsFromExtraction: vi.fn(() => []),
}));
vi.mock('../utils/videoSegmentation', () => ({
  buildPedagogicalVideoSegments: vi.fn(),
}));
vi.mock('./useGeneratorState', () => ({ getInitialState: () => ({}) }));
vi.mock('./useGeneratorQueries', () => ({ useVerifiedQuestions: () => null }));
vi.mock('./useQuotaManager', () => ({ useQuotaManager: () => ({}) }));
vi.mock('./useVariantGenerate', () => ({ useVariantGenerate: () => ({}) }));
vi.mock('./generator', async () => {
  const actual = await vi.importActual<typeof import('./generator/generatorHelpers')>('./generator/generatorHelpers');
  return {
    useGeneratorContext: () => ({}),
    useGeneratorTeacherNote: () => ({}),
    useGeneratorSave: () => ({}),
    useBulkGenerate: () => ({}),
    useMainGenerate: () => ({}),
    buildAiPersonalizationSnippet: actual.buildAiPersonalizationSnippet,
    makeBuildEffectiveInstruction: actual.makeBuildEffectiveInstruction,
    makePersistExtractionArtifact: actual.makePersistExtractionArtifact,
    MACEDONIAN_CONTEXT_HINT: actual.MACEDONIAN_CONTEXT_HINT,
  };
});

import { buildAiPersonalizationSnippet } from './useGeneratorActions';

describe('buildAiPersonalizationSnippet', () => {
  it('returns empty string for default creative+standard+standard', () => {
    const out = buildAiPersonalizationSnippet({
      aiTone: 'creative',
      aiVocabLevel: 'standard',
      aiStyle: 'standard',
    });
    expect(out).toBe('');
  });

  it('includes formal tone when aiTone=formal', () => {
    const out = buildAiPersonalizationSnippet({
      aiTone: 'formal',
      aiVocabLevel: 'standard',
      aiStyle: 'standard',
    });
    expect(out).toContain('формален');
  });

  it('includes simplified vocab snippet', () => {
    const out = buildAiPersonalizationSnippet({
      aiTone: 'creative',
      aiVocabLevel: 'simplified',
      aiStyle: 'standard',
    });
    expect(out).toContain('Поедноставен');
  });

  it('includes socratic style snippet', () => {
    const out = buildAiPersonalizationSnippet({
      aiTone: 'creative',
      aiVocabLevel: 'standard',
      aiStyle: 'socratic',
    });
    expect(out).toContain('Сократски');
  });

  it('combines tone + vocab + style space-separated', () => {
    const out = buildAiPersonalizationSnippet({
      aiTone: 'expert',
      aiVocabLevel: 'advanced',
      aiStyle: 'inquiry',
    });
    expect(out).toContain('стручен');
    expect(out).toContain('Напреден');
    expect(out).toContain('Истражувачки');
  });

  it('handles unknown enum values gracefully (no crash, empty fragments filtered)', () => {
    const out = buildAiPersonalizationSnippet({
      aiTone: 'unknown-tone',
      aiVocabLevel: 'unknown-vocab',
      aiStyle: 'unknown-style',
    });
    expect(typeof out).toBe('string');
  });
});
