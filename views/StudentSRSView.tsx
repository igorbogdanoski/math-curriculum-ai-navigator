/**
 * S65 P2-D — StudentSRSView
 *
 * Личен SRS-ред на ученикот: концепти кои се чекаат за повторување
 * според SM-2 алгоритамот. Чита од колекцијата `spaced_rep` за тековниот
 * deviceId. Овозможува брзо отворање на концептот за review.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Loader2, ArrowRight, CheckCircle2, BookOpen } from 'lucide-react';
import { fetchSpacedRepRecords } from '../services/firestoreService.spacedRep';
import {
  isDueForReview,
  getNextReviewLabel,
  sortByReviewUrgency,
  type SpacedRepRecord,
} from '../utils/spacedRepetition';
import { useCurriculum } from '../hooks/useCurriculum';
import { useNavigation } from '../contexts/NavigationContext';
import { getOrCreateDeviceId } from '../utils/studentIdentity';

export const StudentSRSView: React.FC = () => {
  const { navigate } = useNavigation();
  const { getConceptDetails, isLoading: curriculumLoading } = useCurriculum();
  const deviceId = getOrCreateDeviceId();

  const [records, setRecords] = useState<SpacedRepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentName = useMemo(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  }, []);

  useEffect(() => {
    if (!studentName.trim()) {
      navigate('/student/login');
    }
  }, [studentName, navigate]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchSpacedRepRecords(deviceId)
      .then(rs => { if (alive) setRecords(rs); })
      .catch(() => { if (alive) setError('Грешка при вчитување на повторувањата.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [deviceId]);

  const sorted = useMemo(() => sortByReviewUrgency(records), [records]);
  const due = useMemo(() => sorted.filter(isDueForReview), [sorted]);
  const upcoming = useMemo(() => sorted.filter(r => !isDueForReview(r)), [sorted]);

  const titleFor = (conceptId: string): string => {
    try {
      const details = getConceptDetails(conceptId);
      return details?.concept?.title || conceptId;
    } catch {
      return conceptId;
    }
  };

  if (!studentName.trim()) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
          <Brain className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои повторувања (SM-2)</h1>
          <p className="text-sm text-gray-500">
            Концепти кои треба да ги обновиш според кривата на заборавање.
          </p>
        </div>
      </header>

      {(loading || curriculumLoading) && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Се вчитуваат…
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {!loading && records.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            Сè уште немаш концепти за повторување. Реши некој квиз за да започнеш.
          </p>
          <a
            href="#/student"
            className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
          >
            Назад на dashboard
          </a>
        </div>
      )}

      {due.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-2">
            Денес за повторување ({due.length})
          </h2>
          <div className="space-y-2">
            {due.map(r => (
              <a
                key={r.conceptId}
                href={`#/concept/${encodeURIComponent(r.conceptId)}`}
                className="flex items-center gap-3 bg-white border border-purple-200 rounded-xl p-3 hover:border-purple-400 hover:bg-purple-50/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{titleFor(r.conceptId)}</p>
                  <p className="text-xs text-gray-500">
                    Повторено: {r.repetitions}× · ефикасност {r.easeFactor.toFixed(2)}
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  {getNextReviewLabel(r)}
                </span>
                <ArrowRight className="w-4 h-4 text-purple-500" />
              </a>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Во план ({upcoming.length})
          </h2>
          <div className="space-y-1">
            {upcoming.slice(0, 20).map(r => (
              <div
                key={r.conceptId}
                className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm"
              >
                <span className="text-gray-700 truncate">{titleFor(r.conceptId)}</span>
                <span className="text-xs text-gray-500">{getNextReviewLabel(r)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default StudentSRSView;
