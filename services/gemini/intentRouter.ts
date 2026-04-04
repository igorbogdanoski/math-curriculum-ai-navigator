// E3 — Intent Router (spike)
// Routes AI task types to the cheapest model that can satisfy quality requirements.
// Feature-flagged: disabled by default, opt-in via localStorage or SettingsView toggle.
//
// Routing logic (when enabled):
//   lite      → LITE_MODEL  (short output, no structured JSON, no pedagogy depth)
//   standard  → DEFAULT_MODEL (most generation tasks)
//   advanced  → controlled by caller (PRO_MODEL / ULTIMATE_MODEL via tier routing)
//
// This is a spike: tracks decisions in sessionStorage for latency/cost measurement.

export type AITaskType =
  // Lite — trivial output, 1-3 sentences or ≤ 10 words
  | 'quiz_title'         // Smart title from quiz content (<10 words)
  | 'planner_parse'      // NL → {title,date,type,description} extraction
  | 'concept_explain'    // 3-sentence student-friendly explanation
  | 'misconception'      // 1-sentence misconception diagnosis
  | 'proactive_suggest'  // Short proactive pedagogical tip
  | 'analogy'            // 1-paragraph analogy for a concept
  // Standard — structured JSON, medium depth
  | 'quiz'
  | 'rubric'
  | 'worked_example'
  | 'feedback'
  | 'daily_brief'
  | 'adaptive_homework'
  | 'reflection'
  | 'parent_report'
  | 'learning_paths'
  // Advanced — complex structured outputs, curriculum-depth
  | 'annual_plan'
  | 'presentation'
  | 'recovery_worksheet'
  | 'differentiated_test'
  | 'pedagogical_analysis'
  // Fallback
  | 'default';

export type AITaskComplexity = 'lite' | 'standard' | 'advanced';

const TASK_COMPLEXITY_MAP: Record<AITaskType, AITaskComplexity> = {
  quiz_title:          'lite',
  planner_parse:       'lite',
  concept_explain:     'lite',
  misconception:       'lite',
  proactive_suggest:   'lite',
  analogy:             'lite',

  quiz:                'standard',
  rubric:              'standard',
  worked_example:      'standard',
  feedback:            'standard',
  daily_brief:         'standard',
  adaptive_homework:   'standard',
  reflection:          'standard',
  parent_report:       'standard',
  learning_paths:      'standard',

  annual_plan:         'advanced',
  presentation:        'advanced',
  recovery_worksheet:  'advanced',
  differentiated_test: 'advanced',
  pedagogical_analysis: 'advanced',

  default:             'standard',
};

export const INTENT_ROUTER_KEY = 'intent_router_enabled';
const INTENT_ROUTER_STATS_KEY = 'intent_router_stats';

export function isIntentRouterEnabled(): boolean {
  try { return localStorage.getItem(INTENT_ROUTER_KEY) === 'true'; } catch { return false; }
}

export function setIntentRouterEnabled(enabled: boolean): void {
  try { localStorage.setItem(INTENT_ROUTER_KEY, String(enabled)); } catch { /* ignore */ }
}

export function getTaskComplexity(task: AITaskType): AITaskComplexity {
  return TASK_COMPLEXITY_MAP[task] ?? 'standard';
}

/**
 * Returns true when the intent router should force LITE_MODEL for this task,
 * bypassing the normal tier-based model selection.
 * Only activates when the feature flag is enabled AND the task is classified lite.
 */
export function shouldUseLiteModel(task: AITaskType): boolean {
  return isIntentRouterEnabled() && getTaskComplexity(task) === 'lite';
}

/** Records a routing decision to sessionStorage for measurement. */
export function logRouterDecision(task: AITaskType, resolvedModel: string): void {
  try {
    const raw = sessionStorage.getItem(INTENT_ROUTER_STATS_KEY);
    const stats: Record<string, { count: number; model: string }> = raw ? JSON.parse(raw) : {};
    const key = `${task}:${resolvedModel}`;
    stats[key] = { count: (stats[key]?.count ?? 0) + 1, model: resolvedModel };
    sessionStorage.setItem(INTENT_ROUTER_STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore — stats are best-effort */ }
}

/** Returns current session routing stats (for dev inspection / measurement). */
export function getRouterStats(): Record<string, { count: number; model: string }> {
  try {
    const raw = sessionStorage.getItem(INTENT_ROUTER_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Clears accumulated session stats. */
export function clearRouterStats(): void {
  try { sessionStorage.removeItem(INTENT_ROUTER_STATS_KEY); } catch { /* ignore */ }
}
