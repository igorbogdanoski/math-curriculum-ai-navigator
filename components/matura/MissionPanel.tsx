import React from 'react';
import { Flame, CheckCircle2, Circle, SkipForward, Trophy, CalendarDays, Sparkles } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import type { MaturaMissionPlan, MaturaMissionDay } from '../../services/firestoreService.matura';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  skipped:   <SkipForward  className="w-4 h-4 text-gray-400 flex-shrink-0" />,
  pending:   <Circle       className="w-4 h-4 text-gray-300 flex-shrink-0" />,
};

const STATUS_ROW_CLASS: Record<string, string> = {
  completed: 'bg-emerald-50 border-emerald-200',
  skipped:   'bg-gray-50 border-gray-200 opacity-60',
  pending:   'bg-white border-gray-200',
};

interface MissionDayRowProps {
  missionDay: MaturaMissionDay;
  isToday: boolean;
  onStart: (missionDay: MaturaMissionDay) => void;
  onSkip:  (day: number) => void;
}

const MissionDayRow: React.FC<MissionDayRowProps> = ({ missionDay, isToday, onStart, onSkip }) => {
  const rowClass = isToday && missionDay.status === 'pending'
    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
    : STATUS_ROW_CLASS[missionDay.status];

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${rowClass}`}>
      <span className="text-xs font-black text-gray-400 w-8 shrink-0 tabular-nums">Д{missionDay.day}</span>
      {STATUS_ICONS[missionDay.status]}
      <span className={`text-sm flex-1 truncate ${isToday && missionDay.status === 'pending' ? 'font-bold text-indigo-800' : 'font-medium text-gray-700'}`}>
        {missionDay.label}
      </span>
      {missionDay.pctAfter !== undefined && (
        <span className="text-xs font-bold text-emerald-600 shrink-0">{missionDay.pctAfter.toFixed(0)}%</span>
      )}
      {isToday && missionDay.status === 'pending' && (
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onStart(missionDay)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            Вежбај
          </button>
          <button
            type="button"
            onClick={() => onSkip(missionDay.day)}
            className="px-2 py-1 rounded-lg text-[11px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
            title="Прескокни денеска"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

interface MissionPanelProps {
  mission: MaturaMissionPlan;
  todayDay: MaturaMissionDay | null;
  streakLabel: string;
  onSkipDay: (day: number) => void;
  /** Optional — called when a new recovery session from this panel starts for a day */
  onStartDay?: (missionDay: MaturaMissionDay) => void;
}

export const MissionPanel: React.FC<MissionPanelProps> = ({
  mission,
  todayDay,
  streakLabel,
  onSkipDay,
  onStartDay,
}) => {
  const { navigate } = useNavigation();

  const handleStartDay = (missionDay: MaturaMissionDay) => {
    try {
      sessionStorage.setItem('matura_recovery_prefill', JSON.stringify({
        topicArea: missionDay.topicArea,
        dokLevels: [missionDay.dokLevel],
        maxQ: 10,
        sourceConceptId: mission.sourceConceptId,
        sourceConceptTitle: mission.sourceConceptTitle,
        missionDay: missionDay.day,
      }));
      localStorage.setItem(
        `matura_concept_snap_${mission.sourceConceptId}`,
        JSON.stringify({ pctBefore: null, topicArea: missionDay.topicArea, savedAt: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    onStartDay?.(missionDay);
    navigate('/matura-practice');
  };

  const completedDays = mission.days.filter((d) => d.status === 'completed').length;
  const totalDays     = mission.days.length;
  const progressPct   = Math.round((completedDays / totalDays) * 100);
  const isExpired     = new Date(mission.endsAt).getTime() < Date.now();

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-indigo-100">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-indigo-900">7-дневен Recovery Plan</h3>
          </div>
          <p className="text-xs text-indigo-700 mt-0.5 line-clamp-1">
            Фокус: <span className="font-bold">{mission.sourceConceptTitle}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {streakLabel && (
            <span className="flex items-center gap-1 text-xs font-black text-orange-600">
              <Flame className="w-3.5 h-3.5" />
              {streakLabel}
            </span>
          )}
          {mission.badgeEarned && (
            <span className="flex items-center gap-1 text-xs font-black text-amber-600">
              <Trophy className="w-3.5 h-3.5" />
              Значка освоена!
            </span>
          )}
          {isExpired && !mission.badgeEarned && (
            <span className="text-[11px] text-gray-400 font-medium">Истечен план</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-indigo-600">{completedDays}/{totalDays} денови</span>
          <span className="text-[11px] font-bold text-indigo-600">{progressPct}%</span>
        </div>
        <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
          <progress
            className="w-full h-full accent-indigo-600"
            max={100}
            value={progressPct}
          />
        </div>
      </div>

      {/* Day rows */}
      <div className="px-5 pb-4 mt-3 space-y-1.5">
        {mission.days.map((d) => (
          <MissionDayRow
            key={d.day}
            missionDay={d}
            isToday={todayDay?.day === d.day}
            onStart={handleStartDay}
            onSkip={onSkipDay}
          />
        ))}
      </div>

      {/* Badge celebrate */}
      {mission.badgeEarned && (
        <div className="mx-5 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-black text-amber-800">Честитки! Значка освоена 🏆</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Го заврши целиот 7-дневен план за <strong>{mission.sourceConceptTitle}</strong>.
              Напредокот е видлив во M5 Analytics.
            </p>
          </div>
        </div>
      )}

      {/* Nudge if today is pending */}
      {todayDay && todayDay.status === 'pending' && !isExpired && (
        <div className="mx-5 mb-4 text-[11px] text-indigo-600 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Денешната сесија трае само ~5 минути. Продолжи сега!
        </div>
      )}
    </div>
  );
};
