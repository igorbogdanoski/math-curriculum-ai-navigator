import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-react';
import type { ConceptStat } from './shared';
import type { Concept } from '../../types';
import { GradeBadge } from '../../components/common/GradeBadge';

interface QuizCoverageTabProps {
  allConceptStats: ConceptStat[];
  allConcepts: Concept[];
  onGenerateRemedial: (conceptId: string, title: string, avgPct: number) => void;
}

export const QuizCoverageTab: React.FC<QuizCoverageTabProps> = ({
  allConceptStats,
  allConcepts,
  onGenerateRemedial,
}) => {
  const [filterGrade, setFilterGrade] = useState<string>('');

  // All unique grade levels across all concepts
  const allGrades = useMemo(() => {
    const grades = new Set(
      allConcepts
        .map(c => (c as any).gradeLevel as number | undefined)
        .filter(Boolean)
    );
    return Array.from(grades as Set<number>).sort((a, b) => a - b);
  }, [allConcepts]);

  const quizzedIds = useMemo(
    () => new Set(allConceptStats.map(c => c.conceptId)),
    [allConceptStats]
  );

  const { neverQuizzed, weakQuizzed, goodQuizzed } = useMemo(() => {
    const gradeFilter = filterGrade ? Number(filterGrade) : null;

    const never = allConcepts.filter(c => {
      if (quizzedIds.has(c.id)) return false;
      if (gradeFilter !== null && (c as any).gradeLevel !== gradeFilter) return false;
      return true;
    });

    const weak = allConceptStats.filter(c => {
      if (c.avgPct >= 60) return false;
      if (gradeFilter !== null) {
        const concept = allConcepts.find(ac => ac.id === c.conceptId);
        if (!concept || (concept as any).gradeLevel !== gradeFilter) return false;
      }
      return true;
    });

    const good = allConceptStats.filter(c => {
      if (c.avgPct < 60) return false;
      if (gradeFilter !== null) {
        const concept = allConcepts.find(ac => ac.id === c.conceptId);
        if (!concept || (concept as any).gradeLevel !== gradeFilter) return false;
      }
      return true;
    });

    return { neverQuizzed: never, weakQuizzed: weak, goodQuizzed: good };
  }, [allConceptStats, allConcepts, quizzedIds, filterGrade]);

  const getConcept = (conceptId: string) =>
    allConcepts.find(c => c.id === conceptId);

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📊 Покриеност на концепти</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Кои концепти биле quiz-ирани, кои се слаби, а кои никогаш.
          </p>
        </div>
        <select
          value={filterGrade}
          onChange={e => setFilterGrade(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Сите одделенија</option>
          {allGrades.map(g => (
            <option key={g} value={String(g)}>{g}. одделение</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm font-medium text-red-700">
          <XCircle className="w-4 h-4" />
          {neverQuizzed.length} никогаш не quiz-ирани
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm font-medium text-amber-700">
          <AlertTriangle className="w-4 h-4" />
          {weakQuizzed.length} слаби (avg &lt;60%)
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-sm font-medium text-green-700">
          <CheckCircle className="w-4 h-4" />
          {goodQuizzed.length} добро покриени
        </div>
      </div>

      {/* Section: Never quizzed */}
      {neverQuizzed.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-red-700 mb-3">
            <XCircle className="w-5 h-5" />
            Никогаш не quiz-ирани ({neverQuizzed.length})
          </h3>
          <div className="space-y-2">
            {neverQuizzed.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate">{c.title}</span>
                  {(c as any).gradeLevel && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 flex-shrink-0">
                      {(c as any).gradeLevel}. одд.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onGenerateRemedial(c.id, c.title, 0)}
                  className="flex items-center gap-1.5 ml-3 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition flex-shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Генерирај квиз
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section: Weak quizzed */}
      {weakQuizzed.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-700 mb-3">
            <AlertTriangle className="w-5 h-5" />
            Quiz-ирани но слаби, avg &lt;60% ({weakQuizzed.length})
          </h3>
          <div className="space-y-2">
            {weakQuizzed.map(c => {
              const concept = getConcept(c.conceptId);
              return (
                <div key={c.conceptId} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{c.title}</span>
                    {concept && (concept as any).gradeLevel && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 flex-shrink-0">
                        {(concept as any).gradeLevel}. одд.
                      </span>
                    )}
                    <span className="text-xs font-bold text-amber-700 flex-shrink-0">avg {c.avgPct}%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onGenerateRemedial(c.conceptId, c.title, c.avgPct)}
                    className="flex items-center gap-1.5 ml-3 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition flex-shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Ремедијал
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section: Good coverage */}
      {goodQuizzed.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-green-700 mb-3">
            <CheckCircle className="w-5 h-5" />
            Добро покриени, avg ≥60% ({goodQuizzed.length})
          </h3>
          <div className="space-y-2">
            {goodQuizzed.map(c => {
              const concept = getConcept(c.conceptId);
              return (
                <div key={c.conceptId} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{c.title}</span>
                    {concept && (concept as any).gradeLevel && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 flex-shrink-0">
                        {(concept as any).gradeLevel}. одд.
                      </span>
                    )}
                    <span className="text-xs font-bold text-green-700 flex-shrink-0">avg {c.avgPct}%</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{c.attempts} обиди</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {neverQuizzed.length === 0 && weakQuizzed.length === 0 && goodQuizzed.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          Нема доволно податоци. Поттикнете ги учениците да решат квизови.
        </div>
      )}
    </div>
  );
};
