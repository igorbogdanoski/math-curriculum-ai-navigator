import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Download, Image as ImageIcon, PlusCircle, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { tikzTemplates, type TikzTemplate } from '../../data/tikzTemplates';
import { renderTikzToContainer } from '../../utils/tikzRenderJob';
import { generateTikzDiagram, type TikzCurriculumContext } from '../../services/gemini/tikzGenerate';
import { useDebouncedValue } from '../../hooks/useDebounce';
import { useLanguage } from '../../i18n/LanguageContext';
import { useNotification } from '../../contexts/NotificationContext';

// Wave 18: CodeMirror is only ever imported from this file, which is itself lazy-loaded
// (see TikzLabLazy in DataVizStudioView.tsx) — see vite.config.ts's manualChunks 'vendor-codemirror'
// bucket, which keeps it out of the eagerly-loaded generic 'vendor' chunk.
const tikzLanguage = StreamLanguage.define(stex);

const DEBOUNCE_MS = 750;

export interface TikzInsertPayload {
  svg: string;
  pngDataUrl: string;
  tikzCode: string;
}

interface TikzLabProps {
  /** IoC — TikzLab doesn't know where it's embedded. Passing this shows an "Insert" button. */
  onInsert?: (payload: TikzInsertPayload) => void;
  /** When provided (e.g. from lesson planning), shows a "Fill from this topic" shortcut
   *  in the AI-generate panel and nudges the generated diagram toward this topic/standard. */
  curriculumContext?: TikzCurriculumContext;
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  geometry: 'tikz.category.geometry',
  trigonometry: 'tikz.category.trigonometry',
  'analytic-geometry': 'tikz.category.analytic-geometry',
  stereometry: 'tikz.category.stereometry',
};

type GradeFilter = 'all' | 'primary' | 'secondary';
const GRADE_FILTER_OPTIONS: { value: GradeFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'tikz.gradeFilter.all' },
  { value: 'primary', labelKey: 'tikz.gradeFilter.primary' },
  { value: 'secondary', labelKey: 'tikz.gradeFilter.secondary' },
];

/** SVG (with pt-based width/height) -> upscaled PNG data URL, for export/insert/print quality. */
async function svgToPngDataUrl(svg: string, scale = 2): Promise<string> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('svg image load failed'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const TikzLab: React.FC<TikzLabProps> = ({ onInsert, curriculumContext }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotification();

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [activeTemplateId, setActiveTemplateId] = useState<string>(tikzTemplates[0]?.id ?? '');
  const [code, setCode] = useState<string>(tikzTemplates[0]?.code ?? '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const debouncedCode = useDebouncedValue(code, DEBOUNCE_MS);
  const stagingRef = useRef<HTMLDivElement | null>(null);
  // Job-ID versioning (Wave 10.2): each debounced edit gets a new id; a render is only applied
  // to state if it's still the most recent one when it resolves — protects against a slower,
  // older compile overwriting a faster, newer one that already finished.
  const activeJobIdRef = useRef(0);

  const groupedTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byGrade = gradeFilter === 'all' ? tikzTemplates : tikzTemplates.filter(tpl => tpl.gradeLevel.includes(gradeFilter));
    const filtered = q
      ? byGrade.filter(tpl =>
          t(tpl.titleKey).toLowerCase().includes(q) || t(tpl.descKey).toLowerCase().includes(q),
        )
      : byGrade;
    return filtered.reduce<Record<string, TikzTemplate[]>>((acc, tpl) => {
      (acc[tpl.category] ??= []).push(tpl);
      return acc;
    }, {});
  }, [search, gradeFilter, t]);

  useEffect(() => {
    if (!stagingRef.current) return;
    const jobId = ++activeJobIdRef.current;
    setIsRendering(true);

    renderTikzToContainer(debouncedCode, stagingRef.current).then(result => {
      if (jobId !== activeJobIdRef.current) return; // a newer edit already superseded this job
      setIsRendering(false);
      if (result.ok && result.svg) {
        setSvg(result.svg);
        setError(null);
      } else {
        // Deliberately keep the last successfully-rendered svg visible behind the error
        // banner (Wave 10.3) — a syntax typo shouldn't blank out the last good diagram.
        setError(t('tikz.compileError'));
      }
    });
  }, [debouncedCode, t]);

  const handleSelectTemplate = (tpl: TikzTemplate) => {
    setActiveTemplateId(tpl.id);
    setCode(tpl.code);
  };

  const handleDownloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeTemplateId || 'tikz-dijagram'}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    addNotification(t('tikz.svgExported'), 'success');
  };

  const handleDownloadPng = async () => {
    if (!svg) return;
    setIsExporting(true);
    try {
      const dataUrl = await svgToPngDataUrl(svg);
      const link = document.createElement('a');
      link.download = `${activeTemplateId || 'tikz-dijagram'}.png`;
      link.href = dataUrl;
      link.click();
      addNotification(t('tikz.pngExported'), 'success');
    } catch {
      addNotification(t('tikz.exportError'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFillFromTopic = () => {
    if (!curriculumContext) return;
    setAiPrompt(curriculumContext.topicTitle);
    setAiPanelOpen(true);
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim() || isGeneratingAi) return;
    setIsGeneratingAi(true);
    try {
      const generatedCode = await generateTikzDiagram(aiPrompt, curriculumContext);
      setCode(generatedCode);
      addNotification(t('tikz.ai.generateSuccess'), 'success');
    } catch {
      addNotification(t('tikz.ai.generateError'), 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleInsert = async () => {
    if (!svg || !onInsert) return;
    setIsExporting(true);
    try {
      const pngDataUrl = await svgToPngDataUrl(svg);
      onInsert({ svg, pngDataUrl, tikzCode: code });
      addNotification(t('tikz.inserted'), 'success');
    } catch {
      addNotification(t('tikz.exportError'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[560px]">
      {/* Hidden staging root — TikzLab's own persistent DOM target for isolated per-job
          compiles (see tikzRenderJob.ts). Kept in the layout (not display:none) since some
          rendering libraries need real layout metrics; visually hidden via offscreen position. */}
      <div ref={stagingRef} aria-hidden="true" style={{ position: 'absolute', left: -99999, top: 0, width: 1, height: 1, overflow: 'hidden' }} />

      {/* ── Left: template sidebar (25%) ── */}
      <div className="md:w-1/4 flex flex-col gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('tikz.searchTemplates')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg" role="group" aria-label={t('tikz.gradeFilter.label')}>
          {GRADE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGradeFilter(opt.value)}
              className={`flex-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                gradeFilter === opt.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
          {Object.entries(groupedTemplates).map(([category, templates]) => (
            <div key={category}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                {t(CATEGORY_LABEL_KEYS[category] ?? category)}
              </p>
              <div className="space-y-1.5">
                {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                      activeTemplateId === tpl.id
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-200'
                    }`}
                  >
                    <p className="font-semibold">{t(tpl.titleKey)}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t(tpl.descKey)}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(groupedTemplates).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">{t('tikz.noTemplatesFound')}</p>
          )}
        </div>
      </div>

      {/* ── Middle: code editor (35%, dark) ── */}
      <div className="md:w-[35%] flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{t('tikz.editorLabel')}</p>
          <button
            type="button"
            onClick={() => setAiPanelOpen(o => !o)}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <Sparkles className="w-3.5 h-3.5" /> {t('tikz.ai.toggle')}
          </button>
        </div>
        {aiPanelOpen && (
          <div className="mb-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder={t('tikz.ai.promptPlaceholder')}
              rows={2}
              className="w-full text-xs p-2 rounded-lg border border-indigo-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={!aiPrompt.trim() || isGeneratingAi}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {t('tikz.ai.generate')}
              </button>
              {curriculumContext && (
                <button type="button" onClick={handleFillFromTopic} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline">
                  {t('tikz.ai.fillFromTopic')}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-[480px] rounded-xl border border-slate-700 overflow-hidden">
          <CodeMirror
            value={code}
            onChange={value => setCode(value)}
            theme="dark"
            height="480px"
            extensions={[tikzLanguage]}
            basicSetup={{ lineNumbers: true, bracketMatching: true, closeBrackets: true, highlightActiveLine: false }}
            className="text-xs [&_.cm-editor]:h-full"
          />
        </div>
      </div>

      {/* ── Right: preview + export (40%) ── */}
      <div className="md:w-[40%] flex flex-col gap-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{t('tikz.previewLabel')}</p>
        <div
          className="relative flex-1 min-h-[420px] rounded-xl border border-gray-200 flex items-center justify-center overflow-auto p-4"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}
        >
          {isRendering && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-gray-500 bg-white/90 rounded-lg px-2 py-1 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('tikz.rendering')}
            </div>
          )}
          {svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            !isRendering && <p className="text-sm text-gray-400">{t('tikz.noPreviewYet')}</p>
          )}
          {error && (
            <div className="absolute inset-x-0 bottom-0 flex items-start gap-2 bg-red-50 border-t border-red-200 text-red-700 text-xs px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={!svg}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> {t('tikz.downloadSvg')}
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!svg || isExporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} {t('tikz.downloadPng')}
          </button>
          {onInsert && (
            <button
              type="button"
              onClick={handleInsert}
              disabled={!svg || isExporting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" /> {t('tikz.insertIntoMaterial')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
