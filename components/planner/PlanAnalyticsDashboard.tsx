import React, { useMemo } from 'react';
import type { AIGeneratedAnnualPlan, AIGeneratedAnnualPlanTopic } from '../../types';
import { grade8OfficialCurriculum } from '../../data/official/grade8Official';
import { GRADE6_OFFICIAL_SUBTOPICS } from '../../data/official/grade6Official';
import { GRADE7_OFFICIAL_SUBTOPICS } from '../../data/official/grade7Official';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  plan: AIGeneratedAnnualPlan;
  weeklyHours?: number;
}

// ── Bloom config ─────────────────────────────────────────────────────────────

const BLOOM_AXES = [
  { label: 'Помнење',    level: 1, color: '#6366f1', target: 15 },
  { label: 'Разбирање',  level: 2, color: '#8b5cf6', target: 20 },
  { label: 'Примена',    level: 3, color: '#06b6d4', target: 25 },
  { label: 'Анализа',    level: 4, color: '#10b981', target: 20 },
  { label: 'Евалуација', level: 5, color: '#f59e0b', target: 12 },
  { label: 'Создавање',  level: 6, color: '#ef4444', target: 8  },
];

const BLOOM_KEYWORDS: Record<number, string[]> = {
  1: ['знае', 'именува', 'набројува', 'набројат', 'дефинира', 'наведи', 'познава', 'препознава', 'идентификува', 'recall', 'листа'],
  2: ['разбира', 'објаснува', 'опишува', 'интерпретира', 'сумира', 'класифицира', 'изразува', 'споредува', 'разграничи'],
  3: ['применува', 'пресметува', 'решава', 'користи', 'вежба', 'демонстрира', 'одредува', 'пресметување', 'конструира', 'претставува'],
  4: ['анализира', 'разликува', 'расчленува', 'испитува', 'категоризира', 'разложува', 'разграничува', 'истражува'],
  5: ['оценува', 'критикува', 'аргументира', 'проценува', 'избира', 'докажува', 'оправдува', 'критички'],
  6: ['создава', 'дизајнира', 'планира', 'формулира', 'составува', 'проектира', 'развива', 'генерира', 'конструира нов'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractBloomScores(topics: AIGeneratedAnnualPlanTopic[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  const allText = topics
    .flatMap(t => [...t.objectives, ...t.suggestedActivities])
    .join(' ')
    .toLowerCase();

  for (const [levelStr, keywords] of Object.entries(BLOOM_KEYWORDS)) {
    const lvl = parseInt(levelStr, 10);
    for (const kw of keywords) {
      const re = new RegExp(kw, 'gi');
      const matches = allText.match(re);
      counts[lvl - 1] += matches?.length ?? 0;
    }
  }
  return counts;
}

function toPercent(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  return counts.map(c => Math.round((c / total) * 100));
}

function detectGrade(grade: string): number | null {
  const m = grade.match(/\b(6|7|8|VI|VII|VIII)\b/i);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (v === 'VI'  || v === '6') return 6;
  if (v === 'VII' || v === '7') return 7;
  if (v === 'VIII'|| v === '8') return 8;
  return null;
}

function fuzzyMatchTopic(planTitle: string, officialTitle: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const p = norm(planTitle);
  const o = norm(officialTitle);
  return p.includes(o) || o.includes(p) || (p.length > 4 && o.startsWith(p.slice(0, 4)));
}

// ── Bloom Radar Chart (pure SVG) ──────────────────────────────────────────────

const BloomRadarChart: React.FC<{ scores: number[]; targets: number[] }> = ({ scores, targets }) => {
  const SIZE = 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 80;

  const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 6;

  const pt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy + r * Math.sin(angleOf(i)),
  });

  const polyPts = (vals: number[], max: number) =>
    BLOOM_AXES.map((_, i) => {
      const { x, y } = pt(i, (vals[i] / max) * R);
      return `${x},${y}`;
    }).join(' ');

  const maxVal = 100;
  const ringSteps = [25, 50, 75, 100];

  const labelPt = (i: number) => pt(i, R + 22);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-xs mx-auto"
      aria-label="Bloom's Taxonomy radar chart"
    >
      {/* Grid rings */}
      {ringSteps.map(pct => (
        <polygon
          key={pct}
          points={BLOOM_AXES.map((_, i) => {
            const { x, y } = pt(i, (pct / 100) * R);
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}

      {/* Spokes */}
      {BLOOM_AXES.map((_, i) => {
        const { x, y } = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}

      {/* Target polygon */}
      <polygon
        points={polyPts(targets, maxVal)}
        fill="rgba(99,102,241,0.08)"
        stroke="#c7d2fe"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      {/* Actual polygon */}
      <polygon
        points={polyPts(scores, maxVal)}
        fill="rgba(6,182,212,0.2)"
        stroke="#06b6d4"
        strokeWidth="2"
      />

      {/* Axis dots */}
      {BLOOM_AXES.map((ax, i) => {
        const { x, y } = pt(i, (scores[i] / maxVal) * R);
        return <circle key={i} cx={x} cy={y} r="3.5" fill={ax.color} />;
      })}

      {/* Labels */}
      {BLOOM_AXES.map((ax, i) => {
        const { x, y } = labelPt(i);
        const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="8"
            fontWeight="600"
            fill={ax.color}
          >
            {ax.label}
          </text>
        );
      })}

      {/* Center label */}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#9ca3af">
        Bloom
      </text>
    </svg>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const PlanAnalyticsDashboard: React.FC<Props> = ({ plan, weeklyHours = 4 }) => {
  const gradeNum = detectGrade(plan.grade ?? '');

  // ── A: Bloom ──────────────────────────────────────────────────────────────
  const bloomCounts = useMemo(() => extractBloomScores(plan.topics ?? []), [plan.topics]);
  const bloomPct = useMemo(() => toPercent(bloomCounts), [bloomCounts]);
  const bloomTotalHits = bloomCounts.reduce((a, b) => a + b, 0);
  const bloomTargetPct = BLOOM_AXES.map(a => a.target);

  // ── B: Hours Tracker ─────────────────────────────────────────────────────
  const officialHoursMap: Record<string, number> = useMemo(() => {
    if (gradeNum === 8) {
      return Object.fromEntries(
        grade8OfficialCurriculum.topics.map(t => [t.title, t.totalHours]),
      );
    }
    return {};
  }, [gradeNum]);

  const totalAvailableHours = (plan.totalWeeks ?? 36) * weeklyHours;
  const topicsWithHours = useMemo(
    () =>
      (plan.topics ?? []).map(t => ({
        topic: t,
        planned: t.durationWeeks * weeklyHours,
        official: officialHoursMap[t.title] ?? null,
      })),
    [plan.topics, weeklyHours, officialHoursMap],
  );
  const totalPlanned = topicsWithHours.reduce((s, t) => s + t.planned, 0);

  // ── C: Coverage Gap ──────────────────────────────────────────────────────
  interface CoverageItem { title: string; hours: number; covered: boolean; planTopicTitle?: string }

  const coverageItems: CoverageItem[] = useMemo(() => {
    const planTitles = (plan.topics ?? []).map(t => t.title);

    if (gradeNum === 8) {
      return grade8OfficialCurriculum.topics.map(ot => {
        const matched = planTitles.find(pt => fuzzyMatchTopic(pt, ot.title));
        return { title: ot.title, hours: ot.totalHours, covered: !!matched, planTopicTitle: matched };
      });
    }

    const subtopics = gradeNum === 6
      ? GRADE6_OFFICIAL_SUBTOPICS.reduce<Record<string, number>>((acc, s) => {
          acc[s.themeName] = (acc[s.themeName] ?? 0) + s.hours;
          return acc;
        }, {})
      : gradeNum === 7
        ? GRADE7_OFFICIAL_SUBTOPICS.reduce<Record<string, number>>((acc, s) => {
            acc[s.themeName] = (acc[s.themeName] ?? 0) + s.hours;
            return acc;
          }, {})
        : {};

    return Object.entries(subtopics).map(([title, hours]) => ({
      title,
      hours,
      covered: planTitles.some(pt => fuzzyMatchTopic(pt, title)),
    }));
  }, [gradeNum, plan.topics]);

  const coveredCount = coverageItems.filter(c => c.covered).length;
  const coveragePct = coverageItems.length > 0
    ? Math.round((coveredCount / coverageItems.length) * 100)
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-1">

      {/* ── Top summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{plan.topics?.length ?? 0}</div>
          <div className="text-xs text-blue-500 mt-0.5">Теми</div>
        </div>
        <div className={`rounded-xl p-3 text-center border ${totalPlanned > totalAvailableHours ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`text-2xl font-bold ${totalPlanned > totalAvailableHours ? 'text-red-700' : 'text-emerald-700'}`}>
            {totalPlanned}
            <span className="text-sm font-normal opacity-60">/{totalAvailableHours}</span>
          </div>
          <div className={`text-xs mt-0.5 ${totalPlanned > totalAvailableHours ? 'text-red-500' : 'text-emerald-500'}`}>Планирани часови</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
          <div className="text-2xl font-bold text-purple-700">{coveragePct}%</div>
          <div className="text-xs text-purple-500 mt-0.5">Покриеност</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
          <div className="text-2xl font-bold text-amber-700">
            {bloomTotalHits > 0
              ? `L${bloomPct.indexOf(Math.max(...bloomPct)) + 1}`
              : '—'}
          </div>
          <div className="text-xs text-amber-500 mt-0.5">Доминантен Bloom</div>
        </div>
      </div>

      {/* ── A: Bloom Radar + legend ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
          Bloom's Taxonomy — дистрибуција на цели
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          МОН препорачува: ≥30% Примена (Ниво 3), ≥20% Анализа+Евалуација+Создавање
          {' · '}
          <span className="text-indigo-400">─ ─ Целна</span>
          {' · '}
          <span className="text-cyan-500">─── Планирана</span>
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-64 flex-shrink-0">
            {bloomTotalHits === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-xs border-2 border-dashed border-gray-100 rounded-xl">
                Нема доволно текст за анализа
              </div>
            ) : (
              <BloomRadarChart scores={bloomPct} targets={bloomTargetPct} />
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {BLOOM_AXES.map((ax, i) => (
              <div key={ax.level} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ax.color }} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-700 truncate">
                    L{ax.level} {ax.label}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${bloomPct[i]}%`, backgroundColor: ax.color }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8 text-right font-mono">
                      {bloomPct[i]}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── B: Hours Tracker ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Распределба на часови по теми
        </h3>
        <div className="space-y-2.5">
          {topicsWithHours.map(({ topic, planned, official }, idx) => {
            const max = official ?? Math.max(planned, 1);
            const pct = Math.min(100, Math.round((planned / max) * 100));
            const isOver = official != null && planned > official;
            const isUnder = official != null && planned < official * 0.8;
            const barColor = isOver
              ? 'bg-red-400'
              : isUnder
                ? 'bg-amber-400'
                : 'bg-emerald-500';
            const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#0ea5e9','#a855f7'];
            const dotColor = COLORS[idx % COLORS.length];

            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs text-gray-700 mb-0.5">
                    <span className="truncate font-medium">{topic.title}</span>
                    <span className="flex-shrink-0 ml-2 font-mono tabular-nums text-gray-500">
                      {planned}ч
                      {official != null && <span className="text-gray-300">/{official}ч</span>}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {official != null && isOver && (
                  <span className="text-[10px] text-red-500 font-bold flex-shrink-0">+{planned - official}ч</span>
                )}
                {official != null && !isOver && !isUnder && (
                  <span className="text-[10px] text-emerald-600 flex-shrink-0">✓</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Total row */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500">Вкупно планирани:</span>
          <span className={`font-bold font-mono ${totalPlanned > totalAvailableHours ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalPlanned} / {totalAvailableHours} ч.
          </span>
        </div>
        {totalPlanned > totalAvailableHours && (
          <p className="text-[11px] text-red-500 mt-1">
            ⚠️ Планирани {totalPlanned - totalAvailableHours} часа повеќе од достапниот фонд.
          </p>
        )}
        {totalPlanned < totalAvailableHours * 0.9 && (
          <p className="text-[11px] text-amber-500 mt-1">
            ℹ️ Има {totalAvailableHours - totalPlanned} слободни часа — размисли за дополнително вградување.
          </p>
        )}
      </div>

      {/* ── C: Coverage Gap ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          Покриеност на официјалната програма
        </h3>
        {coverageItems.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            Нема официјална програма за ова одделение во системот (6–8 одд. поддржани).
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Споредба на твоите теми со официјалната МОН програма за {plan.grade ?? 'ова одделение'}.
              {' '}
              <span className="text-emerald-600 font-semibold">{coveredCount}/{coverageItems.length}</span> теми покриени.
            </p>
            <div className="flex flex-wrap gap-2">
              {coverageItems.map((item, i) => (
                <div
                  key={i}
                  title={item.covered ? `Покриена: ${item.planTopicTitle}` : 'Не е планирана'}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    item.covered
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <span>{item.covered ? '✓' : '✗'}</span>
                  <span className="truncate max-w-[180px]">{item.title}</span>
                  <span className="opacity-50 tabular-nums">{item.hours}ч</span>
                </div>
              ))}
            </div>
            {coverageItems.some(c => !c.covered) && (
              <p className="text-[11px] text-red-500 mt-3">
                ⚠️ {coverageItems.filter(c => !c.covered).map(c => c.title).join(', ')} — не се планирани во твојот план.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
