/**
 * useLearningStyleProfile — Ж1.5
 *
 * Detects a student's dominant mathematical learning style from quiz history.
 * Groups quiz results by mathematical strand (domain), computes per-strand
 * averages, and maps the top strand to a VARK-aligned profile.
 *
 * Strands & style mapping (based on Bloom + VARK + educational research):
 *  geo  (Geometry)         → Visual    — spatial/shape reasoning
 *  num  (Numbers/Arith.)   → Procedural — step-by-step calculation
 *  alg  (Algebra)          → Abstract  — symbolic/pattern reasoning
 *  meas (Measurement)      → Applied   — real-world context
 *  data (Data/Statistics)  → Analytical — data interpretation
 *
 * Педагошка основа: VARK Learning Styles (Fleming), Gardner's Multiple
 * Intelligences, Mayer's Cognitive Theory of Multimedia Learning
 */

import { useMemo } from 'react';
import type { QuizResult } from '../services/firestoreService.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_RESULTS = 5; // minimum quiz results before we make a call

const STRANDS = [
  { id: 'geo',  keywords: ['геометр', 'форм', 'агол', 'триаголник', 'плоштин', 'волумен', 'права', 'точка', 'рамнин', 'тела', 'круг', 'правоаголник', 'квадрат', 'периметар'] },
  { id: 'num',  keywords: ['број', 'операц', 'дропк', 'собир', 'одзем', 'множ', 'дел', 'природн', 'цел', 'рационал', 'децимал', 'процент', 'разломок'] },
  { id: 'alg',  keywords: ['алгебр', 'функц', 'равенк', 'променл', 'низ', 'израз', 'степен', 'корен', 'полином', 'факторир'] },
  { id: 'meas', keywords: ['мерењ', 'врем', 'пар', 'должин', 'маса', 'температур', 'единиц', 'конверз', 'сказна задач', 'текстуал'] },
  { id: 'data', keywords: ['податоц', 'веројатн', 'табел', 'дијаграм', 'средна вредн', 'статистик', 'медиан', 'мода', 'фреквенц'] },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type LearningStyle = 'visual' | 'procedural' | 'abstract' | 'applied' | 'analytical' | 'balanced';

export interface StrandStat {
  strandId: string;
  label: string;
  avgScore: number;
  count: number;
}

export interface LearningStyleProfile {
  style: LearningStyle;
  confidence: 'high' | 'medium' | 'low';
  topStrand: string;
  strandStats: StrandStat[];   // sorted desc by avgScore
  dataPoints: number;
  suggestions: string[];
  description: string;
}

// ── Strand label map ──────────────────────────────────────────────────────────

const STRAND_LABELS: Record<string, string> = {
  geo:  'Геометрија',
  num:  'Броеви',
  alg:  'Алгебра',
  meas: 'Мерење',
  data: 'Податоци',
};

// ── Style meta ────────────────────────────────────────────────────────────────

const STYLE_META: Record<LearningStyle, {
  label: string;
  icon: string;
  description: string;
  suggestions: string[];
}> = {
  visual: {
    label: 'Визуелен ученик',
    icon: '👁',
    description: 'Просперира со дијаграми, форми и просторно размислување. Геометриските концепти му се природни.',
    suggestions: [
      'Користи повеќе визуелни прикази и скици',
      'Поврзувај алгебарски концепти со геометриски',
      'Дај задачи со графикони и координатни системи',
      'Анотирај дијаграми наместо само текст',
    ],
  },
  procedural: {
    label: 'Процедурален ученик',
    icon: '🔢',
    description: 'Силен во чекор-по-чекор пресметки. Ужива во алгоритамски постапки и точност.',
    suggestions: [
      'Обезбеди јасни чекор-по-чекор упатства',
      'Дај доволно вежби за автоматизација',
      'Поврзи процедурите со концептуалното разбирање',
      'Користи check-list за сложени пресметки',
    ],
  },
  abstract: {
    label: 'Апстрактен ученик',
    icon: '🔣',
    description: 'Силен во симболично размислување и препознавање шаблони. Алгебарското мислење му е природно.',
    suggestions: [
      'Воведи генерализации рано',
      'Поврзи конкретни примери со апстрактни правила',
      'Охрабрувај докажување и математичко расудување',
      'Нуди предизвикувачки задачи со шаблони и низи',
    ],
  },
  applied: {
    label: 'Применет ученик',
    icon: '🌍',
    description: 'Најдобро учи преку реален контекст и практични ситуации. Задачите со примена го мотивираат.',
    suggestions: [
      'Секогаш врзувај математика со реален живот',
      'Нуди задачи со конкретен контекст',
      'Користи мерења и практични активности',
      'Поврзи концепти со секојдневни ситуации',
    ],
  },
  analytical: {
    label: 'Аналитички ученик',
    icon: '📊',
    description: 'Силен во интерпретација на податоци и логичко расудување. Статистиката и веројатноста му одат.',
    suggestions: [
      'Нуди задачи со анализа на реални податоци',
      'Охрабрувај критичко читање на графикони',
      'Поврзи статистика со теми од интерес',
      'Нуди проекти за прибирање и анализа на податоци',
    ],
  },
  balanced: {
    label: 'Балансиран ученик',
    icon: '⚖',
    description: 'Нема јасно доминантен стил — перформансата е рамномерна низ сите подрачја.',
    suggestions: [
      'Различни приоди за различни теми',
      'Препознај кои типови задачи го мотивираат',
      'Нуди избор на форма за решавање задачи',
    ],
  },
};

// ── Strand detection ──────────────────────────────────────────────────────────

function detectStrand(title: string, conceptTitle?: string | null): string | null {
  const text = ((title ?? '') + ' ' + (conceptTitle ?? '')).toLowerCase();
  for (const strand of STRANDS) {
    if (strand.keywords.some(k => text.includes(k))) return strand.id;
  }
  return null;
}

// ── Style from top strand ─────────────────────────────────────────────────────

function strandToStyle(strandId: string): LearningStyle {
  switch (strandId) {
    case 'geo':  return 'visual';
    case 'num':  return 'procedural';
    case 'alg':  return 'abstract';
    case 'meas': return 'applied';
    case 'data': return 'analytical';
    default:     return 'balanced';
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * Computes a learning style profile from quiz results.
 *
 * @param results - Array of QuizResult for ONE student (filter before passing)
 *                  OR all results (hook groups internally by concept title)
 * @param studentName - If provided, filters results to that student only.
 */
export function useLearningStyleProfile(
  results: QuizResult[],
  studentName?: string,
): LearningStyleProfile | null {
  return useMemo(() => {
    const filtered = studentName
      ? results.filter(r => r.studentName === studentName)
      : results;

    if (filtered.length < MIN_RESULTS) return null;

    // Per-strand score accumulation
    const sums: Record<string, number>  = {};
    const counts: Record<string, number> = {};

    for (const r of filtered) {
      // Use conceptTitle if available, fallback to quizTitle
      const strand = detectStrand(
        r.quizTitle ?? '',
        r.conceptTitle ?? null,
      );
      if (!strand) continue;
      sums[strand]   = (sums[strand]   ?? 0) + r.percentage;
      counts[strand] = (counts[strand] ?? 0) + 1;
    }

    const strandStats: StrandStat[] = Object.keys(sums)
      .map(id => ({
        strandId: id,
        label: STRAND_LABELS[id] ?? id,
        avgScore: Math.round(sums[id] / counts[id]),
        count: counts[id],
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    if (strandStats.length === 0) return null;

    // Determine if there's a clear winner (≥10% gap to second place)
    const top = strandStats[0];
    const second = strandStats[1];
    const gap = second ? top.avgScore - second.avgScore : 100;

    const style: LearningStyle = gap < 5 ? 'balanced' : strandToStyle(top.strandId);
    const confidence: LearningStyleProfile['confidence'] =
      gap >= 15 ? 'high' : gap >= 7 ? 'medium' : 'low';

    const meta = STYLE_META[style];

    return {
      style,
      confidence,
      topStrand: top.strandId,
      strandStats,
      dataPoints: filtered.length,
      description: meta.description,
      suggestions: meta.suggestions,
    };
  }, [results, studentName]);
}

/** Returns label + icon for a given style */
export function getLearningStyleMeta(style: LearningStyle) {
  return STYLE_META[style];
}
