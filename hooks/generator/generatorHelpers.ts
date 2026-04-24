import type { User } from 'firebase/auth';
import type { TeachingProfile } from '../../types';
import { persistScanArtifactWithObservability } from '../../services/scanArtifactPersistence';
import { sanitizePromptInput } from '../../services/gemini/core';
import type { GeneratorState } from '../useGeneratorState';

export const MACEDONIAN_CONTEXT_HINT =
  'Користи македонски примери: цени во денари (МКД), градови (Скопје, Битола, Охрид), реки (Вардар, Брегалница), ситуации од македонскиот секојдневен живот.';

export const AI_TONE_MAP: Record<string, string> = {
  creative: 'Тонот нека биде креативен и ангажирачки — живописни приказни, интересни ликови, изненадувачки контексти.',
  formal: 'Тонот нека биде формален и академски — прецизни дефиниции, строга терминологија, без разговорни изрази.',
  friendly: 'Тонот нека биде пријателски и поддржувачки — охрабрувачки зборови, топол јазик, директно обраќање до ученикот.',
  expert: 'Тонот нека биде стручен и предизвикувачки — апстрактни поими, повеќестепено размислување, засилена когнитивна побарувачка.',
  playful: 'Тонот нека биде игровен и хумористичен — смешни ситуации, ликови со имиња, приказни со изненадувања.',
};

export const AI_VOCAB_MAP: Record<string, string> = {
  simplified: 'НИВО НА РЕЧНИК: Поедноставен — употребувај само основни зборови и кратки реченици. Избегнувај технички жаргон.',
  standard: '',
  advanced: 'НИВО НА РЕЧНИК: Напреден — употребувај стручна терминологија, сложени реченици и прецизни математички поими.',
};

export const AI_STYLE_MAP: Record<string, string> = {
  standard: '',
  socratic: 'ОБРАЗОВЕН СТИЛ — Сократски: водечки прашања наместо директни одговори. Учениците сами да ги откријат законитостите.',
  direct: 'ОБРАЗОВЕН СТИЛ — Директно-инструктивен: јасни чекор-по-чекор инструкции, примери пред задачи, без двосмисленост.',
  inquiry: 'ОБРАЗОВЕН СТИЛ — Истражувачки: почни со проблем или загатка, наведи го ученикот да истражува и формулира хипотеза.',
  problem: 'ОБРАЗОВЕН СТИЛ — Проблемски: реален животен контекст пред теоријата, ученикот го решава проблемот со математиката.',
};

export function buildAiPersonalizationSnippet(state: { aiTone: string; aiVocabLevel: string; aiStyle: string }): string {
  return [
    state.aiTone !== 'creative' ? AI_TONE_MAP[state.aiTone] : '',
    AI_VOCAB_MAP[state.aiVocabLevel] ?? '',
    AI_STYLE_MAP[state.aiStyle] ?? '',
  ].filter(Boolean).join(' ');
}

export function makeBuildEffectiveInstruction(params: {
  state: GeneratorState;
  teacherNote: string;
}): () => string {
  return () => {
    const teacherNoteInstruction = params.teacherNote.trim()
      ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${params.teacherNote.trim()}`
      : '';
    return [
      params.state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '',
      buildAiPersonalizationSnippet(params.state),
      teacherNoteInstruction,
      sanitizePromptInput(params.state.customInstruction),
    ].filter(Boolean).join(' ');
  };
}

export type PersistExtractionArtifactParams = {
  sourceType: 'image' | 'web' | 'video';
  sourceUrl?: string;
  sourceUrls?: string[];
  extractedText: string;
  extractionBundle: { formulas: string[]; theories: string[]; tasks: string[]; rawSnippet: string };
  quality: { score: number; label: 'poor' | 'fair' | 'good' | 'excellent'; truncated?: boolean };
  gradeLevel?: number;
  topicId?: string;
  conceptIds?: string[];
};

export function makePersistExtractionArtifact(params: {
  firebaseUser: User | null;
  user: TeachingProfile | null;
}): (p: PersistExtractionArtifactParams) => Promise<void> {
  return async (p: PersistExtractionArtifactParams) => {
    if (!params.firebaseUser?.uid || !p.extractedText.trim()) return;

    await persistScanArtifactWithObservability({
      teacherUid: params.firebaseUser.uid,
      schoolId: params.user?.schoolId,
      mode: 'content_extraction',
      sourceType: p.sourceType,
      sourceUrl: p.sourceUrl,
      sourceUrls: p.sourceUrls,
      gradeLevel: p.gradeLevel,
      topicId: p.topicId,
      conceptIds: p.conceptIds,
      extractedText: p.extractedText,
      normalizedText: p.extractedText.trim(),
      extractionBundle: p.extractionBundle,
      artifactQuality: {
        score: p.quality.score,
        label: p.quality.label,
        truncated: p.quality.truncated,
      },
    }, {
      flow: 'generator_extraction',
      stage: p.sourceType,
    });
  };
}
