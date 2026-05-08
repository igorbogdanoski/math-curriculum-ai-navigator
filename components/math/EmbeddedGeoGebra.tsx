/**
 * S61-B1 — EmbeddedGeoGebra
 *
 * A self-contained iframe wrapper for the public GeoGebra apps so that a
 * teacher-attached interactive activity can live inline next to a Дига
 * question. Falls back to the public app URL (no Apps Embed API needed)
 * for offline-friendly usage. When `materialId` is provided, the iframe
 * loads a specific shared GeoGebra material instead.
 *
 * The component is intentionally lightweight: state persistence via
 * `onState` is a best-effort mechanism — the GeoGebra apps don't expose a
 * cross-origin postMessage contract by default. We expose the iframe URL
 * so teachers can inspect it, and we capture an "interaction-recorded"
 * flag once the student has clicked into the embed (basic engagement
 * tracking that is sufficient for the final-exam workflow).
 */
import React, { useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

export type GeoGebraApp = 'graphing' | 'cas' | 'geometry' | '3d';

export interface EmbeddedGeoGebraProps {
  app: GeoGebraApp;
  materialId?: string;
  initialState?: string;
  height?: number;
  /** Best-effort callback fired the first time the student interacts with the embed. */
  onState?: (xml: string) => void;
  /** Locale for the GeoGebra UI (default `mk` Macedonian). */
  lang?: string;
  className?: string;
}

const APP_PATH: Record<GeoGebraApp, string> = {
  'graphing': 'graphing',
  'cas':      'cas',
  'geometry': 'geometry',
  '3d':       '3d',
};

const APP_LABEL: Record<GeoGebraApp, string> = {
  'graphing': 'GeoGebra • Графици',
  'cas':      'GeoGebra • CAS',
  'geometry': 'GeoGebra • Геометрија',
  '3d':       'GeoGebra • 3D',
};

export function buildGeoGebraUrl(
  app: GeoGebraApp,
  materialId?: string,
  lang: string = 'mk',
): string {
  if (materialId && materialId.trim()) {
    // Material share URL (works for any user-uploaded resource).
    return `https://www.geogebra.org/m/${encodeURIComponent(materialId)}?embed=1&lang=${lang}`;
  }
  return `https://www.geogebra.org/${APP_PATH[app]}?lang=${lang}`;
}

export const EmbeddedGeoGebra: React.FC<EmbeddedGeoGebraProps> = ({
  app,
  materialId,
  initialState,
  height = 420,
  onState,
  lang = 'mk',
  className = '',
}) => {
  const [interacted, setInteracted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const url = useMemo(() => buildGeoGebraUrl(app, materialId, lang), [app, materialId, lang]);

  const handleClick = () => {
    if (interacted) return;
    setInteracted(true);
    // Best-effort state notification — the public iframe doesn't expose XML
    // cross-origin, so we report at least the initial seed (or empty).
    onState?.(initialState ?? '');
  };

  return (
    <div
      data-testid="embedded-geogebra"
      data-app={app}
      data-material={materialId ?? ''}
      className={`flex flex-col gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/30 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border-b border-emerald-100">
        <span>{APP_LABEL[app]}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 underline"
        >
          <ExternalLink className="w-3 h-3" /> Цел екран
        </a>
      </div>
      <iframe
        ref={iframeRef}
        title={APP_LABEL[app]}
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
        <p className="px-3 py-1 text-[10px] text-emerald-600 bg-emerald-50 border-t border-emerald-100">
          Состојбата на алатката е забележана.
        </p>
      )}
    </div>
  );
};
