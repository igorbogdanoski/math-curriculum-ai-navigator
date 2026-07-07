import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkGenerate } from './useBulkGenerate';
import { geminiService, isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { AI_COSTS } from '../../services/gemini/core.constants';

vi.mock('../../services/geminiService', () => ({
  geminiService: {
    generateLessonPlanIdeas: vi.fn(),
    generateAssessment: vi.fn(),
    generateRubric: vi.fn(),
  },
  isDailyQuotaKnownExhausted: vi.fn(() => false),
}));

function baseParams(overrides: Partial<Parameters<typeof useBulkGenerate>[0]> = {}) {
  return {
    state: { activityFocus: '', scenarioTone: '', learningDesignModel: '', questionTypes: [], activityType: 'worksheet' } as never,
    user: null,
    isOnline: true,
    buildContext: () => ({
      context: { topic: { id: 't1', title: 'Дропки' }, concepts: [], grade: { level: 6 } } as never,
      imageParam: undefined,
      studentProfilesToPass: undefined,
      tempActivityTitle: 'Активност',
    }),
    buildEffectiveInstruction: () => '',
    addNotification: vi.fn(),
    setGeneratedMaterial: vi.fn(),
    setQuotaBannerFromStorage: vi.fn(),
    ...overrides,
  };
}

describe('useBulkGenerate — server cost matches the single disclosed AI_COSTS.BULK charge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDailyQuotaKnownExhausted).mockReturnValue(false);
    vi.mocked(geminiService.generateLessonPlanIdeas).mockResolvedValue({} as never);
    vi.mocked(geminiService.generateAssessment).mockResolvedValue({} as never);
    vi.mocked(geminiService.generateRubric).mockResolvedValue({} as never);
  });

  it('sums the 4 steps\' costKeys to exactly AI_COSTS.BULK, not a multiple of it', async () => {
    const { result } = renderHook(() => useBulkGenerate(baseParams()));

    await act(async () => {
      await result.current.handleBulkGenerate();
    });

    const ideasCostKey = vi.mocked(geminiService.generateLessonPlanIdeas).mock.calls[0].at(-1);
    const quizCostKey = vi.mocked(geminiService.generateAssessment).mock.calls[0].at(-1);
    const assessmentCostKey = vi.mocked(geminiService.generateAssessment).mock.calls[1].at(-1);
    const rubricCostKey = vi.mocked(geminiService.generateRubric).mock.calls[0].at(-1);

    const total = [ideasCostKey, quizCostKey, assessmentCostKey, rubricCostKey]
      .reduce((sum: number, key) => sum + (AI_COSTS[key as keyof typeof AI_COSTS] ?? 0), 0);

    expect(total).toBe(AI_COSTS.BULK);
  });
});
