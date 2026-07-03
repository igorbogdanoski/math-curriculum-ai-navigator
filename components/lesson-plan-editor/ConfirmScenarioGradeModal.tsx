import React, { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { Curriculum, SecondaryTrack } from '../../types';
import { SECONDARY_TRACK_LABELS } from '../../types';

interface Props {
  curriculum: Curriculum;
  /** Grade the AI extracted from the uploaded text, if any — pre-fills the dropdown but is never applied silently. */
  initialGrade?: number;
  initialTrack?: SecondaryTrack;
  /** Teacher's profile-level default track, suggested only when the uploaded scenario didn't specify one. */
  profileDefaultTrack?: SecondaryTrack;
  onConfirm: (grade: number, secondaryTrack?: SecondaryTrack) => void;
  onCancel: () => void;
}

const TRACK_OPTIONS = Object.keys(SECONDARY_TRACK_LABELS) as SecondaryTrack[];

export const ConfirmScenarioGradeModal: React.FC<Props> = ({
  curriculum,
  initialGrade,
  initialTrack,
  profileDefaultTrack,
  onConfirm,
  onCancel,
}) => {
  const gradeLevels = useMemo(
    () => [...new Set(curriculum.grades.map(g => g.level))].sort((a, b) => a - b),
    [curriculum.grades],
  );

  const [grade, setGrade] = useState<number>(
    initialGrade && gradeLevels.includes(initialGrade) ? initialGrade : (gradeLevels[0] ?? 6)
  );
  const [track, setTrack] = useState<SecondaryTrack | ''>(
    initialTrack ?? (grade > 9 ? (profileDefaultTrack ?? '') : '')
  );

  const isSecondary = grade > 9;
  const canConfirm = !isSecondary || track !== '';

  const handleGradeChange = (next: number) => {
    setGrade(next);
    if (next > 9 && track === '') setTrack(profileDefaultTrack ?? '');
    if (next <= 9) setTrack('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 p-5 border-b">
          <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0" />
          <h2 className="text-lg font-black text-gray-900">За кое одделение е ова сценарио?</h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            {initialGrade
              ? 'АИ препозна одделение од текстот — провери и потврди пред да продолжиш.'
              : 'АИ не можеше сигурно да го препознае одделението од прикачениот документ — избери го рачно.'}
          </p>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Одделение</span>
            <select
              value={grade}
              onChange={e => handleGradeChange(Number(e.target.value))}
              className="mt-1 w-full border-2 border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:border-indigo-400 focus:outline-none"
            >
              {gradeLevels.map(level => (
                <option key={level} value={level}>{level}. одделение</option>
              ))}
            </select>
          </label>

          {isSecondary && (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Образовен профил</span>
              <select
                value={track}
                onChange={e => setTrack(e.target.value as SecondaryTrack)}
                className="mt-1 w-full border-2 border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:border-indigo-400 focus:outline-none"
              >
                <option value="">— избери профил —</option>
                {TRACK_OPTIONS.map(t => (
                  <option key={t} value={t}>{SECONDARY_TRACK_LABELS[t]}</option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-gray-400">
                Потребно за X–XIII одделение — гимназиско и стручно имаат различни стандарди и наставни програми.
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Откажи
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(grade, track || undefined)}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Потврди и продолжи
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
