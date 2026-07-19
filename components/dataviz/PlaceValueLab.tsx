import React, { useState, useCallback } from 'react';
import { Eye, PenLine, Layers, RefreshCw, Plus, Minus } from 'lucide-react';
import {
  decomposeNumber, recompose, toExpandedForm, toWordFormMK,
  GRADE_CONFIGS, generatePlaceValueSet,
} from './placeValueMath';
import type { Decomposition, GradeRange } from './placeValueMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';
import { useLanguage } from '../../i18n/LanguageContext';

const gradeLabel = (g: GradeRange, t: (k: string) => string): string =>
  ({ g1: t('placeValueLab.grade.g1'), g2: t('placeValueLab.grade.g2'), g3: t('placeValueLab.grade.g3') }[g]);

const gradeDescription = (g: GradeRange, t: (k: string) => string): string =>
  ({ g1: t('placeValueLab.grade.g1Desc'), g2: t('placeValueLab.grade.g2Desc'), g3: t('placeValueLab.grade.g3Desc') }[g]);

// ─── SVG Dienes block primitives ─────────────────────────────────────────────

const FLAT_SIZE  = 54;   // green 100-flat (px)
const ROD_W      = 8;    // yellow 10-rod width
const ROD_H      = 54;   // yellow 10-rod height (same as flat)
const CUBE_SIZE  = 8;    // red 1-unit cube
const DEPTH      = 5;    // 3-D depth offset (top/right face)
const GAP        = 4;    // gap between blocks

// Colours
const C_FLAT_FACE   = '#4CAF50';
const C_FLAT_TOP    = '#66BB6A';
const C_FLAT_RIGHT  = '#388E3C';
const C_FLAT_GRID   = '#2E7D32';
const C_ROD_FACE    = '#FDD835';
const C_ROD_TOP     = '#FFEE58';
const C_ROD_RIGHT   = '#F9A825';
const C_ROD_GRID    = '#F57F17';
const C_CUBE_FACE   = '#EF5350';
const C_CUBE_TOP    = '#EF9A9A';
const C_CUBE_RIGHT  = '#C62828';

interface SVGFlatProps { x: number; y: number; }
const SVGFlat: React.FC<SVGFlatProps> = ({ x, y }) => {
  const s = FLAT_SIZE;
  const d = DEPTH;
  const gridLines: React.ReactNode[] = [];
  const step = s / 10;
  for (let i = 1; i < 10; i++) {
    // vertical
    gridLines.push(<line key={`v${i}`} x1={x + i * step} y1={y} x2={x + i * step} y2={y + s} stroke={C_FLAT_GRID} strokeWidth={0.5} />);
    // horizontal
    gridLines.push(<line key={`h${i}`} x1={x} y1={y + i * step} x2={x + s} y2={y + i * step} stroke={C_FLAT_GRID} strokeWidth={0.5} />);
  }
  return (
    <g>
      {/* Top face */}
      <polygon points={`${x},${y} ${x+s},${y} ${x+s+d},${y-d} ${x+d},${y-d}`}
        fill={C_FLAT_TOP} stroke={C_FLAT_GRID} strokeWidth={0.8} />
      {/* Right face */}
      <polygon points={`${x+s},${y} ${x+s},${y+s} ${x+s+d},${y+s-d} ${x+s+d},${y-d}`}
        fill={C_FLAT_RIGHT} stroke={C_FLAT_GRID} strokeWidth={0.8} />
      {/* Front face */}
      <rect x={x} y={y} width={s} height={s} fill={C_FLAT_FACE} stroke={C_FLAT_GRID} strokeWidth={1} />
      {/* Grid lines on front face */}
      {gridLines}
      {/* Outer border */}
      <rect x={x} y={y} width={s} height={s} fill="none" stroke={C_FLAT_GRID} strokeWidth={1.5} />
    </g>
  );
};

interface SVGRodProps { x: number; y: number; }
const SVGRod: React.FC<SVGRodProps> = ({ x, y }) => {
  const w = ROD_W; const h = ROD_H; const d = DEPTH;
  const step = h / 10;
  const gridLines: React.ReactNode[] = [];
  for (let i = 1; i < 10; i++) {
    gridLines.push(<line key={i} x1={x} y1={y + i * step} x2={x + w} y2={y + i * step} stroke={C_ROD_GRID} strokeWidth={0.5} />);
  }
  return (
    <g>
      {/* Top */}
      <polygon points={`${x},${y} ${x+w},${y} ${x+w+d},${y-d} ${x+d},${y-d}`}
        fill={C_ROD_TOP} stroke={C_ROD_GRID} strokeWidth={0.8} />
      {/* Right */}
      <polygon points={`${x+w},${y} ${x+w},${y+h} ${x+w+d},${y+h-d} ${x+w+d},${y-d}`}
        fill={C_ROD_RIGHT} stroke={C_ROD_GRID} strokeWidth={0.8} />
      {/* Front */}
      <rect x={x} y={y} width={w} height={h} fill={C_ROD_FACE} stroke={C_ROD_GRID} strokeWidth={1} />
      {gridLines}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={C_ROD_GRID} strokeWidth={1.5} />
    </g>
  );
};

interface SVGCubeProps { x: number; y: number; }
const SVGCube: React.FC<SVGCubeProps> = ({ x, y }) => {
  const s = CUBE_SIZE; const d = DEPTH * 0.6;
  return (
    <g>
      <polygon points={`${x},${y} ${x+s},${y} ${x+s+d},${y-d} ${x+d},${y-d}`}
        fill={C_CUBE_TOP} stroke={C_CUBE_RIGHT} strokeWidth={0.8} />
      <polygon points={`${x+s},${y} ${x+s},${y+s} ${x+s+d},${y+s-d} ${x+s+d},${y-d}`}
        fill={C_CUBE_RIGHT} stroke={C_CUBE_RIGHT} strokeWidth={0.8} />
      <rect x={x} y={y} width={s} height={s} fill={C_CUBE_FACE} stroke={C_CUBE_RIGHT} strokeWidth={1} />
    </g>
  );
};

// ─── Block display area ───────────────────────────────────────────────────────

const PER_ROW_FLAT = 4;
const PER_ROW_ROD  = 5;
const PER_ROW_CUBE = 5;

interface BlockDisplayProps { decomp: Decomposition; showThousands: boolean; showHundreds: boolean; }

const BlockDisplay: React.FC<BlockDisplayProps> = ({ decomp, showThousands, showHundreds }) => {
  const { t } = useLanguage();
  const PAD = 16;
  const SECTION_GAP = 18;
  const flatColW  = FLAT_SIZE + DEPTH + GAP;
  const rodColW   = ROD_W + DEPTH + GAP;
  const cubeColW  = CUBE_SIZE + DEPTH + GAP;

  // Calculate how many rows each section needs
  const flatRows  = Math.ceil((decomp.hundreds || 0.01) / PER_ROW_FLAT);
  const rodRows   = Math.ceil((decomp.tens     || 0.01) / PER_ROW_ROD);
  const cubeRows  = Math.ceil((decomp.ones     || 0.01) / PER_ROW_CUBE);

  const flatSectionW  = PER_ROW_FLAT * flatColW;
  const rodSectionW   = PER_ROW_ROD  * rodColW;
  const cubeSectionW  = PER_ROW_CUBE * cubeColW;
  const thousandsSectionW = showThousands ? (PER_ROW_FLAT * flatColW) : 0;

  const sectionY = PAD + DEPTH + 2;

  // Heights
  const flatH  = Math.max(1, flatRows)  * (FLAT_SIZE + DEPTH + GAP);
  const rodH   = Math.max(1, rodRows)   * (ROD_H + DEPTH + GAP);
  const cubeH  = Math.max(1, cubeRows)  * (CUBE_SIZE + DEPTH + GAP);
  const thousandsH = showThousands ? (Math.ceil((decomp.thousands || 0.01) / PER_ROW_FLAT) * (FLAT_SIZE + DEPTH + GAP)) : 0;
  const maxH = Math.max(flatH, rodH, cubeH, thousandsH, FLAT_SIZE + DEPTH + GAP);

  let curX = PAD;

  // Section x positions
  const thousandsX = curX;
  if (showThousands) curX += thousandsSectionW + SECTION_GAP;
  const hundredsX  = showHundreds ? curX : -1;
  if (showHundreds) curX += flatSectionW + SECTION_GAP;
  const tensX = curX;
  curX += rodSectionW + SECTION_GAP;
  const onesX = curX;
  curX += cubeSectionW;

  const svgW = curX + PAD;
  const svgH = sectionY + maxH + PAD + 24;

  const renderFlats = (count: number, startX: number, label: string, isThousands = false) => {
    const elems: React.ReactNode[] = [];
    const scale = isThousands ? 0.85 : 1;
    const fs = FLAT_SIZE * scale;
    const depthS = DEPTH * scale;
    const colW = fs + depthS + GAP;
    const rowH = fs + depthS + GAP;

    for (let i = 0; i < count; i++) {
      const col = i % PER_ROW_FLAT;
      const row = Math.floor(i / PER_ROW_FLAT);
      const bx = startX + col * colW;
      const by = sectionY + row * rowH;
      if (isThousands) {
        // Mini flat (scaled SVG)
        const sx = FLAT_SIZE;
        const step = sx / 10;
        const gl: React.ReactNode[] = [];
        for (let k = 1; k < 10; k++) {
          gl.push(<line key={`tv${k}`} x1={bx + k * step * scale} y1={by} x2={bx + k * step * scale} y2={by + fs} stroke={C_FLAT_GRID} strokeWidth={0.4} />);
          gl.push(<line key={`th${k}`} x1={bx} y1={by + k * step * scale} x2={bx + fs} y2={by + k * step * scale} stroke={C_FLAT_GRID} strokeWidth={0.4} />);
        }
        elems.push(
          <g key={i}>
            <polygon points={`${bx},${by} ${bx+fs},${by} ${bx+fs+depthS},${by-depthS} ${bx+depthS},${by-depthS}`} fill={C_FLAT_TOP} stroke={C_FLAT_GRID} strokeWidth={0.6} />
            <polygon points={`${bx+fs},${by} ${bx+fs},${by+fs} ${bx+fs+depthS},${by+fs-depthS} ${bx+fs+depthS},${by-depthS}`} fill={C_FLAT_RIGHT} stroke={C_FLAT_GRID} strokeWidth={0.6} />
            <rect x={bx} y={by} width={fs} height={fs} fill={C_FLAT_FACE} stroke={C_FLAT_GRID} strokeWidth={0.8} />
            {gl}
            <rect x={bx} y={by} width={fs} height={fs} fill="none" stroke={C_FLAT_GRID} strokeWidth={1} />
          </g>
        );
      } else {
        elems.push(<SVGFlat key={i} x={bx} y={by} />);
      }
    }
    elems.push(
      <text key="lbl" x={startX + (PER_ROW_FLAT * colW) / 2} y={sectionY + maxH + 16}
        textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151">{label}</text>
    );
    return elems;
  };

  const renderRods = (count: number, startX: number) => {
    const elems: React.ReactNode[] = [];
    const colW = ROD_W + DEPTH + GAP;
    const rowH = ROD_H + DEPTH + GAP;
    for (let i = 0; i < count; i++) {
      const col = i % PER_ROW_ROD;
      const row = Math.floor(i / PER_ROW_ROD);
      elems.push(<SVGRod key={i} x={startX + col * colW} y={sectionY + row * rowH} />);
    }
    elems.push(
      <text key="lbl" x={startX + (PER_ROW_ROD * colW) / 2} y={sectionY + maxH + 16}
        textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151">{t('placeValueLab.tens')}</text>
    );
    return elems;
  };

  const renderCubes = (count: number, startX: number) => {
    const elems: React.ReactNode[] = [];
    const colW = CUBE_SIZE + DEPTH + GAP;
    const rowH = CUBE_SIZE + DEPTH + GAP;
    for (let i = 0; i < count; i++) {
      const col = i % PER_ROW_CUBE;
      const row = Math.floor(i / PER_ROW_CUBE);
      elems.push(<SVGCube key={i} x={startX + col * colW} y={sectionY + row * rowH} />);
    }
    elems.push(
      <text key="lbl" x={startX + (PER_ROW_CUBE * colW) / 2} y={sectionY + maxH + 16}
        textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151">{t('placeValueLab.ones')}</text>
    );
    return elems;
  };

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 340 }}>
      {showThousands && decomp.thousands > 0 && renderFlats(decomp.thousands, thousandsX, t('placeValueLab.thousands'), true)}
      {showHundreds  && decomp.hundreds > 0  && renderFlats(decomp.hundreds, hundredsX, t('placeValueLab.hundreds'))}
      {decomp.tens   > 0 && renderRods(decomp.tens, tensX)}
      {decomp.ones   > 0 && renderCubes(decomp.ones, onesX)}

      {/* Empty state */}
      {decomp.thousands === 0 && decomp.hundreds === 0 && decomp.tens === 0 && decomp.ones === 0 && (
        <text x={svgW / 2} y={svgH / 2} textAnchor="middle" fontSize={14} fill="#9ca3af">
          {t('placeValueLab.empty')}
        </text>
      )}
    </svg>
  );
};

// ─── Compose panel (interactive click to add/remove) ─────────────────────────

interface ComposeControlProps {
  label: string;
  value: number;
  max: number;
  color: string;
  onChange: (n: number) => void;
  disabled?: boolean;
}
const ComposeControl: React.FC<ComposeControlProps> = ({ label, value, max, color, onChange, disabled }) => (
  <div className={`flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border-2 ${disabled ? 'opacity-30 pointer-events-none' : ''} ${color}`}>
    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{label}</span>
    <span className="text-3xl font-black text-gray-800 min-w-[2ch] text-center">{value}</span>
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(Math.min(value + 1, max))}
        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition">
        <Plus className="w-4 h-4 text-gray-700" />
      </button>
      <button type="button" onClick={() => onChange(Math.max(value - 1, 0))}
        disabled={value === 0}
        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition disabled:opacity-30">
        <Minus className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = 'show' | 'practice' | 'compose';

export const PlaceValueLab: React.FC = () => {
  const { t } = useLanguage();
  const [grade, setGrade] = useState<GradeRange>('g2');
  const [mode, setMode] = useState<Mode>('show');

  // Show mode
  const [showInput, setShowInput] = useState('');
  const showNumber = Math.max(0, Math.min(GRADE_CONFIGS[grade].max, parseInt(showInput) || 0));

  // Practice mode — connected to quiz_results via useLabSession
  const session = useLabSession('place-value', 'Дијенесови блокови');
  const [difficulty, setDifficulty] = useLabDifficulty('place-value');
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generatePlaceValueSet(grade, level));
  }, [grade, difficulty, loadExercises]);

  // Compose mode
  const [compose, setCompose] = useState<Decomposition>({ thousands: 0, hundreds: 0, tens: 0, ones: 0 });
  const composeNumber = recompose(compose);
  const cfg = GRADE_CONFIGS[grade];

  // Shared decomp for display
  const showDecomp = decomposeNumber(showNumber);

  const MODES: { id: Mode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'show',     label: t('placeValueLab.mode.show'),     icon: Eye      },
    { id: 'practice', label: t('placeValueLab.mode.practice'), icon: PenLine  },
    { id: 'compose',  label: t('placeValueLab.mode.compose'),  icon: Layers   },
  ];

  const GRADES: GradeRange[] = ['g1', 'g2', 'g3'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">{t('placeValueLab.title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{gradeDescription(grade, t)}</p>
        </div>
        {/* Grade selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {GRADES.map(g => (
            <button key={g} type="button"
              onClick={() => {
                setGrade(g);
                setShowInput('');
                setCompose({ thousands: 0, hundreds: 0, tens: 0, ones: 0 });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                grade === g ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {gradeLabel(g, t)}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setMode(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              mode === id
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── MODE: SHOW ──────────────────────────────────────────────────────── */}
      {mode === 'show' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700 shrink-0">{t('placeValueLab.show.inputLabel')}</label>
            <input
              type="number"
              min={0}
              max={cfg.max}
              value={showInput}
              onChange={e => setShowInput(e.target.value)}
              placeholder={`0 – ${cfg.max}`}
              className="w-36 px-3 py-2 border-2 border-gray-200 rounded-xl text-xl font-black text-center focus:border-emerald-400 focus:outline-none"
            />
            {showNumber > 0 && (
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500">{t('placeValueLab.show.expandedForm')}</span>
                <span className="text-base font-bold text-emerald-700">{toExpandedForm(showNumber)}</span>
              </div>
            )}
          </div>

          {/* Block display */}
          <div className="bg-gradient-to-br from-slate-50 to-green-50 rounded-2xl border border-green-100 p-4 min-h-[200px] flex items-center justify-center overflow-x-auto">
            <BlockDisplay decomp={showDecomp} showThousands={cfg.showThousands} showHundreds={cfg.showHundreds} />
          </div>

          {/* Place value table */}
          {showNumber > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className={`grid ${cfg.showThousands ? 'grid-cols-4' : cfg.showHundreds ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-gray-200`}>
                {cfg.showThousands && (
                  <div className="p-3 text-center bg-purple-50">
                    <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">{t('placeValueLab.thousands')}</div>
                    <div className="text-4xl font-black text-purple-700">{showDecomp.thousands}</div>
                    <div className="text-xs text-purple-400 mt-1">× 1000</div>
                  </div>
                )}
                {cfg.showHundreds && (
                  <div className="p-3 text-center bg-green-50">
                    <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">{t('placeValueLab.hundreds')}</div>
                    <div className="text-4xl font-black text-green-700">{showDecomp.hundreds}</div>
                    <div className="text-xs text-green-400 mt-1">× 100</div>
                  </div>
                )}
                <div className="p-3 text-center bg-yellow-50">
                  <div className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-1">{t('placeValueLab.tens')}</div>
                  <div className="text-4xl font-black text-yellow-700">{showDecomp.tens}</div>
                  <div className="text-xs text-yellow-400 mt-1">× 10</div>
                </div>
                <div className="p-3 text-center bg-red-50">
                  <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">{t('placeValueLab.ones')}</div>
                  <div className="text-4xl font-black text-red-600">{showDecomp.ones}</div>
                  <div className="text-xs text-red-400 mt-1">× 1</div>
                </div>
              </div>
              {/* Word form */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
                <span className="text-sm font-bold text-gray-600 capitalize">{toWordFormMK(showNumber)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODE: PRACTICE ──────────────────────────────────────────────────── */}
      {mode === 'practice' && (
        <div className="space-y-3">
          {/* Block visual for difficulty-1: reinforce the visual → number link */}
          {difficulty === 1 && session.currentEx && !session.sessionDone && (
            <div className="bg-gradient-to-br from-slate-50 to-green-50 rounded-2xl border border-green-100 p-3 overflow-x-auto">
              <BlockDisplay
                decomp={decomposeNumber(parseInt(session.currentEx.correctAnswer, 10) || 0)}
                showThousands={cfg.showThousands}
                showHundreds={cfg.showHundreds}
              />
            </div>
          )}
          <LabExercisePanel
            session={session}
            onNewSet={loadSet}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
          />
        </div>
      )}

      {/* ── MODE: COMPOSE ───────────────────────────────────────────────────── */}
      {mode === 'compose' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">
            {t('placeValueLab.compose.instructionPrefix')} <strong>+</strong> {t('placeValueLab.compose.and')} <strong>−</strong>:
          </p>

          <div className="flex flex-wrap gap-3">
            {cfg.showThousands && (
              <ComposeControl label={t('placeValueLab.thousands')} value={compose.thousands} max={9} color="border-purple-200 bg-purple-50"
                onChange={v => setCompose(p => ({ ...p, thousands: v }))} />
            )}
            {cfg.showHundreds && (
              <ComposeControl label={t('placeValueLab.hundreds')} value={compose.hundreds} max={9} color="border-green-200 bg-green-50"
                onChange={v => setCompose(p => ({ ...p, hundreds: v }))} />
            )}
            <ComposeControl label={t('placeValueLab.tens')} value={compose.tens} max={9} color="border-yellow-200 bg-yellow-50"
              onChange={v => setCompose(p => ({ ...p, tens: v }))} />
            <ComposeControl label={t('placeValueLab.ones')} value={compose.ones} max={9} color="border-red-200 bg-red-50"
              onChange={v => setCompose(p => ({ ...p, ones: v }))} />
          </div>

          {/* Block display */}
          <div className="bg-gradient-to-br from-slate-50 to-green-50 rounded-2xl border border-green-100 p-4 min-h-[180px] flex items-center justify-center overflow-x-auto">
            <BlockDisplay decomp={compose} showThousands={cfg.showThousands} showHundreds={cfg.showHundreds} />
          </div>

          {/* Result */}
          {composeNumber > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center space-y-1">
              <div className="text-5xl font-black text-gray-900">{composeNumber}</div>
              <div className="text-sm font-semibold text-emerald-700">{toExpandedForm(composeNumber)}</div>
              <div className="text-sm text-gray-500 capitalize italic">{toWordFormMK(composeNumber)}</div>
            </div>
          )}

          <button type="button"
            onClick={() => setCompose({ thousands: 0, hundreds: 0, tens: 0, ones: 0 })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <RefreshCw className="w-3.5 h-3.5" /> {t('placeValueLab.reset')}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('placeValueLab.legend.title')}</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="0" y="0" width="14" height="14" fill={C_FLAT_FACE} stroke={C_FLAT_GRID} strokeWidth="1" rx="1" /></svg>
          {t('placeValueLab.legend.flat')}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <svg width="10" height="16" viewBox="0 0 10 16"><rect x="0" y="0" width="8" height="14" fill={C_ROD_FACE} stroke={C_ROD_GRID} strokeWidth="1" rx="1" /></svg>
          {t('placeValueLab.legend.rod')}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="10" height="10" fill={C_CUBE_FACE} stroke={C_CUBE_RIGHT} strokeWidth="1" rx="1" /></svg>
          {t('placeValueLab.legend.cube')}
        </span>
        {cfg.showThousands && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-600">
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="0" y="0" width="12" height="12" fill={C_FLAT_FACE} stroke={C_FLAT_GRID} strokeWidth="1" rx="1" /></svg>
            {t('placeValueLab.legend.thousandsCube')}
          </span>
        )}
      </div>
    </div>
  );
};
