/**
 * AlgebraTilesCanvas — interactive visual algebra manipulative.
 *
 * Tile types:
 *   x²  (large square,  positive = blue,   negative = red)
 *   x   (rectangle,     positive = green,  negative = pink)
 *   1   (small square,  positive = yellow, negative = gray)
 *
 * Features:
 *  - Click tiles in the palette to add to canvas
 *  - Drag tiles on canvas to reposition
 *  - Double-click a canvas tile to remove it
 *  - "Zero pair" detection: positive + negative same type = cancels out
 *  - Live expression display + MathRenderer
 *  - "Simplify" button removes zero pairs
 *  - Reset button clears canvas
 */
import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────
type TileKind = 'x2' | 'x' | '1';
type TileSign = 1 | -1;

interface Tile {
  id: string;
  kind: TileKind;
  sign: TileSign;
  x: number; // canvas px
  y: number;
}

// ─── Visual config ────────────────────────────────────────────────────────────
const TILE_CONFIG: Record<TileKind, { w: number; h: number; label: string; latex: string }> = {
  x2: { w: 64, h: 64, label: 'x²', latex: 'x^2' },
  x:  { w: 64, h: 24, label: 'x',  latex: 'x'   },
  '1': { w: 24, h: 24, label: '1',  latex: '1'   },
};

const TILE_COLOR: Record<TileKind, Record<TileSign, string>> = {
  x2: { 1: 'bg-blue-500 border-blue-700',    [-1]: 'bg-red-400 border-red-600'    },
  x:  { 1: 'bg-emerald-500 border-emerald-700', [-1]: 'bg-pink-400 border-pink-600' },
  '1': { 1: 'bg-amber-400 border-amber-600',  [-1]: 'bg-gray-400 border-gray-600'  },
};

// ─── Expression builder ───────────────────────────────────────────────────────
function buildExpression(tiles: Tile[]): string {
  const counts: Record<string, number> = { x2: 0, x: 0, '1': 0 };
  for (const t of tiles) {
    counts[t.kind] = (counts[t.kind] ?? 0) + t.sign;
  }
  const parts: string[] = [];
  if (counts.x2 !== 0) parts.push(counts.x2 === 1 ? 'x^2' : counts.x2 === -1 ? '-x^2' : `${counts.x2}x^2`);
  if (counts.x  !== 0) parts.push(counts.x  === 1 ? 'x'   : counts.x  === -1 ? '-x'   : `${counts.x}x`);
  if (counts['1'] !== 0) parts.push(String(counts['1']));
  if (parts.length === 0) return '0';
  return parts
    .join(' + ')
    .replace(/\+ -/g, '- ');
}

// ─── Component ────────────────────────────────────────────────────────────────
let uidCounter = 0;
const uid = () => `t${++uidCounter}`;

const CANVAS_W = 520;
const CANVAS_H = 280;

export const AlgebraTilesCanvas: React.FC = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [dragging, setDragging] = useState<{ id: string; offX: number; offY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Add tile from palette ──────────────────────────────────────────────────
  const addTile = useCallback((kind: TileKind, sign: TileSign) => {
    const cfg = TILE_CONFIG[kind];
    // Stack new tiles in rows
    const existing = tiles.filter(t => t.kind === kind && t.sign === sign);
    const col = existing.length % 6;
    const row = Math.floor(existing.length / 6);
    const baseX: Record<TileKind, number> = { x2: 10, x: 10, '1': 10 };
    const baseY: Record<TileKind, number> = { x2: 10, x: 90, '1': 160 };
    setTiles(prev => [
      ...prev,
      {
        id: uid(),
        kind,
        sign,
        x: baseX[kind] + col * (cfg.w + 6),
        y: baseY[kind] + row * (cfg.h + 6),
      },
    ]);
  }, [tiles]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;
    setDragging({ id, offX: e.clientX - rect.left - tile.x, offY: e.clientY - rect.top - tile.y });
  }, [tiles]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cfg = TILE_CONFIG[tiles.find(t => t.id === dragging.id)!.kind];
    const newX = Math.max(0, Math.min(CANVAS_W - cfg.w, e.clientX - rect.left - dragging.offX));
    const newY = Math.max(0, Math.min(CANVAS_H - cfg.h, e.clientY - rect.top - dragging.offY));
    setTiles(prev => prev.map(t => t.id === dragging.id ? { ...t, x: newX, y: newY } : t));
  }, [dragging, tiles]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  // ── Double-click to remove ─────────────────────────────────────────────────
  const removeTile = useCallback((id: string) => {
    setTiles(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Simplify: remove zero pairs ────────────────────────────────────────────
  const simplify = useCallback(() => {
    setTiles(prev => {
      const result: Tile[] = [];
      const pos: Record<TileKind, Tile[]> = { x2: [], x: [], '1': [] };
      const neg: Record<TileKind, Tile[]> = { x2: [], x: [], '1': [] };
      for (const t of prev) {
        (t.sign === 1 ? pos : neg)[t.kind].push(t);
      }
      for (const kind of ['x2', 'x', '1'] as TileKind[]) {
        const pairs = Math.min(pos[kind].length, neg[kind].length);
        result.push(...pos[kind].slice(pairs));
        result.push(...neg[kind].slice(pairs));
      }
      return result;
    });
  }, []);

  const zeroPairs = (['x2', 'x', '1'] as TileKind[]).reduce((sum, k) => {
    const p = tiles.filter(t => t.kind === k && t.sign === 1).length;
    const n = tiles.filter(t => t.kind === k && t.sign === -1).length;
    return sum + Math.min(p, n);
  }, 0);

  const expr = buildExpression(tiles);

  // ── Palette button ─────────────────────────────────────────────────────────
  const PaletteBtn = ({ kind, sign }: { kind: TileKind; sign: TileSign }) => {
    const cfg = TILE_CONFIG[kind];
    const colors = TILE_COLOR[kind][sign];
    return (
      <button
        type="button"
        title={`Додај ${sign === -1 ? '-' : '+'}${cfg.label}`}
        onClick={() => addTile(kind, sign)}
        className={`flex items-center justify-center rounded border-2 text-white font-black text-xs select-none active:scale-95 transition-transform ${colors}`}
        style={{ width: Math.min(cfg.w, 40), height: Math.min(cfg.h, 40), minWidth: Math.min(cfg.w, 40) }}
      >
        {sign === -1 ? '-' : '+'}{cfg.label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Expression display */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-950 rounded-2xl">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex-shrink-0">Израз</span>
        <div className="flex-1 text-white text-lg font-bold">
          <MathRenderer text={`$${expr}$`} />
        </div>
        {zeroPairs > 0 && (
          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">
            {zeroPairs} нулти пар{zeroPairs > 1 ? 'а' : ''}
          </span>
        )}
      </div>

      <div className="flex gap-3">
        {/* Palette */}
        <div className="flex flex-col gap-2 w-[92px] flex-shrink-0">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Палета</p>
          {(['x2', 'x', '1'] as TileKind[]).map(kind => (
            <div key={kind} className="flex gap-1.5 justify-center">
              <PaletteBtn kind={kind} sign={1} />
              <PaletteBtn kind={kind} sign={-1} />
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 flex flex-col gap-1.5">
            <button type="button" onClick={simplify} disabled={zeroPairs === 0}
              title="Отстрани нулти парови"
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 disabled:opacity-30 transition-colors">
              <Sparkles className="w-3 h-3" /> Поедностави
            </button>
            <button type="button" onClick={() => setTiles([])}
              title="Исчисти платно"
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[10px] font-bold hover:bg-gray-200 transition-colors">
              <Trash2 className="w-3 h-3" /> Исчисти
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden cursor-default"
          style={{ width: CANVAS_W, height: CANVAS_H }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {tiles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs text-gray-400 font-medium text-center px-6">
                Кликни плочки од палетата за да ги додадеш на платното.<br />
                Влечи за да ги придвижиш · двоен клик за бришење.
              </p>
            </div>
          )}
          {tiles.map(tile => {
            const cfg = TILE_CONFIG[tile.kind];
            const colors = TILE_COLOR[tile.kind][tile.sign];
            const isDragged = dragging?.id === tile.id;
            return (
              <div
                key={tile.id}
                onMouseDown={e => onMouseDown(e, tile.id)}
                onDoubleClick={() => removeTile(tile.id)}
                title="Влечи за преместување · двоен клик за бришење"
                className={`absolute flex items-center justify-center rounded border-2 text-white font-black text-[10px] cursor-grab active:cursor-grabbing transition-shadow ${colors} ${isDragged ? 'shadow-2xl ring-2 ring-white z-10' : 'shadow-sm hover:shadow-md'}`}
                style={{ left: tile.x, top: tile.y, width: cfg.w, height: cfg.h }}
              >
                {cfg.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
        {(['x2', 'x', '1'] as TileKind[]).map(kind => (
          <React.Fragment key={kind}>
            <span className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded border ${TILE_COLOR[kind][1]} inline-block`} />
              +{TILE_CONFIG[kind].label}
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded border ${TILE_COLOR[kind][-1]} inline-block`} />
              −{TILE_CONFIG[kind].label}
            </span>
          </React.Fragment>
        ))}
        <span className="ml-auto italic">Нулти пар = плочки со спротивен знак се поништуваат</span>
      </div>
    </div>
  );
};
