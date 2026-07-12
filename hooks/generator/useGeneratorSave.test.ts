import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeneratorSave, MATERIAL_TYPE_TO_LIB_TYPE } from './useGeneratorSave';
import { MATERIAL_META } from '../../components/generator/MaterialTypeStep';
import * as scenarioBankService from '../../services/firestoreService.scenarioBank';
import type { Concept } from '../../types';

vi.mock('../../contexts/AcademyProgressContext', () => ({
  useAcademyProgress: () => ({ trackMaterialSaved: vi.fn(() => []) }),
}));

vi.mock('../../services/firestoreService.scenarioBank', () => ({
  publishMaterialFromGenerator: vi.fn(async () => 'new-id'),
}));

vi.mock('../../services/firestoreService', () => ({
  firestoreService: { saveQuestion: vi.fn(), saveMaterialFeedback: vi.fn() },
}));

vi.mock('../../services/geminiService', () => ({
  geminiService: { generateSmartQuizTitle: vi.fn(async () => 'AI Title') },
}));

vi.mock('../../services/telemetryService', () => ({
  trackFirstTimeEvent: vi.fn(),
  trackEvent: vi.fn(),
}));

/**
 * Regression guard for the exact bug class this hook already had once (STORY_BOOK/
 * TECHNICAL_INFOGRAPHIC silently mislabeled 'assessment' in the library because they
 * were missing from the type map) and twice more, found while writing this test
 * (FLASHCARDS/EXIT_TICKET — both duck-typed into the same "Save to Library" button as
 * QUIZ/ASSESSMENT via their shared `questions` shape, but also missing from the map).
 *
 * PRESENTATION and ILLUSTRATION are legitimately excluded: their result shapes never
 * match GeneratorResultPanel's duck-type checks ('openingActivity' in material /
 * 'questions' in material), so the "Save to Library" button never renders for them —
 * confirmed by reading components/generator/GeneratorResultPanel.tsx directly.
 */
describe('MATERIAL_TYPE_TO_LIB_TYPE completeness', () => {
  const LEGITIMATELY_EXCLUDED = new Set(['PRESENTATION', 'ILLUSTRATION']);

  it('has an entry for every user-selectable material type except the known, documented exclusions', () => {
    const materialTypes = Object.keys(MATERIAL_META);
    const missing = materialTypes.filter(
      (mt) => !LEGITIMATELY_EXCLUDED.has(mt) && !(mt in MATERIAL_TYPE_TO_LIB_TYPE),
    );
    expect(missing, `missing from MATERIAL_TYPE_TO_LIB_TYPE: ${missing.join(', ')} — either add a mapping or add to LEGITIMATELY_EXCLUDED with a reason`).toEqual([]);
  });

  it('does not map any of the legitimately-excluded types (would be dead code if it did)', () => {
    for (const mt of LEGITIMATELY_EXCLUDED) {
      expect(mt in MATERIAL_TYPE_TO_LIB_TYPE).toBe(false);
    }
  });
});

describe('useGeneratorSave — handlePublishToBank conceptId/conceptTitle wiring', () => {
  const concepts: Concept[] = [{ id: 'c1', title: 'Собирање дропки' } as Concept];

  function setup(materialType: string, selectedConcepts: string[] = ['c1']) {
    const params = {
      state: { materialType, selectedConcepts, selectedGrade: '', selectedTopic: 'Дропки' } as never,
      curriculum: { grades: [] } as never,
      filteredConcepts: concepts,
      user: { name: 'Тест Наставник', schoolName: 'ООУ Тест' } as never,
      firebaseUser: { uid: 'uid-1' } as never,
      generatedMaterial: null,
      bulkResults: null,
      verifiedQs: [],
      addNotification: vi.fn(),
      addItem: vi.fn(async () => {}),
      setGeneratedMaterial: vi.fn(),
      setVariants: vi.fn(),
      setBulkResults: vi.fn(),
    };
    return params;
  }

  beforeEach(() => vi.clearAllMocks());

  it('passes the selected concept id and title through to publishMaterialFromGenerator', async () => {
    const params = setup('STORY_BOOK');
    const { result } = renderHook(() => useGeneratorSave(params));
    const material = { title: { en: 'A Fractions Story', mk: 'Приказна за дропки', sq: '', tr: '' }, ageRange: '7-9' as const, pages: [] };

    await act(async () => { await result.current.handlePublishToBank(material, 'main'); });

    expect(scenarioBankService.publishMaterialFromGenerator).toHaveBeenCalledWith(
      expect.objectContaining({ conceptId: 'c1', conceptTitle: 'Собирање дропки', materialType: 'ideas' }),
    );
  });

  it('omits conceptId/conceptTitle gracefully when no concept is selected', async () => {
    const params = setup('STORY_BOOK', []);
    const { result } = renderHook(() => useGeneratorSave(params));
    const material = { title: { en: 'A Story', mk: 'Приказна', sq: '', tr: '' }, ageRange: '7-9' as const, pages: [] };

    await act(async () => { await result.current.handlePublishToBank(material, 'main'); });

    const call = vi.mocked(scenarioBankService.publishMaterialFromGenerator).mock.calls[0][0];
    expect(call.conceptId).toBeUndefined();
    expect(call.conceptTitle).toBeUndefined();
  });

  it('TECHNICAL_INFOGRAPHIC saves with libType "ideas", not the "assessment" fallback', async () => {
    const params = setup('TECHNICAL_INFOGRAPHIC');
    const { result } = renderHook(() => useGeneratorSave(params));
    const material = { title: { en: 'Infographic', mk: 'Инфографик', sq: '', tr: '' }, imageUrl: 'x', sections: [] };

    await act(async () => { await result.current.handlePublishToBank(material, 'main'); });

    expect(scenarioBankService.publishMaterialFromGenerator).toHaveBeenCalledWith(
      expect.objectContaining({ materialType: 'ideas' }),
    );
  });
});
