import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { LessonPlan } from '../../types';

interface Props {
  existingDraft: Partial<LessonPlan>;
  uploadedPlan: Partial<LessonPlan>;
  fileName: string;
  /** Use uploaded plan, discard current draft */
  onReplace: () => void;
  /** Fill only empty fields in draft from the uploaded plan */
  onMerge: () => void;
  /** Cancel — keep existing draft, discard upload */
  onKeepDraft: () => void;
}

export const DraftMergeDialog: React.FC<Props> = ({
  existingDraft,
  uploadedPlan,
  fileName,
  onReplace,
  onMerge,
  onKeepDraft,
}) => {
  const draftTitle = existingDraft.title?.trim() || 'Без наслов';
  const draftObjective = existingDraft.objectives?.[0]?.text ?? '—';
  const uploadedTitle = uploadedPlan.title?.trim() || 'Без наслов';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="text-lg font-black text-gray-900">
              Постои незачуван нацрт
            </h2>
          </div>
          <button
            type="button"
            onClick={onKeepDraft}
            title="Затвори"
            aria-label="Затвори"
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body — 2-column comparison */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Избери дали да го задржиш постоечкиот нацрт, да ги споиш двете или да го замениш со прикаченото сценарио.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Left — existing draft (amber) */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                Твој незачуван нацрт
              </p>
              <p className="text-sm font-bold text-gray-800 truncate" title={draftTitle}>
                {draftTitle}
              </p>
              <p className="text-xs text-gray-600 line-clamp-3">
                {draftObjective}
              </p>
            </div>

            {/* Right — uploaded plan (indigo) */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                Прикачено сценарио
              </p>
              <p className="text-sm font-bold text-gray-800 truncate" title={uploadedTitle}>
                {uploadedTitle}
              </p>
              <p className="text-xs text-gray-500 truncate" title={fileName}>
                {fileName}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {/* Keep draft */}
            <button
              type="button"
              onClick={onKeepDraft}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Задржи го нацртот
            </button>

            {/* Merge */}
            <button
              type="button"
              onClick={onMerge}
              title="Прикаченото ги пополнува само полињата кои се празни во твојот нацрт"
              className="flex-1 py-2.5 rounded-xl border border-blue-300 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              Спои — пополни празните полиња
            </button>

            {/* Replace */}
            <button
              type="button"
              onClick={onReplace}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors"
            >
              Замени со прикаченото
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
