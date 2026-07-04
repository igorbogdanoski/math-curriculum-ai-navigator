import React, { useRef, useCallback } from 'react';
import {
  toRad, toDeg, radLabel, unitCirclePoint, QUADRANT_LABELS, SPECIAL_ANGLES,
} from './trigMath';

/**
 * Interactive unit-circle angle/point picker — extracted from
 * TrigonometryLab's `UnitCircleTab` so it can be reused as a controlled
 * component both by the lab and by Dugga's `unit_circle_pick` question type.
 */

const CX = 160, CY = 160, R = 120;

export interface UnitCirclePickerState {
  angle: number;
  x: number;
  y: number;
}

export interface UnitCirclePickerProps {
  angleDeg: number;
  onChange: (state: UnitCirclePickerState) => void;
  disabled?: boolean;
}

export const UnitCirclePicker: React.FC<UnitCirclePickerProps> = ({ angleDeg, onChange, disabled = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const pt = unitCirclePoint(angleDeg, CX, CY, R);
  const qInfo = QUADRANT_LABELS[pt.quadrant];

  const emit = useCallback((deg: number) => {
    const normalized = ((deg % 360) + 360) % 360;
    const p = unitCirclePoint(normalized, CX, CY, R);
    onChange({ angle: normalized, x: p.cos, y: p.sin });
  }, [onChange]);

  const angleFromPointer = useCallback((cx: number, cy: number) => {
    if (disabled) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = cx - rect.left;
    const py = cy - rect.top;
    const scale = 320 / rect.width;
    const dx = (px * scale) - CX;
    const dy = CY - (py * scale);
    const raw = toDeg(Math.atan2(dy, dx));
    emit(raw);
  }, [emit, disabled]);

  const onMouseDown = useCallback(() => { if (!disabled) dragging.current = true; }, [disabled]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    angleFromPointer(e.clientX, e.clientY);
  }, [angleFromPointer]);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    angleFromPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, [angleFromPointer]);
  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    angleFromPointer(e.clientX, e.clientY);
  }, [angleFromPointer]);

  const fmt = (n: number) => (n < 0 ? '−' + Math.abs(n).toFixed(4) : n.toFixed(4));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
        Интерактивна единечна кружница — влечи ја точката
      </p>
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* SVG circle */}
        <svg
          ref={svgRef}
          viewBox="0 0 320 320"
          role="img"
          aria-label={`Единечна кружница, агол ${Math.round(angleDeg)} степени`}
          className={`w-full max-w-[320px] select-none ${disabled ? '' : 'cursor-crosshair'}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
          onClick={onSvgClick}
        >
          {/* Axes */}
          <line x1="20" y1={CY} x2="300" y2={CY} stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1={CX} y1="20" x2={CX} y2="300" stroke="#cbd5e1" strokeWidth="1.5" />
          <text x="298" y={CY - 6} fontSize="11" fill="#64748b">x</text>
          <text x={CX + 5} y="18" fontSize="11" fill="#64748b">y</text>
          {/* Quadrant labels */}
          <text x={CX + 10} y={CY - 10} fontSize="9" fill="#16a34a" opacity="0.6">I</text>
          <text x={CX - 18} y={CY - 10} fontSize="9" fill="#2563eb" opacity="0.6">II</text>
          <text x={CX - 18} y={CY + 18} fontSize="9" fill="#dc2626" opacity="0.6">III</text>
          <text x={CX + 10} y={CY + 18} fontSize="9" fill="#9333ea" opacity="0.6">IV</text>
          {/* Unit circle */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          {/* Special angle ticks */}
          {SPECIAL_ANGLES.map(a => {
            const rad = toRad(a);
            const x1 = CX + Math.cos(rad) * (R - 5), y1 = CY - Math.sin(rad) * (R - 5);
            const x2 = CX + Math.cos(rad) * (R + 5), y2 = CY - Math.sin(rad) * (R + 5);
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
          })}
          {/* Angle arc */}
          {angleDeg > 2 && (
            <path
              d={`M ${CX + 28} ${CY} A 28 28 0 ${angleDeg > 180 ? 1 : 0} 0 ${CX + 28 * Math.cos(toRad(angleDeg))} ${CY - 28 * Math.sin(toRad(angleDeg))}`}
              fill="none" stroke="#f59e0b" strokeWidth="1.5"
            />
          )}
          {/* Cos line (horizontal) */}
          <line x1={CX} y1={CY} x2={pt.x} y2={CY} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Sin line (vertical) */}
          <line x1={pt.x} y1={CY} x2={pt.x} y2={pt.y} stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Radius */}
          <line x1={CX} y1={CY} x2={pt.x} y2={pt.y} stroke="#475569" strokeWidth="2" />
          {/* Point */}
          <circle cx={pt.x} cy={pt.y} r="8" fill="white" stroke="#f43f5e" strokeWidth="2.5" style={{ cursor: disabled ? 'default' : 'grab' }} />
          {/* Angle label */}
          <text x={CX + 34} y={CY - 12} fontSize="11" fill="#f59e0b" fontWeight="bold">{Math.round(angleDeg)}°</text>
          {/* Axis labels */}
          <text x={CX - 18} y={CY + 13} fontSize="10" fill="#94a3b8">−1</text>
          <text x={CX + R + 4} y={CY + 13} fontSize="10" fill="#94a3b8">1</text>
          <text x={CX + 3} y={CY - R - 4} fontSize="10" fill="#94a3b8">1</text>
          <text x={CX + 3} y={CY + R + 13} fontSize="10" fill="#94a3b8">−1</text>
        </svg>

        {/* Values panel */}
        <div className="flex-1 space-y-3 min-w-[200px]">
          <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: qInfo.color + '18', color: qInfo.color }}>
            {qInfo.label} · {qInfo.signs}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-amber-50 rounded-xl p-2">
              <p className="text-amber-500 font-bold uppercase tracking-wide text-[9px]">Агол</p>
              <p className="text-amber-800 font-mono text-sm font-bold">{Math.round(angleDeg)}°</p>
              <p className="text-amber-600 font-mono">{radLabel(toRad(angleDeg))}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2">
              <p className="text-blue-500 font-bold uppercase tracking-wide text-[9px]">cos θ</p>
              <p className="text-blue-800 font-mono text-sm font-bold">{fmt(pt.cos)}</p>
              <p className="text-blue-400 text-[10px]">x-координата</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-green-500 font-bold uppercase tracking-wide text-[9px]">sin θ</p>
              <p className="text-green-800 font-mono text-sm font-bold">{fmt(pt.sin)}</p>
              <p className="text-green-400 text-[10px]">y-координата</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-2">
              <p className="text-purple-500 font-bold uppercase tracking-wide text-[9px]">tan θ</p>
              <p className="text-purple-800 font-mono text-sm font-bold">
                {pt.tan === null ? '∞' : fmt(pt.tan)}
              </p>
              <p className="text-purple-400 text-[10px]">sin/cos</p>
            </div>
          </div>
          {/* Special angle buttons */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Специјални агли</p>
            <div className="flex flex-wrap gap-1">
              {[0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270, 330].map(a => (
                <button
                  key={a}
                  type="button"
                  disabled={disabled}
                  onClick={() => emit(a)}
                  className={`px-2 py-0.5 text-[10px] rounded-lg border transition-colors disabled:opacity-40 ${Math.round(angleDeg) === a ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-indigo-50'}`}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>
          {/* Slider */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Агол: {Math.round(angleDeg)}°
            </label>
            <input
              type="range" min="0" max="359" step="1"
              disabled={disabled}
              value={Math.round(angleDeg)}
              onChange={e => emit(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
