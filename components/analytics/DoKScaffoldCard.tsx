/**
 * DoKScaffoldCard — Adaptive DoK Scaffolding recommendations (S15 backlog).
 *
 * Rule: if ConceptMastery.lastScore < 60 → suggest DoK 1-2 question generation
 * for that concept. No IRT — purely rule-based threshold.
 */
import React, { useMemo } from 'react';
import { Layers, ChevronRight, BrainCircuit } from 'lucide-react';
import type { ConceptMastery } from '../../services/firestoreService.types';
import type { GeneratorPanelProps } from '../../contexts/GeneratorPanelContext';

const SCORE_THRESHOLD = 60; // below this → scaffolding recommended

interface ScaffoldGroup {
  conceptId: string;
  conceptTitle: string;
  studentCount: number;
  avgScore: number;
  students: string[];
}

function buildScaffoldGroups(masteryRecords: ConceptMastery[]): ScaffoldGroup[] {
  const weak = masteryRecords.filter(m => m.lastScore < SCORE_THRESHOLD);
  const byConceptId = new Map<string, ConceptMastery[]>();
  for (const m of weak) {
    const list = byConceptId.get(m.conceptId) ?? [];
    list.push(m);
    byConceptId.set(m.conceptId, list);
  }
  return Array.from(byConceptId.entries())
    .map(([conceptId, records]) => ({
      conceptId,
      conceptTitle: records[0].conceptTitle ?? conceptId,
      studentCount: records.length,
      avgScore: Math.round(records.reduce((s, r) => s + r.lastScore, 0) / records.length),
      students: records.map(r => r.studentName).filter(Boolean).slice(0, 3),
    }))
    .sort((a, b) => a.avgScore - b.avgScore) // worst first
    .slice(0, 6); // cap at 6 concepts
}

interface DoKScaffoldCardProps {
  masteryRecords: ConceptMastery[];
  onOpenGenerator: (props: GeneratorPanelProps) => void;
  getConceptDetails: (id: string) => { grade?: { id: string }; topic?: { id: string } };
}

export const DoKScaffoldCard: React.FC<DoKScaffoldCardProps> = ({
  masteryRecords,
  onOpenGenerator,
  getConceptDetails,
}) => {
  const groups = useMemo(() => buildScaffoldGroups(masteryRecords), [masteryRecords]);

  if (groups.length === 0) return null;

  const openScaffold = (group: ScaffoldGroup, dokTarget: 1 | 2) => {
    const { grade, topic } = getConceptDetails(group.conceptId);
    onOpenGenerator({
      selectedGrade: grade?.id ?? '',
      selectedTopic: topic?.id ?? '',
      selectedConcepts: [group.conceptId],
      contextType: 'CONCEPT',
      materialType: 'ASSESSMENT',
      dokTarget,
      customInstruction: `Адаптивна поддршка: овие ученици постигнале просечно ${group.avgScore}% на претходниот квиз. Генерирај DoK ${dokTarget} прашања (${dokTarget === 1 ? 'ниво Recall — директни процедури, едноставно применување' : 'ниво Skills/Concepts — примена на концепти, интерпретација'}) за да ги поддржиш во разбирањето на ${group.conceptTitle}.`,
    });
  };

  return (
    <div className="mb-8 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <BrainCircuit className="w-5 h-5 text-violet-600 flex-shrink-0" />
        <h2 className="text-sm font-bold text-violet-800 uppercase tracking-widest">
          Адаптивна DoK поддршка
        </h2>
        <span className="ml-auto text-xs text-violet-500 font-semibold">
          {groups.length} концепт{groups.length !== 1 ? 'и' : ''}
        </span>
      </div>
      <p className="text-xs text-violet-600 mb-4">
        Концепти каде ученици постигнале под {SCORE_THRESHOLD}% — препорачано генерирање DoK 1-2 прашања за полесно совладување.
      </p>

      <div className="space-y-2.5">
        {groups.map(group => (
          <div
            key={group.conceptId}
            className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-violet-100 flex-wrap"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{group.conceptTitle}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-bold ${group.avgScore < 40 ? 'text-red-500' : 'text-amber-500'}`}>
                  ⌀ {group.avgScore}%
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">
                  {group.studentCount} уч{group.studentCount !== 1 ? '.' : '.'}
                  {group.students.length > 0 && ` (${group.students.join(', ')}${group.studentCount > 3 ? '…' : ''})`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => openScaffold(group, 1)}
                className="flex items-center gap-1 text-xs font-bold bg-violet-100 text-violet-700 px-2.5 py-1.5 rounded-lg hover:bg-violet-200 transition border border-violet-200"
              >
                <Layers className="w-3 h-3" />
                DoK 1
              </button>
              <button
                type="button"
                onClick={() => openScaffold(group, 2)}
                className="flex items-center gap-1 text-xs font-bold bg-purple-100 text-purple-700 px-2.5 py-1.5 rounded-lg hover:bg-purple-200 transition border border-purple-200"
              >
                <Layers className="w-3 h-3" />
                DoK 2
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-0.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
