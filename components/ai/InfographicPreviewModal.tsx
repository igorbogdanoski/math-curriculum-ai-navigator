import { logger } from '../../utils/logger';
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Loader2, FileImage, FileCode } from 'lucide-react';
import type { InfographicLayout } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

// ─── Palette definitions ─────────────────────────────────────────────────────
const PALETTES = {
  blue:   { bg: '#1e3a8a', accent: '#3b82f6', light: '#eff6ff', text: '#1e3a8a', badge: '#dbeafe', badgeText: '#1e40af' },
  green:  { bg: '#14532d', accent: '#22c55e', light: '#f0fdf4', text: '#14532d', badge: '#dcfce7', badgeText: '#166534' },
  purple: { bg: '#4c1d95', accent: '#a855f7', light: '#faf5ff', text: '#4c1d95', badge: '#f3e8ff', badgeText: '#6b21a8' },
  orange: { bg: '#7c2d12', accent: '#f97316', light: '#fff7ed', text: '#7c2d12', badge: '#ffedd5', badgeText: '#9a3412' },
};

// ─── InfographicCard (shared for preview + capture) ──────────────────────────
const InfographicCard: React.FC<{ layout: InfographicLayout; cardRef?: React.RefObject<HTMLDivElement> }> = ({ layout, cardRef }) => {
  const pal = PALETTES[layout.palette] || PALETTES.blue;

  return (
    <div
      ref={cardRef}
      style={{
        width: 800,
        minHeight: 1100,
        background: pal.light,
        fontFamily: 'Segoe UI, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        border: `3px solid ${pal.bg}`,
        borderRadius: 16,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: pal.bg, padding: '28px 32px 22px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ background: pal.accent, color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 13, fontWeight: 700 }}>
            {layout.grade}
          </span>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 13, fontWeight: 600 }}>
            {layout.subject}
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.25, letterSpacing: '-0.3px' }}>
          {layout.title}
        </h1>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, flex: 1 }}>

        {/* Left column: Objectives + Vocabulary */}
        <div style={{ width: 260, minWidth: 260, background: pal.badge, padding: '20px 20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: pal.bg, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
              🎯 Цели
            </h2>
            {layout.objectives.map((obj, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <span style={{ background: pal.bg, color: '#fff', borderRadius: '50%', width: 20, height: 20, minWidth: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, color: pal.text, lineHeight: 1.4 }}>{obj}</span>
              </div>
            ))}
          </div>

          {layout.vocabulary.length > 0 && (
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: pal.bg, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
                📖 Поими
              </h2>
              {layout.vocabulary.map((v, i) => (
                <div key={i} style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: pal.text }}>{v.term}</div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{v.definition}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Content sections */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {layout.sections.map((sec, i) => (
            <div key={i} style={{
              background: '#fff',
              borderRadius: 12,
              padding: '14px 16px',
              border: `1.5px solid ${pal.badge}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{sec.icon}</span>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: pal.text, margin: 0 }}>{sec.heading}</h3>
              </div>
              {sec.points.map((pt, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                  <span style={{ color: pal.accent, fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>›</span>
                  <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>{pt}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Key message banner ─────────────────────────────────────────────── */}
      <div style={{
        background: pal.bg, color: '#fff', padding: '14px 32px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{layout.keyMessage}</span>
      </div>
    </div>
  );
};

// ─── SVG export — dynamic height calculation ──────────────────────────────────
function buildSVG(layout: InfographicLayout): string {
  const pal = PALETTES[layout.palette] || PALETTES.blue;
  const W = 800;
  const SIDEBAR_W = 260;
  const RIGHT_X = SIDEBAR_W + 16;
  const RIGHT_W = W - RIGHT_X - 16;
  const FOOTER_H = 60;
  const LINE_H = 15;

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const wrap = (text: string, maxChars: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if ((line + word).length > maxChars) { lines.push(line.trim()); line = word + ' '; }
      else { line += word + ' '; }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.length ? lines : [''];
  };

  // Compute header height dynamically from title line count
  const titleLines = wrap(layout.title, 50);
  const HEADER_H = Math.max(100, 50 + titleLines.length * 28 + 14);

  // ── Build LEFT COLUMN elements, tracking y as we go ──────────────────────
  const leftEls: string[] = [];
  let leftY = HEADER_H + 28;

  // Objectives heading
  leftEls.push(`<text x="24" y="${leftY}" fill="${pal.bg}" font-size="11" font-weight="800" font-family="Arial">🎯 ЦЕЛИ</text>`);
  leftY += 20;

  layout.objectives.forEach((obj, i) => {
    const lines = wrap(obj, 23);
    leftEls.push(`<circle cx="36" cy="${leftY + 7}" r="9" fill="${pal.bg}"/>`);
    leftEls.push(`<text x="36" y="${leftY + 11}" text-anchor="middle" fill="white" font-size="10" font-weight="700" font-family="Arial">${i + 1}</text>`);
    lines.forEach((l, li) => {
      leftEls.push(`<text x="52" y="${leftY + 7 + li * LINE_H}" fill="${pal.text}" font-size="12" font-family="Arial">${esc(l)}</text>`);
    });
    leftY += lines.length * LINE_H + 16;
  });

  if (layout.vocabulary.length > 0) {
    leftY += 14;
    leftEls.push(`<text x="24" y="${leftY}" fill="${pal.bg}" font-size="11" font-weight="800" font-family="Arial">📖 ПОИМИ</text>`);
    leftY += 18;
    layout.vocabulary.forEach(v => {
      const termLines = wrap(v.term, 26);
      termLines.forEach((l, li) => {
        leftEls.push(`<text x="24" y="${leftY + li * LINE_H}" fill="${pal.text}" font-size="12" font-weight="700" font-family="Arial">${esc(l)}</text>`);
      });
      leftY += termLines.length * LINE_H + 2;
      const defLines = wrap(v.definition, 28);
      defLines.forEach((l, li) => {
        leftEls.push(`<text x="24" y="${leftY + li * 14}" fill="#475569" font-size="11" font-family="Arial">${esc(l)}</text>`);
      });
      leftY += defLines.length * 14 + 10;
    });
  }
  const leftColH = leftY - HEADER_H + 20;

  // ── Build RIGHT COLUMN elements, tracking y as we go ─────────────────────
  const rightEls: string[] = [];
  let rightY = HEADER_H + 18;

  layout.sections.forEach(sec => {
    // First pass: measure content height
    let ptY = rightY + 44;
    const ptEls: string[] = [];
    sec.points.forEach(pt => {
      const lines = wrap(pt, 44);
      lines.forEach((l, li) => {
        ptEls.push(`<text x="${RIGHT_X + 18}" y="${ptY + li * LINE_H}" fill="#334155" font-size="12" font-family="Arial">${esc((li === 0 ? '› ' : '  ') + l)}</text>`);
      });
      ptY += lines.length * LINE_H + 6;
    });

    const secH = ptY - rightY + 10;
    rightEls.push(`<rect x="${RIGHT_X}" y="${rightY}" width="${RIGHT_W}" height="${secH}" rx="10" fill="white" stroke="${pal.badge}" stroke-width="1.5"/>`);
    rightEls.push(`<text x="${RIGHT_X + 14}" y="${rightY + 24}" fill="${pal.text}" font-size="13" font-weight="800" font-family="Arial">${esc(sec.icon + ' ' + sec.heading)}</text>`);
    rightEls.push(...ptEls);
    rightY += secH + 12;
  });
  const rightColH = rightY - HEADER_H + 16;

  // ── Final dimensions ──────────────────────────────────────────────────────
  const BODY_H = Math.max(leftColH, rightColH, 600);
  const TOTAL_H = HEADER_H + BODY_H + FOOTER_H;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TOTAL_H}" viewBox="0 0 ${W} ${TOTAL_H}">
  <defs><style>text { font-family: Arial, sans-serif; }</style></defs>

  <!-- Background -->
  <rect width="${W}" height="${TOTAL_H}" fill="${pal.light}" rx="16"/>

  <!-- Header -->
  <rect width="${W}" height="${HEADER_H}" fill="${pal.bg}" rx="16"/>
  <rect y="${HEADER_H - 16}" width="${W}" height="16" fill="${pal.bg}"/>
  <rect x="20" y="14" width="82" height="22" rx="11" fill="${pal.accent}"/>
  <text x="61" y="29" text-anchor="middle" fill="white" font-size="11" font-weight="700">${esc(layout.grade)}</text>
  <rect x="112" y="14" width="94" height="22" rx="11" fill="rgba(255,255,255,0.22)"/>
  <text x="159" y="29" text-anchor="middle" fill="white" font-size="11" font-weight="600">${esc(layout.subject)}</text>
  ${titleLines.map((l, i) => `<text x="20" y="${54 + i * 28}" fill="white" font-size="22" font-weight="800">${esc(l)}</text>`).join('\n  ')}

  <!-- Left sidebar background -->
  <rect x="0" y="${HEADER_H}" width="${SIDEBAR_W}" height="${BODY_H}" fill="${pal.badge}"/>

  <!-- Left column content -->
  ${leftEls.join('\n  ')}

  <!-- Right sections -->
  ${rightEls.join('\n  ')}

  <!-- Footer -->
  <rect y="${HEADER_H + BODY_H}" width="${W}" height="${FOOTER_H}" fill="${pal.bg}"/>
  <rect y="${HEADER_H + BODY_H}" width="${W}" height="8" fill="${pal.bg}"/>
  ${wrap('💡 ' + layout.keyMessage, 70).map((l, i) => `<text x="32" y="${HEADER_H + BODY_H + 32 + i * 18}" fill="white" font-size="13" font-weight="600">${esc(l)}</text>`).join('\n  ')}
</svg>`;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface Props {
  layout: InfographicLayout;
  onClose: () => void;
}

export const InfographicPreviewModal: React.FC<Props> = ({ layout, onClose }) => {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { addNotification } = useNotification();

  const handleDownloadPNG = async () => {
    if (!captureRef.current) return;
    setIsExporting(true);
    try {
      const el = captureRef.current;
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 900,
        windowHeight: el.scrollHeight + 100,
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `infografik-${layout.title.substring(0, 30).replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      canvas.width = 0;
      canvas.height = 0;
    } catch (err) {
      logger.error('Infographic PNG export failed:', err);
      addNotification('Грешка при PNG извоз. Обидете се повторно.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSVG = () => {
    try {
      const svg = buildSVG(layout);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `infografik-${layout.title.substring(0, 30).replace(/\s+/g, '-')}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      addNotification('SVG успешно преземен!', 'success');
    } catch (err) {
      logger.error('Infographic SVG export failed:', err);
      addNotification('Грешка при SVG извоз.', 'error');
    }
  };

  return (
    <>
      {/*
       * Hidden off-screen card for html2canvas capture.
       * IMPORTANT: must NOT use visibility:hidden — html2canvas skips hidden elements
       * and returns a blank canvas. Off-screen position (left:-9999px) is sufficient.
       */}
      <div
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 800,
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <InfographicCard layout={layout} cardRef={captureRef as React.RefObject<HTMLDivElement>} />
      </div>

      {/* ── Modal ── */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
        aria-hidden="true"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="infographic-modal-title"
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <div>
              <h2 id="infographic-modal-title" className="text-lg font-bold text-gray-800">Инфографик за часот</h2>
              <p className="text-xs text-gray-500 mt-0.5">Преглед — преземи PNG или SVG (вектор)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSVG}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md text-sm"
              >
                <FileCode className="w-4 h-4" /> SVG
              </button>
              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={isExporting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all disabled:opacity-60 shadow-md text-sm"
              >
                {isExporting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Извезувам…</>
                  : <><FileImage className="w-4 h-4" /> PNG (300dpi)</>}
              </button>
              <button type="button" onClick={onClose} title="Затвори" aria-label="Затвори" className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable preview — CSS scale for display only, NOT for capture */}
          <div className="flex-1 overflow-auto p-6 bg-gray-100 flex justify-center">
            <div style={{ transform: 'scale(0.75)', transformOrigin: 'top center', width: 800 }}>
              <InfographicCard layout={layout} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
