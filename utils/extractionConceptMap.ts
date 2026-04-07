import type { Concept } from '../types';
import type { ExtractedContentBundle } from './extractionBundle';

const STOPWORDS = new Set([
  'и', 'во', 'на', 'со', 'за', 'од', 'до', 'се', 'да', 'по', 'како', 'што', 'или', 'а',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'through', 'using', 'use',
  'lesson', 'математика', 'задача', 'задачи', 'теорија', 'формула', 'пример',
]);

function tokenize(input: string): string[] {
  return (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length >= 3)
    .filter((token) => !STOPWORDS.has(token));
}

function buildExtractionText(bundle: ExtractedContentBundle): string {
  return [
    bundle.formulas.join(' '),
    bundle.theories.join(' '),
    bundle.tasks.join(' '),
    bundle.rawSnippet,
  ].filter(Boolean).join(' ');
}

export function inferConceptIdsFromExtraction(
  bundle: ExtractedContentBundle,
  allConcepts: Concept[],
  selectedConceptIds: string[] = [],
  maxResults = 6,
): string[] {
  const extractionTokens = new Set(tokenize(buildExtractionText(bundle)));
  if (extractionTokens.size === 0) return selectedConceptIds.slice(0, maxResults);

  const ranked = allConcepts
    .map((concept) => {
      const conceptTokens = tokenize([
        concept.title,
        concept.description,
        ...(concept.content ?? []),
      ].join(' '));

      let score = 0;
      for (const token of conceptTokens) {
        if (extractionTokens.has(token)) {
          score += token.length >= 8 ? 2 : 1;
        }
      }

      return { id: concept.id, score };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return Array.from(new Set([
    ...selectedConceptIds,
    ...ranked.map((item) => item.id),
  ])).slice(0, maxResults);
}
