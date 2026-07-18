import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateAndParseJSON = vi.fn();
const mockBuildOfficialCurriculumSummary = vi.fn();

vi.mock('./core', () => ({
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', NUMBER: 'NUMBER' },
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MAX_RETRIES: 2,
  generateAndParseJSON: (...args: unknown[]) => mockGenerateAndParseJSON(...args),
  sanitizePromptInput: vi.fn((s: string) => s ?? ''),
  getSecondaryTrackContext: vi.fn(() => ''),
}));

vi.mock('./plans', () => ({
  buildOfficialCurriculumSummary: (...args: unknown[]) => mockBuildOfficialCurriculumSummary(...args),
}));

vi.mock('../../data/official/pedagogy', () => ({
  buildPedagogyPromptContext: vi.fn(() => ''),
}));

vi.mock('../../data/educationalModelsInfo', () => ({
  educationalHints: { pedagogicalModels: { 'Модел А': {} } },
}));

vi.mock('../../data/allNationalStandardsComplete', () => ({
  MATH_STANDARDS: [],
  CROSS_CURRICULAR_WITH_MATH: [],
  AREA_LABELS: {},
}));

import { annualAPI } from './annual';

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateAndParseJSON.mockResolvedValue({ grade: 'VI', subject: 'Математика', totalWeeks: 36, topics: [] });
});

describe('generateAnnualPlan — official curriculum grounding for every grade (not just 8)', () => {
  it('calls buildOfficialCurriculumSummary for grade 6 (previously only wired for grade 8)', async () => {
    mockBuildOfficialCurriculumSummary.mockResolvedValue('ОФИЦИЈАЛНИ ПОДАТОЦИ ЗА 6 ОДД.');

    await annualAPI.generateAnnualPlan('VI (шесто) Одделение', 'Математика', 36, 'генерички контекст');

    expect(mockBuildOfficialCurriculumSummary).toHaveBeenCalledWith(6);
    const prompt = mockGenerateAndParseJSON.mock.calls[0][0][0].text as string;
    expect(prompt).toContain('ОФИЦИЈАЛНИ ПОДАТОЦИ ЗА 6 ОДД.');
  });

  it('calls buildOfficialCurriculumSummary for grade 1 too', async () => {
    mockBuildOfficialCurriculumSummary.mockResolvedValue('ОФИЦИЈАЛНИ ПОДАТОЦИ ЗА 1 ОДД.');

    await annualAPI.generateAnnualPlan('I (прво) Одделение', 'Математика', 36, 'генерички контекст');

    expect(mockBuildOfficialCurriculumSummary).toHaveBeenCalledWith(1);
  });

  it('does NOT detect a primary grade from a secondary/vocational/elective title that happens to contain a Roman numeral (regression: "I"/"II"/"IV" in secondary titles were misread as grades 1/2/4)', async () => {
    mockBuildOfficialCurriculumSummary.mockResolvedValue('');

    await annualAPI.generateAnnualPlan('I (прва) — Стручно 2-год', 'Математика', 36, 'контекст за стручно 2-год');
    expect(mockBuildOfficialCurriculumSummary).not.toHaveBeenCalled();
    mockBuildOfficialCurriculumSummary.mockClear();

    await annualAPI.generateAnnualPlan('IV — Математичка анализа (изборен)', 'Математика', 36, 'контекст за изборен');
    expect(mockBuildOfficialCurriculumSummary).not.toHaveBeenCalled();
    mockBuildOfficialCurriculumSummary.mockClear();

    await annualAPI.generateAnnualPlan('XI (единаесетто) / II (втора) година — Гимназиско', 'Математика', 36, 'контекст за гимназија');
    expect(mockBuildOfficialCurriculumSummary).not.toHaveBeenCalled();
  });

  it('falls back to the caller-supplied curriculumContext when no official summary is available', async () => {
    mockBuildOfficialCurriculumSummary.mockResolvedValue('');

    await annualAPI.generateAnnualPlan('X', 'Математика', 36, 'генерички локален контекст за средно');

    const prompt = mockGenerateAndParseJSON.mock.calls[0][0][0].text as string;
    expect(prompt).toContain('генерички локален контекст за средно');
  });

  it('includes topicIdHints in the prompt and the schema accepts a nullable topicId field', async () => {
    mockBuildOfficialCurriculumSummary.mockResolvedValue('');

    await annualAPI.generateAnnualPlan('VI', 'Математика', 36, 'контекст', undefined, undefined, [
      { id: 'topic-frac', title: 'Дропки' },
    ]);

    const prompt = mockGenerateAndParseJSON.mock.calls[0][0][0].text as string;
    expect(prompt).toContain('topic-frac');
    expect(prompt).toContain('Дропки');

    const schema = mockGenerateAndParseJSON.mock.calls[0][1] as { properties: { topics: { items: { properties: { topicId?: unknown } } } } };
    expect(schema.properties.topics.items.properties.topicId).toBeDefined();
  });

  it('overrides the default 60s generation timeout — this prompt (full official grounding + all 27 БРО standards + pedagogy context) is the largest single generation in the app and was observed timing out in production', async () => {
    mockBuildOfficialCurriculumSummary.mockResolvedValue('');

    await annualAPI.generateAnnualPlan('IX', 'Математика', 36, 'контекст');

    const overrides = mockGenerateAndParseJSON.mock.calls[0][8] as { timeoutMs?: number };
    expect(overrides.timeoutMs).toBeGreaterThanOrEqual(90_000);
  });
});
