/**
 * services/gemini/socraticHint.test.ts
 * Unit tests for generateSocraticHint — verifies prompt content at each level,
 * model selection (LITE_MODEL), and Socratic guard language.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock dependencies ─────────────────────────────────────────────────────────

const mockCallGeminiProxy = vi.fn();

vi.mock('./core', () => ({
  callGeminiProxy: (...args: unknown[]) => mockCallGeminiProxy(...args),
  DEFAULT_MODEL: 'gemini-2.5-flash',
  LITE_MODEL: 'gemini-2.5-flash-lite',
  ULTIMATE_MODEL: 'gemini-3.1-pro-preview',
  SAFETY_SETTINGS: [],
  CACHE_COLLECTION: 'cached_ai_materials',
  MAX_RETRIES: 2,
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', INTEGER: 'INTEGER', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN' },
  checkDailyQuotaGuard: vi.fn(),
  sanitizePromptInput: vi.fn((s: string, _max: number) => s),
  withLangRule: vi.fn((s: string) => s),
  getResolvedTextSystemInstruction: vi.fn(),
  getSecondaryTrackContext: vi.fn(() => ''),
  minifyContext: vi.fn((s: string) => s),
  getCached: vi.fn(() => null),
  setCached: vi.fn(),
  callImagenProxy: vi.fn(),
  callEmbeddingProxy: vi.fn(),
  streamGeminiProxy: vi.fn(),
  streamGeminiProxyRich: vi.fn(),
  generateAndParseJSON: vi.fn(),
  IMAGEN_MODEL: 'imagen-3.0-fast-generate-001',
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  increment: vi.fn(),
  startAfter: vi.fn(),
  arrayUnion: vi.fn(),
  documentId: vi.fn(),
  onSnapshot: vi.fn(),
  getCountFromServer: vi.fn(),
  getAggregateFromServer: vi.fn(),
  average: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadString: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('../gemini/assessment', () => ({ assessmentAPI: {} }));
vi.mock('../gemini/plans', () => ({ plansAPI: {} }));

// Import AFTER mocking
const { realGeminiService: geminiService } = await import('../geminiService.real');

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('generateSocraticHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallGeminiProxy.mockResolvedValue({ text: '  Ова е насока.  ' });
  });

  it('calls callGeminiProxy with LITE_MODEL', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    expect(mockCallGeminiProxy).toHaveBeenCalledOnce();
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.model).toBe('gemini-2.5-flash-lite');
  });

  it('sets skipTierOverride: true for cost efficiency', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.skipTierOverride).toBe(true);
  });

  it('returns trimmed hint text', async () => {
    const result = await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    expect(result).toBe('Ова е насока.');
  });

  it('level 1 prompt does NOT mention formula or steps', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toContain('Ниво на насока: 1/3');
    expect(promptText).toContain('НЕ давај формули');
  });

  it('level 2 prompt asks for method/formula guidance', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 2);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toContain('Ниво на насока: 2/3');
    expect(promptText).toMatch(/метод|правило|формула/i);
  });

  it('level 3 prompt references a concrete critical step', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 3);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toContain('Ниво на насока: 3/3');
    expect(promptText).toMatch(/критичен чекор|конкретен/i);
  });

  it('system instruction emphasises Socratic guidance — never reveals answer', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.systemInstruction).toMatch(/одговорот/i);
    expect(config.systemInstruction).toMatch(/насоки|Сократ/i);
  });

  it('uses low temperature for deterministic hints', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.generationConfig?.temperature).toBeLessThanOrEqual(0.5);
  });

  it('uses limited maxOutputTokens to keep hints concise', async () => {
    await geminiService.generateSocraticHint('Реши: 2x + 4 = 10', 1);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.generationConfig?.maxOutputTokens).toBeLessThanOrEqual(200);
  });

  it('prompt includes the student question text', async () => {
    const question = 'Пресметај ја површината на правоаголник со страни 4 и 7';
    await geminiService.generateSocraticHint(question, 2);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toContain(question);
  });

  it('prompt includes ВАЖНО guard against revealing the answer', async () => {
    await geminiService.generateSocraticHint('Реши: 3x = 9', 3);
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toMatch(/ВАЖНО.*одговор|никогаш.*одговор/i);
  });
});
