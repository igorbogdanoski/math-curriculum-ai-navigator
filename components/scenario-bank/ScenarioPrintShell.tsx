import React, { forwardRef } from 'react';
import { PrintShell } from '../common/PrintShell';
import type { ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';

interface ScenarioPrintShellProps {
  entry: ScenarioBankEntry | null;
}

/** Hidden print layout for a single scenario, populated when a card's print action fires. */
export const ScenarioPrintShell = forwardRef<HTMLDivElement, ScenarioPrintShellProps>(({ entry }, ref) => (
  <div className="absolute -left-[9999px] top-0">
    <PrintShell
      ref={ref}
      title={entry?.title ?? 'Сценарио за час'}
      subtitle={entry ? `${entry.grade}. одд. · ${entry.topicTitle ?? ''}` : ''}
      teacherName={entry?.authorName ?? ''}
      grade={entry?.grade}
      subject="Математика"
    >
      {entry && (
        <div className="space-y-4 text-sm">
          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-[10pt] border-b border-gray-300 pb-3">
            {entry.teachingModel && <span><strong>Модел:</strong> {entry.teachingModel}</span>}
            {entry.bloomLevels?.length ? <span><strong>Bloom:</strong> {entry.bloomLevels.join(', ')}</span> : null}
            {entry.dokLevel && <span><strong>DoK:</strong> {entry.dokLevel}</span>}
            {entry.authorName && <span><strong>Автор:</strong> {entry.authorName}</span>}
          </div>
          {/* Scenario phases */}
          {entry.objectives.length > 0 && (
            <div>
              <p className="font-bold text-[10pt] mb-1">Цели на часот</p>
              <ul className="list-disc list-inside space-y-0.5">
                {entry.objectives.map((o, i) => <li key={i} className="text-[10pt]">{o}</li>)}
              </ul>
            </div>
          )}
          <div>
            <p className="font-bold text-[10pt] mb-1">Воведна активност</p>
            <p className="text-[10pt]">{entry.scenarioIntro}</p>
          </div>
          {entry.scenarioMain.length > 0 && (
            <div>
              <p className="font-bold text-[10pt] mb-1">Главни активности</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {entry.scenarioMain.map((m, i) => <li key={i} className="text-[10pt]">{m}</li>)}
              </ol>
            </div>
          )}
          <div>
            <p className="font-bold text-[10pt] mb-1">Завршна активност</p>
            <p className="text-[10pt]">{entry.scenarioConcluding}</p>
          </div>
          {entry.assessmentStandards.length > 0 && (
            <div>
              <p className="font-bold text-[10pt] mb-1">БРО Стандарди</p>
              <p className="text-[10pt]">{entry.assessmentStandards.join(' · ')}</p>
            </div>
          )}
          {/* Signature */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-[9pt]">
            <div>
              <div className="border-b border-black w-48 mb-1" />
              <span>Наставник/-чка: {entry.authorName || '_________________'}</span>
            </div>
            <div>
              <div className="border-b border-black w-48 mb-1" />
              <span>Директор/-ка · Потпис и Печат</span>
            </div>
          </div>
        </div>
      )}
    </PrintShell>
  </div>
));
ScenarioPrintShell.displayName = 'ScenarioPrintShell';
