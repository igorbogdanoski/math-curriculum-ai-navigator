/**
 * QuestionGlossaryStrip (T4.5)
 *
 * Scans the given question text for known mathematical terms and renders a
 * small horizontal strip of `GlossaryPopover` chips below it. Hidden when no
 * terms are detected.
 */
import React, { useMemo } from 'react';
import { findTermsInText } from '../../data/mathGlossary';
import { GlossaryPopover } from './GlossaryPopover';

export interface QuestionGlossaryStripProps {
  text: string;
  /** Maximum chips to render (defaults to 6 to avoid noise). */
  limit?: number;
  className?: string;
}

export const QuestionGlossaryStrip: React.FC<QuestionGlossaryStripProps> = ({
  text,
  limit = 6,
  className,
}) => {
  const terms = useMemo(() => findTermsInText(text).slice(0, limit), [text, limit]);

  if (terms.length === 0) return null;

  return (
    <div
      className={`flex items-center flex-wrap gap-1.5 mt-2 ${className ?? ''}`}
      data-testid="question-glossary-strip"
    >
      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Поими:</span>
      {terms.map((t) => (
        <GlossaryPopover key={t.entry.term} entry={t.entry} />
      ))}
    </div>
  );
};
