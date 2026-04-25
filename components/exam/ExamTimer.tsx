import React, { useEffect, useRef, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface ExamTimerProps {
  endsAt: Date;
  onAutoSubmit: () => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export const ExamTimer: React.FC<ExamTimerProps> = ({ endsAt, onAutoSubmit }) => {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000)),
  );
  const submitted = useRef(false);

  useEffect(() => {
    const tick = () => {
      const secs = Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0 && !submitted.current) {
        submitted.current = true;
        onAutoSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onAutoSubmit]);

  const isWarning = remaining <= 300; // last 5 min
  const isDanger = remaining <= 60;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold transition-colors ${
        isDanger
          ? 'bg-red-100 text-red-700 animate-pulse'
          : isWarning
          ? 'bg-amber-100 text-amber-700'
          : 'bg-indigo-50 text-indigo-700'
      }`}
    >
      {isDanger ? (
        <AlertTriangle className="w-5 h-5 shrink-0" />
      ) : (
        <Clock className="w-5 h-5 shrink-0" />
      )}
      {formatTime(remaining)}
    </div>
  );
};
