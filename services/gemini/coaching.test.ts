/**
 * services/gemini/coaching.test.ts
 * Unit tests for coachLiveWork (live-coached scratchpad hints) and
 * extractProblemsFromImage (photograph-a-worksheet self-study extraction).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallGeminiProxy = vi.fn();
const mockGenerateAndParseJSON = vi.fn();
const mockCheckDailyQuotaGuard = vi.fn();

vi.mock('./core', () => ({
  callGeminiProxy: (...args: unknown[]) => mockCallGeminiProxy(...args),
  generateAndParseJSON: (...args: unknown[]) => mockGenerateAndParseJSON(...args),
  DEFAULT_MODEL: 'gemini-2.5-flash',
  LITE_MODEL: 'gemini-2.5-flash-lite',
  MAX_RETRIES: 2,
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' },
  SAFETY_SETTINGS: [],
  checkDailyQuotaGuard: (...args: unknown[]) => mockCheckDailyQuotaGuard(...args),
  sanitizePromptInput: (s: string, _max: number) => s,
  getAILanguageRule: () => 'Користи литературен македонски јазик.',
}));

const { coachingAPI } = await import('./coaching');

describe('coachLiveWork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallGeminiProxy.mockResolvedValue({ text: '  Провери го знакот на -3.  ' });
  });

  it('checks the daily quota guard before calling the model', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    expect(mockCheckDailyQuotaGuard).toHaveBeenCalledOnce();
  });

  it('sends the image as inlineData alongside the text prompt', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.contents[0].parts).toEqual([
      expect.objectContaining({ text: expect.any(String) }),
      { inlineData: { mimeType: 'image/png', data: 'base64img' } },
    ]);
  });

  it('uses LITE_MODEL with skipTierOverride for a cheap, fast coaching call', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.model).toBe('gemini-2.5-flash-lite');
    expect(config.skipTierOverride).toBe(true);
  });

  it('caps maxOutputTokens to keep hints short', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.generationConfig?.maxOutputTokens).toBeLessThanOrEqual(200);
  });

  it('returns the trimmed hint text', async () => {
    const result = await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    expect(result).toEqual({ hint: 'Провери го знакот на -3.' });
  });

  it('never instructs the model to reveal the final answer', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toMatch(/НИКОГАШ не го откривај/i);
  });

  it('includes the problem text in the prompt', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toContain('2x + 3 = 9');
  });

  it('escalates hint specificity as hintsGivenCount increases (level 1 -> 3/3 wording)', async () => {
    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    const level1Prompt: string = mockCallGeminiProxy.mock.calls[0][0].contents[0].parts[0].text;
    expect(level1Prompt).toContain('Ниво на насока (1/3)');

    await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 5);
    const level3Prompt: string = mockCallGeminiProxy.mock.calls[1][0].contents[0].parts[0].text;
    expect(level3Prompt).toContain('Ниво на насока (3/3)');
  });

  it('substitutes a safe fallback hint when the model output looks like a bare final-answer disclosure (MK)', async () => {
    mockCallGeminiProxy.mockResolvedValueOnce({ text: 'Конечниот одговор е x = 3.' });
    const result = await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    expect(result.hint).not.toContain('x = 3');
    expect(result.hint.length).toBeGreaterThan(0);
  });

  it('substitutes a safe fallback hint for an English-phrased disclosure (defense against image-borne jailbreaks)', async () => {
    mockCallGeminiProxy.mockResolvedValueOnce({ text: 'The final answer is 42.' });
    const result = await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    expect(result.hint).not.toContain('42');
  });

  it('passes through a normal Socratic hint unchanged (no false positive)', async () => {
    mockCallGeminiProxy.mockResolvedValueOnce({ text: 'Провери го знакот кога го пренесуваш членот.' });
    const result = await coachingAPI.coachLiveWork('base64img', 'image/png', '2x + 3 = 9', 0);
    expect(result.hint).toBe('Провери го знакот кога го пренесуваш членот.');
  });
});

describe('extractProblemsFromImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndParseJSON.mockResolvedValue({ problems: ['Реши: 2x + 3 = 9', 'Пресметај: 5 x 6'] });
  });

  it('checks the daily quota guard before calling the model', async () => {
    await coachingAPI.extractProblemsFromImage('base64img', 'image/jpeg');
    expect(mockCheckDailyQuotaGuard).toHaveBeenCalledOnce();
  });

  it('sends the image as inlineData alongside the text prompt', async () => {
    await coachingAPI.extractProblemsFromImage('base64img', 'image/jpeg');
    const [contents] = mockGenerateAndParseJSON.mock.calls[0];
    expect(contents).toEqual([
      expect.objectContaining({ text: expect.any(String) }),
      { inlineData: { mimeType: 'image/jpeg', data: 'base64img' } },
    ]);
  });

  it('prices the extraction at the ASSESSMENT cost bucket', async () => {
    await coachingAPI.extractProblemsFromImage('base64img', 'image/jpeg');
    const generationOverrides = mockGenerateAndParseJSON.mock.calls[0][8];
    expect(generationOverrides).toEqual({ costKey: 'ASSESSMENT' });
  });

  it('returns the extracted problem list', async () => {
    const result = await coachingAPI.extractProblemsFromImage('base64img', 'image/jpeg');
    expect(result).toEqual(['Реши: 2x + 3 = 9', 'Пресметај: 5 x 6']);
  });

  it('returns an empty list when nothing is extracted', async () => {
    mockGenerateAndParseJSON.mockResolvedValue({ problems: [] });
    const result = await coachingAPI.extractProblemsFromImage('base64img', 'image/jpeg');
    expect(result).toEqual([]);
  });
});
