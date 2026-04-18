/**
 * AchievementCelebrationOverlay — fullscreen celebration when new achievements unlock.
 * Auto-dismisses after 4 seconds. Shows one achievement at a time (cycles if multiple).
 */
import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { ACHIEVEMENTS } from '../../services/firestoreService';
import { X } from 'lucide-react';

interface Props {
  achievementIds: string[];
  onDismiss: () => void;
}

export const AchievementCelebrationOverlay: React.FC<Props> = ({ achievementIds, onDismiss }) => {
  const [index, setIndex] = useState(0);

  const achievements = achievementIds
    .map(id => ({ id, ...ACHIEVEMENTS[id] }))
    .filter(a => a.label);

  useEffect(() => {
    if (achievements.length === 0) { onDismiss(); return; }

    // Fire confetti burst
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.55 },
      colors: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#ffffff'],
    });

    const cycleTimer = index < achievements.length - 1
      ? setTimeout(() => setIndex(i => i + 1), 2200)
      : setTimeout(onDismiss, 2800);

    return () => clearTimeout(cycleTimer);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = achievements[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onDismiss}
    >
      <div
        className="relative bg-gradient-to-br from-indigo-700 to-purple-800 rounded-3xl shadow-2xl p-10 text-center max-w-sm w-full mx-4 animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 text-white/50 hover:text-white transition"
          aria-label="Затвори"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Badge glow */}
        <div className="text-8xl mb-4 animate-bounce drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
          {current.icon}
        </div>

        <p className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-2">
          Нов achievement!
        </p>
        <h2 className="text-2xl font-black text-white mb-1">
          {current.label}
        </h2>
        {achievements.length > 1 && (
          <p className="text-xs text-white/50 mt-3">
            {index + 1} / {achievements.length}
          </p>
        )}

        {/* Progress dots */}
        {achievements.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {achievements.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? 'bg-yellow-400 w-4' : 'bg-white/30'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
