import React, { useMemo, useState } from 'react';
import type { AIGeneratedAnnualPlan } from '../../types';
import type { PlanQualityReport } from '../../services/gemini/planAnalysis';
import { grade8OfficialCurriculum } from '../../data/official/grade8Official';
import { GRADE6_OFFICIAL_SUBTOPICS } from '../../data/official/grade6Official';
import { GRADE7_OFFICIAL_SUBTOPICS } from '../../data/official/grade7Official';
import { GRADE9_OFFICIAL_SUBTOPICS } from '../../data/official/grade9Official';
import { PRIMARY_OFFICIAL_BY_GRADE } from '../../data/official/grade1to5Official';
import { getGradeHoursInfo } from '../../services/gemini/plans';
import { analyzePlanQuality } from '../../services/gemini/planAnalysis';
import { callGeminiProxy, sanitizePromptInput, DEFAULT_MODEL } from '../../services/gemini/core';
import {
  BLOOM_AXES, BLOOM_TARGET_PCT, analyzeUbD, extractBloomScores, toPercent,
  detectGrade, fuzzyMatchTopic,
} from './planAnalyticsHelpers';
import { BloomRadarChart } from './BloomRadarChart';
import { QualityScoreCard } from './QualityScoreCard';
import { NationalStandardsPanel } from './NationalStandardsPanel';
import { CurriculumGapPanel } from './CurriculumGapPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  plan: AIGeneratedAnnualPlan;
  weeklyHours?: number;
}

function UbDBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[11px] font-semibold">
        <span className="text-gray-700">{label}</span>
        <span className={color}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {/* eslint-disable-next-line react/forbid-component-props -- dynamic width requires inline style */}
        <div className={`h-full rounded-full transition-all duration-700 ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const PlanAnalyticsDashboard: React.FC<Props> = ({ plan, weeklyHours: weeklyHoursProp }) => {
  const gradeNum = detectGrade(plan.grade ?? '');
  // Use accurate МОН hours if grade is detected; fall back to prop or 4
  const { weeklyHours, lessonMinutes, totalHours: officialTotalHours } = gradeNum
    ? getGradeHoursInfo(gradeNum)
    : { weeklyHours: weeklyHoursProp ?? 4, lessonMinutes: 40, totalHours: (weeklyHoursProp ?? 4) * 36 };
  const [qualityReport, setQualityReport] = useState<PlanQualityReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [ubdSuggestions, setUbdSuggestions] = useState<string | null>(null);
  const [isFillingGaps, setIsFillingGaps] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError('');
    try {
      const report = await analyzePlanQuality(plan);
      setQualityReport(report);
    } catch {
      setAnalysisError('Грешка при AI анализа. Обидете се повторно.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── A: Bloom ──────────────────────────────────────────────────────────────
  const bloomCounts = useMemo(() => extractBloomScores(plan.topics ?? []), [plan.topics]);
  const bloomPct = useMemo(() => toPercent(bloomCounts), [bloomCounts]);
  const bloomTotalHits = bloomCounts.reduce((a, b) => a + b, 0);
  const bloomTargetPct = BLOOM_TARGET_PCT;

  // ── B: Hours Tracker ─────────────────────────────────────────────────────
  const officialHoursMap: Record<string, number> = useMemo(() => {
    if (gradeNum === 8) {
      return Object.fromEntries(grade8OfficialCurriculum.topics.map(t => [t.title, t.totalHours]));
    }
    const flatMap = (subs: Array<{ themeName: string; hours: number }>) =>
      subs.reduce<Record<string, number>>((acc, s) => { acc[s.themeName] = (acc[s.themeName] ?? 0) + s.hours; return acc; }, {});
    if (gradeNum === 6) return flatMap(GRADE6_OFFICIAL_SUBTOPICS);
    if (gradeNum === 7) return flatMap(GRADE7_OFFICIAL_SUBTOPICS);
    if (gradeNum === 9) return flatMap(GRADE9_OFFICIAL_SUBTOPICS);
    if (gradeNum && gradeNum >= 1 && gradeNum <= 5) {
      const g = PRIMARY_OFFICIAL_BY_GRADE[gradeNum];
      return g ? flatMap(g.subtopics) : {};
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

    const flatSubs = (subs: Array<{ themeName: string; hours: number }>) =>
      subs.reduce<Record<string, number>>((acc, s) => { acc[s.themeName] = (acc[s.themeName] ?? 0) + s.hours; return acc; }, {});

    let subtopics: Record<string, number> = {};
    if (gradeNum === 6) subtopics = flatSubs(GRADE6_OFFICIAL_SUBTOPICS);
    else if (gradeNum === 7) subtopics = flatSubs(GRADE7_OFFICIAL_SUBTOPICS);
    else if (gradeNum === 9) subtopics = flatSubs(GRADE9_OFFICIAL_SUBTOPICS);
    else if (gradeNum && gradeNum >= 1 && gradeNum <= 5) {
      const g = PRIMARY_OFFICIAL_BY_GRADE[gradeNum];
      if (g) subtopics = flatSubs(g.subtopics);
    }

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

  // HOT skills = Apply(3) + Analyze(4) + Evaluate(5) + Create(6) — МОН requires ≥30%
  const hotPct = bloomPct[2] + bloomPct[3] + bloomPct[4] + bloomPct[5];
  const showBloomWarning = bloomTotalHits > 0 && hotPct < 30;

  // ── D: UbD Backward Design ────────────────────────────────────────────────
  const ubdScore = useMemo(() => analyzeUbD(plan.topics ?? []), [plan.topics]);

  const handleFillUbDGaps = async () => {
    setIsFillingGaps(true);
    setUbdSuggestions(null);
    try {
      const weakList = ubdScore.weakTopics.slice(0, 5)
        .map(t => `- ${t}`)
        .join('\n');
      const safeWeak = sanitizePromptInput(weakList, 600);
      const safeGrade = sanitizePromptInput(plan.grade ?? '', 30);
      const prompt = `Ти си педагошки советник за планирање по UbD рамката (Wiggins & McTighe).
Годишниот план е за ${safeGrade} одделение. Следниве теми имаат нецелосна UbD структура:
${safeWeak}

За секоја тема предложи конкретно:
1. Задача за оценување (Фаза 2) — специфичен тест/проект/портфолио
2. Активност за учење (Фаза 3) — истражувачка или кооперативна активност

Одговори на македонски со структурирана листа, максимум 3 реченици по тема.`;

      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (resp?.text) setUbdSuggestions(resp.text.trim());
    } catch {
      setUbdSuggestions('Грешка при генерирање. Обиди се повторно.');
    } finally {
      setIsFillingGaps(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-1">

      {/* ── Bloom HOT skills warning ── */}
      {showBloomWarning && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-bold text-amber-800">Недоволно Примена/Анализа/Синтеза — само {hotPct}% наспроти препорачаните ≥30%</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              МОН препорачува минимум 30% цели на Блум ниво 3–6 (Примена, Анализа, Евалуација, Создавање).
              Додај активности со „решава", „анализира", „оценува", „дизајнира" во целите на темите.
            </p>
          </div>
        </div>
      )}

      {/* ── UbD Backward Design Check ── */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-sky-900">📐 UbD Backward Design</h3>
            <p className="text-[11px] text-sky-600 mt-0.5">
              Проверка на трите фази: Цели → Докази → Активности (Wiggins &amp; McTighe)
            </p>
          </div>
          {ubdScore.weakTopics.length > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              {ubdScore.weakTopics.length} теми со пропусти
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-sky-100 p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wide">Фаза 1 — Посакувани резултати</p>
            <UbDBar label="Теми со цели" pct={ubdScore.stage1} color={ubdScore.stage1 >= 70 ? 'text-emerald-600' : 'text-red-500'} />
          </div>
          <div className="bg-white rounded-lg border border-sky-100 p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wide">Фаза 2 — Докази за разбирање</p>
            <UbDBar label="Теми со проверка/тест" pct={ubdScore.stage2} color={ubdScore.stage2 >= 70 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
          <div className="bg-white rounded-lg border border-sky-100 p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wide">Фаза 3 — Наставна програма</p>
            <UbDBar label="Теми со истраж./соработка" pct={ubdScore.stage3} color={ubdScore.stage3 >= 70 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
        </div>
        {ubdScore.weakTopics.length > 0 && (
          <div className="space-y-2">
            <details className="text-[11px]">
              <summary className="cursor-pointer text-sky-600 hover:text-sky-800 font-semibold select-none">
                Прикажи теми со нецелосна UbD структура
              </summary>
              <ul className="mt-1.5 space-y-0.5 pl-3">
                {ubdScore.weakTopics.map(t => (
                  <li key={t} className="text-amber-700">• {t}</li>
                ))}
              </ul>
            </details>
            <button
              type="button"
              onClick={handleFillUbDGaps}
              disabled={isFillingGaps}
              className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 hover:text-sky-900 disabled:opacity-50 transition-colors"
            >
              {isFillingGaps
                ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> AI генерира предлози...</>
                : <>🎯 AI: Пополни ги UbD пропустите</>}
            </button>
            {ubdSuggestions && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-[11px] text-sky-900 leading-relaxed whitespace-pre-wrap">
                {ubdSuggestions}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── S78-A: AI Quality Analysis ── */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4 border border-violet-100 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-violet-800 text-sm">🤖 AI Педагошка Анализа</h3>
          <p className="text-xs text-violet-600 mt-0.5">
            Длабока оцена на Блум баланс, покриеност на curriculum, вертикална прогресија и препораки за подобрување.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-60 transition shadow-sm"
        >
          {isAnalyzing ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Анализирам...</>
          ) : qualityReport ? '🔄 Повторна анализа' : '🔍 Анализирај'}
        </button>
      </div>
      {analysisError && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{analysisError}</p>
      )}
      {qualityReport && <QualityScoreCard report={qualityReport} />}

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
          <div className={`text-xs mt-0.5 ${totalPlanned > totalAvailableHours ? 'text-red-500' : 'text-emerald-500'}`}>
            Часови · {weeklyHours}ч/нед · {lessonMinutes}мин
          </div>
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
            Нема официјална програма за ова одделение во системот (1–9 одд. поддржани).
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

      {/* ── D: МОН Национални Стандарди ── */}
      <NationalStandardsPanel planTopics={(plan.topics ?? []).map(t => t.title)} gradeNum={gradeNum} />

      {/* ── E: S100.2 — AI Curriculum Gap Detector ── */}
      {gradeNum !== null && gradeNum <= 9 && (
        <div className="border border-red-200 rounded-2xl bg-white shadow-sm p-5">
          <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span>🔍</span> Gap Detector — БРО стандарди
          </p>
          <CurriculumGapPanel
            planTopics={(plan.topics ?? []).map(t => t.title)}
            gradeNum={gradeNum as number}
          />
        </div>
      )}
    </div>
  );
};
