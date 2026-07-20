import React, { forwardRef } from 'react';
import { PrintShell } from '../common/PrintShell';
import type { ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import { useLanguage } from '../../i18n/LanguageContext';

interface ScenarioPrintShellProps {
  entry: ScenarioBankEntry | null;
}

/** Hidden print layout for a single scenario, populated when a card's print action fires. */
export const ScenarioPrintShell = forwardRef<HTMLDivElement, ScenarioPrintShellProps>(({ entry }, ref) => {
  const { t } = useLanguage();
  return (
  <div className="absolute -left-[9999px] top-0">
    <PrintShell
      ref={ref}
      title={entry?.title ?? t('scenarioBank.print.defaultTitle')}
      subtitle={entry ? `${entry.grade}. ${t('scenarioBank.print.gradeSuffix')} · ${entry.topicTitle ?? ''}` : ''}
      teacherName={entry?.authorName ?? ''}
      grade={entry?.grade}
      subject={t('scenarioBank.print.subject')}
    >
      {entry && (
        <div className="space-y-4 text-sm">
          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-[10pt] border-b border-gray-300 pb-3">
            {entry.teachingModel && <span><strong>{t('scenarioBank.print.model')}</strong> {entry.teachingModel}</span>}
            {entry.bloomLevels?.length ? <span><strong>Bloom:</strong> {entry.bloomLevels.join(', ')}</span> : null}
            {entry.dokLevel && <span><strong>DoK:</strong> {entry.dokLevel}</span>}
            {entry.authorName && <span><strong>{t('scenarioBank.print.author')}</strong> {entry.authorName}</span>}
          </div>
          {/* Scenario phases */}
          {entry.objectives.length > 0 && (
            <div>
              <p className="font-bold text-[10pt] mb-1">{t('scenarioBank.print.objectives')}</p>
              <ul className="list-disc list-inside space-y-0.5">
                {entry.objectives.map((o, i) => <li key={i} className="text-[10pt]">{o}</li>)}
              </ul>
            </div>
          )}
          <div>
            <p className="font-bold text-[10pt] mb-1">{t('scenarioBank.print.introActivity')}</p>
            <p className="text-[10pt]">{entry.scenarioIntro}</p>
          </div>
          {entry.scenarioMain.length > 0 && (
            <div>
              <p className="font-bold text-[10pt] mb-1">{t('scenarioBank.print.mainActivities')}</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {entry.scenarioMain.map((m, i) => <li key={i} className="text-[10pt]">{m}</li>)}
              </ol>
            </div>
          )}
          <div>
            <p className="font-bold text-[10pt] mb-1">{t('scenarioBank.print.concludingActivity')}</p>
            <p className="text-[10pt]">{entry.scenarioConcluding}</p>
          </div>
          {entry.assessmentStandards.length > 0 && (
            <div>
              <p className="font-bold text-[10pt] mb-1">{t('scenarioBank.print.broStandards')}</p>
              <p className="text-[10pt]">{entry.assessmentStandards.join(' · ')}</p>
            </div>
          )}
          {/* Signature */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-[9pt]">
            <div>
              <div className="border-b border-black w-48 mb-1" />
              <span>{t('scenarioBank.print.teacherLabel')} {entry.authorName || '_________________'}</span>
            </div>
            <div>
              <div className="border-b border-black w-48 mb-1" />
              <span>{t('scenarioBank.print.principalSignature')}</span>
            </div>
          </div>
        </div>
      )}
    </PrintShell>
  </div>
  );
});
ScenarioPrintShell.displayName = 'ScenarioPrintShell';
