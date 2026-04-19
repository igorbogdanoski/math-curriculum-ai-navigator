import React from 'react';
import { X } from 'lucide-react';
import { PresentationSlide } from '../../../types';

const SLIDE_META: Record<PresentationSlide['type'], { label: string; color: string; bg: string }> = {
  'title':            { label: 'Наслов',            color: 'text-indigo-300',  bg: 'bg-indigo-900/40'  },
  'content':          { label: 'Содржина',           color: 'text-blue-300',    bg: 'bg-blue-900/40'    },
  'formula-centered': { label: 'Формула',            color: 'text-violet-300',  bg: 'bg-violet-900/40'  },
  'step-by-step':     { label: 'Постапка',           color: 'text-cyan-300',    bg: 'bg-cyan-900/40'    },
  'example':          { label: 'Пример',             color: 'text-emerald-300', bg: 'bg-emerald-900/40' },
  'task':             { label: 'Задача',             color: 'text-amber-300',   bg: 'bg-amber-900/40'   },
  'summary':          { label: 'Заклучок',           color: 'text-rose-300',    bg: 'bg-rose-900/40'    },
  'chart-embed':      { label: 'Дијаграм',           color: 'text-teal-300',    bg: 'bg-teal-900/40'    },
  'shape-3d':         { label: '3D Тело',            color: 'text-cyan-300',    bg: 'bg-cyan-900/40'    },
  'algebra-tiles':    { label: 'Алгебарски плочки',  color: 'text-indigo-300',  bg: 'bg-indigo-900/40'  },
  'comparison':       { label: 'Споредба',           color: 'text-sky-300',     bg: 'bg-sky-900/40'     },
  'proof':            { label: 'Доказ',              color: 'text-purple-300',  bg: 'bg-purple-900/40'  },
};

interface Props {
  slides: PresentationSlide[];
  activeIdx: number;
  onJump: (i: number) => void;
  onClose: () => void;
}

export const GammaThumbnailGrid: React.FC<Props> = ({ slides, activeIdx, onJump, onClose }) => (
  <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-sm flex flex-col">
    <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
      <span className="text-sm font-bold text-white">Преглед на слајдови</span>
      <button
        type="button"
        onClick={onClose}
        title="Затвори преглед (G)"
        aria-label="Затвори преглед на слајдови"
        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="gamma-thumbnail-grid flex-1">
      {slides.map((s, i) => {
        const m = SLIDE_META[s.type];
        const isActive = i === activeIdx;
        return (
          <button
            key={i}
            type="button"
            onClick={() => { onJump(i); onClose(); }}
            className={`group flex flex-col rounded-2xl border-2 overflow-hidden text-left transition-all ${
              isActive ? 'border-indigo-400 shadow-lg shadow-indigo-500/20' : 'border-white/10 hover:border-white/30'
            }`}
          >
            <div className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest ${m.color} ${m.bg} flex items-center justify-between`}>
              <span>{m.label}</span>
              <span className="text-white/40 font-normal">{i + 1}</span>
            </div>
            <div className="bg-slate-900 px-3 py-2 flex-1">
              <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">
                {s.title ?? m.label}
              </p>
              {s.content[0] && (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                  {s.content[0].replace(/\$[^$]*\$/g, '…')}
                </p>
              )}
            </div>
            {isActive && <div className="h-0.5 bg-indigo-400 w-full" />}
          </button>
        );
      })}
    </div>
  </div>
);
