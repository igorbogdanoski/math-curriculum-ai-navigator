import React, { useState, useMemo, useEffect } from 'react';
import type { MaturaExamMeta } from '../../services/firestoreService.matura';
import type { SetupConfig, RecoveryPrefill } from './maturaPracticeHelpers';
import { SESSION_LABELS, LANG_FLAGS } from './maturaPracticeHelpers';
import { TopicChip } from './MaturaPracticeUI';

export function SetupScreen({ allTopics, exams, examsLoading, examsError, onStart, prefill, onDismissPrefill }: {
  allTopics: string[];
  exams: MaturaExamMeta[];
  examsLoading: boolean;
  examsError: string | null;
  onStart: (cfg: SetupConfig) => void;
  prefill: RecoveryPrefill | null;
  onDismissPrefill: () => void;
}) {
  // Derive available sessions/langs from actual Firestore exam list
  const availableSessions = useMemo(() => [...new Set(exams.map(e => e.session))].sort() as ('june'|'august')[], [exams]);
  const availableLangs    = useMemo(() => [...new Set(exams.map(e => e.language))].sort() as ('mk'|'al')[], [exams]);

  const [langs, setLangs]       = useState<('mk'|'al')[]>(['mk']);
  const [sessions, setSessions] = useState<('june'|'august')[]>(['june', 'august']);
  const [topics, setTopics]     = useState<string[]>(() => prefill?.topicArea ? [prefill.topicArea] : []);
  const [parts, setParts]       = useState<number[]>([1, 2, 3]);
  const [dokLevels, setDok]     = useState<number[]>(() => prefill?.dokLevels?.length ? prefill.dokLevels : [1, 2, 3, 4]);
  const [doShuffle, setShuffle] = useState(true);
  const [maxQ, setMaxQ]         = useState(prefill?.maxQ ?? 20);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.topicArea && allTopics.includes(prefill.topicArea)) {
      setTopics([prefill.topicArea]);
    }
    if (prefill.dokLevels?.length) setDok(prefill.dokLevels);
    if (typeof prefill.maxQ === 'number') setMaxQ(prefill.maxQ);
  }, [prefill, allTopics]);

  // Preview count: estimate based on exam count × avg questions per exam
  const matchingExams = useMemo(
    () => exams.filter(e => langs.includes(e.language as 'mk'|'al') && sessions.includes(e.session as 'june'|'august')),
    [exams, langs, sessions],
  );
  const previewCount = useMemo(() => {
    const total = matchingExams.reduce((s, e) => s + e.questionCount, 0);
    const topicFactor = topics.length ? 0.4 : 1;
    return Math.min(Math.round(total * topicFactor), maxQ);
  }, [matchingExams, topics, maxQ]);

  function toggle<T>(arr: T[], val: T, min = 1): T[] {
    if (arr.includes(val)) {
      if (arr.length <= min) return arr;
      return arr.filter(v => v !== val);
    }
    return [...arr, val];
  }

  const canStart = previewCount > 0;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-blue-700 to-indigo-700 px-6 py-5 text-white shadow-lg">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,white_1.5px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative">
          <h1 className="text-2xl font-black tracking-tight">Адаптивна практика</h1>
          <p className="text-white/70 text-sm mt-0.5">Вежбај матурски прашања по тема и следи го напредокот</p>
          {!examsLoading && (
            <div className="flex items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-bold">{exams.length} испити</span>
              <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-bold">{exams.reduce((s,e)=>s+e.questionCount,0)} прашања</span>
              <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-bold">AI оценување</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Recovery banner ── */}
      {prefill && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">Recovery Session</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              Препорачан фокус од M5 аналитика{prefill.sourceConceptTitle ? `: ${prefill.sourceConceptTitle}` : ''}.
            </p>
          </div>
          <button type="button" onClick={onDismissPrefill} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex-shrink-0">Сокриј</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">

        {/* ── Lang + Session (2-col) ── */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Јазик</h3>
            {examsLoading ? (
              <div className="flex gap-2">{[1,2].map(i=><div key={i} className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg"/>)}</div>
            ) : examsError ? (
              <p className="text-xs text-red-600">{examsError}</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {availableLangs.map(l => (
                  <button key={l} type="button" onClick={() => setLangs(prev => toggle(prev, l))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${langs.includes(l)?'bg-brand-primary text-white border-brand-primary shadow-sm':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {LANG_FLAGS[l] ?? l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Испитна сесија</h3>
            {examsLoading ? (
              <div className="flex gap-2">{[1,2].map(i=><div key={i} className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg"/>)}</div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {availableSessions.map(s => {
                  const years = [...new Set(exams.filter(e=>e.session===s).map(e=>e.year))].sort();
                  return (
                    <button key={s} type="button" onClick={() => setSessions(prev => toggle(prev, s))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${sessions.includes(s)?'bg-brand-primary text-white border-brand-primary shadow-sm':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                      {SESSION_LABELS[s] ?? s}
                      <span className={`ml-1.5 text-[10px] font-semibold ${sessions.includes(s)?'text-white/70':'text-slate-400'}`}>{years.join('·')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Topics ── */}
        <section className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Теми</h3>
            <button type="button"
              onClick={() => setTopics(topics.length === allTopics.length ? [] : [...allTopics])}
              className="text-xs text-brand-primary font-semibold hover:underline">
              {topics.length === allTopics.length ? 'Откажи сè' : 'Избери сè'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button"
              onClick={() => setTopics([])}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${topics.length === 0 ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
              Сите
            </button>
            {allTopics.map(t => (
              <TopicChip key={t} topic={t}
                active={topics.length === 0 || topics.includes(t)}
                onClick={() => setTopics(prev => {
                  if (prev.length === 0) return allTopics.filter(x => x !== t);
                  return toggle(prev, t, 1);
                })}
              />
            ))}
          </div>
        </section>

        {/* ── Parts + DoK (2-col) ── */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Дел</h3>
            <div className="flex flex-col gap-1.5">
              {[
                { v: 1, label: 'Дел I', sub: 'MC · 1pt' },
                { v: 2, label: 'Дел II', sub: 'Отворено · 2pt' },
                { v: 3, label: 'Дел III', sub: 'Отворено · 3–5pt' },
              ].map(({ v, label, sub }) => (
                <button key={v} type="button" onClick={() => setParts(prev => toggle(prev, v))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all text-left ${parts.includes(v) ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 font-bold' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-black flex-shrink-0 ${parts.includes(v) ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}>{v}</span>
                  <span>{label}</span>
                  <span className={`ml-auto text-[10px] ${parts.includes(v) ? 'text-brand-primary/70' : 'text-slate-400'}`}>{sub}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Тежина (DoK)</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { l: 1, label: 'Запомни',    on: 'bg-emerald-50 text-emerald-800 border-emerald-200', num: 'text-emerald-600' },
                { l: 2, label: 'Разбери',    on: 'bg-blue-50 text-blue-800 border-blue-200',          num: 'text-blue-600'    },
                { l: 3, label: 'Примени',    on: 'bg-amber-50 text-amber-800 border-amber-200',        num: 'text-amber-600'  },
                { l: 4, label: 'Анализирај', on: 'bg-rose-50 text-rose-800 border-rose-200',           num: 'text-rose-600'   },
              ] as const).map(({ l, label, on, num }) => (
                <button key={l} type="button" onClick={() => setDok(prev => toggle(prev, l))}
                  className={`px-2 py-2 rounded-lg border transition-all text-left font-bold ${dokLevels.includes(l) ? on : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                  <span className={`text-lg font-black leading-none block ${dokLevels.includes(l) ? num : 'text-slate-300'}`}>{l}</span>
                  <span className="text-[10px] leading-tight mt-0.5 block">{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ── Options ── */}
        <section className="px-4 py-3 flex items-center gap-6 bg-slate-50/50 rounded-b-2xl">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={doShuffle} onChange={e => setShuffle(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
            <span className="text-sm font-medium text-slate-700">Мешај ред</span>
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-slate-500">Прашања:</span>
            <select title="Изберете број на прашања" aria-label="Изберете број на прашања" value={maxQ} onChange={e => setMaxQ(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 bg-white focus:ring-brand-primary focus:border-brand-primary">
              {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </section>
      </div>

      {/* ── Start button ── */}
      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStart({ langs, sessions, topics, parts, dokLevels, doShuffle, maxQ })}
        className={`w-full py-3.5 rounded-2xl font-black text-lg transition-all ${
          canStart
            ? 'bg-gradient-to-r from-brand-primary to-blue-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {canStart
          ? `Започни практика · ${previewCount} прашања`
          : 'Нема прашања за избраните филтри'}
      </button>
    </div>
  );
}
