import React, { useState, useEffect } from 'react';
import { Clock, Trophy } from 'lucide-react';

const DEFAULT_EXAM_DATE = new Date('2026-06-06T09:00:00');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    total: diff,
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  / 60_000),
    seconds: Math.floor((diff % 60_000)     / 1_000),
  };
}

const Pad: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <div className="bg-indigo-900 text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center tabular-nums shadow-lg">
      {String(value).padStart(2, '0')}
    </div>
    <span className="text-xs font-semibold text-indigo-300 mt-1 uppercase tracking-wide">{label}</span>
  </div>
);

interface MaturaCountdownProps {
  /** If provided, counts down to this date instead of the default 6 June 2026 */
  examDate?: Date | null;
}

export const MaturaCountdown: React.FC<MaturaCountdownProps> = ({ examDate }) => {
  const target = examDate ?? DEFAULT_EXAM_DATE;
  const [t, setT] = useState<TimeLeft>(() => getTimeLeft(target));

  useEffect(() => {
    setT(getTimeLeft(target));
    const id = setInterval(() => setT(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const label = examDate
    ? examDate.toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' })
    : '6 јуни 2026';

  if (t.total <= 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm">
        <Trophy className="w-4 h-4" /> Среќна матура!
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-indigo-300" />
        <span className="text-indigo-200 text-sm font-semibold">До матура — {label}</span>
      </div>
      <div className="flex items-end gap-3">
        <Pad value={t.days}    label="денови" />
        <span className="text-indigo-400 text-2xl font-black mb-3.5">:</span>
        <Pad value={t.hours}   label="часови" />
        <span className="text-indigo-400 text-2xl font-black mb-3.5">:</span>
        <Pad value={t.minutes} label="минути" />
        <span className="text-indigo-400 text-2xl font-black mb-3.5">:</span>
        <Pad value={t.seconds} label="секунди" />
      </div>
    </div>
  );
};
