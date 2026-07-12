/**
 * services/gemini/creativeContent.test.ts
 * Unit tests for generateStoryBook (детска математичка сликовница) and
 * generateTechnicalInfographic (технички инфографик).
 *
 * Core design under test: the AI image is generated exactly once per visual slot
 * (never per-language), text (captions/labels/title) is generated pre-translated
 * into all 4 languages in a single JSON call, and every image prompt explicitly
 * forbids baked-in text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateAndParseJSON = vi.fn();
vi.mock('./core', () => ({
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' },
  DEFAULT_MODEL: 'gemini-3-flash-preview',
  MAX_RETRIES: 2,
  generateAndParseJSON: (...args: unknown[]) => mockGenerateAndParseJSON(...args),
  sanitizePromptInput: (s: string) => s,
}));

const mockGenerateIllustration = vi.fn();
vi.mock('./pedagogy', () => ({
  pedagogyAPI: {
    generateIllustration: (...args: unknown[]) => mockGenerateIllustration(...args),
  },
}));

const { creativeContentAPI } = await import('./creativeContent');

const multiLang = (base: string) => ({ en: `${base} EN`, mk: `${base} MK`, sq: `${base} SQ`, tr: `${base} TR` });

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateIllustration.mockImplementation(async (prompt: string) => ({
    imageUrl: `https://storage.example/${encodeURIComponent(prompt).slice(0, 20)}.png`,
    prompt,
  }));
});

describe('generateStoryBook', () => {
  beforeEach(() => {
    mockGenerateAndParseJSON.mockResolvedValue({
      title: multiLang('Title'),
      pages: Array.from({ length: 6 }, (_, i) => ({
        sceneDescription: `Scene ${i + 1}`,
        caption: multiLang(`Caption ${i + 1}`),
      })),
    });
  });

  it('generates exactly one image per page, not one per language', async () => {
    await creativeContentAPI.generateStoryBook('собирање', '7-9', 6);
    expect(mockGenerateIllustration).toHaveBeenCalledTimes(6);
  });

  it('requests translated JSON in a single call, not four separate language calls', async () => {
    await creativeContentAPI.generateStoryBook('собирање', '7-9', 6);
    expect(mockGenerateAndParseJSON).toHaveBeenCalledTimes(1);
  });

  it('every image prompt explicitly forbids baked-in text', async () => {
    await creativeContentAPI.generateStoryBook('собирање', '7-9', 6);
    for (const call of mockGenerateIllustration.mock.calls) {
      expect(call[0]).toMatch(/no text/i);
      expect(call[0]).toMatch(/no words/i);
    }
  });

  it('returns pages carrying the full 4-language caption alongside each generated image URL', async () => {
    const result = await creativeContentAPI.generateStoryBook('собирање', '7-9', 6);
    expect(result.pages).toHaveLength(6);
    expect(result.pages[0].caption).toEqual(multiLang('Caption 1'));
    expect(result.pages[0].imageUrl).toMatch(/^https:\/\/storage\.example\//);
    expect(result.title).toEqual(multiLang('Title'));
    expect(result.ageRange).toBe('7-9');
  });

  it('clamps an over-large page count to 10, even if the AI draft returns more pages', async () => {
    mockGenerateAndParseJSON.mockResolvedValue({
      title: multiLang('Title'),
      pages: Array.from({ length: 15 }, (_, i) => ({
        sceneDescription: `Scene ${i + 1}`,
        caption: multiLang(`Caption ${i + 1}`),
      })),
    });
    await creativeContentAPI.generateStoryBook('собирање', '7-9', 99);
    expect(mockGenerateIllustration).toHaveBeenCalledTimes(10);
  });
});

describe('generateTechnicalInfographic', () => {
  beforeEach(() => {
    mockGenerateAndParseJSON.mockResolvedValue({
      title: multiLang('Pyramid'),
      visualPrompt: 'A square pyramid on a white background',
      sections: [
        { key: 'overview', heading: multiLang('Overview'), body: multiLang('Body') },
        { key: 'specs', heading: multiLang('Specs'), body: multiLang('Body2') },
      ],
    });
  });

  it('generates exactly one central image, not one per language', async () => {
    await creativeContentAPI.generateTechnicalInfographic('пирамида');
    expect(mockGenerateIllustration).toHaveBeenCalledTimes(1);
  });

  it('the image prompt explicitly forbids baked-in text/labels', async () => {
    await creativeContentAPI.generateTechnicalInfographic('пирамида');
    const [prompt] = mockGenerateIllustration.mock.calls[0];
    expect(prompt).toMatch(/no text/i);
    expect(prompt).toMatch(/no labels/i);
  });

  it('returns sections carrying the full 4-language heading/body', async () => {
    const result = await creativeContentAPI.generateTechnicalInfographic('пирамида');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toEqual(multiLang('Overview'));
    expect(result.imageUrl).toMatch(/^https:\/\/storage\.example\//);
    expect(result.title).toEqual(multiLang('Pyramid'));
  });
});
