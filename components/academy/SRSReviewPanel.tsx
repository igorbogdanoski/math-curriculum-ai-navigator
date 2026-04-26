/**
 * S50-B — SRS Review Panel
 * Показува концепти за повторување групирани по итност (денес / утре / оваа недела / подоцна).
 * Данатата доаѓа од Firestore spaced_rep collection (не localStorage).
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { fetchSpacedRepRecords } from '../../services/firestoreService.spacedRep';
import { buildReviewSchedule, getScheduleStats } from '../../utils/srsScheduler';
import type { ReviewSchedule, SRSItem } from '../../utils/srsScheduler';
import { useCurriculum } from '../../hooks/useCurriculum';
import { Loader2, CalendarClock, ChevronRight, Flame, CalendarDays } from 'lucide-react';

// ─── Group row ────────────────────────────────────────────────────────────────

interface GroupProps {
  label: string;
  items: SRSItem[];
  accent: string;
  badge?: string;
  defaultOpen?: boolean;
}

function ReviewGroup({ label, items, accent, badge, defaultOpen = false }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { navigate } = useNavigation();
  const { getConceptDetails } = useCurriculum();

  if (items.length === 0) return null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${accent}`} />
          <span className="font-semibold text-sm text-gray-700">{label}</span>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${accent.replace('bg-', 'bg-').replace('500', '100')} text-gray-700`}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">{items.length} концепти</span>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {open && (
        <ul className="divide-y divide-gray-50">
          {items.map(item => {
            const { concept, grade } = getConceptDetails(item.conceptId);
            return (
              <li key={item.conceptId}>
                <button
                  type="button"
                  onClick={() => navigate(`/concept/${item.conceptId}`)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {concept?.title ?? item.conceptId}
                    </p>
                    <p className="text-xs text-gray-400">
                      {grade ? `${grade.level}. одд.` : ''}
                      {item.overdue && ' · Задоцнето!'}
                      {' · '}× {item.repetitions} повторувања
                      {' · EF '}{item.easeFactor.toFixed(1)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.overdue ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {item.nextReviewLabel}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface SRSReviewPanelProps {
  studentId?: string;
}

export function SRSReviewPanel({ studentId }: SRSReviewPanelProps) {
  const { firebaseUser } = useAuth();
  const [schedule, setSchedule] = useState<ReviewSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = studentId ?? firebaseUser?.uid ?? '';

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    fetchSpacedRepRecords(uid).then(records => {
      setSchedule(buildReviewSchedule(records));
      setLoading(false);
    });
  }, [uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!schedule || (schedule.today.length === 0 && schedule.tomorrow.length === 0 && schedule.thisWeek.length === 0 && schedule.later.length === 0)) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>Нема концепти за повторување засега.</p>
        <p className="text-xs mt-1">Решете квизови за да го активирате распоредот.</p>
      </div>
    );
  }

  const stats = getScheduleStats(schedule);

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-xl border border-red-100">
          <Flame className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-bold text-red-700">{stats.dueToday} денес</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100">
          <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-bold text-amber-700">{stats.dueThisWeek} оваа недела</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200">
          <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-bold text-gray-600">{stats.total} вкупно</span>
        </div>
      </div>

      {/* Groups */}
      <ReviewGroup label="Денес" items={schedule.today} accent="bg-red-500" badge="Приоритет" defaultOpen={true} />
      <ReviewGroup label="Утре" items={schedule.tomorrow} accent="bg-amber-500" />
      <ReviewGroup label="Оваа недела" items={schedule.thisWeek} accent="bg-blue-400" />
      <ReviewGroup label="Подоцна" items={schedule.later} accent="bg-gray-300" />
    </div>
  );
}
