import React, { useEffect, useState } from 'react';
import { X, Loader2, Download, ChevronRight, Trash2, Users } from 'lucide-react';
import type { GradeEntry } from '../../types';
import { firestoreService } from '../../services/firestoreService';
import { examService } from '../../services/firestoreService.exam';
import { fetchTeacherDuggaSubmissions } from '../../services/firestoreService.dugga';
import {
  groupQuizResultsForImport, mapQuizResultsToGradeEntries, type QuizResultGroup,
  groupDuggaSubmissionsForImport, mapDuggaSubmissionsToGradeEntries, type DuggaSubmissionGroup,
  groupExamResponsesForImport, mapExamResponsesToGradeEntries, type ExamResponseGroup,
} from '../../utils/gradeBookImport';

interface Props {
  teacherUid: string;
  onImport: (entries: GradeEntry[]) => void;
  onClose: () => void;
}

type Source = 'quiz' | 'dugga' | 'exam';
type AnyGroup = QuizResultGroup | DuggaSubmissionGroup | ExamResponseGroup;

const SOURCE_LABELS: Record<Source, string> = {
  quiz: 'Квиз',
  dugga: 'Dugga',
  exam: 'Дигитален испит',
};

function groupTitle(group: AnyGroup): string {
  if ('quizTitle' in group) return group.quizTitle;
  if ('testTitle' in group) return group.testTitle;
  return group.sessionTitle;
}

function groupCount(group: AnyGroup): number {
  if ('results' in group) return group.results.length;
  if ('submissions' in group) return group.submissions.length;
  return group.responses.length;
}

function mapGroupToEntries(source: Source, group: AnyGroup): GradeEntry[] {
  if (source === 'quiz') return mapQuizResultsToGradeEntries(group as QuizResultGroup);
  if (source === 'dugga') return mapDuggaSubmissionsToGradeEntries(group as DuggaSubmissionGroup);
  return mapExamResponsesToGradeEntries(group as ExamResponseGroup);
}

/**
 * Lets a teacher import a batch of gradebook rows straight from real results — quiz_results,
 * Dugga submissions, or graded Digital Exam responses — instead of retyping scores by hand.
 * Groups results by test, previews the mapped rows (with the real quizId/testId/sessionId
 * carried through as sourceQuizId/sourceDuggaTestId/sourceExamSessionId — see
 * utils/gradeBookImport.ts), and lets the teacher drop any row before confirming — nothing is
 * saved until "Внеси" is pressed.
 */
export const ImportFromResultsModal: React.FC<Props> = ({ teacherUid, onImport, onClose }) => {
  const [source, setSource] = useState<Source>('quiz');
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<AnyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<AnyGroup | null>(null);
  const [previewEntries, setPreviewEntries] = useState<GradeEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedGroup(null);
    setPreviewEntries([]);

    const load = async (): Promise<AnyGroup[]> => {
      if (source === 'quiz') {
        const results = await firestoreService.fetchQuizResults(500, teacherUid);
        return groupQuizResultsForImport(results);
      }
      if (source === 'dugga') {
        const submissions = await fetchTeacherDuggaSubmissions(teacherUid);
        return groupDuggaSubmissionsForImport(submissions);
      }
      const sessionsWithResponses = await examService.fetchTeacherGradedExamResponses(teacherUid);
      return groupExamResponsesForImport(sessionsWithResponses);
    };

    load().then(g => { if (!cancelled) { setGroups(g); setLoading(false); } })
      .catch(() => { if (!cancelled) { setGroups([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [source, teacherUid]);

  const handleSelectGroup = (group: AnyGroup) => {
    setSelectedGroup(group);
    setPreviewEntries(mapGroupToEntries(source, group));
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

        <div className="flex gap-1.5 px-5 pt-4">
          {(Object.keys(SOURCE_LABELS) as Source[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                source === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
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
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Избери {SOURCE_LABELS[source].toLowerCase()} за увоз</p>
                {groups.map(g => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => handleSelectGroup(g)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{groupTitle(g)}</p>
                      <p className="text-xs text-gray-400">{groupCount(g)} резултат{groupCount(g) !== 1 ? 'и' : ''}</p>
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
                <span className="font-bold text-gray-800">{groupTitle(selectedGroup)}</span> — {previewEntries.length} ученик{previewEntries.length !== 1 ? 'и' : ''}
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
