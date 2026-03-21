/**
 * MasteryTimelineCard — Ж6.2
 *
 * Predictive mastery timeline per student/concept.
 * Uses linear regression on quiz history to forecast when each student
 * will reach mastery (≥85%) for each tested concept.
 *
 * Sections:
 *  🔴 At Risk    — declining or flat trend, not yet mastered
 *  🟡 Slow       — improving but >3 weeks to mastery
 *  🟢 On Track   — will master within 3 weeks
 *  ✅ Mastered   — already ≥85% (collapsed by default)
 *
 * Педагошка основа: Bloom's Mastery Learning, Formative Assessment,
 * Data-Driven Decision Making
 */

import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Clock, ChevronDown, ChevronUp,
  CalendarClock, Award,
} from 'lucide-react';
import { Card } from '../common/Card';
import {
  useMasteryPredictions,
  type MasteryPrediction,
  type MasteryStatus,
} from '../../hooks/useMasteryPredictions';
import type { QuizResult } from '../../services/firestoreService.types';

// ── Types & constants ─────────────────────────────────────────────────────────

interface Props {
  results: QuizResult[];
  conceptLabels?: Record<string, string>;
}

const STATUS_META: Record<MasteryStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  rowBg: string;
  icon: React.ReactNode;
}> = {
  at_risk:  {
    label: 'Во опаѓање',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    rowBg: 'bg-red-50/40',
    icon: <TrendingDown className="w-3.5 h-3.5" />,
  },
  slow:     {
    label: 'Бавен напредок',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    rowBg: 'bg-amber-50/30',
    icon: <Minus className="w-3.5 h-3.5" />,
  },
  on_track: {
    label: 'На добар пат',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    rowBg: 'bg-blue-50/30',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  mastered: {
    label: 'Совладано',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    rowBg: 'bg-emerald-50/30',
    icon: <Award className="w-3.5 h-3.5" />,
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MasteryStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${m.bg} ${m.color} ${m.border}`}>
      {m.icon}{m.label}
    </span>
  );
}

function TrendChip({ trendPerWeek }: { trendPerWeek: number }) {
  if (trendPerWeek > 0) {
    return (
      <span className="text-emerald-600 text-xs font-bold">
        +{trendPerWeek}%/нед ↑
      </span>
    );
  }
  if (trendPerWeek < 0) {
    return (
      <span className="text-red-600 text-xs font-bold">
        {trendPerWeek}%/нед ↓
      </span>
    );
  }
  return <span className="text-gray-400 text-xs">→ Стагнира</span>;
}

function DateChip({ p }: { p: MasteryPrediction }) {
  if (p.status === 'mastered') {
    return <span className="text-emerald-600 text-xs font-semibold">✅ Совладано</span>;
  }
  if (p.status === 'at_risk') {
    return <span className="text-red-600 text-xs font-semibold">⚠ Потребна помош</span>;
  }
  if (p.estimatedDate) {
    const fmt = p.estimatedDate.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short' });
    return (
      <span className="text-blue-600 text-xs font-semibold flex items-center gap-1">
        <CalendarClock className="w-3 h-3" />
        ~{fmt} ({p.daysToMastery} дена)
      </span>
    );
  }
  return null;
}

function PredictionRow({ p }: { p: MasteryPrediction }) {
  const m = STATUS_META[p.status];
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${m.rowBg} border border-transparent`}>
      {/* Score bar */}
      <div className="w-8 text-center">
        <span className={`text-sm font-black ${p.currentScore >= 85 ? 'text-emerald-700' : p.currentScore >= 70 ? 'text-blue-700' : p.currentScore >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
          {p.currentScore}%
        </span>
      </div>
      {/* Student + concept */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-800 truncate">{p.studentName}</p>
        <p className="text-[10px] text-gray-500 truncate">{p.conceptLabel}</p>
      </div>
      {/* Trend */}
      <TrendChip trendPerWeek={p.trendPerWeek} />
      {/* Projected date */}
      <div className="hidden sm:block">
        <DateChip p={p} />
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  defaultExpanded = true,
  maxVisible = 5,
}: {
  title: string;
  items: MasteryPrediction[];
  defaultExpanded?: boolean;
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const visible = showAll ? items : items.slice(0, maxVisible);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
          {title} <span className="ml-1 font-normal text-gray-400">({items.length})</span>
        </p>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {visible.map(p => <PredictionRow key={`${p.studentName}|${p.conceptId}`} p={p} />)}
          {!showAll && items.length > maxVisible && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full text-xs text-indigo-500 hover:text-indigo-700 transition py-1"
            >
              + {items.length - maxVisible} уште
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const MasteryTimelineCard: React.FC<Props> = ({ results, conceptLabels }) => {
  const { predictions, atRisk, slow, onTrack, mastered } = useMasteryPredictions(
    results,
    conceptLabels,
  );

  if (predictions.length === 0) {
    return null;
  }

  const urgentCount = atRisk.length + slow.length;

  return (
    <Card className="border-l-4 border-l-rose-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Прогноза за Совладување</h3>
            <p className="text-xs text-gray-500">
              Предвидено кога ученикот ќе достигне 85% — базирано на тренд
            </p>
          </div>
        </div>
        {urgentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
            ⚠ {urgentCount} треба внимание
          </span>
        )}
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {atRisk.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
            🔴 {atRisk.length} во опаѓање
          </span>
        )}
        {slow.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            🟡 {slow.length} бавен напредок
          </span>
        )}
        {onTrack.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            🔵 {onTrack.length} на добар пат
          </span>
        )}
        {mastered.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            ✅ {mastered.length} совладано
          </span>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <Section title="🔴 Во опаѓање — итно" items={atRisk} defaultExpanded maxVisible={6} />
        <Section title="🟡 Бавен напредок" items={slow} defaultExpanded={false} maxVisible={5} />
        <Section title="🔵 На добар пат" items={onTrack} defaultExpanded={false} maxVisible={5} />
        <Section title="✅ Совладано" items={mastered} defaultExpanded={false} maxVisible={5} />
      </div>

      <p className="text-[10px] text-gray-300 mt-4">
        Линеарна регресија врз последните {'{'}N{'}'} квиз обиди · Праг за совладување: 85% · Ж6.2
      </p>
    </Card>
  );
};
