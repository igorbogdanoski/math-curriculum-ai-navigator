import type { PresentationSlide } from '../types';

export function normalizeFormula(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function looksLikeFormula(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\\[a-zA-Z]+/.test(text)) return true;
  if (/[=^]/.test(text)) return true;
  if (/\d\s*[+\-*/]\s*\d/.test(text)) return true;
  if (/[()]/.test(text) && /[+\-*/]/.test(text)) return true;
  return false;
}

export function inferSlideFormulas(target: PresentationSlide): string[] {
  const explicit = (target.formulas ?? []).map(normalizeFormula).filter(Boolean);
  if (explicit.length > 0) return Array.from(new Set(explicit)).slice(0, 6);

  const formulaLike = [...(target.content ?? []), ...(target.solution ?? [])]
    .map(normalizeFormula)
    .filter(looksLikeFormula);

  if (target.type === 'formula-centered' && target.content[0]) {
    formulaLike.unshift(normalizeFormula(target.content[0]));
  }

  return Array.from(new Set(formulaLike)).slice(0, 6);
}

export function inferPriorFormulas(slides: PresentationSlide[], idx: number): string[] {
  const history = new Set<string>();
  for (let i = 0; i < idx; i += 1) {
    for (const formula of inferSlideFormulas(slides[i])) {
      history.add(formula);
    }
  }
  return Array.from(history).slice(0, 8);
}

export function deriveContextualFormulas(slides: PresentationSlide[], slide: PresentationSlide, idx: number): string[] {
  const explicitPrior = (slide.priorFormulas ?? []).map(normalizeFormula).filter(Boolean);
  if (explicitPrior.length > 0) return explicitPrior.slice(0, 8);
  return inferPriorFormulas(slides, idx);
}

export function resolveSlideConcept(slide: PresentationSlide, topic: string): string {
  const explicit = (slide.concept ?? '').trim();
  if (explicit) return explicit;
  if (slide.type === 'step-by-step' || slide.type === 'example') {
    return topic;
  }
  return '';
}
