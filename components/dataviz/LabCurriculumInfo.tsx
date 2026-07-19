/**
 * Wave 9.2 (audit_2026_07_18_full_app_review, 2026-07-19 post-closure review) — compact
 * "connected to the curriculum" strip shown at the top of each lab tab in DataVizStudioView.
 * Renders nothing if the lab has no entry in labCurriculumMap.ts (fail-safe, not an error).
 */
import React from 'react';
import { getLabCurriculumEntry, type LabId } from '../../data/labCurriculumMap';
import { MATH_STANDARDS } from '../../data/allNationalStandardsComplete';

interface Props {
  labId: LabId;
}

export const LabCurriculumInfo: React.FC<Props> = ({ labId }) => {
  const entry = getLabCurriculumEntry(labId);
  if (!entry || (!entry.primaryStandards?.length && !entry.secondaryTopics?.length)) return null;

  const standardDescriptions = (entry.primaryStandards ?? [])
    .map(code => MATH_STANDARDS.find(s => s.code === code))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
        📎 Поврзано со наставната програма
      </p>
      <div className="flex flex-wrap gap-1.5">
        {standardDescriptions.map(s => (
          <span
            key={s.code}
            title={s.description}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-full px-2 py-0.5"
          >
            {s.code}
          </span>
        ))}
        {entry.secondaryTopics?.map(topic => (
          <span
            key={topic}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-full px-2 py-0.5"
          >
            {topic} (средно)
          </span>
        ))}
      </div>
    </div>
  );
};
