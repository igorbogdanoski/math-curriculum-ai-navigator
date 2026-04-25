/**
 * ShareVisualView — public standalone viewer for shared AlgebraTiles + Shape3D links.
 *
 * Route:  #/share/visual?tiles=1x2_3x_2u
 *         #/share/visual?shape=cylinder&r=1.5&h=3
 */
import React, { useMemo, useState, Suspense } from 'react';
import { Link2, CheckCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { AlgebraTilesCanvas } from '../components/math/AlgebraTilesCanvas';
import { SHAPE_ORDER } from '../components/math/Shape3DViewer';
import type { Shape3DType } from '../components/math/Shape3DViewer';
const Shape3DViewer = React.lazy(() =>
  import('../components/math/Shape3DViewer').then(m => ({ default: m.Shape3DViewer }))
);
import { decodeTileSpecs, parseVisualShareParams } from '../utils/visualShareUrl';

export const ShareVisualView: React.FC = () => {
  const shareParams = useMemo(() => parseVisualShareParams(), []);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const tileSpecs = shareParams.tiles ? decodeTileSpecs(shareParams.tiles) : null;
  const shape = (shareParams.shape && SHAPE_ORDER.includes(shareParams.shape as Shape3DType))
    ? shareParams.shape as Shape3DType
    : null;

  const hasContent = tileSpecs !== null || shape !== null;

  const title = tileSpecs
    ? 'Алгебарски плочки'
    : shape
      ? `3D Геометрија`
      : 'Визуелна математика';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 p-4 flex flex-col">
      {/* Header bar */}
      <div className="max-w-2xl mx-auto w-full mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
              Math Curriculum AI Navigator
            </span>
            <h1 className="text-xl font-bold text-gray-800 mt-0.5">{title}</h1>
            {shape && (
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{shape}</p>
            )}
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors shadow-sm shrink-0"
          >
            {copied
              ? <CheckCheck className="w-3.5 h-3.5 text-green-600" />
              : <Link2 className="w-3.5 h-3.5" />
            }
            {copied ? 'Копирано!' : 'Копирај линк'}
          </button>
        </div>
      </div>

      {/* Content card */}
      <div className="max-w-2xl mx-auto w-full flex-1">
        {hasContent ? (
          <div className="bg-white rounded-2xl shadow-md border border-indigo-100 p-4 overflow-x-auto">
            {tileSpecs !== null && (
              <AlgebraTilesCanvas initialTileSpecs={tileSpecs} />
            )}
            {shape !== null && (
              <Suspense fallback={<div className="flex items-center justify-center p-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
                <Shape3DViewer
                  initialShape={shape}
                  initialDims={shareParams.dims}
                  hideSelector={false}
                  compact={false}
                />
              </Suspense>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-red-100 p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Невалиден линк</p>
            <p className="text-sm text-gray-500 mt-1">
              Параметрите за визуелизација недостасуваат или се невалидни.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-6">
        Споделено преку{' '}
        <a href="/#/" className="text-indigo-400 hover:underline">
          Math Curriculum AI Navigator
        </a>
      </p>
    </div>
  );
};
