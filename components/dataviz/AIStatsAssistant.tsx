import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, BarChart2, FileText, TrendingUp, Loader2, Copy,
  CheckCircle, ChevronRight, PlusCircle, Download,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { callGeminiProxy, DEFAULT_MODEL, sanitizePromptInput } from '../../services/gemini/core';
import type { TableData } from './DataTable';
import type { ChartConfig, ChartType } from './ChartPreview';
import { useNotification } from '../../contexts/NotificationContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
  tableData: TableData;
  chartConfig: ChartConfig;
  chartRef: React.RefObject<HTMLDivElement | null>;
  onChartTypeChange: (type: ChartType) => void;
  onTableDataChange: (data: TableData) => void;
  onConfigChange: (updates: Partial<ChartConfig>) => void;
  onGoToChart: () => void;
}

interface GeneratedTask {
  question: string;
  type: 'read' | 'calculate' | 'compare' | 'analyze';
  hint?: string;
  answer?: string;
}

interface StatsSummary {
  mean: number; median: number; mode: number[];
  min: number; max: number; range: number; stdDev: number; count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function computeStats(values: number[]): StatsSummary {
  if (values.length === 0) return { mean: 0, median: 0, mode: [], min: 0, max: 0, range: 0, stdDev: 0, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const freq = new Map<number, number>();
  values.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
  const maxFreq = freq.size > 0 ? Math.max(...freq.values()) : 0;
  const mode = maxFreq > 1 ? [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v) : [];
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  return { mean, median, mode, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0], stdDev: Math.sqrt(variance), count: n };
}

/** Safely extract first valid JSON object or array from AI text */
function extractJson(text: string, type: 'object' | 'array'): unknown | null {
  const pattern = type === 'array' ? /\[[\s\S]*?\](?=\s*$|\s*\n)/s : /\{[\s\S]*?\}(?=\s*$|\s*\n)/s;
  // Try non-greedy first, then greedy fallback
  let match = text.match(pattern);
  if (!match) match = text.match(type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/** Validate GeneratedTask array from AI */
function isValidTaskArray(data: unknown): data is GeneratedTask[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.every(t =>
    typeof t === 'object' && t !== null &&
    typeof (t as GeneratedTask).question === 'string' &&
    ['read', 'calculate', 'compare', 'analyze'].includes((t as GeneratedTask).type)
  );
}

/** Validate generated data object from AI */
function isValidDataObj(data: unknown): data is { headers: string[]; rows: (string|number)[][]; suggestedChartType?: string; title?: string; xLabel?: string; yLabel?: string; unit?: string; explanation?: string } {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d['headers']) && Array.isArray(d['rows']) && d['rows'].length > 0;
}

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: 'столбест', 'bar-horizontal': 'столбест хоризонтален',
  line: 'линиски', area: 'површински', pie: 'пита',
  scatter: 'scatter', bubble: 'bubble', histogram: 'хистограм', 'box-whisker': 'box-whisker',
};

const TYPE_LABELS: Record<string, string> = {
  read: '📖 Читање', calculate: '🔢 Пресметка',
  compare: '⚖️ Споредба', analyze: '🔍 Анализа',
};

const MODE_OPTIONS = [
  { id: 'tasks',    label: 'Генерирај задачи',    icon: FileText,    desc: 'AI создава педагошки прашања од вашиот дијаграм' },
  { id: 'generate', label: 'Генерирај податоци',   icon: BarChart2,   desc: 'Опишете сценарио → AI ги измислува вредностите + ги назива оските' },
  { id: 'analyze',  label: 'Анализирај податоци',  icon: TrendingUp,  desc: 'Статистичка анализа + препорака за тип на дијаграм' },
] as const;
type Mode = typeof MODE_OPTIONS[number]['id'];

// ─── Component ────────────────────────────────────────────────────────────────
export const AIStatsAssistant: React.FC<Props> = ({
  tableData, chartConfig, chartRef,
  onChartTypeChange, onTableDataChange, onConfigChange, onGoToChart,
}) => {
  const { addNotification } = useNotification();
  const [mode, setMode] = useState<Mode>('tasks');
  const [loading, setLoading] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [gradeInput, setGradeInput] = useState('7');
  const [taskCount, setTaskCount] = useState(5);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [exportingQuiz, setExportingQuiz] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const getSeriesValues = useCallback((): number[] =>
    tableData.rows
      .map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])))
      .filter(v => !isNaN(v)),
    [tableData]);

  // ── Генерирај задачи ───────────────────────────────────────────────────────
  const handleGenerateTasks = async () => {
    if (tableData.rows.length < 2) {
      addNotification('Внесете најмалку 2 редови со податоци.', 'warning'); return;
    }
    setLoading(true);
    try {
      const dataStr = tableData.headers.join(' | ') + '\n' +
        tableData.rows.map(r => r.join(' | ')).join('\n');
      const chartLabel = CHART_TYPE_LABELS[chartConfig.type] ?? 'статистички';
      const prompt = `Ти си наставник по математика во Македонија. Имаш ${chartLabel} дијаграм со наслов „${sanitizePromptInput(chartConfig.title, 100)}" и следните податоци:

${sanitizePromptInput(dataStr, 800)}

Оска X: ${sanitizePromptInput(chartConfig.xLabel || '—', 60)} | Оска Y: ${sanitizePromptInput(chartConfig.yLabel || '—', 60)} | Единица: ${sanitizePromptInput(chartConfig.unit || '—', 20)}

Креирај точно ${taskCount} педагошки прашања на македонски јазик за ${sanitizePromptInput(gradeInput, 10)}-то одделение. Секое прашање мора да е конкретно (со реални вредности од табелата). Типовите: читање вредности, пресметка (просек/медијана/опсег), споредба, анализа на тренд.

Одговори САМО со валиден JSON array:
[{"question":"...","type":"read|calculate|compare|analyze","hint":"...","answer":"..."}]`;

      const resp = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      const parsed = extractJson(resp.text, 'array');
      if (!isValidTaskArray(parsed)) throw new Error('Invalid task array from AI');
      setGeneratedTasks(parsed.slice(0, taskCount));
      addNotification(`${parsed.length} задачи генерирани ✅`, 'success');
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      addNotification('Грешка при генерирање задачи. Обидете се повторно.', 'error');
    } finally { setLoading(false); }
  };

  // ── Генерирај податоци + авто-назнаки ─────────────────────────────────────
  const handleGenerateData = async () => {
    if (!descriptionInput.trim()) {
      addNotification('Опишете го сценариото за кое сакате податоци.', 'warning'); return;
    }
    setLoading(true);
    try {
      const prompt = `Ти си наставник по математика во Македонија за ${sanitizePromptInput(gradeInput, 10)}-то одделение.

Сценарио: ${sanitizePromptInput(descriptionInput, 400)}

Генерирај реалистични, педагошки вредни статистички податоци. Одговори САМО со валиден JSON објект:
{
  "headers": ["Категорија", "Вредност"],
  "rows": [["Ознака1", број], ["Ознака2", број]],
  "suggestedChartType": "bar|line|pie|scatter|histogram|box-whisker|area",
  "title": "Наслов на дијаграм на македонски",
  "xLabel": "Назив на X оска",
  "yLabel": "Назив на Y оска",
  "unit": "единица мерење (°C, км, %, кг...)",
  "explanation": "Зошто овој тип дијаграм е најдобар за овие податоци"
}

Максимум 10 редови. Вредностите нека се реалистични за македонски контекст.`;

      const resp = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      const parsed = extractJson(resp.text, 'object');

      if (!isValidDataObj(parsed)) throw new Error('Invalid data structure from AI');

      // Apply data
      onTableDataChange({ headers: parsed.headers, rows: parsed.rows });
      if (parsed.suggestedChartType) onChartTypeChange(parsed.suggestedChartType as ChartType);

      // ✨ Auto-label axes, title, unit
      const configUpdates: Partial<ChartConfig> = {};
      if (parsed.title) configUpdates.title = parsed.title;
      if (parsed.xLabel) configUpdates.xLabel = parsed.xLabel;
      if (parsed.yLabel) configUpdates.yLabel = parsed.yLabel;
      if (parsed.unit) configUpdates.unit = parsed.unit;
      if (Object.keys(configUpdates).length > 0) onConfigChange(configUpdates);

      setAiRecommendation(parsed.explanation ?? '');
      addNotification('Податоци генерирани + оски автоматски именувани ✅', 'success');
      onGoToChart();
    } catch {
      addNotification('Грешка при генерирање. Обидете се повторно.', 'error');
    } finally { setLoading(false); }
  };

  // ── Анализа ────────────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    const values = getSeriesValues();
    if (values.length < 3) {
      addNotification('Потребни се најмалку 3 нумерички вредности за анализа.', 'warning'); return;
    }
    const stats = computeStats(values);
    setStatsSummary(stats);
    // AI chart type recommendation
    const n = values.length;
    const colName = tableData.headers[0]?.toLowerCase() ?? '';
    const isTime = ['ден', 'нед', 'мес', 'год', 'час', 'мин'].some(k => colName.includes(k));
    let rec = '';
    if (n <= 6) rec = '🥧 **Пита дијаграм** — малку категории, добро за споредба на делови од целина.';
    else if (isTime) rec = '📈 **Линиски дијаграм** — временска серија, покажува тренд и промена.';
    else if (n <= 15) rec = '📊 **Столбест дијаграм** — јасна споредба на дискретни категории.';
    else rec = '📉 **Хистограм** — многу вредности, покажува распределба на фреквенции.';
    setAiRecommendation(rec);
  };

  // ── Додај во квиз ──────────────────────────────────────────────────────────
  const handleAddToQuiz = async () => {
    if (generatedTasks.length === 0) {
      addNotification('Прво генерирајте задачи.', 'warning'); return;
    }
    setExportingQuiz(true);
    try {
      // 1. Capture chart as base64
      let chartBase64 = '';
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        chartBase64 = canvas.toDataURL('image/png');
      }

      // 2. Build structured text for quiz question creation
      const diagramInfo = chartBase64
        ? `[ДИЈАГРАМ: ${chartConfig.title}]`
        : '';
      const questionsText = generatedTasks.map((t, i) =>
        `${i + 1}. [${TYPE_LABELS[t.type] ?? t.type}] ${t.question}${t.hint ? `\n   💡 ${t.hint}` : ''}${t.answer ? `\n   ✓ ${t.answer}` : ''}`
      ).join('\n\n');

      const fullText = `${diagramInfo}\n\n${questionsText}`;
      await navigator.clipboard.writeText(fullText);

      // 3. If chart captured, also copy image
      if (chartBase64 && chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        canvas.toBlob(async blob => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch {
            // Fallback: image clipboard not supported, text already copied
          }
        });
      }

      addNotification(
        `${generatedTasks.length} задачи + дијаграм копирани! Залепи ги во Тест Генераторот (Ctrl+V).`,
        'success'
      );
    } catch {
      addNotification('Грешка при подготовка за квиз.', 'error');
    } finally { setExportingQuiz(false); }
  };

  // ── Export chart PNG ───────────────────────────────────────────────────────
  const handleExportChartPNG = async () => {
    if (!chartRef.current) { addNotification('Прво нацртајте дијаграм.', 'warning'); return; }
    const canvas = await html2canvas(chartRef.current, { scale: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `${chartConfig.title || 'dijagram'}-zadaci.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    addNotification('PNG со дијаграм преземен (300dpi) ✅', 'success');
  };

  // ── Copy single task ───────────────────────────────────────────────────────
  const copyTask = (q: string, idx: number) => {
    navigator.clipboard.writeText(q).then(() => {
      setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODE_OPTIONS.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition ${mode === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${mode === m.id ? 'text-indigo-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-bold ${mode === m.id ? 'text-indigo-700' : 'text-gray-700'}`}>{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Генерирај задачи ── */}
      {mode === 'tasks' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Одделение</label>
              <select value={gradeInput} onChange={e => setGradeInput(e.target.value)}
                title="Изберете одделение"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {[4,5,6,7,8,9].map(g => <option key={g} value={g}>{g}-то</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Број задачи: {taskCount}</label>
              <input type="range" min={3} max={10} value={taskCount}
                title="Број на задачи"
                onChange={e => setTaskCount(+e.target.value)}
                className="w-32 accent-indigo-600" />
            </div>
          </div>

          {/* Chart info preview */}
          {chartConfig.title && (
            <div className="bg-indigo-50 rounded-xl px-3 py-2 text-xs text-indigo-700 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span>Дијаграм: <strong>{chartConfig.title}</strong>
                {chartConfig.xLabel && <> · X: {chartConfig.xLabel}</>}
                {chartConfig.yLabel && <> · Y: {chartConfig.yLabel}</>}
                {chartConfig.unit && <> · {chartConfig.unit}</>}
              </span>
            </div>
          )}

          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
            <Sparkles className="w-4 h-4 inline text-indigo-500 mr-1" />
            AI ги чита <strong>{tableData.rows.length} вредности</strong> + насловите на оските и создава конкретни прашања со реални бројки.
          </p>
          <button type="button" onClick={handleGenerateTasks} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Генерирам...' : 'Генерирај задачи'}
          </button>
        </div>
      )}

      {/* ── Генерирај податоци ── */}
      {mode === 'generate' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex gap-2">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span><strong>Авто-назнаки:</strong> AI автоматски ги пополнува насловот, оска X, оска Y и единицата за мерење.</span>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Опишете го сценариото</label>
            <textarea
              value={descriptionInput}
              onChange={e => setDescriptionInput(e.target.value)}
              rows={3}
              title="Опис на сценарио"
              placeholder="Пример: Температура во Скопје 7 дена во јули — scatter plot на оценки и часови учење за 15 ученика — споредба на спортови по популарност..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Одделение</label>
            <select value={gradeInput} onChange={e => setGradeInput(e.target.value)}
              title="Изберете одделение"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {[4,5,6,7,8,9].map(g => <option key={g} value={g}>{g}-то</option>)}
            </select>
          </div>
          {/* Quick prompts */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-1.5">Брзи примери:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Температура во Скопје 7 дена во јули',
                'Оценки и часови учење за 15 ученика 7-мо одд.',
                'Продажба на овошје на пазар — 5 видови',
                'Резултати од тест за одделение 8А (20 ученика)',
                'Потрошувачка на вода во домаќинство по месеци',
                'Брзина и растојание за различни транспорти',
              ].map(ex => (
                <button key={ex} type="button" onClick={() => setDescriptionInput(ex)}
                  className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-gray-600 transition flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />{ex}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={handleGenerateData} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60 transition">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            {loading ? 'Генерирам...' : 'Генерирај податоци + авто-назнаки'}
          </button>
        </div>
      )}

      {/* ── Анализирај ── */}
      {mode === 'analyze' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Анализира ги <strong>{getSeriesValues().length} нумерички вредности</strong> од колоната „{tableData.headers[1] || 'Серија 1'}".
          </p>
          <button type="button" onClick={handleAnalyze}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition">
            <TrendingUp className="w-4 h-4" /> Анализирај
          </button>
          {statsSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Просек (μ)', value: statsSummary.mean.toFixed(2) },
                { label: 'Медијана', value: statsSummary.median.toFixed(2) },
                { label: 'Мода', value: statsSummary.mode.length ? statsSummary.mode.join(', ') : '—' },
                { label: 'Опсег', value: statsSummary.range.toFixed(2) },
                { label: 'Минимум', value: statsSummary.min.toFixed(2) },
                { label: 'Максимум', value: statsSummary.max.toFixed(2) },
                { label: 'Ст. девијација', value: statsSummary.stdDev.toFixed(2) },
                { label: 'Н (елементи)', value: String(statsSummary.count) },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{s.label}</p>
                  <p className="text-lg font-mono font-bold text-gray-800 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Recommendation */}
      {aiRecommendation && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-bold mb-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" /> AI препорака
          </p>
          <p>{aiRecommendation}</p>
        </div>
      )}

      {/* Generated tasks */}
      {generatedTasks.length > 0 && (
        <div ref={resultRef} className="space-y-3">
          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-bold text-gray-700">{generatedTasks.length} генерирани задачи</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={handleExportChartPNG}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition">
                <Download className="w-3.5 h-3.5" /> PNG дијаграм
              </button>
              <button type="button" onClick={handleAddToQuiz} disabled={exportingQuiz}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition">
                {exportingQuiz ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                Додај во квиз
              </button>
              <button type="button"
                onClick={() => {
                  const text = generatedTasks.map((t, i) =>
                    `${i + 1}. ${t.question}${t.answer ? `\nОдговор: ${t.answer}` : ''}`
                  ).join('\n\n');
                  navigator.clipboard.writeText(text);
                  addNotification('Сите задачи копирани!', 'success');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 font-semibold">
                Копирај сите
              </button>
            </div>
          </div>

          {/* Task cards */}
          {generatedTasks.map((task, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 group hover:border-indigo-200 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{i + 1}</span>
                    <span className="text-[10px] font-bold text-gray-400">{TYPE_LABELS[task.type] ?? task.type}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{task.question}</p>
                  {task.hint && <p className="text-xs text-gray-400 mt-1.5 italic">💡 {task.hint}</p>}
                  {task.answer && (
                    <details className="mt-2">
                      <summary className="text-xs font-semibold text-emerald-600 cursor-pointer hover:underline">Покажи одговор</summary>
                      <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mt-1.5">{task.answer}</p>
                    </details>
                  )}
                </div>
                <button type="button" onClick={() => copyTask(task.question, i)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 transition flex-shrink-0"
                  title="Копирај прашање">
                  {copiedIdx === i
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          ))}

          {/* Quiz export tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <PlusCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
            <span>
              <strong>Додај во квиз</strong> — копира ги задачите + дијаграмот во clipboard.
              Потоа отворете <strong>Тест Генератор → Ново прашање → Залепи (Ctrl+V)</strong>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
