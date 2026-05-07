/**
 * GlossaryPopover (T4.5)
 *
 * Hover/click chip that exposes a math term's definition in a small floating
 * popover. Click toggles for touch devices; hover for desktop.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { GlossaryEntry } from '../../data/mathGlossary';

export interface GlossaryPopoverProps {
  entry: GlossaryEntry;
  /** Override the chip label (default = entry.term capitalised). */
  label?: string;
  /** Optional className for the trigger. */
  className?: string;
}

const TOPIC_TINTS: Record<GlossaryEntry['topic'], string> = {
  algebra:        'bg-indigo-50 text-indigo-700 border-indigo-200',
  geometrija:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  analiza:        'bg-rose-50 text-rose-700 border-rose-200',
  kombinatorika:  'bg-amber-50 text-amber-700 border-amber-200',
  trigonometrija: 'bg-violet-50 text-violet-700 border-violet-200',
  opsto:          'bg-gray-50 text-gray-700 border-gray-200',
};

function capitalise(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

export const GlossaryPopover: React.FC<GlossaryPopoverProps> = ({ entry, label, className }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const text = label ?? capitalise(entry.term);
  const tint = TOPIC_TINTS[entry.topic];

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-block ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-testid={`glossary-popover-${entry.term}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${tint} hover:shadow-sm transition`}
        data-testid={`glossary-trigger-${entry.term}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BookOpen className="w-3 h-3" />
        {text}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={`Дефиниција: ${entry.term}`}
          className="absolute left-0 top-full mt-1 z-30 w-64 bg-white border border-gray-200 shadow-lg rounded-xl p-3 text-xs text-gray-700 space-y-1"
          data-testid={`glossary-content-${entry.term}`}
          // Stop propagation so clicks on the popover don't close it.
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-bold text-gray-900">{capitalise(entry.term)}</p>
          <p className="leading-relaxed">{entry.definition}</p>
          {entry.example && (
            <p className="mt-1 pt-1 border-t border-gray-100 text-[11px] text-gray-500 italic">
              <span className="font-semibold not-italic text-gray-700">Пример: </span>
              {entry.example}
            </p>
          )}
        </span>
      )}
    </span>
  );
};
