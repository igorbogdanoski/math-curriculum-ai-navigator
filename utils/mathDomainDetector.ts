/**
 * S97.1 — mathDomainDetector
 *
 * Detects the primary math domain of a topic title (in Macedonian or English)
 * using keyword matching. Used by ContextualMathTools to surface relevant tools
 * in the lesson plan editor sidebar.
 */

import type { SecondaryTrack } from '../types/curriculum';

export type MathDomain =
  | 'algebra'
  | 'geometry'
  | 'statistics'
  | 'calculus'
  | 'arithmetic'
  | 'other';

const DOMAIN_KEYWORDS: Record<MathDomain, string[]> = {
  algebra: [
    'равенк', 'израз', 'полином', 'алгебр', 'систем', 'неравенк',
    'факторир', 'корен', 'степен', 'логаритам', 'експонент',
    'квадрат', 'линеарн', 'equation', 'algebra', 'polynomial',
  ],
  geometry: [
    'триаголник', 'правоаголник', 'круж', 'плоштин', 'агол', 'геометр',
    'вектор', 'оска', 'симетр', 'трансформ', 'паралелограм', 'трапез',
    'пирамида', 'конус', 'цилиндар', 'сфера', 'призма', 'обем',
    '3d', 'дводимензионал', 'тродимензионал', 'координат',
    'triangle', 'circle', 'geometry', 'angle', 'vector',
    // 2026-07-19 (Wave 8.3, audit_2026_07_18_full_app_review): trigonometry has its own
    // dedicated lab (/data-viz?tab=trig) but no keywords routed a trig topic here at all.
    'тригонометр', 'синус', 'косинус', 'тангенс', 'котангенс', 'радијан',
  ],
  statistics: [
    'веројатност', 'статист', 'дијаграм', 'средна вредност', 'медијан',
    'мода', 'фреквенц', 'хистограм', 'комбинатор', 'пермутац',
    'случаен', 'распределб', 'probability', 'statistics', 'data',
  ],
  calculus: [
    'извод', 'интеграл', 'лимит', 'диференц', 'derivative',
    'integral', 'limit', 'calculus', 'continuit', 'непрекинат',
    'монотоност', 'екстрем', 'асимптота',
  ],
  arithmetic: [
    'дропк', 'процент', 'цели броев', 'природни броев', 'рационал',
    'ирационал', 'делив', 'множење', 'делење', 'собирање', 'одземање',
    'дропки', 'fraction', 'decimal', 'integer', 'ratio', 'proportion',
    'сразмер',
    // 2026-07-19 (Wave 8.3, audit_2026_07_18_full_app_review): number theory and place
    // value each have a dedicated lab (/data-viz?tab=numtheory, ?tab=placevalue) but no
    // keywords routed those topics here.
    'прост број', 'прости броеви', 'нзд', 'нзс', 'делители', 'разложув',
    'месна вредност', 'позицион',
  ],
  other: [],
};

/**
 * Returns the most likely math domain for a given topic title.
 * When multiple domains match, returns the one with the most keyword hits.
 */
export function detectMathDomain(topicTitle: string): MathDomain {
  if (!topicTitle) return 'other';
  const lower = topicTitle.toLowerCase();

  let bestDomain: MathDomain = 'other';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [MathDomain, string[]][]) {
    if (domain === 'other') continue;
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

export interface DomainTool {
  label: string;
  route: string;
  icon: string;
  /** Inclusive grade bounds. Omitted on either side means "no bound" — the tool spans that
   * whole side of the primary/secondary divide (e.g. the function grapher or GeoGebra). Set
   * only on tools that are genuinely grade-locked (trig, calculus, conic sections are
   * secondary-only in the MK curriculum; fractions/number-theory/place-value are primary-only). */
  minGrade?: number;
  maxGrade?: number;
}

/**
 * Tool sets surfaced in ContextualMathTools per domain.
 *
 * Routes point at real, directly-navigable destinations: DataVizStudioView's
 * tabs (`/data-viz?tab=<id>`) for the dedicated labs, and MathToolsView's tabs
 * (`/math-tools?tab=<id>`) for Desmos/GeoGebra, both registered in App.tsx and
 * both reading their tab from the same `?tab=` URLSearchParams convention.
 * Neither `/geometry-2d`/`/geometry-3d` nor bare `/math-tools` (without a tab
 * param falling through LessonPlanSidebar's one-off interception) were ever
 * registered routes — fixed 2026-07-06. This mapping is read directly by
 * StudentTutorView too, so every entry here must be a real `navigate()` target.
 */
export const DOMAIN_TOOLS: Record<MathDomain, DomainTool[]> = {
  algebra: [
    { label: 'Алгебарски плочки', route: '/data-viz?tab=algebra', icon: '🔲' },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
    { label: 'Десмос', route: '/math-tools?tab=desmos', icon: '∿' },
  ],
  geometry: [
    { label: 'Геометрија 2D лаб', route: '/data-viz?tab=geo2d', icon: '△' },
    { label: 'Геометрија 3D лаб', route: '/data-viz?tab=solid', icon: '🔷', minGrade: 6 },
    { label: 'Конични пресеци', route: '/data-viz?tab=conic', icon: '⊙', minGrade: 10 },
    { label: 'Тригонометрија лаб', route: '/data-viz?tab=trig', icon: '📐', minGrade: 9 },
    { label: 'TikZ дијаграми', route: '/data-viz?tab=tikz', icon: '✏️' },
    { label: 'GeoGebra', route: '/math-tools?tab=geogebra', icon: '📐' },
  ],
  statistics: [
    { label: 'Лаб за веројатност', route: '/data-viz?tab=prob', icon: '🎲' },
    { label: 'Статистика лаб', route: '/data-viz?tab=stats', icon: '📊', minGrade: 10 },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
  ],
  calculus: [
    { label: 'Калкулус лаб', route: '/data-viz?tab=calc', icon: '∫', minGrade: 10 },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
    { label: 'Конични пресеци', route: '/data-viz?tab=conic', icon: '⊙', minGrade: 10 },
    { label: 'Десмос', route: '/math-tools?tab=desmos', icon: '∿' },
  ],
  arithmetic: [
    { label: 'Дропки лаб', route: '/data-viz?tab=fractions', icon: '🍕', maxGrade: 9 },
    { label: 'Теорија на броеви лаб', route: '/data-viz?tab=numtheory', icon: '🔢', maxGrade: 9 },
    { label: 'Месна вредност лаб', route: '/data-viz?tab=placevalue', icon: '🧮', maxGrade: 9 },
    { label: 'Алгебарски плочки', route: '/data-viz?tab=algebra', icon: '🔲' },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
  ],
  other: [
    { label: 'DataViz Studio', route: '/data-viz', icon: '📊' },
  ],
};

export interface GradeContext {
  grade: number;
  secondaryTrack?: SecondaryTrack;
}

/**
 * Grade-aware tool lookup for a domain. Filters out tools whose min/maxGrade bound excludes
 * the caller's grade — but if filtering would leave nothing (e.g. an "arithmetic" topic
 * detected on a grade-11 plan, where all 3 primary-only labs get filtered out), falls back to
 * the unfiltered list rather than surfacing nothing; an imperfect suggestion beats none.
 * `secondaryTrack` isn't used to filter yet (no track-specific tool exists today) — it's part
 * of the signature so callers don't need to change again when one is added.
 */
export function getToolsForDomain(domain: MathDomain, gradeContext?: GradeContext): DomainTool[] {
  const tools = DOMAIN_TOOLS[domain];
  if (!gradeContext) return tools;
  const filtered = tools.filter(tool => {
    if (tool.minGrade != null && gradeContext.grade < tool.minGrade) return false;
    if (tool.maxGrade != null && gradeContext.grade > tool.maxGrade) return false;
    return true;
  });
  return filtered.length > 0 ? filtered : tools;
}
