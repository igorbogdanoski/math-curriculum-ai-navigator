import { logger } from '../../utils/logger';
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, Loader2, FileImage, FileCode } from 'lucide-react';
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
        overflow: 'hidden',
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
          {/* Objectives */}
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

          {/* Vocabulary */}
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

// ─── SVG export helper ────────────────────────────────────────────────────────
function buildSVG(layout: InfographicLayout): string {
  const pal = PALETTES[layout.palette] || PALETTES.blue;
  const W = 800;

  // Header height
  const headerH = 90;
  // Estimate body height based on content
  const bodyH = Math.max(700, layout.sections.length * 140 + 80);
  const footerH = 56;
  const totalH = headerH + bodyH + footerH;

  const escXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const wrapText = (text: string, maxChars: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if ((line + word).length > maxChars) { lines.push(line.trim()); line = word + ' '; }
      else { line += word + ' '; }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  };

  let objY = headerH + 30;
  const objectivesSVG = layout.objectives.map((obj, i) => {
    const lines = wrapText(obj, 22);
    const block = `
      <circle cx="${44}" cy="${objY + 8}" r="10" fill="${pal.bg}"/>
      <text x="${44}" y="${objY + 12}" text-anchor="middle" fill="white" font-size="10" font-weight="700">${i + 1}</text>
      ${lines.map((l, li) => `<text x="60" y="${objY + 8 + li * 16}" fill="${pal.text}" font-size="12" font-family="Arial">${escXml(l)}</text>`).join('')}
    `;
    objY += lines.length * 16 + 18;
    return block;
  }).join('');

  let secY = headerH + 20;
  const sectionsSVG = layout.sections.map((sec) => {
    const secH = sec.points.length * 22 + 44;
    const block = `
      <rect x="276" y="${secY}" width="${W - 276 - 20}" height="${secH}" rx="10" fill="white" stroke="${pal.badge}" stroke-width="1.5"/>
      <text x="310" y="${secY + 24}" fill="${pal.text}" font-size="13" font-weight="800" font-family="Arial">${escXml(sec.icon + ' ' + sec.heading)}</text>
      ${sec.points.map((pt, j) => {
        const lines = wrapText(pt, 42);
        return lines.map((l, li) => `<text x="300" y="${secY + 42 + j * 22 + li * 15}" fill="#334155" font-size="12" font-family="Arial">${escXml('› ' + (li === 0 ? l : '  ' + l))}</text>`).join('');
      }).join('')}
    `;
    secY += secH + 12;
    return block;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <defs>
    <style>text { font-family: Arial, sans-serif; }</style>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${totalH}" fill="${pal.light}" rx="16"/>

  <!-- Header -->
  <rect width="${W}" height="${headerH}" fill="${pal.bg}" rx="16"/>
  <rect y="${headerH - 16}" width="${W}" height="16" fill="${pal.bg}"/>
  <rect x="20" y="14" width="80" height="20" rx="10" fill="${pal.accent}"/>
  <text x="60" y="28" text-anchor="middle" fill="white" font-size="11" font-weight="700">${escXml(layout.grade)}</text>
  <rect x="110" y="14" width="90" height="20" rx="10" fill="rgba(255,255,255,0.2)"/>
  <text x="155" y="28" text-anchor="middle" fill="white" font-size="11" font-weight="600">${escXml(layout.subject)}</text>
  ${wrapText(layout.title, 48).map((l, i) => `<text x="20" y="${52 + i * 26}" fill="white" font-size="20" font-weight="800">${escXml(l)}</text>`).join('')}

  <!-- Left sidebar -->
  <rect x="0" y="${headerH}" width="260" height="${bodyH}" fill="${pal.badge}"/>
  <text x="24" y="${headerH + 20}" fill="${pal.bg}" font-size="11" font-weight="800">🎯 ЦЕЛИ</text>
  ${objectivesSVG}

  <!-- Right sections -->
  ${sectionsSVG}

  <!-- Footer -->
  <rect y="${headerH + bodyH}" width="${W}" height="${footerH}" fill="${pal.bg}"/>
  <text x="44" y="${headerH + bodyH + 34}" fill="white" font-size="14" font-weight="600">💡 ${escXml(layout.keyMessage)}</text>
</svg>`;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface Props {
  layout: InfographicLayout;
  onClose: () => void;
}

export const InfographicPreviewModal: React.FC<Props> = ({ layout, onClose }) => {
  // captureRef is on a HIDDEN off-screen card — no parent transforms affecting it
  const captureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { addNotification } = useNotification();

  const handleDownloadPNG = async () => {
    if (!captureRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        // Capture at full size without any transform influence
        windowWidth: 900,
        windowHeight: 1200,
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
      {/* ── Hidden off-screen card for html2canvas capture ── */}
      <div
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 800,
          pointerEvents: 'none',
          visibility: 'hidden',
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

          {/* Scrollable preview — CSS scale only for display, NOT for capture */}
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
