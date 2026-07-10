import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateAndParseJSON = vi.fn();

vi.mock('./core', () => ({
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', INTEGER: 'INTEGER', BOOLEAN: 'BOOLEAN', NUMBER: 'NUMBER' },
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MAX_RETRIES: 2,
  JSON_SYSTEM_INSTRUCTION: 'JSON_SYSTEM_INSTRUCTION',
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => undefined),
  generateAndParseJSON: (...args: unknown[]) => mockGenerateAndParseJSON(...args),
  buildDynamicSystemInstruction: vi.fn(async () => 'SYSTEM_INSTR'),
  minifyContext: vi.fn((ctx: unknown) => ctx),
  sanitizePromptInput: vi.fn((s: string) => s ?? ''),
  getAILanguageRule: vi.fn(() => ''),
}));

vi.mock('./ragService', () => ({
  fetchFewShotExamples: vi.fn(async () => ''),
}));

import { assessmentAPI } from './assessment';
import { AI_COSTS } from './core.constants';
import type { GenerationContext } from '../../types';

const context: GenerationContext = {
  topic: { id: 't1', title: 'Дропки' },
  concepts: [{ id: 'c1', title: 'Собирање дропки' }],
  grade: { level: 6 },
} as unknown as GenerationContext;

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateAndParseJSON.mockResolvedValue({ title: 'T', questions: [] });
});

describe('generateABCTest — server cost matches the single disclosed AI_COSTS.VARIANTS charge', () => {
  it('sums the 3 parallel calls\' costKeys to exactly AI_COSTS.VARIANTS, not 3x it', async () => {
    await assessmentAPI.generateABCTest(5, context);

    expect(mockGenerateAndParseJSON).toHaveBeenCalledTimes(3);
    const total = mockGenerateAndParseJSON.mock.calls
      .map((call) => (call[8] as { costKey?: string })?.costKey)
      .reduce((sum, key) => sum + (AI_COSTS[key as keyof typeof AI_COSTS] ?? 0), 0);

    expect(total).toBe(AI_COSTS.VARIANTS);
  });
});

describe('generateAssessment — cache key includes tier', () => {
  it('caches Free and Pro tier generations under different keys, not one shared key', async () => {
    const { setCached } = await import('./core');
    const questionTypes = ['multiple-choice'] as unknown as Parameters<typeof assessmentAPI.generateAssessment>[1];

    await assessmentAPI.generateAssessment('ASSESSMENT', questionTypes, 5, context, { tier: 'Free' } as never);
    await assessmentAPI.generateAssessment('ASSESSMENT', questionTypes, 5, context, { tier: 'Pro' } as never);

    const keysUsed = vi.mocked(setCached).mock.calls.map(call => call[0]);
    expect(keysUsed).toHaveLength(2);
    expect(keysUsed[0]).not.toEqual(keysUsed[1]);
    expect(keysUsed[0]).toContain('_Free');
    expect(keysUsed[1]).toContain('_Pro');
  });
});
