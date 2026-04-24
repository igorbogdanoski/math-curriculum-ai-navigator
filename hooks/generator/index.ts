export { useGeneratorContext } from './useGeneratorContext';
export type { BuildContextResult, GeneratedMaterial } from './useGeneratorContext';
export { useGeneratorTeacherNote } from './useGeneratorTeacherNote';
export { useGeneratorSave } from './useGeneratorSave';
export { useBulkGenerate } from './useBulkGenerate';
export type { BulkStep, BulkResults } from './useBulkGenerate';
export { useMainGenerate } from './useMainGenerate';
export {
  MACEDONIAN_CONTEXT_HINT,
  AI_TONE_MAP,
  AI_VOCAB_MAP,
  AI_STYLE_MAP,
  buildAiPersonalizationSnippet,
  makeBuildEffectiveInstruction,
  makePersistExtractionArtifact,
} from './generatorHelpers';
export type { PersistExtractionArtifactParams } from './generatorHelpers';
