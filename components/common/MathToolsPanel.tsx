import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PenTool, Box, LineChart, Maximize2, Minimize2, X, Save, WifiOff, RefreshCw } from 'lucide-react';
import { DigitalScratchpad } from './DigitalScratchpad';

interface Props {
  onClose?: () => void;
  className?: string;
  /** Called when teacher clicks "Зачувај" — receives PNG data-URI and tool name */
  onExportImage?: (dataUrl: string, tool: 'geogebra' | 'desmos') => void;
}

// ─── Script loader singletons (Promise-based, immune to concurrent mounts) ───
const GGBAPPLET_SCRIPT = 'https://www.geogebra.org/apps/deployggb.js';
const DESMOS_SCRIPT = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';

let ggbLoadPromise: Promise<void> | null = null;
let desmosLoadPromise: Promise<void> | null = null;

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Не може да се вчита: ${src}`));
    document.head.appendChild(s);
  });

const loadGgbScript = (): Promise<void> => {
  if ((window as any).GGBApplet) return Promise.resolve();
  if (!ggbLoadPromise) ggbLoadPromise = loadScript(GGBAPPLET_SCRIPT).catch(e => { ggbLoadPromise = null; throw e; });
  return ggbLoadPromise;
};

const loadDesmosScript = (): Promise<void> => {
  if ((window as any).Desmos) return Promise.resolve();
  if (!desmosLoadPromise) desmosLoadPromise = loadScript(DESMOS_SCRIPT).catch(e => { desmosLoadPromise = null; throw e; });
  return desmosLoadPromise;
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div className="flex flex-col h-full items-center justify-center gap-4 bg-gray-50 p-8">
    <div className={`w-12 h-12 rounded-xl animate-pulse ${color}`} />
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      <div className="h-3 rounded animate-pulse bg-gray-200 w-3/4" />
      <div className="h-3 rounded animate-pulse bg-gray-200 w-1/2" />
    </div>
    <p className="text-xs text-gray-400 font-medium">{label}</p>
  </div>
);

// ─── Error fallback ───────────────────────────────────────────────────────────
const ErrorFallback: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col h-full items-center justify-center gap-4 p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
      <WifiOff className="w-7 h-7 text-orange-500" />
    </div>
    <div>
      <p className="text-sm font-bold text-gray-700 mb-1">Алатката не може да се вчита</p>
      <p className="text-xs text-gray-500 max-w-xs">{message}</p>
      <p className="text-xs text-gray-400 mt-1">Потребна е активна интернет врска.</p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
    >
      <RefreshCw className="w-4 h-4" />
      Обиди се повторно
    </button>
  </div>
);

// ─── GeoGebra panel ──────────────────────────────────────────────────────────
const GeoGebraPanel: React.FC<{ onExport?: (dataUrl: string) => void }> = ({ onExport }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);

    const init = async () => {
      try {
        await loadGgbScript();
        if (cancelled || !containerRef.current) return;
        const GGBApplet = (window as any).GGBApplet;
        if (!GGBApplet) throw new Error('GGBApplet не е достапен.');

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

        const uid = `ggb-${Date.now()}`;
        containerRef.current.id = uid;
        const applet = new GGBApplet(params, true);
        applet.inject(uid);
        appletRef.current = applet;
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Грешка при вчитување.');
      }
    };

    init();
    return () => {
      cancelled = true;
      try {
        if (containerRef.current) containerRef.current.innerHTML = '';
        appletRef.current = null;
      } catch (_) { /* ignore */ }
    };
  }, [retryKey]);

  const handleExport = useCallback(async () => {
    if (!appletRef.current) return;
    setExporting(true);
    try {
      const ggbApp = (window as any).ggbApplet ?? appletRef.current;
      const base64: string = ggbApp?.getBase64?.(true);
      if (base64) {
        const dataUrl = `data:image/png;base64,${base64}`;
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

  if (error) return <ErrorFallback message={error} onRetry={() => setRetryKey(k => k + 1)} />;

  return (
    <div className="flex flex-col h-full">
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
      <div className="flex-1 relative min-h-0">
        {!ready && !error && (
          <div className="absolute inset-0 z-10">
            <LoadingSkeleton label="Вчитувам GeoGebra…" color="bg-blue-200" />
          </div>
        )}
        <div ref={containerRef} className="w-full h-full bg-white" />
      </div>
    </div>
  );
};

// ─── Desmos panel ─────────────────────────────────────────────────────────────
const DesmosPanel: React.FC<{ onExport?: (dataUrl: string) => void }> = ({ onExport }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);

    const init = async () => {
      try {
        await loadDesmosScript();
        if (cancelled || !containerRef.current) return;
        const Desmos = (window as any).Desmos;
        if (!Desmos?.GraphingCalculator) throw new Error('Desmos API не е достапен.');
        calcRef.current = Desmos.GraphingCalculator(containerRef.current, {
          keypad: true, expressions: true, settingsMenu: true,
          zoomButtons: true, expressionsTopbar: true,
        });
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Грешка при вчитување.');
      }
    };

    init();
    return () => {
      cancelled = true;
      calcRef.current?.destroy?.();
      calcRef.current = null;
    };
  }, [retryKey]);

  const handleExport = useCallback(async () => {
    if (!calcRef.current) return;
    setExporting(true);
    try {
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

  if (error) return <ErrorFallback message={error} onRetry={() => setRetryKey(k => k + 1)} />;

  return (
    <div className="flex flex-col h-full">
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
      <div className="flex-1 relative min-h-[400px]">
        {!ready && !error && (
          <div className="absolute inset-0 z-10">
            <LoadingSkeleton label="Вчитувам Desmos…" color="bg-green-200" />
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0 bg-white" />
      </div>
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

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    onClose?.();
  }, [onClose]);

  // Escape key — first exit fullscreen, then close panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isExpanded) { setIsExpanded(false); return; }
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpanded, onClose]);

  return (
    <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-[200] md:relative md:inset-auto md:z-auto' : ''} ${className}`}>
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
            <button type="button" onClick={handleClose}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Затвори (Esc)"
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
          <button type="button" onClick={() => setLastExport(null)} title="Затвори преглед" className="ml-auto text-amber-400 hover:text-amber-700">
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
