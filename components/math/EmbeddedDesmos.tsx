/**
 * S61-B2 — EmbeddedDesmos
 *
 * Iframe-based wrapper for the public Desmos calculators (calc + graph).
 * The Desmos JS API requires a third-party script tag and an API key for
 * full state read/write — for the final-exam workflow we keep the embed
 * lightweight and offline-friendly by using the public iframe URL. State
 * persistence is signalled best-effort on first interaction (parity with
 * EmbeddedGeoGebra).
 */
import React, { useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

export type DesmosKind = 'calc' | 'graph';

export interface EmbeddedDesmosProps {
  type: DesmosKind;
  /** Optional pre-shared graph id for `graph` type (e.g. "abc123def"). */
  state?: string;
  height?: number;
  onState?: (state: string) => void;
  className?: string;
}

const LABEL: Record<DesmosKind, string> = {
  'calc':  'Desmos • Калкулатор',
  'graph': 'Desmos • Графици',
};

export function buildDesmosUrl(type: DesmosKind, state?: string): string {
  if (type === 'graph') {
    if (state && state.trim()) {
      return `https://www.desmos.com/calculator/${encodeURIComponent(state)}?embed`;
    }
    return 'https://www.desmos.com/calculator?embed';
  }
  // Scientific calculator
  return 'https://www.desmos.com/scientific?embed';
}

export const EmbeddedDesmos: React.FC<EmbeddedDesmosProps> = ({
  type,
  state,
  height = 420,
  onState,
  className = '',
}) => {
  const [interacted, setInteracted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const url = useMemo(() => buildDesmosUrl(type, state), [type, state]);

  const handleClick = () => {
    if (interacted) return;
    setInteracted(true);
    onState?.(state ?? '');
  };

  return (
    <div
      data-testid="embedded-desmos"
      data-type={type}
      data-state={state ?? ''}
      className={`flex flex-col gap-1.5 rounded-xl border border-sky-200 bg-sky-50/30 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-sky-800 bg-sky-50 border-b border-sky-100">
        <span>{LABEL[type]}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 underline"
        >
          <ExternalLink className="w-3 h-3" /> Цел екран
        </a>
      </div>
      <iframe
        ref={iframeRef}
        title={LABEL[type]}
        src={url}
        width="100%"
        height={height}
        loading="lazy"
        allow="fullscreen"
        onMouseDown={handleClick}
        onTouchStart={handleClick}
        className="border-0 bg-white"
      />
      {interacted && (
        <p className="px-3 py-1 text-[10px] text-sky-600 bg-sky-50 border-t border-sky-100">
          Состојбата на алатката е забележана.
        </p>
      )}
    </div>
  );
};
