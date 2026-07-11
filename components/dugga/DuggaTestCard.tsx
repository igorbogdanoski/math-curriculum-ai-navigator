import React from 'react';
import {
  Globe, Lock, Copy, Trash2, BarChart2,
  Clock, BookOpen, Award,
  ClipboardList, Pencil, GitFork, Send,
} from 'lucide-react';
import type { DuggaTest } from '../../services/firestoreService.dugga';
import { TEST_TYPE_LABELS, DOK_COLORS } from './duggaLibraryConstants';

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      {icon}
      <span className="font-medium text-gray-700">{value}</span>
      <span>{label}</span>
    </div>
  );
}

export function DuggaTestCard({
  test, isOwner, onDelete, onTogglePublic, onViewResults, onCopyCode, onPlay, onEdit, onAdapt, onAssign,
}: {
  test: DuggaTest;
  isOwner: boolean;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
  onViewResults: (test: DuggaTest) => void;
  onCopyCode: (code: string) => void;
  onPlay: () => void;
  onEdit: (id: string) => void;
  onAdapt: (id: string) => void;
  onAssign?: () => void;
}) {
  const dokDist = test.questions.reduce<Record<number, number>>((acc, q) => {
    if (q.type !== 'section_header') acc[q.dok] = (acc[q.dok] ?? 0) + 1;
    return acc;
  }, {});

  const questionCount = test.questions.filter(q => q.type !== 'section_header').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
              {TEST_TYPE_LABELS[test.testType] ?? test.testType}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {test.grade}. разред
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${test.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {test.isPublic ? <><Globe className="w-3 h-3" />Јавен</> : <><Lock className="w-3 h-3" />Приватен</>}
            </span>
          </div>
          <h3 className="font-bold text-gray-900 text-base leading-snug">{test.title}</h3>
          {test.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{test.description}</p>
          )}
          {test.adaptedFromId && (
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
              <GitFork className="w-2.5 h-2.5" />
              Адаптирано од: <span className="font-medium">{test.originalAuthorName ?? 'непознат'}</span>
              {test.adaptedFromTitle && ` — „${test.adaptedFromTitle}"`}
            </p>
          )}
        </div>
        {/* Share code */}
        <button type="button" onClick={() => onCopyCode(test.shareCode)}
          className="shrink-0 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors group"
          title="Копирај код">
          <div className="text-center">
            <div className="font-mono font-black text-indigo-700 text-sm tracking-widest">{test.shareCode}</div>
            <div className="text-[10px] text-indigo-500 group-hover:text-indigo-700 flex items-center gap-0.5 justify-center">
              <Copy className="w-2.5 h-2.5" />копирај
            </div>
          </div>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4">
        <StatPill icon={<ClipboardList className="w-3.5 h-3.5" />} label="прашања" value={questionCount} />
        <StatPill icon={<Award className="w-3.5 h-3.5" />} label="поени" value={test.totalPoints} />
        <StatPill icon={<Clock className="w-3.5 h-3.5" />} label="мин" value={test.estimatedMinutes} />
        {test.topics.length > 0 && (
          <div className="text-xs text-gray-500 flex-1 min-w-0">
            <span className="font-medium text-gray-600">Теми: </span>
            <span className="truncate">{test.topics.join(', ')}</span>
          </div>
        )}
      </div>

      {/* DoK distribution */}
      {Object.keys(dokDist).length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {([1, 2, 3, 4] as const).map(d => dokDist[d] ? (
            <span key={d} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOK_COLORS[d]}`}>
              DoK{d}: {dokDist[d]}
            </span>
          ) : null)}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
        <button type="button" onClick={onPlay}
          className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          Играј
        </button>
        <button type="button" onClick={() => onViewResults(test)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors">
          <BarChart2 className="w-3.5 h-3.5" />
          Резултати
        </button>
        {isOwner ? (
          <>
            {onAssign && (
              <button type="button" onClick={onAssign}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                title="Задај на класа">
                <Send className="w-3.5 h-3.5" />
                Задај
              </button>
            )}
            <button type="button" onClick={() => onEdit(test.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
              title="Уреди тест">
              <Pencil className="w-3.5 h-3.5" />
              Уреди
            </button>
            <button type="button" onClick={() => onTogglePublic(test.id, !test.isPublic)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
              title={test.isPublic ? 'Направи приватен' : 'Сподели јавно'}>
              {test.isPublic ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={() => onDelete(test.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onAdapt(test.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
            title="Клонирај и адаптирај за твоите ученици">
            <GitFork className="w-3.5 h-3.5" />
            Адаптирај
          </button>
        )}
      </div>
    </div>
  );
}
