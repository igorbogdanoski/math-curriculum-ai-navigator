/**
 * AlgebraTilesCanvas — world-class interactive visual algebra manipulative.
 *
 * Features:
 *  - Palette: click to add x², x, 1 tiles (positive + negative)
 *  - Canvas: drag (mouse + touch), double-click/tap to remove
 *  - Preset expressions: auto-populate tiles — 14 presets organised by grade (6–10+)
 *  - Guided Factoring Mode: arrange tiles into a rectangle to factor
 *  - Balance Mode (D1): two-sided equation scale — visual equality explorer
 *  - Zero-pair detection + Simplify button
 *  - Undo stack (20 steps, Ctrl+Z, undo button)
 *  - PNG export via html2canvas → share in Forum
 *  - Live LaTeX expression with MathRenderer
 *  - Full touch support (mobile/tablet)
 *  - compact prop: reduced layout for embedding in slides/quizzes
 *  - readOnly prop: view-only (no drag, no palette)
 *  - onSolve callback: fires when a quiz challenge is met
 *  - Macedonian UI
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { RefreshCw, Sparkles, Trash2, Undo2, Camera, BookOpen, Share2, Link2, CheckCheck } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { buildTileShareUrl } from '../../utils/visualShareUrl';
import type { TileSpec } from '../../utils/visualShareUrl';

// ─── Types ────────────────────────────────────────────────────────────────────
type TileKind = 'x2' | 'x' | '1';
type TileSign = 1 | -1;

interface Tile {
  id: string;
  kind: TileKind;
  sign: TileSign;
  x: number;
  y: number;
}

// ─── Visual config ─────────────────────────────────────────────────────────────
const TILE_CONFIG: Record<TileKind, { w: number; h: number; label: string }> = {
  x2: { w: 64, h: 64, label: 'x²' },
  x:  { w: 64, h: 24, label: 'x'  },
  '1': { w: 24, h: 24, label: '1' },
};

const TILE_COLOR: Record<TileKind, Record<TileSign, string>> = {
  x2:  { 1: 'bg-blue-500 border-blue-700 text-white',    [-1]: 'bg-red-400 border-red-600 text-white'    },
  x:   { 1: 'bg-emerald-500 border-emerald-700 text-white', [-1]: 'bg-pink-400 border-pink-600 text-white' },
  '1': { 1: 'bg-amber-400 border-amber-600 text-gray-900', [-1]: 'bg-gray-400 border-gray-600 text-white' },
};

// ─── Preset expressions ────────────────────────────────────────────────────────
interface Preset {
  label: string;
  latex: string;
  gradeHint?: string;
  tiles: { kind: TileKind; sign: TileSign; count: number }[];
}

const PRESETS: Preset[] = [
  // ─── 6-то одделение — линеарни изрази ────────────────────────────────────
  {
    label: '2x+4',
    latex: '2x+4',
    gradeHint: '6. одд.',
    tiles: [
      { kind: 'x',  sign: 1, count: 2 },
      { kind: '1',  sign: 1, count: 4 },
    ],
  },
  {
    label: '3x+6',
    latex: '3x+6',
    gradeHint: '6. одд.',
    tiles: [
      { kind: 'x',  sign: 1, count: 3 },
      { kind: '1',  sign: 1, count: 6 },
    ],
  },
  {
    label: 'x+3',
    latex: 'x+3',
    gradeHint: '6. одд.',
    tiles: [
      { kind: 'x',  sign: 1, count: 1 },
      { kind: '1',  sign: 1, count: 3 },
    ],
  },
  // ─── 7-мо одделение — уводна квадратна ──────────────────────────────────
  {
    label: 'x²+3x+2',
    latex: 'x^2+3x+2',
    gradeHint: '7. одд.',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 3 },
      { kind: '1',  sign: 1, count: 2 },
    ],
  },
  {
    label: 'x²+5x+6',
    latex: 'x^2+5x+6',
    gradeHint: '7. одд.',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 5 },
      { kind: '1',  sign: 1, count: 6 },
    ],
  },
  {
    label: 'x²-x-2',
    latex: 'x^2-x-2',
    gradeHint: '7. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: 'x',  sign: -1, count: 1 },
      { kind: '1',  sign: -1, count: 2 },
    ],
  },
  // ─── 8-мо одделение — факторизација ──────────────────────────────────────
  {
    label: 'x²-4',
    latex: 'x^2-4',
    gradeHint: '8. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: '1',  sign: -1, count: 4 },
    ],
  },
  {
    label: 'x²+4x+4',
    latex: 'x^2+4x+4',
    gradeHint: '8. одд.',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 4 },
      { kind: '1',  sign: 1, count: 4 },
    ],
  },
  {
    label: 'x²-6x+9',
    latex: 'x^2-6x+9',
    gradeHint: '8. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: 'x',  sign: -1, count: 6 },
      { kind: '1',  sign: 1,  count: 9 },
    ],
  },
  // ─── 9-то одделение / Средно — сложена факторизација ─────────────────────
  {
    label: '2x²+5x+3',
    latex: '2x^2+5x+3',
    gradeHint: '9. одд.+',
    tiles: [
      { kind: 'x2', sign: 1, count: 2 },
      { kind: 'x',  sign: 1, count: 5 },
      { kind: '1',  sign: 1, count: 3 },
    ],
  },
  {
    label: 'x²-2x-3',
    latex: 'x^2-2x-3',
    gradeHint: '9. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: 'x',  sign: -1, count: 2 },
      { kind: '1',  sign: -1, count: 3 },
    ],
  },
  {
    label: 'x²+6x+9',
    latex: 'x^2+6x+9',
    gradeHint: '9. одд. (потполен квадрат)',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 6 },
      { kind: '1',  sign: 1, count: 9 },
    ],
  },
  {
    label: 'x²-9',
    latex: 'x^2-9',
    gradeHint: '9–10. одд. (разлика на квадрати)',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: '1',  sign: -1, count: 9 },
    ],
  },
  {
    label: '3x²+6x+3',
    latex: '3x^2+6x+3',
    gradeHint: '10. одд. (заеднички фактор)',
    tiles: [
      { kind: 'x2', sign: 1, count: 3 },
      { kind: 'x',  sign: 1, count: 6 },
      { kind: '1',  sign: 1, count: 3 },
    ],
  },
];

// ─── Balance mode presets ──────────────────────────────────────────────────────
interface BalancePreset {
  label: string;
  gradeHint: string;
  challenge: string;  // What to explain to the student
  left: { kind: TileKind; sign: TileSign; count: number }[];
  right: { kind: TileKind; sign: TileSign; count: number }[];
}

const BALANCE_PRESETS: BalancePreset[] = [
  {
    label: 'x+x+2 = 2x+2',
    gradeHint: '6. одд.',
    challenge: 'Сподели ги плочките на десната страна за да го провериш: x + x + 2 = 2x + 2',
    left:  [{ kind: 'x', sign: 1, count: 2 }, { kind: '1', sign: 1, count: 2 }],
    right: [{ kind: 'x', sign: 1, count: 2 }, { kind: '1', sign: 1, count: 2 }],
  },
  {
    label: '2x+4 = 2(x+2)',
    gradeHint: '6–7. одд.',
    challenge: 'Лева: 2x+4. Десна: додај плочки за 2(x+2). Тежиниот треба да биде еднаков.',
    left:  [{ kind: 'x', sign: 1, count: 2 }, { kind: '1', sign: 1, count: 4 }],
    right: [],
  },
  {
    label: 'x²+3x+2 = (x+1)(x+2)',
    gradeHint: '7–8. одд.',
    challenge: 'Лева: x²+3x+2. Десна: додај плочки за истиот израз (или наредете ги во правоаголник).',
    left:  [{ kind: 'x2', sign: 1, count: 1 }, { kind: 'x', sign: 1, count: 3 }, { kind: '1', sign: 1, count: 2 }],
    right: [],
  },
  {
    label: 'x²-4 = (x-2)(x+2)',
    gradeHint: '8–9. одд.',
    challenge: 'Лева: x²-4 (разлика на квадрати). Балансирај ја десната страна.',
    left:  [{ kind: 'x2', sign: 1, count: 1 }, { kind: '1', sign: -1, count: 4 }],
    right: [],
  },
  {
    label: 'x²+4x+4 = (x+2)²',
    gradeHint: '8–9. одд. (потполен квадрат)',
    challenge: 'Лева: x²+4x+4 = (x+2)². Репродуцирај го истиот израз на десната страна.',
    left:  [{ kind: 'x2', sign: 1, count: 1 }, { kind: 'x', sign: 1, count: 4 }, { kind: '1', sign: 1, count: 4 }],
    right: [],
  },
];

// ─── Expression builder ────────────────────────────────────────────────────────
function buildExpression(tiles: Tile[]): string {
  const counts: Record<string, number> = { x2: 0, x: 0, '1': 0 };
  for (const t of tiles) counts[t.kind] = (counts[t.kind] ?? 0) + t.sign;
  const parts: string[] = [];
  if (counts.x2 !== 0) parts.push(counts.x2 === 1 ? 'x^2' : counts.x2 === -1 ? '-x^2' : `${counts.x2}x^2`);
  if (counts.x  !== 0) parts.push(counts.x  === 1 ? 'x'   : counts.x  === -1 ? '-x'   : `${counts.x}x`);
  if (counts['1'] !== 0) parts.push(String(counts['1']));
  if (parts.length === 0) return '0';
  return parts.join(' + ').replace(/\+ -/g, '- ');
}

// ─── Layout helpers ────────────────────────────────────────────────────────────
const CANVAS_W = 500;
const CANVAS_H = 280;

const BASE_Y: Record<TileKind, number> = { x2: 10, x: 90, '1': 160 };

function layoutTiles(specs: { kind: TileKind; sign: TileSign; count: number }[]): Tile[] {
  let uid = 0;
  const result: Tile[] = [];
  const posCounters: Record<string, number> = {};
  for (const { kind, sign, count } of specs) {
    const key = `${kind}_${sign}`;
    if (posCounters[key] === undefined) posCounters[key] = 0;
    const cfg = TILE_CONFIG[kind];
    for (let i = 0; i < count; i++) {
      const n = posCounters[key]++;
      const col = n % 6;
      const row = Math.floor(n / 6);
      result.push({
        id: `preset_${uid++}`,
        kind, sign,
        x: 10 + col * (cfg.w + 6),
        y: BASE_Y[kind] + row * (cfg.h + 6),
      });
    }
  }
  return result;
}

// ─── Undo helpers ──────────────────────────────────────────────────────────────
const UNDO_MAX = 20;

// ─── ID counter ───────────────────────────────────────────────────────────────
let _uid = 0;
const nextUid = () => `t${++_uid}`;

// ─── Coefficient extractor (for balance comparison) ────────────────────────────
function tileCoefficients(tiles: Tile[]): { x2: number; x: number; c: number } {
  let x2 = 0, x = 0, c = 0;
  for (const t of tiles) {
    if (t.kind === 'x2') x2 += t.sign;
    else if (t.kind === 'x') x += t.sign;
    else c += t.sign;
  }
  return { x2, x, c };
}

function isBalanced(left: Tile[], right: Tile[]): boolean {
  const l = tileCoefficients(left);
  const r = tileCoefficients(right);
  return l.x2 === r.x2 && l.x === r.x && l.c === r.c;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AlgebraTilesCanvasProps {
  /** Pre-populate with a preset key, e.g. "x²+3x+2" */
  presetExpression?: string;
  /** Pre-populate from decoded URL share specs (C2.4) */
  initialTileSpecs?: TileSpec[];
  /** Show "Share to Forum" button — calls back with PNG data URL */
  onForumShare?: (dataUrl: string) => void;
  /** 'default' = full single-canvas mode; 'balance' = two-sided equation scale */
  mode?: 'default' | 'balance';
  /** Balance mode: pre-fill left side with these specs */
  balanceLeftSpecs?: { kind: TileKind; sign: TileSign; count: number }[];
  /** Compact layout — smaller canvas, no export buttons; for embedding in slides/quizzes */
  compact?: boolean;
  /** View-only: no drag, no palette, no editing controls */
  readOnly?: boolean;
  /** Fires when balanced or factoring is solved (quiz integration) */
  onSolve?: () => void;
}

/** Convert live Tile[] → TileSpec[] for URL encoding */
function tilesToSpecs(tiles: Tile[]): TileSpec[] {
  const counts = new Map<string, number>();
  for (const t of tiles) {
    const key = `${t.kind}:${t.sign}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const result: TileSpec[] = [];
  for (const kind of ['x2', 'x', '1'] as TileKind[]) {
    const pos = counts.get(`${kind}:1`) ?? 0;
    const neg = counts.get(`${kind}:-1`) ?? 0;
    if (pos > 0) result.push({ kind, sign: 1, count: pos });
    if (neg > 0) result.push({ kind, sign: -1, count: neg });
  }
  return result;
}

export const AlgebraTilesCanvas: React.FC<AlgebraTilesCanvasProps> = ({
  presetExpression,
  initialTileSpecs,
  onForumShare,
  mode = 'default',
  balanceLeftSpecs,
  compact = false,
  readOnly = false,
  onSolve,
}) => {
  const initTiles = useCallback((): Tile[] => {
    if (initialTileSpecs && initialTileSpecs.length > 0) {
      return layoutTiles(initialTileSpecs);
    }
    if (!presetExpression) return [];
    const preset = PRESETS.find(p => p.label === presetExpression || p.latex === presetExpression);
    return preset ? layoutTiles(preset.tiles) : [];
  }, [presetExpression, initialTileSpecs]);

  const [tiles, setTiles] = useState<Tile[]>(initTiles);
  const [guidedMode, setGuidedMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const guidedSolveReported = useRef(false);

  // ── Balance mode state ──────────────────────────────────────────────────────
  const initBalanceLeft = useCallback((): Tile[] =>
    balanceLeftSpecs && balanceLeftSpecs.length > 0 ? layoutTiles(balanceLeftSpecs) : [],
  [balanceLeftSpecs]);
  const [leftTiles, setLeftTiles]   = useState<Tile[]>(initBalanceLeft);
  const [rightTiles, setRightTiles] = useState<Tile[]>([]);
  const [balancePresetIdx, setBalancePresetIdx] = useState(0);
  const [balanceSolved, setBalanceSolved]       = useState(false);

  const leftUndoStack  = useRef<Tile[][]>([]);
  const rightUndoStack = useRef<Tile[][]>([]);

  // Undo stack: array of tile snapshots
  const undoStack = useRef<Tile[][]>([]);
  const dragging = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const defaultCanvasWidth = compact ? 320 : CANVAS_W;
  const defaultCanvasHeight = compact ? 220 : CANVAS_H;

  // Push current state to undo stack before any mutating operation
  const pushUndo = useCallback((current: Tile[]) => {
    undoStack.current = [...undoStack.current.slice(-UNDO_MAX + 1), current.map(t => ({ ...t }))];
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setTiles(prev);
  }, []);

  // Keyboard undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // ── Add tile ────────────────────────────────────────────────────────────────
  const addTile = useCallback((kind: TileKind, sign: TileSign) => {
    setTiles(prev => {
      pushUndo(prev);
      const cfg = TILE_CONFIG[kind];
      const existing = prev.filter(t => t.kind === kind && t.sign === sign);
      const col = existing.length % 6;
      const row = Math.floor(existing.length / 6);
      return [...prev, {
        id: nextUid(), kind, sign,
        x: 10 + col * (cfg.w + 6),
        y: BASE_Y[kind] + row * (cfg.h + 6),
      }];
    });
  }, [pushUndo]);

  // ── Load preset ─────────────────────────────────────────────────────────────
  const loadPreset = useCallback((preset: Preset) => {
    setTiles(prev => { pushUndo(prev); return layoutTiles(preset.tiles); });
  }, [pushUndo]);

  // ── Remove tile ─────────────────────────────────────────────────────────────
  const removeTile = useCallback((id: string) => {
    setTiles(prev => { pushUndo(prev); return prev.filter(t => t.id !== id); });
  }, [pushUndo]);

  // ── Drag (mouse) ────────────────────────────────────────────────────────────
  const getCanvasRect = () => canvasRef.current?.getBoundingClientRect();

  const startDrag = useCallback((id: string, clientX: number, clientY: number) => {
    const rect = getCanvasRect();
    if (!rect) return;
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;
    dragging.current = { id, offX: clientX - rect.left - tile.x, offY: clientY - rect.top - tile.y };
  }, [tiles]);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current || !canvasRef.current) return;
    const rect = getCanvasRect()!;
    const cfg = TILE_CONFIG[tiles.find(t => t.id === dragging.current!.id)!.kind];
    const newX = Math.max(0, Math.min(defaultCanvasWidth - cfg.w, clientX - rect.left - dragging.current.offX));
    const newY = Math.max(0, Math.min(defaultCanvasHeight - cfg.h, clientY - rect.top - dragging.current.offY));
    setTiles(prev => prev.map(t => t.id === dragging.current!.id ? { ...t, x: newX, y: newY } : t));
  }, [defaultCanvasHeight, defaultCanvasWidth, tiles]);

  const endDrag = useCallback(() => { dragging.current = null; }, []);

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent, id: string) => {
    if (readOnly) return;
    e.preventDefault();
    startDrag(id, e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => moveDrag(e.clientX, e.clientY);
  const onMouseUp = () => endDrag();

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent, id: string) => {
    if (readOnly) return;
    e.preventDefault();
    const t = e.touches[0];
    startDrag(id, t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (readOnly || !dragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  };
  const onTouchEnd = () => endDrag();

  // ── Simplify: remove zero pairs ─────────────────────────────────────────────
  const simplify = useCallback(() => {
    setTiles(prev => {
      pushUndo(prev);
      const pos: Record<TileKind, Tile[]> = { x2: [], x: [], '1': [] };
      const neg: Record<TileKind, Tile[]> = { x2: [], x: [], '1': [] };
      for (const t of prev) (t.sign === 1 ? pos : neg)[t.kind].push(t);
      const result: Tile[] = [];
      for (const kind of ['x2', 'x', '1'] as TileKind[]) {
        const pairs = Math.min(pos[kind].length, neg[kind].length);
        result.push(...pos[kind].slice(pairs), ...neg[kind].slice(pairs));
      }
      return result;
    });
  }, [pushUndo]);

  // ── PNG export ───────────────────────────────────────────────────────────────
  const exportPng = useCallback(async () => {
    if (!wrapperRef.current || exporting) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(wrapperRef.current, { scale: 2, backgroundColor: '#f8fafc', logging: false });
      const link = document.createElement('a');
      link.download = `algebra-tiles-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      setExportError(true);
      setTimeout(() => setExportError(false), 3000);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // ── Copy shareable URL ───────────────────────────────────────────────────────
  const copyShareUrl = useCallback(() => {
    if (tiles.length === 0) return;
    const url = buildTileShareUrl(tilesToSpecs(tiles));
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2500);
    });
  }, [tiles]);

  const shareToForum = useCallback(async () => {
    if (!wrapperRef.current || exporting || !onForumShare) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(wrapperRef.current, { scale: 2, backgroundColor: '#f8fafc', logging: false });
      onForumShare(canvas.toDataURL('image/png'));
    } catch {
      setExportError(true);
      setTimeout(() => setExportError(false), 3000);
    } finally {
      setExporting(false);
    }
  }, [exporting, onForumShare]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const zeroPairs = (['x2', 'x', '1'] as TileKind[]).reduce((sum, k) => {
    const p = tiles.filter(t => t.kind === k && t.sign === 1).length;
    const n = tiles.filter(t => t.kind === k && t.sign === -1).length;
    return sum + Math.min(p, n);
  }, 0);

  // A1.8 — identify which tiles are in zero pairs for pulsing animation
  const zeroPairTileIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const kind of ['x2', 'x', '1'] as TileKind[]) {
      const pos = tiles.filter(t => t.kind === kind && t.sign === 1);
      const neg = tiles.filter(t => t.kind === kind && t.sign === -1);
      const pairCount = Math.min(pos.length, neg.length);
      pos.slice(0, pairCount).forEach(t => ids.add(t.id));
      neg.slice(0, pairCount).forEach(t => ids.add(t.id));
    }
    return ids;
  }, [tiles]);

  const expr = buildExpression(tiles);
  const canUndo = undoStack.current.length > 0;

  // A1.9 — copy LaTeX expression to clipboard
  const [latexCopied, setLatexCopied] = useState(false);
  const copyLatex = useCallback(() => {
    void navigator.clipboard.writeText(expr).then(() => {
      setLatexCopied(true);
      setTimeout(() => setLatexCopied(false), 2000);
    });
  }, [expr]);

  // ── Balance mode: add tile to a specific pan ────────────────────────────────
  const addTileToPan = useCallback((kind: TileKind, sign: TileSign, pan: 'left' | 'right') => {
    const setter = pan === 'left' ? setLeftTiles : setRightTiles;
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
    const setter = pan === 'left' ? setLeftTiles : setRightTiles;
    const undoRef = pan === 'left' ? leftUndoStack : rightUndoStack;
    setter(prev => {
      undoRef.current = [...undoRef.current.slice(-UNDO_MAX + 1), prev.map(t => ({ ...t }))];
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const undoPan = useCallback((pan: 'left' | 'right') => {
    const undoRef = pan === 'left' ? leftUndoStack : rightUndoStack;
    const setter = pan === 'left' ? setLeftTiles : setRightTiles;
    if (undoRef.current.length === 0) return;
    const prev = undoRef.current.pop()!;
    setter(prev);
  }, []);

  const loadBalancePreset = useCallback((idx: number) => {
    const bp = BALANCE_PRESETS[idx];
    if (!bp) return;
    setBalancePresetIdx(idx);
    setBalanceSolved(false);
    setLeftTiles(layoutTiles(bp.left));
    setRightTiles(layoutTiles(bp.right));
  }, []);

  // Check balance whenever tiles change
  useEffect(() => {
    if (mode !== 'balance') return;
    if (leftTiles.length === 0 && rightTiles.length === 0) return;
    const balanced = isBalanced(leftTiles, rightTiles);
    if (balanced && !balanceSolved) {
      setBalanceSolved(true);
      onSolve?.();
    } else if (!balanced && balanceSolved) {
      setBalanceSolved(false);
    }
  }, [leftTiles, rightTiles, mode, balanceSolved, onSolve]);

  // ── Guided mode: check if tiles form a valid rectangle ──────────────────────
  const guidedTarget = PRESETS[3]; // default: x²+3x+2 = (x+1)(x+2)
  const guidedSolved = guidedMode && expr === 'x^2 + 3x + 2';

  useEffect(() => {
    if (mode !== 'default' || !guidedMode) {
      guidedSolveReported.current = false;
      return;
    }
    if (guidedSolved && !guidedSolveReported.current) {
      guidedSolveReported.current = true;
      onSolve?.();
    } else if (!guidedSolved) {
      guidedSolveReported.current = false;
    }
  }, [guidedSolved, guidedMode, mode, onSolve]);

  // ── Palette button ──────────────────────────────────────────────────────────
  const PaletteBtn = ({ kind, sign, pan }: { kind: TileKind; sign: TileSign; pan?: 'left' | 'right' }) => {
    const cfg = TILE_CONFIG[kind];
    const colors = TILE_COLOR[kind][sign];
    const handleClick = () => {
      if (mode === 'balance' && pan) addTileToPan(kind, sign, pan);
      else if (mode !== 'balance') addTile(kind, sign);
    };
    return (
      <button
        type="button"
        title={`Додај ${sign === -1 ? '−' : '+'}${cfg.label}`}
        onClick={handleClick}
        disabled={readOnly}
        className={`flex items-center justify-center rounded border-2 font-black text-xs select-none active:scale-95 transition-transform ${colors} disabled:opacity-40 disabled:cursor-not-allowed`}
        style={{ width: Math.min(cfg.w, 40), height: Math.min(cfg.h, 40), minWidth: Math.min(cfg.w, 40) }}
      >
        {sign === -1 ? '−' : '+'}{cfg.label}
      </button>
    );
  };

  // ── Tile pan canvas (shared between default and balance mode) ────────────────
  const TilePanCanvas: React.FC<{
    panTiles: Tile[];
    panRef: React.RefObject<HTMLDivElement | null>;
    panKey: 'left' | 'right';
    label?: string;
    compact?: boolean;
  }> = ({ panTiles, panRef, panKey, label }) => {
    const panHeight = compact ? 160 : CANVAS_H;
    const panWidth  = mode === 'balance' ? 230 : CANVAS_W;
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
          style={{ width: '100%', minWidth: panWidth, height: panHeight }}
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
                onDoubleClick={() => !readOnly && removeTileFromPan(tile.id, panKey)}
                title={readOnly ? cfg.label : 'Двоен клик за бришење'}
                className={`absolute flex items-center justify-center rounded border-2 font-black text-[10px] select-none ${colors} ${readOnly ? '' : 'cursor-pointer hover:scale-105 hover:shadow-md'} transition-transform shadow-sm`}
                style={{ left: tile.x, top: tile.y, width: cfg.w, height: cfg.h }}
              >
                {cfg.label}
              </div>
            );
          })}
        </div>
        {!readOnly && mode === 'balance' && (
          <button
            type="button"
            onClick={() => undoPan(panKey)}
            className="self-start flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-[9px] font-bold hover:bg-gray-200 transition-colors"
          >
            <Undo2 className="w-2.5 h-2.5" /> Откажи
          </button>
        )}
      </div>
    );
  };

  // ── Balance scale SVG ────────────────────────────────────────────────────────
  const BalanceScaleSvg: React.FC<{ leftTiles: Tile[]; rightTiles: Tile[] }> = ({ leftTiles: lt, rightTiles: rt }) => {
    const balanced = isBalanced(lt, rt);
    const lCoef = tileCoefficients(lt);
    const rCoef = tileCoefficients(rt);
    // Simplified "weight" heuristic: x² counts 4, x counts 2, 1 counts 1
    const lWeight = Math.abs(lCoef.x2 * 4 + lCoef.x * 2 + lCoef.c);
    const rWeight = Math.abs(rCoef.x2 * 4 + rCoef.x * 2 + rCoef.c);
    const tilt = balanced ? 0 : lWeight > rWeight ? -14 : 14;
    return (
      <div className="flex flex-col items-center justify-center w-16 flex-shrink-0">
        <svg width="56" height="120" viewBox="0 0 56 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Pillar */}
          <rect x="26" y="40" width="4" height="75" rx="2" fill="#6366F1" />
          {/* Base */}
          <rect x="10" y="112" width="36" height="6" rx="3" fill="#4338CA" />
          {/* Beam */}
          <g transform={`rotate(${tilt}, 28, 40)`} style={{ transition: 'transform 0.5s cubic-bezier(.34,1.56,.64,1)' }}>
            <rect x="4" y="37" width="48" height="6" rx="3" fill={balanced ? '#10B981' : '#6366F1'} />
            {/* Left pan chain */}
            <line x1="8" y1="40" x2="8" y2="58" stroke="#94A3B8" strokeWidth={1.5} />
            <ellipse cx="8" cy="62" rx="10" ry="5" fill={balanced ? '#D1FAE5' : '#EEF2FF'} stroke={balanced ? '#10B981' : '#818CF8'} strokeWidth={1.5} />
            {/* Right pan chain */}
            <line x1="48" y1="40" x2="48" y2="58" stroke="#94A3B8" strokeWidth={1.5} />
            <ellipse cx="48" cy="62" rx="10" ry="5" fill={balanced ? '#D1FAE5' : '#EEF2FF'} stroke={balanced ? '#10B981' : '#818CF8'} strokeWidth={1.5} />
          </g>
        </svg>
        <span className={`text-[9px] font-black text-center mt-1 transition-colors ${balanced ? 'text-emerald-600' : 'text-indigo-400'}`}>
          {balanced ? '⚖️ Бал.' : '⚖️ везна'}
        </span>
      </div>
    );
  };

  // ── Left pan ref (re-used both for default mode canvas and balance left) ──────
  const leftPanRef  = useRef<HTMLDivElement>(null);
  const rightPanRef = useRef<HTMLDivElement>(null);

  // ── Balance mode render ──────────────────────────────────────────────────────
  if (mode === 'balance') {
    const currentPreset = BALANCE_PRESETS[balancePresetIdx];
    return (
      <div ref={wrapperRef} className="flex flex-col gap-3 select-none bg-white rounded-2xl p-3">
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
                <PaletteBtn key={`L${k}+`} kind={k} sign={1}  pan="left" />,
                <PaletteBtn key={`L${k}-`} kind={k} sign={-1} pan="left" />,
              ])}
              <button type="button"
                disabled={readOnly}
                onClick={() => { leftUndoStack.current = [...leftUndoStack.current.slice(-UNDO_MAX+1), leftTiles.map(t=>({...t}))]; setLeftTiles([]); }}
                className="flex items-center justify-center w-9 h-9 rounded border-2 bg-gray-100 border-gray-300 text-gray-500 text-[10px] hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <TilePanCanvas panTiles={leftTiles} panRef={leftPanRef} panKey="left" label="Лева страна" compact={compact} />
          </div>

          {/* Balance scale */}
          <BalanceScaleSvg leftTiles={leftTiles} rightTiles={rightTiles} />

          {/* Right side palette + pan */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {(['x2', 'x', '1'] as TileKind[]).flatMap(k => [
                <PaletteBtn key={`R${k}+`} kind={k} sign={1}  pan="right" />,
                <PaletteBtn key={`R${k}-`} kind={k} sign={-1} pan="right" />,
              ])}
              <button type="button"
                disabled={readOnly}
                onClick={() => { rightUndoStack.current = [...rightUndoStack.current.slice(-UNDO_MAX+1), rightTiles.map(t=>({...t}))]; setRightTiles([]); }}
                className="flex items-center justify-center w-9 h-9 rounded border-2 bg-gray-100 border-gray-300 text-gray-500 text-[10px] hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <TilePanCanvas panTiles={rightTiles} panRef={rightPanRef} panKey="right" label="Десна страна" compact={compact} />
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

  // ── Default mode ─────────────────────────────────────────────────────────────


  return (
    <div ref={wrapperRef} className="flex flex-col gap-3 select-none bg-white rounded-2xl p-1">
      {/* ── Header: expression + controls ───────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-950 rounded-2xl flex-wrap">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex-shrink-0">Израз</span>
        <div className="flex-1 text-white text-lg font-bold min-w-0">
          <MathRenderer text={`$${expr}$`} />
        </div>
        {!compact && tiles.length > 0 && (
          <button
            type="button"
            title="Копирај LaTeX израз"
            onClick={copyLatex}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-indigo-200 text-[9px] font-bold transition-colors flex-shrink-0"
          >
            {latexCopied
              ? <CheckCheck className="w-3 h-3 text-green-400" />
              : <span className="font-mono text-[9px]">LaTeX</span>
            }
            {latexCopied ? 'Копирано!' : 'Копирај'}
          </button>
        )}
        {zeroPairs > 0 && (
          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0 animate-pulse">
            {zeroPairs} нулти пар{zeroPairs > 1 ? 'а' : ''}
          </span>
        )}
        {tiles.length > 0 && (
          <span className="text-[10px] text-indigo-400 flex-shrink-0">{tiles.length} плочки</span>
        )}
      </div>

      {/* ── Preset expressions ──────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5 px-1">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest self-center mr-1">Примери:</span>
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => loadPreset(p)}
              title={p.gradeHint}
              className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold hover:bg-indigo-100 active:scale-95 transition-all font-mono"
            >
              {p.label}
              {p.gradeHint && <span className="ml-1 text-indigo-300 font-normal text-[8px]">({p.gradeHint})</span>}
            </button>
          ))}
          {!compact && (
            <button
              type="button"
              onClick={() => setGuidedMode(v => !v)}
              className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-bold transition-all ${
                guidedMode ? 'bg-violet-600 text-white border-violet-700' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              Водена факторизација
            </button>
          )}
        </div>
      )}

      {/* ── Guided mode banner ──────────────────────────────────────────────── */}
      {guidedMode && !compact && (
        <div className={`mx-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
          guidedSolved
            ? 'bg-green-50 border-green-300 text-green-800'
            : 'bg-violet-50 border-violet-200 text-violet-800'
        }`}>
          {guidedSolved ? (
            <span>🎉 Браво! <MathRenderer text="$x^2+3x+2 = (x+1)(x+2)$" /> — факторизацијата е точна!</span>
          ) : (
            <span>
              Задача: постави плочки за <MathRenderer text="$x^2+3x+2$" /> и нареди ги во правоаголник за да ја покажеш факторизацијата.
            </span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {/* ── Palette ─────────────────────────────────────────────────────── */}
        {!readOnly && (
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
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 disabled:opacity-30 transition-colors">
              <Sparkles className="w-3 h-3" /> Поедностави
            </button>
            <button type="button" onClick={undo} disabled={!canUndo}
              title="Откажи (Ctrl+Z)"
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[10px] font-bold hover:bg-gray-200 disabled:opacity-30 transition-colors">
              <Undo2 className="w-3 h-3" /> Откажи
            </button>
            <button type="button" onClick={() => { setTiles(prev => { pushUndo(prev); return []; }); }}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[10px] font-bold hover:bg-red-100 hover:text-red-600 transition-colors">
              <Trash2 className="w-3 h-3" /> Исчисти
            </button>
            {!compact && (
              <>
                <button type="button" onClick={exportPng} disabled={exporting || tiles.length === 0}
                  title="Зачувај како слика"
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100 disabled:opacity-30 transition-colors">
                  <Camera className="w-3 h-3" /> {exporting ? '…' : 'Зачувај PNG'}
                </button>
                {onForumShare && (
                  <button type="button" onClick={shareToForum} disabled={exporting || tiles.length === 0}
                    title="Сподели во Форум"
                    className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-violet-50 text-violet-600 text-[10px] font-bold hover:bg-violet-100 disabled:opacity-30 transition-colors">
                    <Share2 className="w-3 h-3" /> {exporting ? '…' : 'Форум'}
                  </button>
                )}
                <button type="button" onClick={copyShareUrl} disabled={tiles.length === 0}
                  title="Копирај линк за споделување"
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 disabled:opacity-30 transition-colors">
                  {urlCopied ? <CheckCheck className="w-3 h-3 text-green-600" /> : <Link2 className="w-3 h-3" />}
                  {urlCopied ? 'Копирано!' : 'Копирај линк'}
                </button>
              </>
            )}
          </div>
        </div>
        )}

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <div
          ref={canvasRef}
          className="relative flex-1 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden"
          style={{ width: defaultCanvasWidth, height: defaultCanvasHeight }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {tiles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs text-gray-400 font-medium text-center px-8 leading-relaxed">
                Кликни плочки од палетата или избери пример израз погоре.<br />
                Влечи за преместување · двоен клик/тап за бришење.
              </p>
            </div>
          )}
          {tiles.map(tile => {
            const cfg = TILE_CONFIG[tile.kind];
            const colors = TILE_COLOR[tile.kind][tile.sign];
            const isDragged = dragging.current?.id === tile.id;
            return (
              <div
                key={tile.id}
                onMouseDown={e => onMouseDown(e, tile.id)}
                onDoubleClick={() => { if (!readOnly) removeTile(tile.id); }}
                onTouchStart={e => onTouchStart(e, tile.id)}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                title={readOnly ? cfg.label : 'Влечи · двоен клик за бришење'}
                className={`absolute flex items-center justify-center rounded border-2 font-black text-[10px] transition-shadow touch-none ${readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${colors} ${isDragged ? 'shadow-2xl ring-2 ring-white/70 z-10 scale-105' : 'shadow-sm hover:shadow-md hover:scale-105'} ${zeroPairTileIds.has(tile.id) ? 'ring-2 ring-amber-400 ring-offset-1 animate-pulse' : ''}`}
                style={{ left: tile.x, top: tile.y, width: cfg.w, height: cfg.h, transition: isDragged ? 'none' : 'box-shadow 0.15s, transform 0.1s' }}
              >
                {cfg.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
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
        <span className="ml-auto italic opacity-70">Нулти пар = спротивни знаци се поништуваат</span>
      </div>
    </div>
  );
};
