import React, { useEffect, useRef } from 'react';
import { StreamingIndicator } from '../ai/StreamingIndicator';

interface StreamingTextPreviewProps {
  text: string;
  onCancel: () => void;
}

/**
 * Shows live streaming AI output while generation is in progress.
 * Displays the last ~200 chars with a scrolling "typewriter window" effect.
 * Replaced by the structured result component once generation completes.
 */
export const StreamingTextPreview: React.FC<StreamingTextPreviewProps> = ({ text, onCancel }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new chunks arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  // Show only the last 400 chars to keep the window readable
  const preview = text.length > 400 ? '…' + text.slice(-400) : text;

  return (
    <div className="w-full animate-fade-in">
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-2xl p-5 shadow-xl border border-indigo-800/40">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <StreamingIndicator />
          <span className="text-xs text-indigo-400 font-mono">{text.length} знаци</span>
        </div>

        {/* Streaming text window */}
        <div
          ref={scrollRef}
          className="bg-black/30 rounded-xl p-4 font-mono text-xs text-emerald-300 leading-relaxed min-h-[120px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all"
          aria-live="polite"
          aria-label="Streaming AI output"
        >
          {preview}
          {/* Blinking cursor */}
          <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse align-middle" aria-hidden="true" />
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 text-xs text-indigo-400 hover:text-red-400 transition flex items-center gap-1"
        >
          ✕ Откажи генерирање
        </button>
      </div>
    </div>
  );
};
