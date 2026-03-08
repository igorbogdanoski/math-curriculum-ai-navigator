import React, { useMemo, useState } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { ConceptMastery } from '../services/firestoreService';
import { Trophy, Star, Lock, BookOpen, Target, CheckCircle2, PlayCircle, AlertCircle } from 'lucide-react';

interface LogicMapProps {
  masteryRecords: ConceptMastery[];
  nextQuizIds?: Record<string, string>; // conceptId → cached quizId
}

type ConceptState = 'mastered' | 'in-progress' | 'unlocked' | 'locked';

const STATE_STYLES: Record<ConceptState, { ring: string; bg: string; icon: React.ReactNode; label: string; labelColor: string }> = {
  mastered:    { ring: 'ring-4 ring-yellow-400',    bg: 'bg-amber-400 border-amber-500 shadow-amber-300/60',   icon: <Trophy className="w-7 h-7 fill-current" />,    label: 'Совладано',      labelColor: 'text-amber-600' },
  'in-progress':{ ring: 'ring-4 ring-blue-400',     bg: 'bg-blue-500 border-blue-600 shadow-blue-300/60',     icon: <Star className="w-7 h-7 fill-current" />,      label: 'Во тек',         labelColor: 'text-blue-600' },
  unlocked:    { ring: 'ring-4 ring-indigo-300',    bg: 'bg-white border-indigo-300 shadow-indigo-100/80 text-indigo-500', icon: <PlayCircle className="w-7 h-7" />, label: 'Подготвено',   labelColor: 'text-indigo-600' },
  locked:      { ring: '',                          bg: 'bg-slate-100 border-slate-200 text-slate-300 shadow-none', icon: <Lock className="w-6 h-6" />,           label: 'Заклучено',      labelColor: 'text-slate-400' },
};

export const LogicMap: React.FC<LogicMapProps> = ({ masteryRecords, nextQuizIds = {} }) => {
  const { curriculum, isLoading, allConcepts } = useCurriculum();
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const activeGrade = useMemo(() => {
    if (selectedGrade !== null) return selectedGrade;
    if (!masteryRecords.length) return 6;
    const gradeCounts = masteryRecords.reduce((acc, m) => {
      const gl = m.gradeLevel || 6;
      acc[gl] = (acc[gl] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    let max = 6, maxCount = 0;
    Object.entries(gradeCounts).forEach(([k, v]) => { if (v > maxCount) { maxCount = v; max = Number(k); } });
    return max;
  }, [masteryRecords, selectedGrade]);

  const masteryMap = useMemo(() => {
    const map: Record<string, ConceptMastery> = {};
    masteryRecords.forEach(m => { map[m.conceptId] = m; });
    return map;
  }, [masteryRecords]);

  const masteredIds = useMemo(() => new Set(masteryRecords.filter(m => m.mastered).map(m => m.conceptId)), [masteryRecords]);

  // Build a fast lookup: conceptId → concept (across ALL grades, for prereq checking)
  const conceptById = useMemo(() => {
    const map: Record<string, { title: string }> = {};
    allConcepts.forEach(c => { map[c.id] = { title: c.title }; });
    return map;
  }, [allConcepts]);

  const getConceptState = (concept: { id: string; priorKnowledgeIds?: string[] }): ConceptState => {
    const m = masteryMap[concept.id];
    if (m?.mastered) return 'mastered';
    if (m && m.attempts > 0) return 'in-progress';
    const prereqs = concept.priorKnowledgeIds || [];
    if (prereqs.length > 0 && !prereqs.every(pid => masteredIds.has(pid))) return 'locked';
    return 'unlocked';
  };

  const getLockedByNames = (concept: { priorKnowledgeIds?: string[] }): string => {
    const unmet = (concept.priorKnowledgeIds || []).filter(pid => !masteredIds.has(pid));
    return unmet.map(pid => conceptById[pid]?.title ?? pid).slice(0, 2).join(', ');
  };

  const handleNodeClick = (conceptId: string, state: ConceptState) => {
    if (state === 'locked') return;
    const quizId = nextQuizIds[conceptId];
    if (quizId) {
      window.location.hash = `/play/${quizId}`;
    }
  };

  // Winding offset pattern (snake path)
  const getIndentClass = (idx: number) => {
    const pattern = ['ml-0', 'ml-10', 'ml-20', 'ml-10', 'ml-0', '-ml-10', '-ml-20', '-ml-10'];
    return pattern[idx % pattern.length];
  };

  if (isLoading || !curriculum) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Вчитување патека...</div>;
  }

  const grades = curriculum.grades.sort((a, b) => a.level - b.level);
  const currentGradeData = grades.find(g => g.level === activeGrade);
  const allConceptsInGrade = currentGradeData?.topics.flatMap(t => t.concepts) ?? [];
  const masteredInGrade = allConceptsInGrade.filter(c => masteredIds.has(c.id)).length;
  const pct = allConceptsInGrade.length > 0 ? Math.round((masteredInGrade / allConceptsInGrade.length) * 100) : 0;

  return (
    <div className="bg-slate-50 p-4 md:p-6 rounded-3xl border border-slate-200 select-none">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-500" />
            Мојот пат
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Кликни на концепт за да започнеш квиз</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Progress pill */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-2 bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600">{masteredInGrade}/{allConceptsInGrade.length}</span>
          </div>
          {/* Grade selector */}
          <select
            value={activeGrade}
            onChange={e => setSelectedGrade(Number(e.target.value))}
            aria-label="Избери одделение"
            title="Избери одделение"
            className="bg-white border-2 border-indigo-100 rounded-xl px-3 py-1.5 font-bold text-indigo-700 text-sm outline-none focus:border-indigo-300"
          >
            {grades.map(g => <option key={g.id} value={g.level}>{g.level} Одд.</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6 px-1">
        {(Object.entries(STATE_STYLES) as [ConceptState, typeof STATE_STYLES[ConceptState]][]).map(([state, cfg]) => (
          <div key={state} className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={`w-3 h-3 rounded-full ${
              state === 'mastered' ? 'bg-amber-400' :
              state === 'in-progress' ? 'bg-blue-500' :
              state === 'unlocked' ? 'bg-indigo-200 border border-indigo-300' :
              'bg-slate-200'
            }`} />
            <span className={cfg.labelColor}>{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Winding Path */}
      <div className="max-w-sm mx-auto flex flex-col items-center relative">
        {currentGradeData?.topics.map((topic, tIdx) => (
          <div key={topic.id} className="w-full mb-12 relative">

            {/* Topic header */}
            <div className="bg-indigo-600 text-white rounded-2xl px-4 py-3 shadow-lg mb-8 text-center relative z-10">
              <h3 className="font-bold text-sm">{topic.title}</h3>
              <p className="text-indigo-200 text-xs mt-0.5">
                {topic.concepts.filter(c => masteredIds.has(c.id)).length}/{topic.concepts.length} совладани
              </p>
            </div>

            {/* Concepts */}
            <div className="flex flex-col items-center gap-5 relative">
              {topic.concepts.map((concept, cIdx) => {
                const state = getConceptState(concept as any);
                const cfg = STATE_STYLES[state];
                const mastery = masteryMap[concept.id];
                const isClickable = state !== 'locked' && !!nextQuizIds[concept.id];
                const isLast = cIdx === topic.concepts.length - 1 && tIdx === currentGradeData.topics.length - 1;

                return (
                  <div key={concept.id} className={`relative flex flex-col items-center ${getIndentClass(cIdx)}`}>
                    {/* Connector line to next */}
                    {!isLast && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-8 bg-indigo-100 rounded-full -z-10 mt-1" />
                    )}

                    {/* Node */}
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => handleNodeClick(concept.id, state)}
                      onMouseEnter={() => state === 'locked' ? setTooltip(concept.id) : null}
                      onMouseLeave={() => setTooltip(null)}
                      className={`
                        relative w-20 h-20 rounded-full border-b-4 flex items-center justify-center
                        shadow-xl text-white transition-all duration-200
                        ${cfg.bg}
                        ${isClickable ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-not-allowed'}
                      `}
                      aria-label={concept.title}
                    >
                      {cfg.icon}

                      {/* Score badge for in-progress */}
                      {state === 'in-progress' && mastery?.bestScore != null && (
                        <span className="absolute -top-1 -right-1 bg-white text-blue-600 text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-blue-400 shadow">
                          {mastery.bestScore}%
                        </span>
                      )}

                      {/* Checkmark for mastered */}
                      {state === 'mastered' && (
                        <span className="absolute -top-1 -right-1 bg-green-400 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}

                      {/* Locked tooltip */}
                      {state === 'locked' && tooltip === concept.id && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-semibold px-2 py-1.5 rounded-lg whitespace-nowrap shadow-xl z-30 pointer-events-none">
                          <AlertCircle className="w-3 h-3 inline mr-1 text-amber-400" />
                          Прво: {getLockedByNames(concept as any)}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      )}
                    </button>

                    {/* Label */}
                    <div className="mt-2 text-center max-w-[90px]">
                      <p className="text-xs font-bold text-slate-700 leading-tight line-clamp-2">{concept.title}</p>
                      {state !== 'locked' && !nextQuizIds[concept.id] && (
                        <p className="text-[10px] text-slate-400 mt-0.5">нема квиз</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Finish banner */}
        {allConceptsInGrade.length > 0 && masteredInGrade === allConceptsInGrade.length && (
          <div className="mt-4 bg-amber-400 text-amber-900 rounded-2xl px-6 py-4 text-center shadow-lg">
            <Trophy className="w-8 h-8 mx-auto mb-1 fill-current" />
            <p className="font-black text-sm">Совладано одделение {activeGrade}! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
};
