import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateAndParseJSON = vi.fn();

vi.mock('./core', () => ({
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', NUMBER: 'NUMBER' },
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MAX_RETRIES: 2,
  JSON_SYSTEM_INSTRUCTION: 'JSON_SYSTEM_INSTRUCTION',
  generateAndParseJSON: (...args: unknown[]) => mockGenerateAndParseJSON(...args),
}));

vi.mock('./core.instructions', () => ({
  isMacedonianContextEnabled: vi.fn(() => false),
  MACEDONIAN_CONTEXT_SNIPPET: 'MK_CONTEXT_SNIPPET',
}));

import { generateMindMap } from './mindmap';
import { isMacedonianContextEnabled } from './core.instructions';

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateAndParseJSON.mockResolvedValue({ nodes: [] });
});

describe('generateMindMap', () => {
  it('does not include a БРО-code warning for primary/lower-secondary grades (1-9)', async () => {
    await generateMindMap('Дропки', 6);
    const prompt = mockGenerateAndParseJSON.mock.calls[0][0][0].text as string;
    expect(prompt).not.toContain('Не користи БРО кодови');
  });

  it('warns against БРО codes for secondary grades (10-12)', async () => {
    await generateMindMap('Матрици', 11);
    const prompt = mockGenerateAndParseJSON.mock.calls[0][0][0].text as string;
    expect(prompt).toContain('Не користи БРО кодови');
  });

  it('includes the Macedonian-context snippet only when the flag is enabled', async () => {
    vi.mocked(isMacedonianContextEnabled).mockReturnValue(true);
    await generateMindMap('Дропки', 6);
    const prompt = mockGenerateAndParseJSON.mock.calls[0][0][0].text as string;
    expect(prompt).toContain('MK_CONTEXT_SNIPPET');
  });

  it('passes costKey ASSESSMENT and the profile tier through to generateAndParseJSON', async () => {
    await generateMindMap('Дропки', 6, { tier: 'Pro' } as never);
    const call = mockGenerateAndParseJSON.mock.calls[0];
    expect(call[7]).toBe('Pro'); // userTier
    expect(call[8]).toEqual({ costKey: 'ASSESSMENT' });
  });
});
