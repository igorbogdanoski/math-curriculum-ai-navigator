import React, { useMemo } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import type { Concept } from '../../types';

interface PriorKnowledgeConnectorProps {
  conceptIds: string[];
  currentGrade: number;
}

interface LocatedConcept {
  concept: Concept;
  grade: number;
  gradeLevel: number;
  topicTitle: string;
}

export const PriorKnowledgeConnector: React.FC<PriorKnowledgeConnectorProps> = ({
  conceptIds,
  currentGrade,
}) => {
  const { curriculum } = useCurriculum();

  // Build flat map: conceptId → { concept, gradeLevel, topicTitle }
  const conceptMap = useMemo(() => {
    const map = new Map<string, LocatedConcept>();
    if (!curriculum) return map;
    for (const grade of curriculum.grades) {
      for (const topic of grade.topics) {
        for (const concept of topic.concepts) {
          map.set(concept.id, {
            concept,
            grade: grade.level,
            gradeLevel: grade.level,
            topicTitle: topic.title,
          });
        }
      }
    }
    return map;
  }, [curriculum]);

  // Selected concepts for this lesson
  const selectedConcepts = useMemo(
    () => conceptIds.map(id => conceptMap.get(id)).filter(Boolean) as LocatedConcept[],
    [conceptIds, conceptMap]
  );

  // Collect all unique priorKnowledgeIds from selected concepts
  const priorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const loc of selectedConcepts) {
      for (const pid of loc.concept.priorKnowledgeIds ?? []) ids.add(pid);
    }
    return [...ids];
  }, [selectedConcepts]);

  // Locate the prior concepts
  const priorConcepts = useMemo(
    () => priorIds.map(id => conceptMap.get(id)).filter(Boolean) as LocatedConcept[],
    [priorIds, conceptMap]
  );

  // Group prior concepts by grade
  const byGrade = useMemo(() => {
    const map = new Map<number, LocatedConcept[]>();
    for (const loc of priorConcepts) {
      if (!map.has(loc.gradeLevel)) map.set(loc.gradeLevel, []);
      map.get(loc.gradeLevel)!.push(loc);
    }
    return [...map.entries()].sort(([a], [b]) => b - a);
  }, [priorConcepts]);

  if (!curriculum || conceptIds.length === 0) return null;

  if (priorConcepts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
          <span className="text-base">🧩</span> Претходни знаења
        </h3>
        <p className="text-xs text-gray-400 italic">
          {conceptIds.length > 0
            ? 'Нема дефинирани претходни знаења за избраните поими.'
            : 'Избери поими за да ги видиш претходните знаења.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <span className="text-base">🧩</span>
        Претходни знаења
        <span className="ml-auto text-[10px] font-normal text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full bg-gray-50">
          {priorConcepts.length} поими
        </span>
      </h3>
      <p className="text-[10px] text-gray-400">
        Поими кои учениците треба да ги совладале пред овој час — провери дали треба повторување.
      </p>

      <div className="space-y-2">
        {byGrade.map(([gradeLevel, concepts]) => {
          const isCurrentGrade = gradeLevel === currentGrade;
          const isPrevGrade = gradeLevel < currentGrade;
          return (
            <div key={gradeLevel} className={`rounded-lg border p-2 ${
              isCurrentGrade
                ? 'border-amber-200 bg-amber-50/50'
                : isPrevGrade
                  ? 'border-blue-100 bg-blue-50/30'
                  : 'border-gray-100 bg-gray-50/30'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCurrentGrade
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {gradeLevel}. одд.
                </span>
                {!isCurrentGrade && (
                  <span className="text-[9px] text-gray-400">← претходна градба</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {concepts.map(loc => (
                  <span
                    key={loc.concept.id}
                    title={`${loc.topicTitle} — ${loc.concept.description}`}
                    className="inline-flex items-center gap-1 text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-md cursor-default"
                  >
                    {loc.concept.title}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-1 border-t border-gray-100">
        <p className="text-[10px] text-indigo-600 font-medium">
          💡 Препорака: Во фазата Вовед (10 мин) посвети 2-3 мин на брзо повторување на претходните знаења.
        </p>
      </div>
    </div>
  );
};
