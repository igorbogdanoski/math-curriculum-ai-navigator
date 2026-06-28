/**
 * S97.1 — mathDomainDetector
 *
 * Detects the primary math domain of a topic title (in Macedonian or English)
 * using keyword matching. Used by ContextualMathTools to surface relevant tools
 * in the lesson plan editor sidebar.
 */

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

/** Tool sets surfaced in ContextualMathTools per domain */
export const DOMAIN_TOOLS: Record<MathDomain, { label: string; route: string; icon: string }[]> = {
  algebra: [
    { label: 'Algebra Tiles', route: '/math-tools?tab=algebra-tiles', icon: '🔲' },
    { label: 'Алгебарски идентитети', route: '/math-tools?tab=algebra-identity', icon: '≡' },
    { label: 'График на функција', route: '/math-tools?tab=function-grapher', icon: '📈' },
    { label: 'Десмос', route: '/math-tools?tab=desmos', icon: '∿' },
  ],
  geometry: [
    { label: 'Геометрија 2D лаб', route: '/geometry-2d', icon: '△' },
    { label: 'Геометрија 3D лаб', route: '/geometry-3d', icon: '🔷' },
    { label: 'GeoGebra', route: '/math-tools?tab=geogebra', icon: '📐' },
    { label: 'Десмос', route: '/math-tools?tab=desmos', icon: '∿' },
  ],
  statistics: [
    { label: 'DataViz Studio', route: '/data-viz', icon: '📊' },
    { label: 'Лаб за веројатност', route: '/math-tools?tab=probability', icon: '🎲' },
    { label: 'График на функција', route: '/math-tools?tab=function-grapher', icon: '📈' },
  ],
  calculus: [
    { label: 'График на функција', route: '/math-tools?tab=function-grapher', icon: '📈' },
    { label: 'Десмос', route: '/math-tools?tab=desmos', icon: '∿' },
    { label: 'Конични пресеци', route: '/math-tools?tab=conic', icon: '⊙' },
  ],
  arithmetic: [
    { label: 'Алгебра плочки', route: '/math-tools?tab=algebra-tiles', icon: '🔲' },
    { label: 'График на функција', route: '/math-tools?tab=function-grapher', icon: '📈' },
  ],
  other: [
    { label: 'Математички алатки', route: '/math-tools', icon: '🧮' },
    { label: 'DataViz Studio', route: '/data-viz', icon: '📊' },
  ],
};
