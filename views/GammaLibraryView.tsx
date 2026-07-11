import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, PresentationIcon, Calendar, GraduationCap } from 'lucide-react';
import { fetchGammaPresentations, type GammaPresentationRecord } from '../services/gammaPresentationService';
import { GammaModeModal } from '../components/ai/GammaModeModal';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import type { AIGeneratedPresentation } from '../types';
import type { Timestamp } from 'firebase/firestore';

function formatDate(ts: unknown): string {
  const date = (ts as Timestamp | null)?.toDate?.();
  if (!date) return '';
  return date.toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PresentationCard({ record, onOpen }: { record: GammaPresentationRecord; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-900 leading-snug">{record.title}</h3>
        <PresentationIcon className="w-5 h-5 text-indigo-500 shrink-0" />
      </div>
      <p className="text-sm text-gray-500">{record.topic}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />{record.gradeLevel}. одд.</span>
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(record.createdAt)}</span>
      </div>
      <p className="text-xs text-indigo-600 font-semibold">{record.slides.length} слајдови</p>
    </button>
  );
}

export const GammaLibraryView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [records, setRecords] = useState<GammaPresentationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPresentation, setOpenPresentation] = useState<AIGeneratedPresentation | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) { setLoading(false); return; }
    setLoading(true);
    const list = await fetchGammaPresentations(firebaseUser.uid);
    setRecords(list);
    setLoading(false);
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          Gamma — Библиотека на презентации
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Секоја презентација што си ја отворил во Gamma Mode автоматски се зачувува овде — кликни за да ја отвориш повторно.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-10 h-10 text-indigo-300" />}
          title="Сè уште нема зачувани презентации"
          message="Отвори кое било генерирано предавање во Gamma Mode и тоа автоматски ќе се зачува тука."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map(r => (
            <PresentationCard key={r.id} record={r} onOpen={() => setOpenPresentation({
              title: r.title, topic: r.topic, gradeLevel: r.gradeLevel, slides: r.slides,
            })} />
          ))}
        </div>
      )}

      {openPresentation && (
        <GammaModeModal data={openPresentation} onClose={() => setOpenPresentation(null)} skipLibrarySave />
      )}
    </div>
  );
};
