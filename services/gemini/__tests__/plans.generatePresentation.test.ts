import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateAndParseJSON = vi.fn();
const mockBuildDynamicSystemInstruction = vi.fn(async () => 'SYSTEM_PROMPT');

vi.mock('../core', async () => {
  const actual = await vi.importActual<typeof import('../core')>('../core');
  return {
    ...actual,
    DEFAULT_MODEL: 'mock-model',
    MAX_RETRIES: 1,
    generateAndParseJSON: mockGenerateAndParseJSON,
    buildDynamicSystemInstruction: mockBuildDynamicSystemInstruction,
  };
});

vi.mock('../../../firebaseConfig', () => ({
  db: {},
}));

describe('plansAPI.generatePresentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndParseJSON.mockResolvedValue({
      title: 'Test',
      topic: 'Алгебра',
      gradeLevel: 9,
      slides: [],
    });
  });

  it('includes contextual continuity fields in prompt and schema', async () => {
    const { plansAPI } = await import('../plans');

    await plansAPI.generatePresentation('Алгебра', 9, ['Линеарни равенки'], 'Нека биде визуелно', undefined, 8);

    expect(mockGenerateAndParseJSON).toHaveBeenCalledTimes(1);
    const [contents, schema] = mockGenerateAndParseJSON.mock.calls[0];

    const prompt = (contents as Array<{ text: string }>)[0].text;
    expect(prompt).toContain('concept: краток назив на концептот');
    expect(prompt).toContain('formulas: листа со формули');
    expect(prompt).toContain('priorFormulas: листа со формули');
    expect(prompt).toContain('КОНТЕКСТУАЛНА КОНТИНУИТЕТНОСТ (задолжително)');

    const slideProps = (schema as { properties: { slides: { items: { properties: Record<string, unknown> } } } }).properties.slides.items.properties;
    expect(slideProps).toHaveProperty('concept');
    expect(slideProps).toHaveProperty('formulas');
    expect(slideProps).toHaveProperty('priorFormulas');
  });
});
