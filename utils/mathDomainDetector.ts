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

/**
 * Tool sets surfaced in ContextualMathTools per domain.
 *
 * All routes point at real, directly-navigable destinations inside
 * DataVizStudioView's tabs (`/data-viz?tab=<id>`, read by that view's own
 * URLSearchParams parsing) rather than `/geometry-2d`, `/geometry-3d`, or
 * `/math-tools`, none of which are registered routes in App.tsx — those were
 * dead links everywhere except LessonPlanSidebar's one-off `/math-tools?tab=`
 * interception, which reroutes into the in-editor MathToolsPanel instead of
 * navigating. Kept plain `/data-viz?tab=X` here so every consumer (this
 * mapping is also read directly by StudentTutorView) can `navigate()` to it.
 */
export const DOMAIN_TOOLS: Record<MathDomain, { label: string; route: string; icon: string }[]> = {
  algebra: [
    { label: 'Алгебарски плочки', route: '/data-viz?tab=algebra', icon: '🔲' },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
  ],
  geometry: [
    { label: 'Геометрија 2D лаб', route: '/data-viz?tab=geo2d', icon: '△' },
    { label: 'Геометрија 3D лаб', route: '/data-viz?tab=solid', icon: '🔷' },
    { label: 'Конични пресеци', route: '/data-viz?tab=conic', icon: '⊙' },
  ],
  statistics: [
    { label: 'Лаб за веројатност', route: '/data-viz?tab=prob', icon: '🎲' },
    { label: 'Статистика лаб', route: '/data-viz?tab=stats', icon: '📊' },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
  ],
  calculus: [
    { label: 'Калкулус лаб', route: '/data-viz?tab=calc', icon: '∫' },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
    { label: 'Конични пресеци', route: '/data-viz?tab=conic', icon: '⊙' },
  ],
  arithmetic: [
    { label: 'Алгебарски плочки', route: '/data-viz?tab=algebra', icon: '🔲' },
    { label: 'График на функција', route: '/data-viz?tab=fn', icon: '📈' },
  ],
  other: [
    { label: 'DataViz Studio', route: '/data-viz', icon: '📊' },
  ],
};
