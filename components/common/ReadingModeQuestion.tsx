import React, { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';
import { type ReadingModeState } from './ReadingModeBar';

interface Props {
  text: string;
  mode: ReadingModeState;
  className?: string;
}

/**
 * Splits question text into sentence chunks, respecting LaTeX boundaries.
 * E.g. "Марија имаше 15 јаболка. Ги подели на 3. Колку добила секоја?"
 * → ["Марија имаше 15 јаболка.", "Ги подели на 3.", "Колку добила секоја?"]
 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let current = '';
  let inLatex = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '$') {
      inLatex = !inLatex;
      current += ch;
    } else if (!inLatex && /[.?!]/.test(ch) && (i + 1 >= text.length || text[i + 1] === ' ')) {
      current += ch;
      const trimmed = current.trim();
      if (trimmed) chunks.push(trimmed);
      current = '';
      if (i + 1 < text.length && text[i + 1] === ' ') i++; // skip trailing space
    } else {
      current += ch;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 1 ? chunks : [text];
}

/**
 * Highlights numbers (amber) and math operators (blue) in a plain text segment.
 * LaTeX segments ($...$) are rendered via MathRenderer.
 */
function applyHighlighting(text: string): React.ReactNode {
  const segments = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith('$') && seg.endsWith('$')) {
          return <MathRenderer key={i} text={seg} />;
        }
        // Tokenise: numbers → amber, operators → blue
        const tokens: React.ReactNode[] = [];
        const re = /(\d+(?:[.,]\d+)*)|([+\-×÷=<>≤≥])/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(seg)) !== null) {
          if (m.index > last) tokens.push(seg.slice(last, m.index));
          if (m[1]) {
            tokens.push(
              <span key={m.index} className="bg-amber-200 text-amber-900 px-0.5 rounded font-black">
                {m[1]}
              </span>
            );
          } else {
            tokens.push(
              <span key={m.index} className="text-blue-600 font-black mx-0.5">
                {m[2]}
              </span>
            );
          }
          last = m.index + m[0].length;
        }
        if (last < seg.length) tokens.push(seg.slice(last));
        return <span key={i}>{tokens}</span>;
      })}
    </>
  );
}

const FONT_SIZE_CLASS: Record<ReadingModeState['fontSize'], string> = {
  normal: 'text-xl md:text-2xl',
  large:  'text-2xl md:text-3xl',
  xl:     'text-3xl md:text-4xl',
};

export const ReadingModeQuestion: React.FC<Props> = ({ text, mode, className = '' }) => {
  const chunks = useMemo(() => splitIntoChunks(text), [text]);
  const sizeClass = FONT_SIZE_CLASS[mode.fontSize];
  const fontStyle = mode.dyslexicFont ? { fontFamily: 'OpenDyslexic, sans-serif' } : undefined;

  // Reading mode OFF — render normally
  if (!mode.active) {
    return (
      <div className={`font-black text-gray-800 leading-snug ${sizeClass} ${className}`}>
        <MathRenderer text={text} />
      </div>
    );
  }

  // Sequential (чекор по чекор)
  if (mode.sequential) {
    return (
      <div
        className={`font-black text-gray-800 leading-relaxed ${sizeClass} ${className}`}
        style={fontStyle}
      >
        {chunks.map((chunk, i) => {
          const isCurrent = i === mode.sequentialStep;
          const isPast    = i < mode.sequentialStep;
          const isFuture  = i > mode.sequentialStep;
          return (
            <span
              key={i}
              className={`transition-all duration-300 ${
                isCurrent ? 'bg-yellow-200 px-1 py-0.5 rounded text-gray-900' :
                isPast    ? 'text-gray-400' :
                isFuture  ? 'opacity-0 pointer-events-none select-none' : ''
              }`}
            >
              {isCurrent ? applyHighlighting(chunk) : <MathRenderer text={chunk} />}
              {i < chunks.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    );
  }

  // Reading mode ON, non-sequential — highlight numbers + LaTeX
  return (
    <div
      className={`font-black text-gray-800 leading-relaxed ${sizeClass} ${className}`}
      style={fontStyle}
    >
      {mode.highlightNumbers ? applyHighlighting(text) : <MathRenderer text={text} />}
    </div>
  );
};

/** Returns number of sentence-chunks for the given question text. */
export function getChunkCount(text: string): number {
  return splitIntoChunks(text).length;
}
