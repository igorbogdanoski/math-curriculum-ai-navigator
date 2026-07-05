import React from 'react';
import { Loader2, ShieldCheck, Globe, Lock, BadgeCheck } from 'lucide-react';
import { useScenarioBankAdmin } from '../../hooks/useScenarioBankAdmin';

/** Admin-only all-entries table for ScenarioBankView's "admin" tab. */
export const ScenarioBankAdminPanel: React.FC = () => {
  const { entries, hasMore, loading, loadMore, refresh } = useScenarioBankAdmin();

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-rose-600" />
          <h2 className="text-base font-black text-gray-800">
            Администраторски преглед — сите сценарија
          </h2>
          <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
            {entries.length}{hasMore ? '+' : ''} вкупно
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↻'} Освежи
        </button>
      </div>

      {/* Column breakdown */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xl font-black text-emerald-600">
              {entries.filter(e => e.isPublic).length}
            </p>
            <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1 mt-0.5">
              <Globe className="w-3 h-3" /> Јавни
            </p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xl font-black text-amber-600">
              {entries.filter(e => !e.isPublic).length}
            </p>
            <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1 mt-0.5">
              <Lock className="w-3 h-3" /> Приватни нацрти
            </p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xl font-black text-indigo-600">
              {entries.filter(e => e.verifiedByBRO).length}
            </p>
            <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1 mt-0.5">
              <BadgeCheck className="w-3 h-3" /> БРО Верифиц.
            </p>
          </div>
        </div>
      )}

      {loading && entries.length === 0 && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      )}

      {/* Admin table */}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600">Наслов</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600">Автор</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600">Одд.</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600">Тема</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600">Статус</th>
                <th className="text-right px-3 py-2.5 font-bold text-gray-600">Употреби</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <td className="px-3 py-2 max-w-[220px]">
                    <p className="font-semibold text-gray-800 truncate">{entry.title}</p>
                    {entry.forkDepth > 0 && (
                      <span className="text-[10px] text-indigo-500">
                        ↳ Ремикс (ниво {entry.forkDepth}){entry.originalAuthorName ? ` — оригинално од: ${entry.originalAuthorName}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-700 truncate max-w-[140px]">{entry.authorName}</p>
                    {entry.schoolName && <p className="text-gray-400 truncate max-w-[140px]">{entry.schoolName}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                      {entry.grade}. одд.
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[160px]">
                    <span className="truncate text-gray-600 block">{entry.topicTitle}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {entry.isPublic
                        ? <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold"><Globe className="w-2.5 h-2.5" /> Јавно</span>
                        : <span className="flex items-center gap-0.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold"><Lock className="w-2.5 h-2.5" /> Нацрт</span>
                      }
                      {entry.verifiedByBRO && <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold">БРО</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">
                    {entry.usageCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Вчитај уште 30 →
          </button>
        </div>
      )}
    </div>
  );
};
