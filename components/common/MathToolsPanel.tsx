import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PenTool, Box, LineChart, Maximize2, Minimize2, X, Download, Save } from 'lucide-react';
import { DigitalScratchpad } from './DigitalScratchpad';

interface Props {
  onClose?: () => void;
  className?: string;
  /** Called when teacher clicks "Зачувај" — receives PNG data-URI and tool name */
  onExportImage?: (dataUrl: string, tool: 'geogebra' | 'desmos') => void;
}

// ─── GeoGebra loader ─────────────────────────────────────────────────────────
const GGBAPPLET_SCRIPT = 'https://www.geogebra.org/apps/deployggb.js';
let ggbScriptLoaded = false;

const loadGgbScript = (): Promise<void> =>
  new Promise(resolve => {
    if (ggbScriptLoaded || (window as any).GGBApplet) { ggbScriptLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = GGBAPPLET_SCRIPT;
    s.onload = () => { ggbScriptLoaded = true; resolve(); };
    document.head.appendChild(s);
  });

// ─── Desmos loader ────────────────────────────────────────────────────────────
const DESMOS_SCRIPT = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
let desmosScriptLoaded = false;

const loadDesmosScript = (): Promise<void> =>
  new Promise(resolve => {
    if (desmosScriptLoaded || (window as any).Desmos) { desmosScriptLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = DESMOS_SCRIPT;
    s.onload = () => { desmosScriptLoaded = true; resolve(); };
    document.head.appendChild(s);
  });

// ─── GeoGebra panel ──────────────────────────────────────────────────────────
const GeoGebraPanel: React.FC<{ onExport?: (dataUrl: string) => void }> = ({ onExport }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await loadGgbScript();
      if (cancelled || !containerRef.current) return;
      const GGBApplet = (window as any).GGBApplet;
      if (!GGBApplet) return;

      const params = {
        appName: 'geometry',
        width: containerRef.current.clientWidth || 800,
        height: containerRef.current.clientHeight || 500,
        showToolBar: true,
        showAlgebraInput: false,
        showMenuBar: false,
        showResetIcon: true,
        enableLabelDrags: false,
        useBrowserForJS: false,
        allowStyleBar: true,
        preventFocus: false,
        showZoomButtons: true,
        capturingThreshold: null,
        appletOnLoad: () => { if (!cancelled) setReady(true); },
      };

      // Each instance needs a unique container ID
      const uid = `ggb-${Date.now()}`;
      containerRef.current.id = uid;
      const applet = new GGBApplet(params, true);
      applet.inject(uid);
      appletRef.current = applet;
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const handleExport = useCallback(async () => {
    if (!appletRef.current) return;
    setExporting(true);
    try {
      // getBase64(true) → PNG base64 string (synchronous after applet loads)
      const ggbApp = (window as any).ggbApplet ?? appletRef.current;
      const base64: string = ggbApp?.getBase64?.(true);
      if (base64) {
        const dataUrl = `data:image/png;base64,${base64}`;
        // Also trigger direct download
        const link = document.createElement('a');
        link.download = `geogebra-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        onExport?.(dataUrl);
      }
    } finally {
      setExporting(false);
    }
  }, [onExport]);

  return (
    <div className="flex flex-col h-full">
      {/* Export toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-100">
        <span className="text-xs font-semibold text-blue-700">GeoGebra Geometry</span>
        <button
          type="button"
          onClick={handleExport}
          disabled={!ready || exporting}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
          title="Зачувај конструкцијата како PNG слика"
        >
          <Save className="w-3.5 h-3.5" />
          {exporting ? 'Зачувувам…' : ready ? 'Зачувај PNG' : 'Вчитувам…'}
        </button>
      </div>
      {/* GeoGebra container — injected by GGBApplet */}
      <div ref={containerRef} className="flex-1 w-full min-h-0 bg-white" />
    </div>
  );
};

// ─── Desmos panel ─────────────────────────────────────────────────────────────
const DesmosPanel: React.FC<{ onExport?: (dataUrl: string) => void }> = ({ onExport }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await loadDesmosScript();
      if (cancelled || !containerRef.current) return;
      const Desmos = (window as any).Desmos;
      if (!Desmos?.GraphingCalculator) return;
      calcRef.current = Desmos.GraphingCalculator(containerRef.current, {
        keypad: true, expressions: true, settingsMenu: true,
        zoomButtons: true, expressionsTopbar: true,
      });
      if (!cancelled) setReady(true);
    };
    init();
    return () => {
      cancelled = true;
      calcRef.current?.destroy?.();
    };
  }, []);

  const handleExport = useCallback(async () => {
    if (!calcRef.current) return;
    setExporting(true);
    try {
      // screenshot() returns a data-URI PNG string
      const dataUrl: string = calcRef.current.screenshot({ width: 1200, height: 700, targetPixelRatio: 2 });
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `desmos-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        onExport?.(dataUrl);
      }
    } finally {
      setExporting(false);
    }
  }, [onExport]);

  return (
    <div className="flex flex-col h-full">
      {/* Export toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100">
        <span className="text-xs font-semibold text-green-700">Desmos Graphing Calculator</span>
        <button
          type="button"
          onClick={handleExport}
          disabled={!ready || exporting}
          className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
          title="Зачувај графикот како PNG слика"
        >
          <Save className="w-3.5 h-3.5" />
          {exporting ? 'Зачувувам…' : ready ? 'Зачувај PNG' : 'Вчитувам…'}
        </button>
      </div>
      {/* Desmos container */}
      <div ref={containerRef} className="flex-1 w-full min-h-0 bg-white" style={{ minHeight: 400 }} />
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────
export const MathToolsPanel: React.FC<Props> = ({ onClose, className = '', onExportImage }) => {
  const [activeTool, setActiveTool] = useState<'scratchpad' | 'geogebra' | 'desmos'>('scratchpad');
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastExport, setLastExport] = useState<{ dataUrl: string; tool: string } | null>(null);

  const handleExport = useCallback((dataUrl: string, tool: 'geogebra' | 'desmos') => {
    setLastExport({ dataUrl, tool });
    onExportImage?.(dataUrl, tool);
  }, [onExportImage]);

  return (
    <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-50 md:relative md:inset-auto' : ''} ${className}`}>
      {/* Header & Tabs */}
      <div className="flex-none p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto no-scrollbar">
          <button type="button"
            onClick={() => setActiveTool('scratchpad')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTool === 'scratchpad' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <PenTool size={16} /> <span className="hidden sm:inline">Скицирање</span>
          </button>
          <button type="button"
            onClick={() => setActiveTool('geogebra')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTool === 'geogebra' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Box size={16} /> <span className="hidden sm:inline">GeoGebra</span>
          </button>
          <button type="button"
            onClick={() => setActiveTool('desmos')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTool === 'desmos' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LineChart size={16} /> <span className="hidden sm:inline">Desmos</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title={isExpanded ? 'Намали' : 'Зголеми на цел екран'}
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {onClose && (
            <button type="button" onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Затвори"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Last exported preview strip */}
      {lastExport && (
        <div className="flex-none flex items-center gap-3 px-3 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          <img src={lastExport.dataUrl} alt="export preview"
            className="h-10 w-16 object-contain border border-amber-200 rounded bg-white" />
          <span className="font-semibold">Зачувано! Сликата е преземена.</span>
          <button type="button" onClick={() => setLastExport(null)} className="ml-auto text-amber-400 hover:text-amber-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tool Content Area */}
      <div className="flex-1 w-full bg-white relative overflow-hidden flex flex-col min-h-0">
        {activeTool === 'scratchpad' && (
          <DigitalScratchpad className="flex-1 w-full min-h-[300px] border-0 rounded-none" />
        )}
        {activeTool === 'geogebra' && (
          <GeoGebraPanel onExport={url => handleExport(url, 'geogebra')} />
        )}
        {activeTool === 'desmos' && (
          <DesmosPanel onExport={url => handleExport(url, 'desmos')} />
        )}
      </div>
    </div>
  );
};
