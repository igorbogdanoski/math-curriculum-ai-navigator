import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, Loader2 } from 'lucide-react';
import type { InfographicLayout } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

// ─── Palette definitions ─────────────────────────────────────────────────────
const PALETTES = {
  blue:   { bg: '#1e3a8a', accent: '#3b82f6', light: '#eff6ff', text: '#1e3a8a', badge: '#dbeafe', badgeText: '#1e40af' },
  green:  { bg: '#14532d', accent: '#22c55e', light: '#f0fdf4', text: '#14532d', badge: '#dcfce7', badgeText: '#166534' },
  purple: { bg: '#4c1d95', accent: '#a855f7', light: '#faf5ff', text: '#4c1d95', badge: '#f3e8ff', badgeText: '#6b21a8' },
  orange: { bg: '#7c2d12', accent: '#f97316', light: '#fff7ed', text: '#7c2d12', badge: '#ffedd5', badgeText: '#9a3412' },
};

// ─── InfographicCard (rendered to PNG) ───────────────────────────────────────
const InfographicCard: React.FC<{ layout: InfographicLayout; cardRef: React.RefObject<HTMLDivElement> }> = ({ layout, cardRef }) => {
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

// ─── Modal ───────────────────────────────────────────────────────────────────
interface Props {
  layout: InfographicLayout;
  onClose: () => void;
}

export const InfographicPreviewModal: React.FC<Props> = ({ layout, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { addNotification } = useNotification();

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,          // 3× = ~300dpi for 800px wide card
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `infografik-${layout.title.substring(0, 30).replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      // Release canvas memory
      canvas.width = 0;
      canvas.height = 0;
    } catch (err) {
      console.error('Infographic export failed:', err);
      addNotification('Грешка при извоз. Обидете се повторно.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Инфографик за часот</h2>
            <p className="text-xs text-gray-500 mt-0.5">Преглед — преземи го PNG со копчето подолу</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all disabled:opacity-60 shadow-md text-sm"
            >
              {isExporting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Извезувам…</>
                : <><Download className="w-4 h-4" /> Преземи PNG</>}
            </button>
            <button type="button" onClick={onClose} title="Затвори" aria-label="Затвори" className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable preview — inline styles required for html2canvas capture accuracy */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100 flex justify-center">
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div style={{ transform: 'scale(0.75)', transformOrigin: 'top center', width: 800 }}>
            <InfographicCard layout={layout} cardRef={cardRef as React.RefObject<HTMLDivElement>} />
          </div>
        </div>
      </div>
    </div>
  );
};
