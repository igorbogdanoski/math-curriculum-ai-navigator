import type { AIGeneratedAnnualPlanTopic } from '../../types';

// ── Bloom config ──────────────────────────────────────────────────────────────

export const BLOOM_AXES = [
  { label: 'Помнење',    level: 1, color: '#6366f1', target: 15 },
  { label: 'Разбирање',  level: 2, color: '#8b5cf6', target: 20 },
  { label: 'Примена',    level: 3, color: '#06b6d4', target: 25 },
  { label: 'Анализа',    level: 4, color: '#10b981', target: 20 },
  { label: 'Евалуација', level: 5, color: '#f59e0b', target: 12 },
  { label: 'Создавање',  level: 6, color: '#ef4444', target: 8  },
];

export const BLOOM_TARGET_PCT = BLOOM_AXES.map(a => a.target);

export const BLOOM_KEYWORDS: Record<number, string[]> = {
  1: ['знае', 'именува', 'набројува', 'набројат', 'дефинира', 'наведи', 'познава', 'препознава', 'идентификува', 'recall', 'листа'],
  2: ['разбира', 'објаснува', 'опишува', 'интерпретира', 'сумира', 'класифицира', 'изразува', 'споредува', 'разграничи'],
  3: ['применува', 'пресметува', 'решава', 'користи', 'вежба', 'демонстрира', 'одредува', 'пресметување', 'конструира', 'претставува'],
  4: ['анализира', 'разликува', 'расчленува', 'испитува', 'категоризира', 'разложува', 'разграничува', 'истражува'],
  5: ['оценува', 'критикува', 'аргументира', 'проценува', 'избира', 'докажува', 'оправдува', 'критички'],
  6: ['создава', 'дизајнира', 'планира', 'формулира', 'составува', 'проектира', 'развива', 'генерира', 'конструира нов'],
};

// ── UbD config ────────────────────────────────────────────────────────────────

export const UBD_ASSESSMENT_KW = ['тест', 'квиз', 'проект', 'портфолио', 'презентација', 'задача', 'провер', 'оцен', 'есеј', 'извештај'];
export const UBD_INQUIRY_KW    = ['истражување', 'дискусија', 'дебата', 'групна', 'кооперативн', 'манипулатив', 'откри', 'проблем', 'ситуација'];

export interface UbDScore { stage1: number; stage2: number; stage3: number; weakTopics: string[] }

export function analyzeUbD(topics: AIGeneratedAnnualPlanTopic[]): UbDScore {
  if (!topics.length) return { stage1: 0, stage2: 0, stage3: 0, weakTopics: [] };
  const weakTopics: string[] = [];
  let s1 = 0, s2 = 0, s3 = 0;
  for (const t of topics) {
    const hasObjectives = t.objectives.length > 0;
    const actText = t.suggestedActivities.join(' ').toLowerCase();
    const hasAssessment = UBD_ASSESSMENT_KW.some(kw => actText.includes(kw));
    const hasInquiry    = UBD_INQUIRY_KW.some(kw => actText.includes(kw));
    if (hasObjectives) s1++;
    if (hasAssessment) s2++;
    if (hasInquiry)    s3++;
    if (!hasObjectives || !hasAssessment || !hasInquiry) weakTopics.push(t.title);
  }
  const n = topics.length;
  return {
    stage1: Math.round((s1 / n) * 100),
    stage2: Math.round((s2 / n) * 100),
    stage3: Math.round((s3 / n) * 100),
    weakTopics,
  };
}

export function extractBloomScores(topics: AIGeneratedAnnualPlanTopic[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  const allText = topics
    .flatMap(t => [...t.objectives, ...t.suggestedActivities])
    .join(' ')
    .toLowerCase();
  for (const [levelStr, keywords] of Object.entries(BLOOM_KEYWORDS)) {
    const lvl = parseInt(levelStr, 10);
    for (const kw of keywords) {
      const re = new RegExp(`(?<![\\p{L}])${kw}(?![\\p{L}])`, 'giu');
      const matches = allText.match(re);
      counts[lvl - 1] += matches?.length ?? 0;
    }
  }
  return counts;
}

export function toPercent(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  return counts.map(c => Math.round((c / total) * 100));
}

export function detectGrade(grade: string): number | null {
  // Guard against secondary/vocational/elective titles (e.g. "I (прва) — Стручно 2-год",
  // "IV — Математичка анализа (изборен)", "XI (единаесетто) / II (втора) година — Гимназиско")
  // whose Roman numerals/digits would otherwise be misread as a primary grade 1-9. Every
  // primary grade title (grade1.ts..grade9.ts) consistently contains "Одделение" — secondary
  // titles never do — so this is a reliable, track-agnostic signal without needing the caller
  // to thread secondaryTrack through every call site.
  if (!/одделение/i.test(grade)) return null;
  const m = grade.match(/\b(IX|VIII|VII|VI|V|IV|III|II|I|9|8|7|6|5|4|3|2|1)\b/i);
  if (!m) return null;
  const v = m[1].toUpperCase();
  const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
  return roman[v] ?? parseInt(v, 10) ?? null;
}

export function fuzzyMatchTopic(planTitle: string, officialTitle: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const p = norm(planTitle);
  const o = norm(officialTitle);
  return p.includes(o) || o.includes(p) || (p.length > 4 && o.startsWith(p.slice(0, 4)));
}

export function topicsAddressStd(planTopics: string[], description: string): boolean {
  const descLower = description.toLowerCase();
  return planTopics.some(pt => {
    const words = pt.toLowerCase().replace(/[^\p{L}\d\s]/giu, '').split(/\s+/).filter(w => w.length > 4);
    return words.some(w => descLower.includes(w));
  });
}
