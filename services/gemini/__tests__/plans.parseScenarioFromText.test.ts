import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before any imports that pull in the modules under test
const mockGenerateAndParseJSON = vi.fn();

vi.mock('../core', async () => {
  const actual = await vi.importActual<typeof import('../core')>('../core');
  return {
    ...actual,
    DEFAULT_MODEL: 'mock-model',
    MAX_RETRIES: 1,
    ULTIMATE_MODEL: 'mock-ultimate',
    generateAndParseJSON: mockGenerateAndParseJSON,
  };
});

vi.mock('../../../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), serverTimestamp: vi.fn() }));

const PARSED_PLAN = {
  title: 'Дропки — воведна',
  grade: 6,
  subject: 'Математика',
  theme: 'Дропки',
  objectives: [{ text: 'Ученикот ги знае основните поими за дропки.' }],
  scenario: {
    introductory: { text: 'Наставникот поставува прашање: Ако поделиме питица...' },
    main: [{ text: 'Учениците работат во групи на задачи со дропки.' }],
    concluding: { text: 'Систематизација — пополнување на излезна картичка.' },
  },
  materials: ['Табла', 'Работен лист'],
};

describe('plansAPI.parseScenarioFromText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndParseJSON.mockResolvedValue(PARSED_PLAN);
  });

  it('calls generateAndParseJSON with DEFAULT_MODEL and useThinking=false', async () => {
    const { plansAPI } = await import('../plans');
    const rawText = 'Воведна активност: Наставникот поставува прашање...\nГлавна активност: Учениците работат...';

    await plansAPI.parseScenarioFromText(rawText);

    expect(mockGenerateAndParseJSON).toHaveBeenCalledTimes(1);
    const [, , model, , , useThinking] = mockGenerateAndParseJSON.mock.calls[0];
    expect(model).toBe('mock-model');
    expect(useThinking).toBe(false);
  });

  it('uses low temperature (0.3) for deterministic transcription', async () => {
    const { plansAPI } = await import('../plans');
    await plansAPI.parseScenarioFromText('Текст на сценарио');

    const [, , , , , , , , overrides] = mockGenerateAndParseJSON.mock.calls[0];
    expect(overrides?.temperature).toBe(0.3);
  });

  it('injects raw text into prompt and never invents content', async () => {
    const { plansAPI } = await import('../plans');
    const rawText = 'Единствен препознатлив текст за тест';
    await plansAPI.parseScenarioFromText(rawText);

    const [contents] = mockGenerateAndParseJSON.mock.calls[0];
    const prompt = (contents as Array<{ text: string }>)[0].text;
    expect(prompt).toContain(rawText);
    expect(prompt).toContain('ТРАНСКРИПЦИЈА');
    expect(prompt).toContain('измислуваш');
  });

  it('truncates rawText to 13000 chars in the prompt', async () => {
    const { plansAPI } = await import('../plans');
    const longText = 'a'.repeat(18000);
    await plansAPI.parseScenarioFromText(longText);

    const [contents] = mockGenerateAndParseJSON.mock.calls[0];
    const prompt = (contents as Array<{ text: string }>)[0].text;
    const inPrompt = prompt.match(/"{3}([\s\S]*?)"{3}/)?.[1] ?? '';
    expect(inPrompt.trim().length).toBeLessThanOrEqual(13000 + 10);
  });

  it('adds truncation warning when text exceeds 13000 chars', async () => {
    const { plansAPI } = await import('../plans');
    const longText = 'Текст '.repeat(3000); // ~18000 chars
    await plansAPI.parseScenarioFromText(longText);

    const [contents] = mockGenerateAndParseJSON.mock.calls[0];
    const prompt = (contents as Array<{ text: string }>)[0].text;
    expect(prompt).toContain('искратен');
  });

  it('does NOT add truncation warning for short texts', async () => {
    const { plansAPI } = await import('../plans');
    await plansAPI.parseScenarioFromText('Краток текст');

    const [contents] = mockGenerateAndParseJSON.mock.calls[0];
    const prompt = (contents as Array<{ text: string }>)[0].text;
    expect(prompt).not.toContain('искратен');
  });

  it('schema requires title and scenario fields', async () => {
    const { plansAPI } = await import('../plans');
    await plansAPI.parseScenarioFromText('Текст');

    const [, schema] = mockGenerateAndParseJSON.mock.calls[0];
    expect(schema.required).toContain('title');
    expect(schema.required).toContain('scenario');
  });

  it('schema includes assessmentStandards (extracted from text, never invented)', async () => {
    const { plansAPI } = await import('../plans');
    await plansAPI.parseScenarioFromText('Текст');

    const [, schema] = mockGenerateAndParseJSON.mock.calls[0];
    // assessmentStandards is in schema so AI can extract existing standards from the document,
    // but the prompt instructs to leave it empty if none are written in the text.
    expect(schema.properties).toHaveProperty('assessmentStandards');
  });

  it('returns the structured plan from generateAndParseJSON', async () => {
    const { plansAPI } = await import('../plans');
    const result = await plansAPI.parseScenarioFromText('Воведна: нешто. Главна: нешто друго.');

    expect(result).toEqual(PARSED_PLAN);
    expect(result.title).toBe('Дропки — воведна');
    expect(result.scenario?.main).toHaveLength(1);
    expect(result.scenario?.introductory?.text).toContain('питица');
  });
});
