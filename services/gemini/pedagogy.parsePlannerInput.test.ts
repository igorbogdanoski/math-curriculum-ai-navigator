import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallGeminiProxy = vi.fn();
const mockShouldUseLiteModel = vi.fn();

vi.mock('./core', () => ({
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' },
  DEFAULT_MODEL: 'gemini-3-flash-preview',
  LITE_MODEL: 'gemini-3.1-flash-lite-preview',
  MAX_RETRIES: 2,
  CACHE_COLLECTION: 'cached_ai_materials',
  SAFETY_SETTINGS: [],
  IMAGEN_MODEL: 'imagen-3',
  generateAndParseJSON: vi.fn(),
  callGeminiProxy: (...args: unknown[]) => mockCallGeminiProxy(...args),
  callImagenProxy: vi.fn(),
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => undefined),
  minifyContext: vi.fn((ctx: unknown) => ctx),
  sanitizePromptInput: vi.fn((s: string) => s ?? ''),
  getResolvedTextSystemInstruction: vi.fn(() => ''),
  getSecondaryTrackContext: vi.fn(() => ''),
  getAILanguageRule: vi.fn(() => ''),
}));

vi.mock('./intentRouter', () => ({
  shouldUseLiteModel: (...args: unknown[]) => mockShouldUseLiteModel(...args),
  logRouterDecision: vi.fn(),
}));

vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadString: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('../../firebaseConfig', () => ({ storage: {} }));

import { pedagogyAPI } from './pedagogy';

beforeEach(() => {
  vi.clearAllMocks();
  mockCallGeminiProxy.mockResolvedValue({ text: '{"title":"Час","date":"2026-07-10","type":"lesson","description":""}', candidates: [] });
});

describe('parsePlannerInput — lite-model routing is not silently overridden', () => {
  it('passes skipTierOverride=true and the LITE_MODEL when the router picks lite', async () => {
    mockShouldUseLiteModel.mockReturnValue(true);

    await pedagogyAPI.parsePlannerInput('Час по дропки утре');

    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(1);
    const call = mockCallGeminiProxy.mock.calls[0][0] as { model: string; skipTierOverride?: boolean };
    expect(call.model).toBe('gemini-3.1-flash-lite-preview');
    expect(call.skipTierOverride).toBe(true);
  });

  it('uses DEFAULT_MODEL and does not force skipTierOverride when the router picks the default', async () => {
    mockShouldUseLiteModel.mockReturnValue(false);

    await pedagogyAPI.parsePlannerInput('Час по дропки утре');

    const call = mockCallGeminiProxy.mock.calls[0][0] as { model: string; skipTierOverride?: boolean };
    expect(call.model).toBe('gemini-3-flash-preview');
    expect(call.skipTierOverride).toBe(false);
  });

  it('parses the JSON response into the expected shape', async () => {
    mockShouldUseLiteModel.mockReturnValue(false);
    const result = await pedagogyAPI.parsePlannerInput('Час по дропки утре');
    expect(result).toEqual({ title: 'Час', date: '2026-07-10', type: 'lesson', description: '' });
  });
});
