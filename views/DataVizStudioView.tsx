import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import {
  BarChart2, FileSpreadsheet, Sparkles, Download, Printer,
  Palette, Settings2, Eye, PlusCircle, Grid3X3, ChevronDown, Sigma, TrendingUp, Triangle,
  FlaskConical, FunctionSquare, Layers, Box, Shapes, LayoutGrid, PieChart
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { DataTable, DEFAULT_TABLE } from '../components/dataviz/DataTable';
import type { TableData } from '../components/dataviz/DataTable';
import { ChartPreview, COLOR_PALETTES, DEFAULT_CONFIG } from '../components/dataviz/ChartPreview';
import type { ChartType, ChartConfig } from '../components/dataviz/ChartPreview';
import { MathPaperGenerator } from '../components/dataviz/MathPaperGenerator';
import { AIStatsAssistant } from '../components/dataviz/AIStatsAssistant';
import { ProbabilityLab } from '../components/dataviz/ProbabilityLab';
import { SecondaryStatsLab } from '../components/dataviz/SecondaryStatsLab';
import { CalculusLab } from '../components/dataviz/CalculusLab';
import { Geometry2DLab } from '../components/dataviz/Geometry2DLab';
import { FunctionGrapher } from '../components/dataviz/FunctionGrapher';
import { FunctionTransformer } from '../components/math/FunctionTransformer';
import { GeoGebraViewer } from '../components/dataviz/GeoGebraViewer';
import { GammaModeModal } from '../components/ai/GammaModeModal';
import { SilentErrorBoundary } from '../components/common/SilentErrorBoundary';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';

const LinearAlgebraLab = lazy(() =>
  import('../components/dataviz/LinearAlgebraLab').then(m => ({ default: m.LinearAlgebraLab }))
);
const Geometry3DLab = lazy(() =>
  import('../components/dataviz/Geometry3DLab').then(m => ({ default: m.Geometry3DLab }))
);
const ConicSectionsLab = lazy(() =>
  import('../components/dataviz/ConicSectionsLab').then(m => ({ default: m.ConicSectionsLab }))
)
const AlgebraTilesLazy = lazy(() =>
  import('../components/math/AlgebraTilesCanvas').then(m => ({ default: m.AlgebraTilesCanvas }))
);
const TrigonometryLabLazy = lazy(() =>
  import('../components/dataviz/TrigonometryLab')
);
const NumberTheoryLabLazy = lazy(() =>
  import('../components/dataviz/NumberTheoryLab')
);
const PlaceValueLabLazy = lazy(() =>
  import('../components/dataviz/PlaceValueLab').then(m => ({ default: m.PlaceValueLab }))
);
const FractionsLabLazy = lazy(() =>
  import('../components/dataviz/FractionsLab').then(m => ({ default: m.FractionsLab }))
);

const LabLoading: React.FC = () => (
  <div className="flex items-center justify-center py-16 text-sm text-gray-500">
    <div className="animate-pulse">Се вчитува лаб...</div>
  </div>
);

// ─── Chart type definitions ──────────────────────────────────────────────────
interface ChartTypeDef {
  id: ChartType;
  label: string;
  emoji: string;
  desc: string;
  minCols: number;
}

const CHART_TYPES: ChartTypeDef[] = [
  { id: 'bar',                     label: 'Столбест верт.',       emoji: '📊', desc: 'Споредба категории, МОН 2–13р.',       minCols: 1 },
  { id: 'bar-horizontal',          label: 'Столбест хориз.',      emoji: '📉', desc: 'Категории со долги имиња',             minCols: 1 },
  { id: 'stacked-bar',             label: 'Наредени столбови',    emoji: '📶', desc: 'Повеќе серии наредени, МОН 4–9р.',     minCols: 2 },
  { id: 'stacked-bar-horizontal',  label: 'Наредени хориз.',      emoji: '☰',  desc: 'Хориз. наредени, МОН 4–9р.',          minCols: 2 },
  { id: 'divided-bar',             label: 'Делен (100%) Бар',     emoji: '🔲', desc: 'Пропорционален — Divided Bar, МОН 5+', minCols: 2 },
  { id: 'line',                    label: 'Линиски',               emoji: '📈', desc: 'Тренд низ времето (прави сегменти)',  minCols: 1 },
  { id: 'motion',                  label: 'График на движење',     emoji: '🚗', desc: 's–t / v–t — праволиниски сегменти, физика', minCols: 1 },
  { id: 'area',                    label: 'Површински',            emoji: '🏔️', desc: 'Акумулирани вредности',              minCols: 1 },
  { id: 'pie',                     label: 'Пита',                  emoji: '🥧', desc: 'Делови од целина',                    minCols: 1 },
  { id: 'scatter',                 label: 'Расеан (Scatter)',      emoji: '✦',  desc: 'Корелација X-Y',                      minCols: 2 },
  { id: 'scatter-trend',           label: 'Scatter + Тренд',      emoji: '📐', desc: 'Линеарна регресија R²',               minCols: 2 },
  { id: 'bubble',                  label: 'Balloon (Bubble)',      emoji: '🫧', desc: 'Три димензии',                        minCols: 3 },
  { id: 'histogram',               label: 'Хистограм',             emoji: '▬',  desc: 'Распределба на податоци',             minCols: 1 },
  { id: 'frequency-polygon',       label: 'Фрекв. многуаголник',  emoji: '📿', desc: 'Линија на фреквенции, МОН 6–9р.',     minCols: 1 },
  { id: 'cumulative-frequency',    label: 'Кумулат. фреквенција', emoji: '〰', desc: 'Огива — кумулатив, МОН 8–13р.',       minCols: 1 },
  { id: 'back-to-back-histogram',  label: 'B-to-B Хистограм',     emoji: '⇔',  desc: 'Споредба 2 групи, МОН 7–9р.',         minCols: 2 },
  { id: 'pareto',                  label: 'Парето дијаграм',       emoji: '🎯', desc: 'Сортиран + кумул. %, МОН 9–13р.',    minCols: 1 },
  { id: 'box-whisker',             label: 'Box-and-Whisker',       emoji: '⊟',  desc: 'Квартили + медијана',                 minCols: 1 },
  { id: 'stem-leaf',               label: 'Стебло-Листови',       emoji: '🌿', desc: 'Сите вредности, МОН 6-8р.',           minCols: 1 },
  { id: 'dot-plot',                label: 'Точкаст дијаграм',     emoji: '⠿',  desc: 'Броење на точки, МОН 5-7р.',          minCols: 1 },
  { id: 'heatmap',                 label: 'Топлинска карта',       emoji: '🌡️', desc: 'Корелации, МОН IX одд.',              minCols: 2 },
  { id: 'pictogram',               label: 'Пиктограм ★',          emoji: '🌟', desc: 'Сликовен дијаграм, МОН I–IV одд.',   minCols: 1 },
];

type StudioTab = 'chart' | 'paper' | 'ai' | 'prob' | 'fn' | 'geo' | 'stats' | 'calc' | 'linalg' | 'solid' | 'geo2d' | 'conic' | 'algebra' | 'trig' | 'numtheory' | 'placevalue' | 'fractions';

// ─── S62-A4: Function tab with sub-tabs ──────────────────────────────────────
type FnSubTab = 'grapher' | 'sliders';

const FnTabPanel: React.FC = () => {
  const [sub, setSub] = useState<FnSubTab>('grapher');
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-500" /> Граф на функции
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Исцртај функции · истражувај трансформации · МОН V–XIII одд.
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSub('grapher')}
            className={`px-3 py-1.5 transition-colors ${sub === 'grapher' ? 'bg-cyan-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Граф функции
          </button>
          <button
            type="button"
            onClick={() => setSub('sliders')}
            className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${sub === 'sliders' ? 'bg-cyan-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Слајдери за функции
          </button>
        </div>
      </div>
      {sub === 'grapher' ? <FunctionGrapher /> : <FunctionTransformer width={560} height={340} />}
    </div>
  );
};

// ─── Main View ───────────────────────────────────────────────────────────────
export const DataVizStudioView: React.FC = () => {
  const { addNotification } = useNotification();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    const hash = window.location.hash;
    const tabParam = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '').get('tab');
    const validTabs: StudioTab[] = ['chart', 'paper', 'ai', 'prob', 'fn', 'geo', 'stats', 'calc', 'linalg', 'solid', 'geo2d', 'conic', 'algebra', 'trig', 'numtheory', 'placevalue', 'fractions'];
    return (validTabs.includes(tabParam as StudioTab) ? tabParam : 'chart') as StudioTab;
  });

  // Chart builder state
  const [tableData, setTableData] = useState<TableData>(DEFAULT_TABLE);
  const [config, setConfig] = useState<ChartConfig>(DEFAULT_CONFIG);
  const [showCustomize, setShowCustomize] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [gammaOpen, setGammaOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // В2 — import data from sessionStorage (sent by Analytics, AnnualPlanner, Explore, Planner)
  useEffect(() => {
    const ext = sessionStorage.getItem('dataviz_import');
    if (!ext) return;
    try {
      const parsed = JSON.parse(ext) as { tableData?: TableData; config?: Partial<ChartConfig> };
      if (parsed.tableData) setTableData(parsed.tableData);
      if (parsed.config) setConfig(prev => ({ ...prev, ...parsed.config }));
      sessionStorage.removeItem('dataviz_import');
      addNotification('Податоците се увезени во DataViz Studio ✅', 'success');
    } catch { /* ignore malformed data */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConfig = useCallback(<K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportPNG = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
      const link = document.createElement('a');
      link.download = `${config.title || 'dijagram'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      addNotification('PNG извезен (300dpi) ✅', 'success');
    } catch {
      addNotification('Грешка при извоз.', 'error');
    } finally { setExporting(false); }
  };

  const exportSVG = () => {
    const svgEl = chartRef.current?.querySelector('svg');
    if (!svgEl) { addNotification('SVG не е достапен за овој тип на дијаграм. Користете PNG.', 'info'); return; }
    const serialized = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([serialized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${config.title || 'dijagram'}.svg`;
    link.href = url; link.click();
    URL.revokeObjectURL(url);
    addNotification('SVG извезен ✅', 'success');
  };

  const printChart = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) { addNotification('Попап е блокиран. Дозволете попапи за оваа страница.', 'warning'); return; }
    const safeTitle = config.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(`<html><head><title>${safeTitle}</title><style>body{margin:20px;font-family:sans-serif}h2{font-size:16px;margin-bottom:12px}img{max-width:100%}@media print{body{margin:10px}}</style></head><body><h2>${safeTitle}</h2><img src="${dataUrl}" onload="window.print()"/></body></html>`);
    win.document.close();
  };

  const addToClipboard = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff' });
      canvas.toBlob(async blob => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        addNotification('Дијаграмот е копиран во clipboard! Залепи го каде сакаш (Ctrl+V).', 'success');
      });
    } catch {
      addNotification('Clipboard копирање не е поддржано во овој прелистувач.', 'warning');
    } finally { setExporting(false); }
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'chart'  as StudioTab, label: t('dataviz.tab.chart'),  icon: BarChart2,      color: 'indigo'  },
    { id: 'fn'     as StudioTab, label: t('dataviz.tab.fn'),     icon: TrendingUp,     color: 'cyan'    },
    { id: 'geo'    as StudioTab, label: t('dataviz.tab.geo'),    icon: Triangle,       color: 'teal'    },
    { id: 'paper'  as StudioTab, label: t('dataviz.tab.paper'),  icon: Grid3X3,        color: 'emerald' },
    { id: 'ai'     as StudioTab, label: t('dataviz.tab.ai'),     icon: Sparkles,       color: 'violet'  },
    { id: 'prob'   as StudioTab, label: t('dataviz.tab.prob'),   icon: Sigma,          color: 'rose'    },
    { id: 'stats'  as StudioTab, label: t('dataviz.tab.stats'),  icon: FlaskConical,   color: 'fuchsia' },
    { id: 'calc'   as StudioTab, label: t('dataviz.tab.calc'),   icon: FunctionSquare, color: 'amber'   },
    { id: 'linalg' as StudioTab, label: t('dataviz.tab.linalg'), icon: Layers,         color: 'sky'     },
    { id: 'geo2d'  as StudioTab, label: t('dataviz.tab.geo2d'),  icon: Shapes,         color: 'pink'    },
    { id: 'solid'  as StudioTab, label: t('dataviz.tab.solid'),  icon: Box,            color: 'orange'  },
    { id: 'conic'  as StudioTab, label: t('dataviz.tab.conic'),  icon: Triangle,       color: 'violet'  },
    { id: 'algebra' as StudioTab, label: t('dataviz.tab.algebra'), icon: LayoutGrid,    color: 'indigo'  },
    { id: 'trig'      as StudioTab, label: 'Тригонометрија',         icon: Sigma,         color: 'violet'  },
    { id: 'numtheory'  as StudioTab, label: 'Теорија на броеви',     icon: Sigma,         color: 'emerald' },
    { id: 'placevalue' as StudioTab, label: 'Месна вредност',         icon: Layers,        color: 'green'   },
    { id: 'fractions'  as StudioTab, label: 'Дропки',                 icon: PieChart,      color: 'blue'    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">DataViz Studio</h1>
              <p className="text-xs text-gray-400">Графици · Калкулус · Линеарна Алгебра · Статистика · Веројатност · AI</p>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    active ? `bg-white shadow text-${tab.color}-700` : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">

        {/* ══ TAB 1: CHART BUILDER ══════════════════════════════════════════ */}
        {activeTab === 'chart' && (
          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">

            {/* Left panel — data + settings */}
            <div className="space-y-5">

              {/* Chart type selector */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Тип на дијаграм
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {CHART_TYPES.map(ct => (
                    <button key={ct.id} type="button"
                      onClick={() => updateConfig('type', ct.id)}
                      title={ct.desc}
                      className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition ${
                        config.type === ct.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                      }`}>
                      <span className="text-2xl leading-none mb-1">{ct.emoji}</span>
                      <span className={`text-[10px] font-bold text-center leading-tight ${config.type === ct.id ? 'text-indigo-700' : 'text-gray-600'}`}>
                        {ct.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data table */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Податоци
                </p>
                <DataTable data={tableData} onChange={setTableData} />
              </div>

              {/* Customize panel */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button type="button"
                  onClick={() => setShowCustomize(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" /> Прилагодување
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCustomize ? 'rotate-180' : ''}`} />
                </button>

                {showCustomize && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 gap-3 mt-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Наслов на дијаграм</label>
                        <input value={config.title} onChange={e => updateConfig('title', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          placeholder="Мој дијаграм" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1 block">Оска X</label>
                          <input value={config.xLabel} onChange={e => updateConfig('xLabel', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="Категории" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1 block">Оска Y</label>
                          <input value={config.yLabel} onChange={e => updateConfig('yLabel', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="Вредност" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Единица за мерење</label>
                        <input value={config.unit} onChange={e => updateConfig('unit', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          placeholder="°C, km, %, ден..." />
                      </div>
                    </div>

                    {/* Color palettes */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-2 block">Палета на бои</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {Object.entries(COLOR_PALETTES).map(([name, colors]) => (
                          <button key={name} type="button"
                            onClick={() => updateConfig('colorPalette', colors)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition ${
                              JSON.stringify(config.colorPalette) === JSON.stringify(colors)
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}>
                            <div className="flex gap-0.5">
                              {colors.slice(0, 7).map((c, i) => (
                                <div key={i} className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-4">
                      {[
                        { key: 'showLegend', label: 'Легенда' },
                        { key: 'showGrid',   label: 'Мрежа' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox"
                            checked={config[key as keyof ChartConfig] as boolean}
                            onChange={e => updateConfig(key as keyof ChartConfig, e.target.checked as ChartConfig[keyof ChartConfig])}
                            className="accent-indigo-600 w-4 h-4" />
                          <span className="text-sm text-gray-600 font-medium">{label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Histogram bins slider */}
                    {(['histogram', 'frequency-polygon', 'cumulative-frequency', 'back-to-back-histogram'] as ChartType[]).includes(config.type) && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block flex items-center justify-between">
                          <span>Број на класи (bins)</span>
                          <span className="text-indigo-600 font-extrabold">{config.bins ?? 8}</span>
                        </label>
                        <input
                          type="range" min={2} max={20} step={1}
                          value={config.bins ?? 8}
                          onChange={e => updateConfig('bins', parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-600"
                          aria-label="Број на класи за хистограм"
                          title="Број на класи за хистограм"
                        />
                        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                          <span>2</span><span>20</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — preview + export */}
            <div className="space-y-4">
              {/* Chart preview card */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Live преглед
                  </p>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {CHART_TYPES.find(t => t.id === config.type)?.label}
                  </span>
                </div>
                <div ref={chartRef} className="p-5 bg-white">
                  {config.title && (
                    <h3 className="text-base font-bold text-gray-800 text-center mb-3">{config.title}</h3>
                  )}
                  <ChartPreview data={tableData} config={config} />
                  {(config.xLabel || config.yLabel) && (
                    <p className="text-center text-xs text-gray-400 mt-1">
                      {config.xLabel && <span>X: {config.xLabel}</span>}
                      {config.xLabel && config.yLabel && ' · '}
                      {config.yLabel && <span>Y: {config.yLabel}</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Export actions */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Извоз
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <button type="button" onClick={() => setGammaOpen(true)}
                    className="flex flex-col items-center gap-1 px-3 py-3 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-xl text-xs font-bold hover:opacity-90 transition shadow-md col-span-1">
                    <Eye className="w-4 h-4" />Gamma<span className="font-normal opacity-80">Слајд</span>
                  </button>
                  <button type="button" onClick={exportPNG} disabled={exporting}
                    className="flex flex-col items-center gap-1 px-3 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition">
                    <Download className="w-4 h-4" />PNG<span className="font-normal opacity-70">300 DPI</span>
                  </button>
                  <button type="button" onClick={exportSVG}
                    className="flex flex-col items-center gap-1 px-3 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition">
                    <Download className="w-4 h-4" />SVG<span className="font-normal opacity-70">Скалабилен</span>
                  </button>
                  <button type="button" onClick={printChart}
                    className="flex flex-col items-center gap-1 px-3 py-3 bg-gray-800 text-white rounded-xl text-xs font-bold hover:bg-gray-900 transition">
                    <Printer className="w-4 h-4" />Печати<span className="font-normal opacity-70">А4</span>
                  </button>
                  <button type="button" onClick={addToClipboard} disabled={exporting}
                    className="flex flex-col items-center gap-1 px-3 py-3 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 disabled:opacity-60 transition">
                    <PlusCircle className="w-4 h-4" />Clipboard<span className="font-normal opacity-70">Ctrl+V</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  PNG и SVG се подготвени за вметнување во работен лист, квиз или тест.
                </p>
              </div>

              {/* Tips */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-600 mb-2 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" /> Педагошки совети
                </p>
                <ul className="text-xs text-indigo-700 space-y-1">
                  <li>• <strong>Scatter / Bubble</strong> — 3 или 4 колони: Ознака, X, Y [, Големина]</li>
                  <li>• <strong>Хистограм / Фрекв. полигон / Огива</strong> — прва колона се игнорира; прилагоди ги класите</li>
                  <li>• <strong>B-to-B Хистограм</strong> — 3 колони: Ознака, Серија1, Серија2</li>
                  <li>• <strong>Наредени / Делен бар</strong> — 2+ колони со серии; Делен бар нормализира на 100%</li>
                  <li>• <strong>Пиктограм ★</strong> — идеален за I–IV одд.; скалата се прилагодува автоматски</li>
                  <li>• <strong>Парето</strong> — автоматски сортира опаѓачки + додава кумулатив. линија (80/20 правило)</li>
                  <li>• Копирај во clipboard → залепи директно во Word/PowerPoint/Canva</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: GEOGEBRA ════════════════════════════════════════════════ */}
        {activeTab === 'geo' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Triangle className="h-5 w-5 text-teal-600" />
                GeoGebra — Интерактивна математика
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Функции, геометрија, CAS калкулатор и 3D простор — директно во апликацијата
              </p>
            </div>
            <SilentErrorBoundary>
              <GeoGebraViewer />
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: FUNCTION GRAPHER ════════════════════════════════════════ */}
        {activeTab === 'fn' && (
          <FnTabPanel />
        )}

        {/* ══ TAB 2: MATH PAPER ════════════════════════════════════════════ */}
        {activeTab === 'paper' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">Математичка хартија</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Генерирај 6 типови математички мрежи — прилагодени за печатење или цртање.
              </p>
            </div>
            <MathPaperGenerator />
          </div>
        )}

        {/* ══ TAB 3: AI ASSISTANT ══════════════════════════════════════════ */}
        {activeTab === 'ai' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" /> AI Асистент за статистика
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Генерирај педагошки задачи, создавај реалистични податоци или анализирај ги вашите вредности.
              </p>
            </div>
            <AIStatsAssistant
              tableData={tableData}
              chartConfig={config}
              chartRef={chartRef}
              onChartTypeChange={type => updateConfig('type', type)}
              onTableDataChange={setTableData}
              onConfigChange={updates => setConfig(prev => ({ ...prev, ...updates }))}
              onGoToChart={() => setActiveTab('chart')}
            />
          </div>
        )}

        {/* ══ TAB 4: PROBABILITY LAB ═══════════════════════════════════════ */}
        {activeTab === 'prob' && (
          <div>
            <div className="mb-5 bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Sigma className="w-5 h-5 text-rose-500" /> Лабораторија за Веројатност
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Симулирај монета, коцка, спинер и составени настани · Теоретска vs. Експериментална веројатност
              </p>
            </div>
            <ProbabilityLab
              onSendToDataViz={(td, cfg) => {
                setTableData(td);
                setConfig(prev => ({ ...prev, ...cfg }));
              }}
              onGoToChart={() => setActiveTab('chart')}
            />
          </div>
        )}

        {/* ══ TAB: SECONDARY STATS LAB ════════════════════════════════════ */}
        {activeTab === 'stats' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-fuchsia-500" /> Напредна Статистика
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Нормална дистрибуција · Регресија · Баесова теорема · Монте Карло · Хи-квадрат тест
              </p>
            </div>
            <SilentErrorBoundary>
              <SecondaryStatsLab />
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: CALCULUS LAB ════════════════════════════════════════════ */}
        {activeTab === 'calc' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FunctionSquare className="w-5 h-5 text-amber-500" /> Анализа — Калкулус
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Изводи (тангента) · Риманови суми (интеграли) · Граници на функции
              </p>
            </div>
            <SilentErrorBoundary>
              <CalculusLab />
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: 2D GEOMETRY LAB ═════════════════════════════════════════ */}
        {activeTab === 'geo2d' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Shapes className="w-5 h-5 text-pink-500" /> 2D Геометрија — Планиметрија
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Триаголник · Питагорова теорема · Кружница · Многуаголници — МОН V–VIII одд.
              </p>
            </div>
            <SilentErrorBoundary>
              <Geometry2DLab />
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: 3D GEOMETRY LAB ═════════════════════════════════════════ */}
        {activeTab === 'solid' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Box className="w-5 h-5 text-orange-500" /> 3D Геометрија — Полиедри
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                17 тела · Платонски · Архимедски · Призми · Антипризми · Пирамиди · Планови и проекции · Мрежи
              </p>
            </div>
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <Geometry3DLab />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: CONIC SECTIONS ══════════════════════════════════════════ */}
        {activeTab === 'conic' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Triangle className="w-5 h-5 text-violet-500" /> Конусни пресеци
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Елипса · Хипербола · Парабола — слајдери a, b, h, k, θ · фокуси · асимптоти · ротациска анимација
              </p>
            </div>
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <ConicSectionsLab />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: LINEAR ALGEBRA LAB ══════════════════════════════════════ */}
        {activeTab === 'linalg' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-500" /> Линеарна Алгебра
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Матрични операции · 2D вектори и скаларен производ · Линеарни трансформации
              </p>
            </div>
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <LinearAlgebraLab />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: ALGEBRA TILES ═══════════════════════════════════════════════ */}
        {activeTab === 'algebra' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-indigo-500" /> Алгебарски Плочки
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Визуелна алгебра со плочки · Собирање/Одземање поими · Решавање равенки — МОН VI–VIII одд.
              </p>
            </div>
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <AlgebraTilesLazy />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: TRIGONOMETRY LAB ═════════════════════════════════════════════ */}
        {activeTab === 'trig' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <TrigonometryLabLazy />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: NUMBER THEORY LAB ════════════════════════════════════════════ */}
        {activeTab === 'numtheory' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <NumberTheoryLabLazy />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: PLACE VALUE LAB (Диенесови блокови) ═════════════════════════ */}
        {activeTab === 'placevalue' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <PlaceValueLabLazy />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}

        {/* ══ TAB: FRACTIONS LAB (Бар, круг, бројна права) ═════════════════════ */}
        {activeTab === 'fractions' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <SilentErrorBoundary>
              <Suspense fallback={<LabLoading />}>
                <FractionsLabLazy />
              </Suspense>
            </SilentErrorBoundary>
          </div>
        )}
      </div>

      {/* ── Gamma Mode: chart as single slide ─────────────────────────────── */}
      {gammaOpen && (
        <SilentErrorBoundary name="GammaMode" fallback={
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 text-white" onClick={() => setGammaOpen(false)}>
            <p className="text-slate-400">Gamma Mode не можеше да се вчита. Кликни за да затвориш.</p>
          </div>
        }>
          <GammaModeModal
            data={{
              title: config.title || 'Дијаграм',
              topic: config.xLabel || 'DataViz Studio',
              gradeLevel: 0,
              slides: [{
                type: 'chart-embed',
                title: config.title || 'Дијаграм',
                content: [
                  ...(config.xLabel ? [`X: ${config.xLabel}`] : []),
                  ...(config.yLabel ? [`Y: ${config.yLabel}`] : []),
                ],
                chartData: { headers: tableData.headers, rows: tableData.rows },
                chartConfig: config as unknown as Record<string, unknown>,
              }],
            }}
            onClose={() => setGammaOpen(false)}
          />
        </SilentErrorBoundary>
      )}
    </div>
  );
};
