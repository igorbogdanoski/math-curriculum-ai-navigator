import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Trash2, Undo2 } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import {
  type TileKind, type TileSign, type Tile,
  TILE_CONFIG, TILE_COLOR, BALANCE_PRESETS,
  buildExpression, CANVAS_H, BASE_Y,
  layoutTiles, UNDO_MAX, nextUid, tileCoefficients, isBalanced,
} from './algebraTilesMath';

export interface AlgebraTilesBalanceModeProps {
  balanceLeftSpecs?: { kind: TileKind; sign: TileSign; count: number }[];
  compact?: boolean;
  readOnly?: boolean;
  onSolve?: () => void;
}

// ─── PaletteBtn ───────────────────────────────────────────────────────────────
function PaletteBtn({ kind, sign, pan, onAdd, readOnly }: {
  kind: TileKind; sign: TileSign; pan: 'left' | 'right';
  onAdd: (kind: TileKind, sign: TileSign, pan: 'left' | 'right') => void;
  readOnly?: boolean;
}) {
  const cfg = TILE_CONFIG[kind];
  const colors = TILE_COLOR[kind][sign];
  return (
    <button
      type="button"
      title={`Додај ${sign === -1 ? '−' : '+'}${cfg.label}`}
      onClick={() => onAdd(kind, sign, pan)}
      disabled={readOnly}
      className={`flex items-center justify-center rounded border-2 font-black text-xs select-none active:scale-95 transition-transform ${colors} disabled:opacity-40 disabled:cursor-not-allowed`}
      style={{ width: Math.min(cfg.w, 40), height: Math.min(cfg.h, 40), minWidth: Math.min(cfg.w, 40) }}
    >
      {sign === -1 ? '−' : '+'}{cfg.label}
    </button>
  );
}

// ─── TilePanCanvas ────────────────────────────────────────────────────────────
function TilePanCanvas({ panTiles, panRef, panKey, label, compact, readOnly, onRemove, onUndo }: {
  panTiles: Tile[];
  panRef: React.RefObject<HTMLDivElement | null>;
  panKey: 'left' | 'right';
  label?: string;
  compact?: boolean;
  readOnly?: boolean;
  onRemove: (id: string) => void;
  onUndo: () => void;
}) {
  const panHeight = compact ? 160 : CANVAS_H;
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      {label && (
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase tracking-widest ${panKey === 'left' ? 'text-blue-400' : 'text-emerald-400'}`}>{label}</span>
          <div className={`h-[2px] flex-1 rounded-full ${panKey === 'left' ? 'bg-blue-800' : 'bg-emerald-800'}`} />
          <span className="text-[10px] text-slate-400 font-mono">
            <MathRenderer text={`$${buildExpression(panTiles)}$`} />
          </span>
        </div>
      )}
      <div
        ref={panRef as React.RefObject<HTMLDivElement>}
        className={`relative rounded-xl border-2 border-dashed overflow-hidden ${panKey === 'left' ? 'border-blue-300/50 bg-blue-50/30' : 'border-emerald-300/50 bg-emerald-50/30'}`}
        style={{ width: '100%', minWidth: 230, height: panHeight }}
      >
        {panTiles.length === 0 && !readOnly && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
              Кликни плочки од палетата<br />{panKey === 'right' ? 'за да балансираш' : ''}
            </p>
          </div>
        )}
        {panTiles.map(tile => {
          const cfg = TILE_CONFIG[tile.kind];
          const colors = TILE_COLOR[tile.kind][tile.sign];
          return (
            <div
              key={tile.id}
              onDoubleClick={() => !readOnly && onRemove(tile.id)}
              title={readOnly ? cfg.label : 'Двоен клик за бришење'}
              className={`absolute flex items-center justify-center rounded border-2 font-black text-[10px] select-none ${colors} ${readOnly ? '' : 'cursor-pointer hover:scale-105 hover:shadow-md'} transition-transform shadow-sm`}
              style={{ left: tile.x, top: tile.y, width: cfg.w, height: cfg.h }}
            >
              {cfg.label}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onUndo}
          className="self-start flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-[9px] font-bold hover:bg-gray-200 transition-colors"
        >
          <Undo2 className="w-2.5 h-2.5" /> Откажи
        </button>
      )}
    </div>
  );
}

// ─── BalanceScaleSvg ──────────────────────────────────────────────────────────
function BalanceScaleSvg({ leftTiles, rightTiles }: { leftTiles: Tile[]; rightTiles: Tile[] }) {
  const balanced = isBalanced(leftTiles, rightTiles);
  const lCoef = tileCoefficients(leftTiles);
  const rCoef = tileCoefficients(rightTiles);
  const lWeight = Math.abs(lCoef.x2 * 4 + lCoef.x * 2 + lCoef.c);
  const rWeight = Math.abs(rCoef.x2 * 4 + rCoef.x * 2 + rCoef.c);
  const tilt = balanced ? 0 : lWeight > rWeight ? -14 : 14;
  return (
    <div className="flex flex-col items-center justify-center w-16 flex-shrink-0">
      <svg width="56" height="120" viewBox="0 0 56 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="26" y="40" width="4" height="75" rx="2" fill="#6366F1" />
        <rect x="10" y="112" width="36" height="6" rx="3" fill="#4338CA" />
        <g transform={`rotate(${tilt}, 28, 40)`} style={{ transition: 'transform 0.5s cubic-bezier(.34,1.56,.64,1)' }}>
          <rect x="4" y="37" width="48" height="6" rx="3" fill={balanced ? '#10B981' : '#6366F1'} />
          <line x1="8" y1="40" x2="8" y2="58" stroke="#94A3B8" strokeWidth={1.5} />
          <ellipse cx="8" cy="62" rx="10" ry="5" fill={balanced ? '#D1FAE5' : '#EEF2FF'} stroke={balanced ? '#10B981' : '#818CF8'} strokeWidth={1.5} />
          <line x1="48" y1="40" x2="48" y2="58" stroke="#94A3B8" strokeWidth={1.5} />
          <ellipse cx="48" cy="62" rx="10" ry="5" fill={balanced ? '#D1FAE5' : '#EEF2FF'} stroke={balanced ? '#10B981' : '#818CF8'} strokeWidth={1.5} />
        </g>
      </svg>
      <span className={`text-[9px] font-black text-center mt-1 transition-colors ${balanced ? 'text-emerald-600' : 'text-indigo-400'}`}>
        {balanced ? '⚖️ Бал.' : '⚖️ везна'}
      </span>
    </div>
  );
}

// ─── AlgebraTilesBalanceMode ──────────────────────────────────────────────────
export function AlgebraTilesBalanceMode({
  balanceLeftSpecs,
  compact = false,
  readOnly = false,
  onSolve,
}: AlgebraTilesBalanceModeProps) {
  const initLeft = useCallback((): Tile[] =>
    balanceLeftSpecs && balanceLeftSpecs.length > 0 ? layoutTiles(balanceLeftSpecs) : [],
  [balanceLeftSpecs]);

  const [leftTiles,  setLeftTiles]  = useState<Tile[]>(initLeft);
  const [rightTiles, setRightTiles] = useState<Tile[]>([]);
  const [balancePresetIdx, setBalancePresetIdx] = useState(0);
  const [balanceSolved, setBalanceSolved]       = useState(false);

  const leftUndoStack  = useRef<Tile[][]>([]);
  const rightUndoStack = useRef<Tile[][]>([]);
  const leftPanRef  = useRef<HTMLDivElement>(null);
  const rightPanRef = useRef<HTMLDivElement>(null);

  const addTileToPan = useCallback((kind: TileKind, sign: TileSign, pan: 'left' | 'right') => {
    const setter  = pan === 'left' ? setLeftTiles  : setRightTiles;
    const undoRef = pan === 'left' ? leftUndoStack : rightUndoStack;
    setter(prev => {
      undoRef.current = [...undoRef.current.slice(-UNDO_MAX + 1), prev.map(t => ({ ...t }))];
      const cfg = TILE_CONFIG[kind];
      const existing = prev.filter(t => t.kind === kind && t.sign === sign);
      const col = existing.length % 5;
      const row = Math.floor(existing.length / 5);
      return [...prev, {
        id: nextUid(), kind, sign,
        x: 8 + col * (cfg.w + 5),
        y: BASE_Y[kind] + row * (cfg.h + 5),
      }];
    });
  }, []);

  const removeTileFromPan = useCallback((id: string, pan: 'left' | 'right') => {
    const setter  = pan === 'left' ? setLeftTiles  : setRightTiles;
    const undoRef = pan === 'left' ? leftUndoStack : rightUndoStack;
    setter(prev => {
      undoRef.current = [...undoRef.current.slice(-UNDO_MAX + 1), prev.map(t => ({ ...t }))];
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const undoPan = useCallback((pan: 'left' | 'right') => {
    const undoRef = pan === 'left' ? leftUndoStack : rightUndoStack;
    const setter  = pan === 'left' ? setLeftTiles  : setRightTiles;
    if (undoRef.current.length === 0) return;
    setter(undoRef.current.pop()!);
  }, []);

  const clearPan = useCallback((pan: 'left' | 'right') => {
    const setter  = pan === 'left' ? setLeftTiles  : setRightTiles;
    const undoRef = pan === 'left' ? leftUndoStack : rightUndoStack;
    setter(prev => {
      undoRef.current = [...undoRef.current.slice(-UNDO_MAX + 1), prev.map(t => ({ ...t }))];
      return [];
    });
  }, []);

  const loadBalancePreset = useCallback((idx: number) => {
    const bp = BALANCE_PRESETS[idx];
    if (!bp) return;
    setBalancePresetIdx(idx);
    setBalanceSolved(false);
    setLeftTiles(layoutTiles(bp.left));
    setRightTiles(layoutTiles(bp.right));
  }, []);

  useEffect(() => {
    if (leftTiles.length === 0 && rightTiles.length === 0) return;
    const balanced = isBalanced(leftTiles, rightTiles);
    if (balanced && !balanceSolved) {
      setBalanceSolved(true);
      onSolve?.();
    } else if (!balanced && balanceSolved) {
      setBalanceSolved(false);
    }
  }, [leftTiles, rightTiles, balanceSolved, onSolve]);

  const currentPreset = BALANCE_PRESETS[balancePresetIdx];

  return (
    <div className="flex flex-col gap-3 select-none bg-white rounded-2xl p-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-950 rounded-2xl flex-wrap">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">⚖️ Везна — балансирај ги страните</span>
        {balanceSolved && (
          <span className="ml-auto text-[10px] bg-emerald-500 text-white px-3 py-0.5 rounded-full font-black animate-pulse">
            ✅ Балансирано!
          </span>
        )}
      </div>

      {/* Challenge banner */}
      {currentPreset && (
        <div className={`px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
          balanceSolved ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-violet-50 border-violet-200 text-violet-700'
        }`}>
          {balanceSolved ? (
            <span>🎉 Браво! Двете страни се еднакви: <MathRenderer text={`$${buildExpression(leftTiles)} = ${buildExpression(rightTiles)}$`} /></span>
          ) : (
            <span>{currentPreset.challenge} <span className="text-gray-400 ml-1">({currentPreset.gradeHint})</span></span>
          )}
        </div>
      )}

      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5 px-1">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest self-center mr-1">Задачи:</span>
        {BALANCE_PRESETS.map((bp, i) => (
          <button
            key={bp.label}
            type="button"
            onClick={() => loadBalancePreset(i)}
            className={`px-2 py-0.5 rounded-xl border text-[9px] font-bold transition-all font-mono ${
              balancePresetIdx === i ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {bp.label}
          </button>
        ))}
      </div>

      {/* Two-pan layout */}
      <div className="flex gap-2 items-start">
        {/* Left side palette + pan */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {(['x2', 'x', '1'] as TileKind[]).flatMap(k => [
              <PaletteBtn key={`L${k}+`} kind={k} sign={1}  pan="left" onAdd={addTileToPan} readOnly={readOnly} />,
              <PaletteBtn key={`L${k}-`} kind={k} sign={-1} pan="left" onAdd={addTileToPan} readOnly={readOnly} />,
            ])}
            <button type="button" disabled={readOnly} onClick={() => clearPan('left')}
              className="flex items-center justify-center w-9 h-9 rounded border-2 bg-gray-100 border-gray-300 text-gray-500 text-[10px] hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <TilePanCanvas panTiles={leftTiles} panRef={leftPanRef} panKey="left" label="Лева страна"
            compact={compact} readOnly={readOnly}
            onRemove={id => removeTileFromPan(id, 'left')}
            onUndo={() => undoPan('left')} />
        </div>

        {/* Balance scale */}
        <BalanceScaleSvg leftTiles={leftTiles} rightTiles={rightTiles} />

        {/* Right side palette + pan */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {(['x2', 'x', '1'] as TileKind[]).flatMap(k => [
              <PaletteBtn key={`R${k}+`} kind={k} sign={1}  pan="right" onAdd={addTileToPan} readOnly={readOnly} />,
              <PaletteBtn key={`R${k}-`} kind={k} sign={-1} pan="right" onAdd={addTileToPan} readOnly={readOnly} />,
            ])}
            <button type="button" disabled={readOnly} onClick={() => clearPan('right')}
              className="flex items-center justify-center w-9 h-9 rounded border-2 bg-gray-100 border-gray-300 text-gray-500 text-[10px] hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <TilePanCanvas panTiles={rightTiles} panRef={rightPanRef} panKey="right" label="Десна страна"
            compact={compact} readOnly={readOnly}
            onRemove={id => removeTileFromPan(id, 'right')}
            onUndo={() => undoPan('right')} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 px-1">
        {(['x2', 'x', '1'] as TileKind[]).flatMap(kind => [
          <span key={`${kind}+`} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded border-2 ${TILE_COLOR[kind][1]} inline-block`} />
            +{TILE_CONFIG[kind].label}
          </span>,
          <span key={`${kind}-`} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded border-2 ${TILE_COLOR[kind][-1]} inline-block`} />
            −{TILE_CONFIG[kind].label}
          </span>,
        ])}
        <span className="ml-auto italic opacity-70">Двоен клик на плочка за бришење</span>
      </div>
    </div>
  );
}
