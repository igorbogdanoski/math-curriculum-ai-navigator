/**
 * Gamma Presenter View — opened in a separate popup window.
 * Receives slide data via BroadcastChannel('gamma-sync') from GammaModeModal.
 * Shows: current slide, next slide preview, speaker notes, task timer, elapsed time.
 */
import React, { useState, useEffect, useRef } from 'react';
import type { PresentationSlide } from '../types';
import { MathRenderer } from '../components/common/MathRenderer';

interface SyncMessage {
  type: 'slide-change';
  idx: number;
  total: number;
  slide: PresentationSlide;
  nextSlide: PresentationSlide | null;
  topic: string;
  gradeLevel: number;
  taskTimer: number | null;
}

const SLIDE_TYPE_COLORS: Record<string, string> = {
  title:            'bg-indigo-700',
  content:          'bg-blue-700',
  'formula-centered': 'bg-violet-700',
  'step-by-step':   'bg-cyan-700',
  example:          'bg-emerald-700',
  task:             'bg-amber-700',
  summary:          'bg-rose-700',
  'chart-embed':    'bg-teal-700',
  'shape-3d':       'bg-cyan-800',
  'algebra-tiles':  'bg-indigo-800',
  comparison:       'bg-sky-700',
  proof:            'bg-purple-700',
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  title: 'Наслов', content: 'Содржина', 'formula-centered': 'Формула',
  'step-by-step': 'Постапка', example: 'Пример', task: 'Задача',
  summary: 'Заклучок', 'chart-embed': 'Дијаграм', 'shape-3d': '3D Тело',
  'algebra-tiles': 'Алгебарски плочки', comparison: 'Споредба', proof: 'Доказ',
};

function SlideCard({ slide, label, large }: { slide: PresentationSlide; label: string; large?: boolean }) {
  const color = SLIDE_TYPE_COLORS[slide.type] ?? 'bg-slate-700';
  const typeLabel = SLIDE_TYPE_LABELS[slide.type] ?? slide.type;
  return (
    <div className={`rounded-2xl overflow-hidden border border-white/10 ${large ? '' : 'opacity-80'}`}>
      <div className={`${color} px-3 py-1.5 flex items-center justify-between`}>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{typeLabel}</span>
        <span className="text-[10px] text-white/50 font-medium">{label}</span>
      </div>
      <div className="bg-slate-800 px-4 py-3">
        <p className={`font-bold text-white leading-snug ${large ? 'text-base' : 'text-sm'}`}>
          <MathRenderer text={slide.title ?? typeLabel} />
        </p>
        {slide.content[0] && (
          <p className="text-slate-400 text-xs mt-1.5 line-clamp-3 leading-relaxed">
            <MathRenderer text={slide.content[0]} />
          </p>
        )}
      </div>
    </div>
  );
}

export const GammaPresenterView: React.FC = () => {
  const [state, setState] = useState<SyncMessage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel('gamma-sync');
    channelRef.current = bc;
    bc.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (e.data?.type === 'slide-change') setState(e.data);
    };
    return () => bc.close();
  }, []);

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-pulse">📡</div>
        <p className="text-slate-400 text-sm">Чекање на Gamma Mode презентација…</p>
        <p className="text-slate-600 text-xs">Отвори Gamma Mode во главниот прозорец за да започнеш.</p>
      </div>
    );
  }

  const { idx, total, slide, nextSlide, topic, gradeLevel, taskTimer } = state;
  const pct = Math.round(((idx + 1) / total) * 100);
  const timerColor = taskTimer !== null
    ? taskTimer > 60 ? 'text-emerald-400' : taskTimer > 20 ? 'text-amber-400' : 'text-red-400'
    : 'text-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-5 gap-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Gamma Presenter</p>
          <p className="text-sm font-bold text-slate-300">{topic} · {gradeLevel}. одд.</p>
        </div>
        <div className="flex items-center gap-5">
          {taskTimer !== null && (
            <div className={`text-2xl font-black tabular-nums ${timerColor}`}>{fmt(taskTimer)}</div>
          )}
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums text-slate-300">{idx + 1}<span className="text-slate-600 text-base">/{total}</span></div>
            <div className="text-xs text-slate-600">⏱ {fmt(elapsed)}</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Main area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Current slide — large */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Моментален слајд</p>
          <SlideCard slide={slide} label={`${idx + 1}/${total}`} large />

          {/* Full content */}
          <div className="flex-1 bg-slate-900 rounded-2xl border border-white/5 px-4 py-3 overflow-y-auto">
            {slide.content.map((line, i) => (
              <p key={i} className="text-sm text-slate-300 leading-relaxed mb-2">
                <MathRenderer text={line} />
              </p>
            ))}
            {slide.solution && slide.solution.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mt-3 mb-1">Решение</p>
                {slide.solution.map((s, i) => (
                  <p key={i} className="text-sm text-emerald-300 leading-relaxed mb-1">
                    <MathRenderer text={s} />
                  </p>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right column: next slide + notes */}
        <div className="w-72 flex flex-col gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Следен слајд</p>
            {nextSlide
              ? <SlideCard slide={nextSlide} label={`${idx + 2}/${total}`} />
              : <div className="rounded-2xl bg-slate-900 border border-white/5 px-4 py-6 text-center text-slate-600 text-xs">Последен слајд</div>
            }
          </div>

          {slide.speakerNotes && (
            <div className="flex-1 bg-amber-950/30 border border-amber-500/20 rounded-2xl px-4 py-3 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-2">Белешки за наставник</p>
              <p className="text-xs text-amber-200/80 leading-relaxed">{slide.speakerNotes}</p>
            </div>
          )}

          {!slide.speakerNotes && (
            <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3 flex items-center justify-center">
              <p className="text-slate-600 text-xs text-center">Нема белешки за овој слајд</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
