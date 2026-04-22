import React from 'react';
import { X } from 'lucide-react';
import type { CachedMaterial } from '../../services/firestoreService';
import type { AIGeneratedAssessment } from '../../types';
import { typeLabel } from './contentLibraryHelpers';

const GeneratedAssessment = React.lazy(() =>
  import('../../components/ai/GeneratedAssessment').then(m => ({ default: m.GeneratedAssessment }))
);

// Generic renderer for non-assessment types (rubric, ideas, outline, etc.)
const GenericContentRenderer: React.FC<{ content: any; type: string }> = ({ content, type }) => {
  if (type === 'rubric') {
    const criteria: any[] = content?.criteria ?? content?.rubric ?? [];
    if (criteria.length > 0) {
      return (
        <div className="space-y-4">
          {criteria.map((c: any, i: number) => (
            <div key={i} className="border rounded-xl p-4">
              <p className="font-semibold text-gray-800 mb-2">{c.criterion ?? c.name ?? `Критериум ${i + 1}`}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(c.levels ?? []).map((l: any, j: number) => (
                  <div key={j} className="bg-gray-50 rounded-lg p-2 text-xs">
                    <p className="font-bold text-gray-700 mb-1">{l.level ?? l.name}</p>
                    <p className="text-gray-500">{l.description}</p>
                    {l.points != null && <p className="mt-1 font-semibold text-indigo-600">{l.points} поени</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  if (type === 'ideas') {
        const extractionBundle = content?.extractionBundle;
        const sourceMeta = content?.sourceMeta;
    const sections: [string, any][] = Object.entries(content ?? {}).filter(([k, v]) => v && k !== 'extractionBundle' && k !== 'sourceMeta');
    return (
      <div className="space-y-4">
                {sourceMeta && (
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800">
                        <p className="font-bold mb-1">Извор на екстракција</p>
                        <p>
                            Тип: {sourceMeta?.sourceType ?? '—'}
                            {sourceMeta?.gradeLevel ? ` · Одделение: ${sourceMeta.gradeLevel}` : ''}
                            {sourceMeta?.topicId ? ` · Тема: ${sourceMeta.topicId}` : ''}
                        </p>
                        {Array.isArray(sourceMeta?.sourceUrls) && sourceMeta.sourceUrls.length > 0 && (
                            <p className="mt-1">Batch извори: {sourceMeta.sourceUrls.length}</p>
                        )}
                        {Array.isArray(sourceMeta?.conceptIds) && sourceMeta.conceptIds.length > 0 && (
                            <p className="mt-1">Концепти: {sourceMeta.conceptIds.join(', ')}</p>
                        )}
                        {sourceMeta?.extractionQuality && (
                            <p className="mt-1 font-semibold">Quality: {sourceMeta.extractionQuality.score}% ({sourceMeta.extractionQuality.label})</p>
                        )}
                    </div>
                )}
                {extractionBundle && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Extraction Bundle</p>
                        {Array.isArray(extractionBundle.formulas) && extractionBundle.formulas.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-slate-700 mb-1">Формули</p>
                                <div className="text-xs text-slate-700 whitespace-pre-wrap">{extractionBundle.formulas.join('\n')}</div>
                            </div>
                        )}
                        {Array.isArray(extractionBundle.theories) && extractionBundle.theories.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-slate-700 mb-1">Теорија</p>
                                <div className="text-xs text-slate-700 whitespace-pre-wrap">{extractionBundle.theories.join('\n')}</div>
                            </div>
                        )}
                        {Array.isArray(extractionBundle.tasks) && extractionBundle.tasks.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-slate-700 mb-1">Задачи</p>
                                <div className="text-xs text-slate-700 whitespace-pre-wrap">{extractionBundle.tasks.join('\n')}</div>
                            </div>
                        )}
                    </div>
                )}
        {sections.map(([key, val]) => (
          <div key={key}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">{key.replace(/_/g, ' ')}</h3>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {typeof val === 'string' ? val : Array.isArray(val) ? val.join('\n') : JSON.stringify(val, null, 2)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render all top-level string/array fields
  const entries = Object.entries(content ?? {}).filter(([k]) => !['embedding', 'id'].includes(k));
  return (
    <div className="space-y-4">
      {entries.map(([key, val]) => {
        if (!val || (Array.isArray(val) && val.length === 0)) return null;
        return (
          <div key={key}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">{key.replace(/_/g, ' ')}</h3>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {typeof val === 'string' ? val
                : Array.isArray(val) ? val.map((item: any, i: number) => (
                    <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-gray-200' : ''}>
                      {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                    </div>
                  ))
                : JSON.stringify(val, null, 2)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const PreviewModal: React.FC<{ material: CachedMaterial; onClose: () => void }> = ({ material, onClose }) => {
  const content = material.content as Record<string, unknown> | null | undefined;
  const isAssessment = material.type === 'quiz' || material.type === 'assessment';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-6 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800 truncate">{material.title || 'Преглед на материјал'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{typeLabel[material.type] ?? material.type} · {material.gradeLevel > 0 ? `${material.gradeLevel}. одд.` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition" title="Затвори">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 md:p-6">
          {isAssessment && content ? (
            <React.Suspense fallback={<div className="text-center py-10 text-gray-400">Вчитувам преглед…</div>}>
              <GeneratedAssessment material={content as unknown as AIGeneratedAssessment} />
            </React.Suspense>
          ) : content ? (
            <GenericContentRenderer content={content} type={material.type} />
          ) : (
            <p className="text-gray-400 text-center py-10">Нема содржина за прикажување.</p>
          )}
        </div>
      </div>
    </div>
  );
};
