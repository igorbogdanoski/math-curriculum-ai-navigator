import React, { useEffect, useState } from 'react';
import { X, Loader2, Download, ChevronRight, Trash2, Users } from 'lucide-react';
import type { GradeEntry } from '../../types';
import { firestoreService } from '../../services/firestoreService';
import { groupQuizResultsForImport, mapQuizResultsToGradeEntries, type QuizResultGroup } from '../../utils/gradeBookImport';

interface Props {
  teacherUid: string;
  onImport: (entries: GradeEntry[]) => void;
  onClose: () => void;
}

/**
 * Lets a teacher import a batch of gradebook rows straight from a quiz's real results
 * (quiz_results), instead of retyping scores by hand. Groups results by quiz+concept,
 * previews the mapped rows (with real quizId/conceptId carried through as
 * sourceQuizId/conceptId — see utils/gradeBookImport.ts), and lets the teacher drop any
 * row before confirming — nothing is saved until "Внеси" is pressed.
 */
export const ImportFromResultsModal: React.FC<Props> = ({ teacherUid, onImport, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<QuizResultGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<QuizResultGroup | null>(null);
  const [previewEntries, setPreviewEntries] = useState<GradeEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    firestoreService.fetchQuizResults(500, teacherUid).then(results => {
      if (cancelled) return;
      setGroups(groupQuizResultsForImport(results));
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teacherUid]);

  const handleSelectGroup = (group: QuizResultGroup) => {
    setSelectedGroup(group);
    setPreviewEntries(mapQuizResultsToGradeEntries(group));
  };

  const handleConfirm = () => {
    if (previewEntries.length === 0) return;
    onImport(previewEntries);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-gray-800 text-lg">Увези од резултати</h2>
          </div>
          <button type="button" aria-label="Затвори" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Вчитувам резултати...
            </div>
          ) : !selectedGroup ? (
            groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-400">
                <Users className="w-8 h-8 opacity-30" />
                <p className="font-semibold text-gray-500">Нема пронајдени резултати со име на ученик.</p>
                <p className="text-xs max-w-xs">Резултатите мора да имаат зачувано име на ученик за да можат да се увезат.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Избери квиз за увоз</p>
                {groups.map(g => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => handleSelectGroup(g)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{g.quizTitle}</p>
                      <p className="text-xs text-gray-400">{g.results.length} резултат{g.results.length !== 1 ? 'и' : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <button type="button" onClick={() => setSelectedGroup(null)} className="text-xs font-bold text-indigo-600 hover:underline">
                ← Назад кон листа
              </button>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-gray-800">{selectedGroup.quizTitle}</span> — {previewEntries.length} ученик{previewEntries.length !== 1 ? 'и' : ''}
              </p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-black text-gray-500 text-xs uppercase">Ученик</th>
                      <th className="text-center px-3 py-2 font-black text-gray-500 text-xs uppercase">%</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {previewEntries.map(e => (
                      <tr key={e.studentId} className="border-t border-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-700">{e.studentName}</td>
                        <td className="px-3 py-2 text-center font-bold text-gray-600">{e.percentage}%</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            aria-label={`Отстрани ${e.studentName}`}
                            onClick={() => setPreviewEntries(prev => prev.filter(x => x.studentId !== e.studentId))}
                            className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={previewEntries.length === 0}
                className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Внеси {previewEntries.length} резултат{previewEntries.length !== 1 ? 'и' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
