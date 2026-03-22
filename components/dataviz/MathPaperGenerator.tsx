import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Download, Printer, Settings2 } from 'lucide-react';

type GridType = 'square' | 'isometric' | 'polar' | 'dot' | 'millimeter' | 'logarithmic';
type PageFormat = 'A4' | 'A5' | 'A3';
type Orientation = 'portrait' | 'landscape';

interface PaperConfig {
  gridType: GridType;
  format: PageFormat;
  orientation: Orientation;
  spacing: number;        // mm — основен растер
  lineColor: string;
  majorLineColor: string;
  lineWidth: number;
  showTitle: boolean;
  titleText: string;
  polarRings: number;
  polarSectors: number;
  isoAngle: 30 | 60;
  dotSize: number;
}

const DEFAULT_CONFIG: PaperConfig = {
  gridType: 'square',
  format: 'A4',
  orientation: 'portrait',
  spacing: 5,
  lineColor: '#c7d2e7',
  majorLineColor: '#93a8c8',
  lineWidth: 0.5,
  showTitle: false,
  titleText: '',
  polarRings: 10,
  polarSectors: 12,
  isoAngle: 60,
  dotSize: 1.5,
};

// Page dimensions in pixels at 96dpi (A4=794×1123, A5=559×794, A3=1123×1587)
const PAGE_PX: Record<PageFormat, [number, number]> = {
  A4: [794, 1123],
  A5: [559, 794],
  A3: [1123, 1587],
};
const MM_TO_PX = 3.78;

function drawSquareGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: PaperConfig) {
  const step = cfg.spacing * MM_TO_PX;
  const majorEvery = cfg.spacing === 1 ? 5 : 1;
  ctx.lineWidth = cfg.lineWidth;
  for (let x = 0; x <= w; x += step) {
    const isMajor = Math.round(x / step) % majorEvery === 0;
    ctx.strokeStyle = isMajor ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = isMajor ? cfg.lineWidth * 2 : cfg.lineWidth;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    const isMajor = Math.round(y / step) % majorEvery === 0;
    ctx.strokeStyle = isMajor ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = isMajor ? cfg.lineWidth * 2 : cfg.lineWidth;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawMillimeter(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: PaperConfig) {
  const mm1 = 1 * MM_TO_PX;
  const mm5 = 5 * MM_TO_PX;
  for (let x = 0; x <= w; x += mm1) {
    const isMajor = Math.round(x / mm1) % 5 === 0;
    ctx.strokeStyle = isMajor ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = isMajor ? 0.8 : 0.3;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += mm1) {
    const isMajor = Math.round(y / mm1) % 5 === 0;
    ctx.strokeStyle = isMajor ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = isMajor ? 0.8 : 0.3;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawIsometric(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: PaperConfig) {
  const step = cfg.spacing * MM_TO_PX;
  const angle = cfg.isoAngle * Math.PI / 180;
  ctx.strokeStyle = cfg.lineColor;
  ctx.lineWidth = cfg.lineWidth;
  // Horizontal lines
  for (let y = 0; y <= h; y += step * Math.sin(angle)) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const dx = step; const dy = step * Math.sin(angle);
  // Left-leaning
  for (let startX = -h; startX <= w + h; startX += dx) {
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + h / Math.tan(angle), h);
    ctx.stroke();
  }
  // Right-leaning
  for (let startX = -h; startX <= w + h; startX += dx) {
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX - h / Math.tan(angle), h);
    ctx.stroke();
  }
}

function drawPolar(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: PaperConfig) {
  const cx = w / 2; const cy = h / 2;
  const maxR = Math.min(w, h) * 0.45;
  const ringStep = maxR / cfg.polarRings;
  // Rings
  for (let i = 1; i <= cfg.polarRings; i++) {
    const r = ringStep * i;
    ctx.strokeStyle = i % 5 === 0 ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = i % 5 === 0 ? cfg.lineWidth * 2 : cfg.lineWidth;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  // Radii
  const sectorAngle = (2 * Math.PI) / cfg.polarSectors;
  for (let i = 0; i < cfg.polarSectors; i++) {
    const a = sectorAngle * i;
    const isMajor = i % 3 === 0;
    ctx.strokeStyle = isMajor ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = isMajor ? cfg.lineWidth * 2 : cfg.lineWidth;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
    ctx.stroke();
  }
}

function drawDot(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: PaperConfig) {
  const step = cfg.spacing * MM_TO_PX;
  ctx.fillStyle = cfg.lineColor;
  for (let x = step; x < w; x += step) {
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, cfg.dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLogarithmic(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: PaperConfig) {
  const decades = 4;
  const decadeW = w / decades;
  ctx.strokeStyle = cfg.majorLineColor;
  ctx.lineWidth = cfg.lineWidth * 2;
  for (let d = 0; d <= decades; d++) {
    const x = d * decadeW;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.lineWidth = cfg.lineWidth;
  ctx.strokeStyle = cfg.lineColor;
  for (let d = 0; d < decades; d++) {
    for (let i = 2; i <= 9; i++) {
      const x = d * decadeW + Math.log10(i) * decadeW;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  }
  // Horizontal: regular
  const step = (cfg.spacing * MM_TO_PX);
  for (let y = 0; y <= h; y += step) {
    ctx.strokeStyle = y % (step * 5) < 1 ? cfg.majorLineColor : cfg.lineColor;
    ctx.lineWidth = y % (step * 5) < 1 ? cfg.lineWidth * 2 : cfg.lineWidth;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

export const MathPaperGenerator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cfg, setCfg] = useState<PaperConfig>(DEFAULT_CONFIG);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [pw, ph] = PAGE_PX[cfg.format];
    const [cw, ch] = cfg.orientation === 'portrait' ? [pw, ph] : [ph, pw];
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    switch (cfg.gridType) {
      case 'square': drawSquareGrid(ctx, cw, ch, cfg); break;
      case 'millimeter': drawMillimeter(ctx, cw, ch, cfg); break;
      case 'isometric': drawIsometric(ctx, cw, ch, cfg); break;
      case 'polar': drawPolar(ctx, cw, ch, cfg); break;
      case 'dot': drawDot(ctx, cw, ch, cfg); break;
      case 'logarithmic': drawLogarithmic(ctx, cw, ch, cfg); break;
    }

    if (cfg.showTitle && cfg.titleText) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText(cfg.titleText, 20, 24);
    }
  }, [cfg]);

  useEffect(() => { draw(); }, [draw]);

  const exportPNG = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const link = document.createElement('a');
    link.download = `math-paper-${cfg.gridType}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportSVG = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const [pw, ph] = PAGE_PX[cfg.format];
    const [cw, ch] = cfg.orientation === 'portrait' ? [pw, ph] : [ph, pw];
    // Build SVG with same drawing logic
    const step = cfg.spacing * MM_TO_PX;
    let svgLines = '';
    if (cfg.gridType === 'square' || cfg.gridType === 'millimeter') {
      for (let x = 0; x <= cw; x += step) {
        svgLines += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${ch}" stroke="${cfg.lineColor}" stroke-width="${cfg.lineWidth}"/>`;
      }
      for (let y = 0; y <= ch; y += step) {
        svgLines += `<line x1="0" y1="${y.toFixed(1)}" x2="${cw}" y2="${y.toFixed(1)}" stroke="${cfg.lineColor}" stroke-width="${cfg.lineWidth}"/>`;
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}"><rect width="${cw}" height="${ch}" fill="white"/>${svgLines}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `math-paper-${cfg.gridType}.svg`;
    link.href = url; link.click();
    URL.revokeObjectURL(url);
  };

  const printPaper = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) { alert('Попап е блокиран. Дозволете попапи за оваа страница.'); return; }
    win.document.write(`<html><head><title>Математичка хартија</title><style>body{margin:0;padding:0}img{width:100%;height:auto}@media print{body{margin:0}}</style></head><body><img src="${dataUrl}" onload="window.print()"/></body></html>`);
    win.document.close();
  };

  const GRID_TYPES: { id: GridType; label: string; icon: string; desc: string }[] = [
    { id: 'square', label: 'Квадратна мрежа', icon: '⊞', desc: 'Најчесто користена' },
    { id: 'millimeter', label: 'Милиметарска', icon: '▦', desc: '1mm + 5mm акцент' },
    { id: 'dot', label: 'Точкаста', icon: '⠿', desc: 'Минималистичка' },
    { id: 'isometric', label: 'Изометриска', icon: '◈', desc: '3D цртање' },
    { id: 'polar', label: 'Поларна', icon: '◎', desc: 'Кружни координати' },
    { id: 'logarithmic', label: 'Логаритамска', icon: '≋', desc: 'За 9. одд. / средно' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Controls */}
      <div className="space-y-5">
        {/* Grid type */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Тип на мрежа</p>
          <div className="grid grid-cols-2 gap-2">
            {GRID_TYPES.map(g => (
              <button key={g.id} type="button"
                onClick={() => setCfg(c => ({ ...c, gridType: g.id }))}
                className={`flex flex-col items-start p-2.5 rounded-xl border-2 text-left transition ${cfg.gridType === g.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                <span className="text-xl mb-0.5">{g.icon}</span>
                <span className={`text-xs font-bold ${cfg.gridType === g.id ? 'text-indigo-700' : 'text-gray-700'}`}>{g.label}</span>
                <span className="text-[10px] text-gray-400">{g.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Page settings */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Формат</label>
            <select value={cfg.format} onChange={e => setCfg(c => ({ ...c, format: e.target.value as PageFormat }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="A3">A3</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Ориентација</label>
            <select value={cfg.orientation} onChange={e => setCfg(c => ({ ...c, orientation: e.target.value as Orientation }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="portrait">Портрет</option>
              <option value="landscape">Пејзаж</option>
            </select>
          </div>
        </div>

        {/* Spacing */}
        {cfg.gridType !== 'millimeter' && cfg.gridType !== 'logarithmic' && (
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 flex justify-between">
              <span>Растер (mm)</span>
              <span className="text-indigo-600 font-mono">{cfg.spacing} mm</span>
            </label>
            <input type="range" min={2} max={20} value={cfg.spacing}
              onChange={e => setCfg(c => ({ ...c, spacing: +e.target.value }))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>2 mm (ситна)</span><span>10 mm</span><span>20 mm (крупна)</span>
            </div>
          </div>
        )}

        {/* Polar options */}
        {cfg.gridType === 'polar' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Прстени: {cfg.polarRings}</label>
              <input type="range" min={4} max={20} value={cfg.polarRings}
                onChange={e => setCfg(c => ({ ...c, polarRings: +e.target.value }))}
                className="w-full accent-indigo-600" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Сектори: {cfg.polarSectors}</label>
              <input type="range" min={4} max={36} step={2} value={cfg.polarSectors}
                onChange={e => setCfg(c => ({ ...c, polarSectors: +e.target.value }))}
                className="w-full accent-indigo-600" />
            </div>
          </div>
        )}

        {/* Dot size */}
        {cfg.gridType === 'dot' && (
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 flex justify-between">
              <span>Голем. на точка</span>
              <span className="text-indigo-600 font-mono">{cfg.dotSize}px</span>
            </label>
            <input type="range" min={1} max={4} step={0.5} value={cfg.dotSize}
              onChange={e => setCfg(c => ({ ...c, dotSize: +e.target.value }))}
              className="w-full accent-indigo-600" />
          </div>
        )}

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Боја на линии</label>
            <div className="flex items-center gap-2">
              <input type="color" value={cfg.lineColor}
                onChange={e => setCfg(c => ({ ...c, lineColor: e.target.value }))}
                className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
              <span className="text-xs text-gray-500 font-mono">{cfg.lineColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Боја на акцент</label>
            <div className="flex items-center gap-2">
              <input type="color" value={cfg.majorLineColor}
                onChange={e => setCfg(c => ({ ...c, majorLineColor: e.target.value }))}
                className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
              <span className="text-xs text-gray-500 font-mono">{cfg.majorLineColor}</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <input type="checkbox" id="showTitle" checked={cfg.showTitle}
              onChange={e => setCfg(c => ({ ...c, showTitle: e.target.checked }))}
              className="accent-indigo-600" />
            <label htmlFor="showTitle" className="text-xs font-bold text-gray-500 cursor-pointer">Наслов на страница</label>
          </div>
          {cfg.showTitle && (
            <input type="text" value={cfg.titleText} placeholder="Математика — Функции..."
              onChange={e => setCfg(c => ({ ...c, titleText: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          )}
        </div>

        {/* Quick presets */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Settings2 className="w-3 h-3" /> Брзи поставки</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '5mm квадрат', fn: () => setCfg(c => ({ ...c, gridType: 'square', spacing: 5 })) },
              { label: '1cm квадрат', fn: () => setCfg(c => ({ ...c, gridType: 'square', spacing: 10 })) },
              { label: 'Изо 30°', fn: () => setCfg(c => ({ ...c, gridType: 'isometric', isoAngle: 30 })) },
              { label: 'Поларна 12', fn: () => setCfg(c => ({ ...c, gridType: 'polar', polarSectors: 12, polarRings: 10 })) },
              { label: 'Точки 5mm', fn: () => setCfg(c => ({ ...c, gridType: 'dot', spacing: 5 })) },
            ].map(p => (
              <button key={p.label} type="button" onClick={p.fn}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 transition">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={printPaper}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl font-semibold text-sm hover:bg-gray-900 transition">
            <Printer className="w-4 h-4" /> Печати
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={exportPNG}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-xs hover:bg-indigo-700 transition">
              <Download className="w-3.5 h-3.5" /> PNG (300dpi)
            </button>
            <button type="button" onClick={exportSVG}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-xs hover:bg-emerald-700 transition">
              <Download className="w-3.5 h-3.5" /> SVG
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-100 rounded-2xl p-4 flex flex-col items-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Преглед</p>
        <div className="bg-white shadow-xl rounded overflow-hidden" style={{ maxWidth: '100%', maxHeight: 600 }}>
          <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: 580, objectFit: 'contain' }} />
        </div>
        <p className="text-[10px] text-gray-400 mt-2">{cfg.format} · {cfg.orientation === 'portrait' ? 'Портрет' : 'Пејзаж'} · {cfg.gridType}</p>
      </div>
    </div>
  );
};
