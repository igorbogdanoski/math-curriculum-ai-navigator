import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainGenerate } from './useMainGenerate';
import { geminiService, isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { getInitialState } from '../useGeneratorState';
import type { MaterialType } from '../../types';

vi.mock('../../services/geminiService', () => ({
  geminiService: {
    generateIllustration: vi.fn(),
    generateStoryBook: vi.fn(),
    generateTechnicalInfographic: vi.fn(),
    generatePresentation: vi.fn(),
    generateLearningPaths: vi.fn(),
    generateAssessment: vi.fn(),
  },
  isDailyQuotaKnownExhausted: vi.fn(() => false),
}));

/**
 * Regression guard for the STORY_BOOK/TECHNICAL_INFOGRAPHIC costKeys computation added
 * this session — asserts what deductCredits is actually called with per material type,
 * since that's the real billing surface, not just what geminiService receives.
 */
function baseParams(materialType: MaterialType, stateOverrides: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  const state = { ...getInitialState(null, []), materialType, ...stateOverrides };
  return {
    state: state as never,
    dispatch: vi.fn(),
    user: null,
    firebaseUser: null,
    isOnline: true,
    allConcepts: [],
    isGeneratingBulk: false,
    isGeneratingVariants: false,
    buildContext: () => ({
      context: { topic: { id: 't1', title: 'Дропки' }, concepts: [], grade: { level: 6 } } as never,
      imageParam: undefined,
      studentProfilesToPass: undefined,
      tempActivityTitle: 'Активност',
    }),
    buildEffectiveInstruction: () => '',
    persistExtractionArtifact: vi.fn(async () => {}),
    addNotification: vi.fn(),
    setQuotaBannerFromStorage: vi.fn(),
    setVariants: vi.fn(),
    deductCredits: vi.fn(async (_costKeys?: string[]) => {}),
    openUpgradeModal: vi.fn(),
    ...overrides,
  };
}

describe('useMainGenerate — costKeys per material type (billing surface)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDailyQuotaKnownExhausted).mockReturnValue(false);
    vi.mocked(geminiService.generateIllustration).mockResolvedValue({ imageUrl: 'x', prompt: 'p' } as never);
    vi.mocked(geminiService.generateStoryBook).mockResolvedValue({ title: {}, pages: [] } as never);
    vi.mocked(geminiService.generateTechnicalInfographic).mockResolvedValue({ title: {}, imageUrl: 'x', sections: [] } as never);
  });

  it('ILLUSTRATION costs exactly one ILLUSTRATION credit', async () => {
    const params = baseParams('ILLUSTRATION', { illustrationPrompt: 'a circle' });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.deductCredits).toHaveBeenCalledWith(['ILLUSTRATION']);
  });

  it('STORY_BOOK costs one ILLUSTRATION per page plus one TEXT_BASIC, clamped to the 4-10 page range', async () => {
    const params = baseParams('STORY_BOOK', { storyBookTopic: 'собирање', storyBookPageCount: 6 });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    const costKeys = vi.mocked(params.deductCredits!).mock.calls[0][0] as string[];
    expect(costKeys.filter(k => k === 'ILLUSTRATION')).toHaveLength(6);
    expect(costKeys.filter(k => k === 'TEXT_BASIC')).toHaveLength(1);
  });

  it('STORY_BOOK clamps an out-of-range page count to the 4-10 window before billing', async () => {
    const params = baseParams('STORY_BOOK', { storyBookTopic: 'собирање', storyBookPageCount: 99 });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    const costKeys = vi.mocked(params.deductCredits!).mock.calls[0][0] as string[];
    expect(costKeys.filter(k => k === 'ILLUSTRATION')).toHaveLength(10);
  });

  it('TECHNICAL_INFOGRAPHIC costs exactly one ILLUSTRATION plus one TEXT_BASIC', async () => {
    const params = baseParams('TECHNICAL_INFOGRAPHIC', { infographicTopic: 'пирамида' });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.deductCredits).toHaveBeenCalledWith(['ILLUSTRATION', 'TEXT_BASIC']);
  });

  it('a generic material type (e.g. RUBRIC) costs exactly one TEXT_BASIC', async () => {
    const params = baseParams('RUBRIC', { activityType: 'worksheet' }, {
      buildContext: () => ({
        context: { topic: { id: 't1', title: 'Дропки' }, concepts: [], grade: { level: 6, secondaryTrack: undefined } } as never,
        imageParam: undefined, studentProfilesToPass: undefined, tempActivityTitle: 'Активност',
      }),
    });
    (geminiService as unknown as { generateRubric: ReturnType<typeof vi.fn> }).generateRubric = vi.fn(async () => ({ title: 'r' }));
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.deductCredits).toHaveBeenCalledWith(['TEXT_BASIC']);
  });

  it('STORY_BOOK: blocks generation with a notification when the topic is empty, without calling deductCredits', async () => {
    const params = baseParams('STORY_BOOK', { storyBookTopic: '   ' });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.addNotification).toHaveBeenCalledWith(expect.stringMatching(/математички поим/i), 'error');
    expect(params.deductCredits).not.toHaveBeenCalled();
    expect(geminiService.generateStoryBook).not.toHaveBeenCalled();
  });

  it('TECHNICAL_INFOGRAPHIC: blocks generation with a notification when the topic is empty', async () => {
    const params = baseParams('TECHNICAL_INFOGRAPHIC', { infographicTopic: '' });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.addNotification).toHaveBeenCalledWith(expect.stringMatching(/поим или објект/i), 'error');
    expect(geminiService.generateTechnicalInfographic).not.toHaveBeenCalled();
  });

  it('dispatches STORY_BOOK generation with the topic, age range, and page count from state', async () => {
    const params = baseParams('STORY_BOOK', { storyBookTopic: 'собирање', storyBookAgeRange: '7-9', storyBookPageCount: 4 });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(geminiService.generateStoryBook).toHaveBeenCalledWith('собирање', '7-9', 4, undefined);
  });

  it('blocks generation entirely when the user has insufficient credits, without calling any geminiService method', async () => {
    const params = baseParams('STORY_BOOK', { storyBookTopic: 'собирање', storyBookPageCount: 4 }, {
      user: { role: 'teacher', aiCreditsBalance: 1, tier: 'Free' } as never,
    });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.openUpgradeModal).toHaveBeenCalled();
    expect(geminiService.generateStoryBook).not.toHaveBeenCalled();
    expect(params.deductCredits).not.toHaveBeenCalled();
  });

  it('does not gate on credits for an admin user even with a zero balance', async () => {
    const params = baseParams('STORY_BOOK', { storyBookTopic: 'собирање', storyBookPageCount: 4 }, {
      user: { role: 'admin', aiCreditsBalance: 0 } as never,
    });
    const { result } = renderHook(() => useMainGenerate(params));
    await act(async () => { await result.current.handleGenerate(); });
    expect(params.openUpgradeModal).not.toHaveBeenCalled();
    expect(geminiService.generateStoryBook).toHaveBeenCalled();
  });
});

// 2026-07-18 (audit_2026_07_18_full_app_review): "Cancel" previously only ever checked
// cancelRef inside the SCENARIO branch's own streaming loop — every other material type is a
// single non-streaming await with no mid-flight checkpoint, so clicking Cancel while e.g. an
// ILLUSTRATION request was in flight did nothing: the server had already generated (and, per
// the Wave 3 credit-race fix, already atomically billed) the result by the time the promise
// resolved, and the old code unconditionally displayed it with no acknowledgement of the
// cancel click at all.
describe('useMainGenerate — Cancel on non-SCENARIO material types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDailyQuotaKnownExhausted).mockReturnValue(false);
  });

  it('still shows a result that finished generating after Cancel was clicked, with a notice — not silently discarded', async () => {
    let resolveIllustration!: (v: { imageUrl: string; prompt: string }) => void;
    vi.mocked(geminiService.generateIllustration).mockReturnValue(
      new Promise(resolve => { resolveIllustration = resolve; }) as never,
    );
    const params = baseParams('ILLUSTRATION', { illustrationPrompt: 'a circle' });
    const { result } = renderHook(() => useMainGenerate(params));

    let generatePromise!: Promise<void>;
    act(() => { generatePromise = result.current.handleGenerate(); });
    // Cancel while the request is still in flight (server-side generation/billing already
    // started and can't be un-billed from the client — see Wave 3's reserveCredits()).
    act(() => { result.current.handleCancel(); });
    act(() => { resolveIllustration({ imageUrl: 'x', prompt: 'a circle' }); });
    await act(async () => { await generatePromise; });

    expect(result.current.generatedMaterial).toEqual({ imageUrl: 'x', prompt: 'a circle' });
    expect(params.addNotification).toHaveBeenCalledWith(
      expect.stringMatching(/откажување/i), 'info',
    );
  });

  it('does not show a stale notice or leftover cancelled state on the next successful generation', async () => {
    let resolveFirst!: (v: { imageUrl: string; prompt: string }) => void;
    vi.mocked(geminiService.generateIllustration).mockReturnValueOnce(
      new Promise(resolve => { resolveFirst = resolve; }) as never,
    );
    const params = baseParams('ILLUSTRATION', { illustrationPrompt: 'a circle' });
    const { result } = renderHook(() => useMainGenerate(params));

    let firstGenerate!: Promise<void>;
    act(() => { firstGenerate = result.current.handleGenerate(); });
    act(() => { result.current.handleCancel(); });
    act(() => { resolveFirst({ imageUrl: 'first', prompt: 'a circle' }); });
    await act(async () => { await firstGenerate; });
    params.addNotification.mockClear();

    vi.mocked(geminiService.generateIllustration).mockResolvedValueOnce({ imageUrl: 'second', prompt: 'a circle' } as never);
    await act(async () => { await result.current.handleGenerate(); });

    expect(result.current.generatedMaterial).toEqual({ imageUrl: 'second', prompt: 'a circle' });
    expect(params.addNotification).not.toHaveBeenCalledWith(expect.stringMatching(/откажување/i), 'info');
  });
});
