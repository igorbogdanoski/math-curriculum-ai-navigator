/**
 * services/gemini/visionContracts.test.ts
 * Unit tests for Vision RAG Contracts v1.
 *
 * Tests use vi.mock to avoid real Gemini calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  HomeworkFeedbackOutput,
  TestGradingOutput,
  ContentExtractionOutput,
  SmartOCROutput,
  WebTaskExtractionOutput,
} from './visionContracts';

// ─── Mock callGeminiProxy ──────────────────────────────────────────────────────

const mockCallGeminiProxy = vi.fn();
vi.mock('./core', () => ({
  callGeminiProxy: (...args: unknown[]) => mockCallGeminiProxy(...args),
  DEFAULT_MODEL: 'gemini-2.5-flash',
  ULTIMATE_MODEL: 'gemini-3.1-pro-preview',
  SAFETY_SETTINGS: [],
}));

// Import AFTER mocking
const {
  homeworkFeedbackContract,
  testGradingContract,
  contentExtractionContract,
} = await import('./visionContracts');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeProxy(text: string) {
  return mockCallGeminiProxy.mockResolvedValue({ text });
}

const VALID_HF_OUTPUT: HomeworkFeedbackOutput = {
  summary: 'Добра работа',
  strengths: ['Точно решена задача 1'],
  mistakes: [
    {
      itemRef: 'Задача 2',
      misconceptionType: 'procedural',
      whyItIsWrong: 'Погрешно собирање',
      correctionSteps: ['Чекор 1', 'Чекор 2'],
    },
  ],
  nextSteps: ['Вежбај дропки'],
  estimatedMastery: 75,
  ragMeta: {
    conceptIds: ['gym5-c1-1'],
    topicId: 'fractions',
    gradeLevel: 5,
    evidenceSpans: [{ claim: 'knows multiplication', source: 'task 1' }],
  },
};

const VALID_TG_OUTPUT: TestGradingOutput = {
  grades: [
    { questionId: 'q1', earnedPoints: 2, maxPoints: 3, feedback: 'Добро', confidence: 0.9 },
    { questionId: 'q2', earnedPoints: 1, maxPoints: 2, feedback: 'Делумно точно', misconception: 'sign error', correctionHint: 'Check sign', confidence: 0.8 },
  ],
  total: { earned: 3, max: 5, percentage: 60 },
  pedagogy: { classLevelGaps: ['Алгебра'], remediationActions: ['Вежбај знаци'] },
  ragMeta: { conceptIds: ['gym8-c2-1'], topicId: 'algebra', gradeLevel: 8 },
};

const VALID_CE_OUTPUT: ContentExtractionOutput = {
  formulas: ['$a^2 + b^2 = c^2$'],
  theories: ['Питагорова теорема'],
  tasks: ['Пресметај хипотенуза кога a=3, b=4'],
  normalizedText: 'Питагорова теорема и нејзина примена во решавање задачи.',
  quality: { score: 85, label: 'good', truncated: false },
  ragMeta: {
    conceptIds: ['gym8-c3-2'],
    topicId: 'pythagoras',
    gradeLevel: 8,
    sourceEvidence: [{ itemType: 'formula', text: 'a^2+b^2=c^2' }],
  },
};

// ─── Contract 1: homework_feedback ────────────────────────────────────────────

describe('homeworkFeedbackContract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed output on first valid response', async () => {
    makeProxy(JSON.stringify(VALID_HF_OUTPUT));
    const { output, retried, fallback } = await homeworkFeedbackContract({
      scanRef: 'scan-1',
      mimeType: 'image/jpeg',
      imageBase64: 'abc123',
      gradeLevel: 5,
      detailMode: 'standard',
    });
    expect(fallback).toBe(false);
    expect(retried).toBe(false);
    expect(output.estimatedMastery).toBe(75);
    expect(output.strengths.length).toBeGreaterThanOrEqual(1);
    expect(output.mistakes[0].correctionSteps.length).toBeGreaterThanOrEqual(1);
    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(1);
  });

  it('retries once on invalid JSON then returns valid output', async () => {
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: 'not valid json' })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HF_OUTPUT) });
    const { output, retried, fallback } = await homeworkFeedbackContract({
      scanRef: 'scan-2',
      mimeType: 'image/png',
      imageBase64: 'xyz',
      gradeLevel: 6,
      detailMode: 'standard',
    });
    expect(retried).toBe(true);
    expect(fallback).toBe(false);
    expect(output.summary).toBe('Добра работа');
    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(2);
  });

  it('returns fallback after two consecutive failures', async () => {
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: '{}' })
      .mockResolvedValueOnce({ text: '{}' });
    const { output, fallback } = await homeworkFeedbackContract({
      scanRef: 'scan-3',
      mimeType: 'image/jpeg',
      imageBase64: 'bad',
      gradeLevel: 7,
      detailMode: 'standard',
    });
    expect(fallback).toBe(true);
    expect(output.estimatedMastery).toBe(0);
    expect(output.strengths).toEqual(['—']);
  });

  it('strips markdown fences from response', async () => {
    makeProxy('```json\n' + JSON.stringify(VALID_HF_OUTPUT) + '\n```');
    const { output, fallback } = await homeworkFeedbackContract({
      scanRef: 'scan-4',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      gradeLevel: 5,
      detailMode: 'detailed',
    });
    expect(fallback).toBe(false);
    expect(output.summary).toBe('Добра работа');
  });

  it('rejects output where estimatedMastery is out of range', async () => {
    const bad = { ...VALID_HF_OUTPUT, estimatedMastery: 150 };
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: JSON.stringify(bad) })
      .mockResolvedValueOnce({ text: JSON.stringify(bad) });
    const { fallback } = await homeworkFeedbackContract({
      scanRef: 'scan-5',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      gradeLevel: 5,
      detailMode: 'standard',
    });
    expect(fallback).toBe(true);
  });

  it('rejects output with empty strengths array', async () => {
    const bad = { ...VALID_HF_OUTPUT, strengths: [] };
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: JSON.stringify(bad) })
      .mockResolvedValueOnce({ text: JSON.stringify(bad) });
    const { fallback } = await homeworkFeedbackContract({
      scanRef: 'scan-6',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      gradeLevel: 5,
      detailMode: 'standard',
    });
    expect(fallback).toBe(true);
  });
});

// ─── Contract 2: test_grading ──────────────────────────────────────────────────

describe('testGradingContract', () => {
  beforeEach(() => vi.clearAllMocks());

  const INPUT_QUESTIONS = [
    { id: 'q1', text: 'Колку е 2+2?', points: 3, correctAnswer: '4', conceptId: 'gym4-c1-1' },
    { id: 'q2', text: 'Реши: x+1=3', points: 2, correctAnswer: 'x=2' },
  ];

  it('returns parsed grades on success', async () => {
    makeProxy(JSON.stringify(VALID_TG_OUTPUT));
    const { output, fallback } = await testGradingContract({
      scanRef: 'test-1',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      questions: INPUT_QUESTIONS,
      gradeLevel: 8,
    });
    expect(fallback).toBe(false);
    expect(output.grades).toHaveLength(2);
    expect(output.total.percentage).toBe(60);
  });

  it('rejects if grades count mismatches question count', async () => {
    const bad = { ...VALID_TG_OUTPUT, grades: [VALID_TG_OUTPUT.grades[0]] };
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: JSON.stringify(bad) })
      .mockResolvedValueOnce({ text: JSON.stringify(bad) });
    const { fallback } = await testGradingContract({
      scanRef: 'test-2',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      questions: INPUT_QUESTIONS,
      gradeLevel: 8,
    });
    expect(fallback).toBe(true);
  });

  it('rejects if earnedPoints > maxPoints', async () => {
    const bad = {
      ...VALID_TG_OUTPUT,
      grades: [
        { ...VALID_TG_OUTPUT.grades[0], earnedPoints: 10, maxPoints: 3 },
        VALID_TG_OUTPUT.grades[1],
      ],
    };
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: JSON.stringify(bad) })
      .mockResolvedValueOnce({ text: JSON.stringify(bad) });
    const { fallback } = await testGradingContract({
      scanRef: 'test-3',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      questions: INPUT_QUESTIONS,
      gradeLevel: 8,
    });
    expect(fallback).toBe(true);
  });

  it('fallback has one entry per input question with 0 earned', async () => {
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: '{}' })
      .mockResolvedValueOnce({ text: '{}' });
    const { output, fallback } = await testGradingContract({
      scanRef: 'test-4',
      mimeType: 'image/jpeg',
      imageBase64: 'abc',
      questions: INPUT_QUESTIONS,
      gradeLevel: 8,
    });
    expect(fallback).toBe(true);
    expect(output.grades).toHaveLength(2);
    expect(output.grades.every(g => g.earnedPoints === 0)).toBe(true);
    expect(output.total.earned).toBe(0);
    expect(output.total.max).toBe(5);
  });
});

// ─── Contract 3: content_extraction ───────────────────────────────────────────

describe('contentExtractionContract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed extraction on success', async () => {
    makeProxy(JSON.stringify(VALID_CE_OUTPUT));
    const { output, fallback } = await contentExtractionContract({
      sourceType: 'image',
      sourceRef: 'img-001',
      gradeLevel: 8,
      topicId: 'pythagoras',
    });
    expect(fallback).toBe(false);
    expect(output.formulas).toHaveLength(1);
    expect(output.quality.label).toBe('good');
    expect(output.quality.score).toBe(85);
  });

  it('rejects if quality score out of range', async () => {
    const bad = { ...VALID_CE_OUTPUT, quality: { score: 110, label: 'good', truncated: false } };
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: JSON.stringify(bad) })
      .mockResolvedValueOnce({ text: JSON.stringify(bad) });
    const { fallback } = await contentExtractionContract({
      sourceType: 'pdf',
      sourceRef: 'doc.pdf',
    });
    expect(fallback).toBe(true);
  });

  it('rejects if quality label is not one of the valid values', async () => {
    const bad = { ...VALID_CE_OUTPUT, quality: { score: 50, label: 'average', truncated: false } };
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: JSON.stringify(bad) })
      .mockResolvedValueOnce({ text: JSON.stringify(bad) });
    const { fallback } = await contentExtractionContract({
      sourceType: 'pdf',
      sourceRef: 'doc.pdf',
    });
    expect(fallback).toBe(true);
  });

  it('fallback has empty arrays and poor quality', async () => {
    mockCallGeminiProxy
      .mockResolvedValueOnce({ text: 'garbage' })
      .mockResolvedValueOnce({ text: 'still garbage' });
    const { output, fallback } = await contentExtractionContract({
      sourceType: 'image',
      sourceRef: 'bad.jpg',
    });
    expect(fallback).toBe(true);
    expect(output.formulas).toHaveLength(0);
    expect(output.quality.label).toBe('poor');
    expect(output.normalizedText).toBe('');
  });

  it('accepts extraction without media parts (text-only source)', async () => {
    makeProxy(JSON.stringify(VALID_CE_OUTPUT));
    const { output, fallback } = await contentExtractionContract({
      sourceType: 'web',
      sourceRef: 'https://example.com/math',
      extractedRawText: 'Питагорова теорема: a² + b² = c²',
      gradeLevel: 8,
    });
    expect(fallback).toBe(false);
    expect(output.theories.length).toBeGreaterThan(0);
  });
});

// ─── smartOCRContract ──────────────────────────────────────────────────────────

const { smartOCRContract } = await import('./visionContracts');

const VALID_SMART_OCR_OUTPUT: SmartOCROutput = {
  latexCode: '$x^2 + y^2 = r^2$',
  normalizedText: 'x squared plus y squared equals r squared',
  formulas: ['x^2 + y^2 = r^2'],
  quality: { score: 92, label: 'excellent' },
  curriculumHints: {
    suggestedGrade: 9,
    suggestedTopicMk: 'Геометрија',
    suggestedConceptsMk: ['Кружница', 'Равенка на кружница'],
    dokLevel: 2,
  },
};

describe('smartOCRContract', () => {
  beforeEach(() => { mockCallGeminiProxy.mockReset(); });

  it('returns parsed OCR output for valid image', async () => {
    makeProxy(JSON.stringify(VALID_SMART_OCR_OUTPUT));
    const { output, fallback } = await smartOCRContract({
      imageBase64: 'base64data==',
      mimeType: 'image/png',
      mode: 'image',
    });
    expect(fallback).toBe(false);
    expect(output.latexCode).toBe('$x^2 + y^2 = r^2$');
    expect(output.quality.label).toBe('excellent');
    expect(output.curriculumHints.dokLevel).toBe(2);
    expect(output.formulas).toHaveLength(1);
  });

  it('returns fallback when AI returns malformed JSON', async () => {
    makeProxy('not valid json at all');
    const { output, fallback } = await smartOCRContract({
      imageBase64: 'base64data==',
      mimeType: 'image/jpeg',
      mode: 'handwriting',
    });
    expect(fallback).toBe(true);
    expect(output.latexCode).toBe('');
    expect(output.quality.score).toBe(0);
    expect(output.quality.label).toBe('poor');
  });

  it('includes dokLevel in curriculumHints when provided', async () => {
    const withDok = { ...VALID_SMART_OCR_OUTPUT, curriculumHints: { ...VALID_SMART_OCR_OUTPUT.curriculumHints, dokLevel: 4 as const } };
    makeProxy(JSON.stringify(withDok));
    const { output } = await smartOCRContract({ imageBase64: 'x', mimeType: 'image/png', mode: 'image' });
    expect(output.curriculumHints.dokLevel).toBe(4);
  });

  it('accepts empty curriculumHints ({}) without fallback', async () => {
    const minimal: SmartOCROutput = {
      latexCode: '$1+1=2$',
      normalizedText: '1+1=2',
      formulas: ['1+1=2'],
      quality: { score: 75, label: 'good' },
      curriculumHints: {},
    };
    makeProxy(JSON.stringify(minimal));
    const { output, fallback } = await smartOCRContract({ imageBase64: 'x', mimeType: 'image/png', mode: 'image' });
    expect(fallback).toBe(false);
    expect(output.curriculumHints).toEqual({});
  });
});

// ─── webTaskExtractionContract ─────────────────────────────────────────────────

const { webTaskExtractionContract } = await import('./visionContracts');

const VALID_WTE_OUTPUT: WebTaskExtractionOutput = {
  tasks: [
    {
      title: 'Реши квадратна равенка',
      statement: 'Реши ја равенката: x² - 5x + 6 = 0',
      latexStatement: 'Реши ја равенката: $x^2 - 5x + 6 = 0$',
      difficulty: 'intermediate',
      topicMk: 'Алгебра',
      imagenPrompt: 'A parabola intersecting the x-axis at two points on a coordinate plane',
      dokLevel: 2,
    },
  ],
  topicsSummary: 'Квадратни равенки',
  quality: { score: 80, label: 'good' },
};

describe('webTaskExtractionContract', () => {
  beforeEach(() => { mockCallGeminiProxy.mockReset(); });

  it('returns extracted tasks for valid input', async () => {
    makeProxy(JSON.stringify(VALID_WTE_OUTPUT));
    const { output, fallback } = await webTaskExtractionContract({
      text: 'Денес ќе решиме x²-5x+6=0',
      sourceType: 'youtube',
      sourceRef: 'https://youtube.com/watch?v=abc',
    });
    expect(fallback).toBe(false);
    expect(output.tasks).toHaveLength(1);
    expect(output.tasks[0].dokLevel).toBe(2);
    expect(output.tasks[0].difficulty).toBe('intermediate');
  });

  it('returns fallback for invalid JSON response', async () => {
    makeProxy('{ broken json');
    const { output, fallback } = await webTaskExtractionContract({
      text: 'some math content',
      sourceType: 'webpage',
    });
    expect(fallback).toBe(true);
    expect(output.tasks).toHaveLength(0);
    expect(output.quality.label).toBe('poor');
  });

  it('returns fallback when tasks field is missing', async () => {
    makeProxy(JSON.stringify({ topicsSummary: 'test', quality: { score: 50, label: 'fair' } }));
    const { output, fallback } = await webTaskExtractionContract({
      text: 'no tasks here',
      sourceType: 'webpage',
    });
    expect(fallback).toBe(true);
    expect(output.tasks).toEqual([]);
  });

  it('handles empty tasks array (no math found)', async () => {
    const noMath: WebTaskExtractionOutput = { tasks: [], topicsSummary: 'Нема математички задачи', quality: { score: 10, label: 'poor' } };
    makeProxy(JSON.stringify(noMath));
    const { output, fallback } = await webTaskExtractionContract({ text: 'hello world', sourceType: 'webpage' });
    expect(fallback).toBe(false);
    expect(output.tasks).toHaveLength(0);
  });
});
