/**
 * visualShareUrl — encode/decode helpers for AlgebraTiles + Shape3D shareable URLs.
 *
 * URL format:
 *   Tiles: #/share/visual?tiles=1x2_3x_2u        (1 x², 3 x, 2 units)
 *          #/share/visual?tiles=1x2_-1x_-2u      (negative tiles)
 *   Shape: #/share/visual?shape=cylinder&r=1.5&h=3
 */
import type { Shape3DType, ShapeDimensions } from '../components/math/Shape3DViewer';

// Re-export these types so callers don't need to import from Shape3DViewer directly
export type { Shape3DType, ShapeDimensions };

export type TileKind = 'x2' | 'x' | '1';
export type TileSign = 1 | -1;

export interface TileSpec {
  kind: TileKind;
  sign: TileSign;
  count: number;
}

// Maps internal kind to URL-safe token ('1' → 'u' to avoid ambiguity with count digits)
const URL_KIND: Record<TileKind, string> = { x2: 'x2', x: 'x', '1': 'u' };
const KIND_FROM_URL: Record<string, TileKind> = { x2: 'x2', x: 'x', u: '1' };

/** Encodes TileSpec[] → compact URL string, e.g. "1x2_3x_2u" */
export function encodeTileSpecs(specs: TileSpec[]): string {
  return specs
    .filter(s => s.count > 0)
    .map(({ kind, sign, count }) => `${sign === -1 ? '-' : ''}${count}${URL_KIND[kind]}`)
    .join('_');
}

/** Decodes compact URL string → TileSpec[]. Unknown segments are silently skipped. */
export function decodeTileSpecs(str: string): TileSpec[] {
  return str
    .split('_')
    .filter(Boolean)
    .flatMap(part => {
      const m = /^(-?)(\d+)(x2|x|u)$/.exec(part.trim());
      if (!m) return [];
      const sign: TileSign = m[1] === '-' ? -1 : 1;
      const count = parseInt(m[2], 10);
      const kind = KIND_FROM_URL[m[3]];
      if (!kind || count < 1 || count > 25) return [];
      return [{ kind, sign, count }];
    });
}

/** Builds a full shareable URL for a tile arrangement. */
export function buildTileShareUrl(specs: TileSpec[]): string {
  const encoded = encodeTileSpecs(specs);
  if (!encoded) return '';
  return `${window.location.origin}/#/share/visual?tiles=${encoded}`;
}

/** Builds a full shareable URL for a 3D shape with dimensions. */
export function buildShapeShareUrl(shape: Shape3DType, dims: ShapeDimensions): string {
  const params = new URLSearchParams({ shape });
  for (const [k, v] of Object.entries(dims)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  return `${window.location.origin}/#/share/visual?${params.toString()}`;
}

/** Parses the current hash URL for visual share params. */
export function parseVisualShareParams(): {
  tiles?: string;
  shape?: Shape3DType;
  dims?: ShapeDimensions;
} {
  const hash = window.location.hash; // e.g. '#/share/visual?tiles=1x2_3x_2u'
  const qIdx = hash.indexOf('?');
  if (qIdx < 0) return {};

  const params = new URLSearchParams(hash.slice(qIdx + 1));
  const tilesParam = params.get('tiles');
  const shapeParam = params.get('shape');

  if (tilesParam) return { tiles: tilesParam };

  if (shapeParam) {
    const dims: ShapeDimensions = {};
    for (const key of ['a', 'b', 'c', 'h', 'r'] as (keyof ShapeDimensions)[]) {
      const v = params.get(key);
      if (v !== null) {
        const n = parseFloat(v);
        if (!isNaN(n)) dims[key] = n;
      }
    }
    return { shape: shapeParam as Shape3DType, dims };
  }

  return {};
}
