/**
 * Wave 9.2 (audit_2026_07_18_full_app_review, 2026-07-19 post-closure review) — ties each
 * DataVizStudioView lab to the concrete curriculum it serves. Before this, no lab component
 * referenced conceptId/standardCode/MATH_STANDARDS anywhere — they were generic standalone
 * tools with zero structural link to БРО standards or grade-specific goals.
 *
 * Primary (grade ≤ 9) uses real `MATH_STANDARDS` codes (`data/allNationalStandardsComplete.ts`,
 * III-А.1-27) since that registry exists for primary only. Secondary has no formal standards
 * registry (confirmed in architecture notes) — `secondaryTopics` is free-text naming the
 * gymnasium/vocational curriculum unit instead of a code.
 */

import type { StudioTab } from '../views/DataVizStudioView';
import { detectMathDomain, getToolsForDomain, type GradeContext } from '../utils/mathDomainDetector';

export type LabId = Extract<
  StudioTab,
  'prob' | 'stats' | 'calc' | 'solid' | 'geo2d' | 'conic' | 'algebra' | 'trig' | 'numtheory' | 'placevalue' | 'fractions' | 'tikz'
>;

export interface LabCurriculumEntry {
  /** MATH_STANDARDS codes from data/allNationalStandardsComplete.ts, e.g. 'III-А.14'. */
  primaryStandards?: string[];
  /** Free-text gymnasium/vocational unit names — no formal secondary standards registry exists. */
  secondaryTopics?: string[];
}

export const LAB_STANDARDS: Record<LabId, LabCurriculumEntry> = {
  fractions: {
    primaryStandards: ['III-А.1', 'III-А.3', 'III-А.4', 'III-А.5'],
  },
  numtheory: {
    primaryStandards: ['III-А.1'],
  },
  placevalue: {
    primaryStandards: ['III-А.1', 'III-А.2'],
  },
  algebra: {
    primaryStandards: ['III-А.7', 'III-А.8', 'III-А.10', 'III-А.11'],
    secondaryTopics: ['Алгебарски изрази и равенки'],
  },
  geo2d: {
    primaryStandards: ['III-А.12', 'III-А.14', 'III-А.15', 'III-А.19'],
  },
  solid: {
    primaryStandards: ['III-А.13', 'III-А.20'],
  },
  prob: {
    primaryStandards: ['III-А.24'],
  },
  stats: {
    secondaryTopics: ['Веројатност и статистика (напредно)'],
  },
  trig: {
    secondaryTopics: ['Тригонометриски функции'],
  },
  calc: {
    secondaryTopics: ['Изводи и интеграли (математичка анализа)'],
  },
  conic: {
    secondaryTopics: ['Конусни пресеци'],
  },
  tikz: {
    primaryStandards: ['III-А.12', 'III-А.14', 'III-А.19'],
    secondaryTopics: ['Геометриски докази и конструкции'],
  },
};

export function getLabCurriculumEntry(labId: string): LabCurriculumEntry | undefined {
  return LAB_STANDARDS[labId as LabId];
}

/**
 * Reverse lookup used by ConceptDetailView's "Поврзани лаборатории" block. Deliberately reuses
 * the same domain-detection machinery as ContextualMathTools (rather than a hand-maintained
 * conceptId→lab list, which would need upkeep across hundreds of concepts) — a concept's title
 * is run through the same `detectMathDomain`/`getToolsForDomain` pipeline the planning chain
 * uses, so the two surfaces (plan a lesson → get a lab; browse a concept → get a lab) always
 * agree with each other by construction.
 */
export function getRelatedLabsForConcept(conceptTitle: string, gradeContext?: GradeContext) {
  const domain = detectMathDomain(conceptTitle);
  return getToolsForDomain(domain, gradeContext);
}
