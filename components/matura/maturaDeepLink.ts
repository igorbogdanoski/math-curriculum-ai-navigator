/**
 * S37-C4 — Matura library deep-link helpers.
 *
 * Build/parse URLs like:
 *   /matura-library?tab=ucilisna&topic=algebra&dok=2
 *
 * Used by PlannerItemModal (lesson plan → matura bank) and AnnualPlan items
 * to deep-link into a pre-filtered Internal matura bank view.
 */

import { TOPIC_LABELS } from './maturaLibrary.constants';

export type MaturaTab = 'dim' | 'ucilisna' | 'teacher';

export interface MaturaDeepLinkParams {
  tab?: MaturaTab;
  topic?: string;
  dok?: 1 | 2 | 3 | 4;
}

const VALID_TABS: ReadonlySet<MaturaTab> = new Set(['dim', 'ucilisna', 'teacher']);

/** Slug-keys recognised as Internal matura topicArea values (data/matura/raw). */
const VALID_TOPICS: ReadonlySet<string> = new Set(Object.keys(TOPIC_LABELS));

/**
 * Naive Macedonian theme → topicArea slug mapping. Used when a LessonPlan
 * has only a free-text `theme` to derive a deep-link.
 *
 * Returns `undefined` if no confident match — caller should hide the link.
 */
export function inferTopicAreaFromTheme(theme: string | undefined | null): string | undefined {
  if (!theme) return undefined;
  const t = theme.toLowerCase();
  if (/(алгебр|equation|линеарн|квадратн|полином|jednacin|ravenk)/i.test(t)) return 'algebra';
  if (/(геометр|триаголник|круг|плоштин|volumen|периметар)/i.test(t)) return 'geometrija';
  if (/(тригономет|sin|cos|tan|агол|радијан)/i.test(t)) return 'trigonometrija';
  if (/(анализ|интеграл|извод|граница|функц|деривац)/i.test(t)) return 'analiza';
  if (/(матриц|вектор|детерминант)/i.test(t)) return 'matrici-vektori';
  if (/(број|дел|реален|комплексен|natural|cel)/i.test(t)) return 'broevi';
  if (/(статистик|просек|медиан|стандардн)/i.test(t)) return 'statistika';
  if (/(комбинатор|пермутац|комбинац)/i.test(t)) return 'kombinatorika';
  return undefined;
}

/** Parse a `URLSearchParams` (or `location.search` string) → typed params. */
export function parseMaturaDeepLink(search: string | URLSearchParams): MaturaDeepLinkParams {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;

  const out: MaturaDeepLinkParams = {};

  const tab = params.get('tab');
  if (tab && VALID_TABS.has(tab as MaturaTab)) out.tab = tab as MaturaTab;

  const topic = params.get('topic');
  if (topic && VALID_TOPICS.has(topic)) out.topic = topic;

  const dokRaw = params.get('dok');
  if (dokRaw) {
    const n = Number(dokRaw);
    if (n === 1 || n === 2 || n === 3 || n === 4) out.dok = n;
  }

  return out;
}

/** Build `/matura-library?...` from typed params. Empty params → bare path. */
export function buildMaturaDeepLink(params: MaturaDeepLinkParams): string {
  const qs = new URLSearchParams();
  if (params.tab && VALID_TABS.has(params.tab)) qs.set('tab', params.tab);
  if (params.topic && VALID_TOPICS.has(params.topic)) qs.set('topic', params.topic);
  if (params.dok && params.dok >= 1 && params.dok <= 4) qs.set('dok', String(params.dok));
  const s = qs.toString();
  return s ? `/matura-library?${s}` : '/matura-library';
}
