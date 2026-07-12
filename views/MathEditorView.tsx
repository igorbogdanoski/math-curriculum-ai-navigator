import React, { useState, useCallback, useRef, useEffect } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';
import {
  Sigma, Copy, Trash2, History, Lightbulb, Calculator,
  CheckCircle2, Shuffle, Loader2, Check,
  Printer, Download, Zap, Save, ArrowLeftCircle,
} from 'lucide-react';
import { duggaAPI } from '../services/gemini/dugga';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { saveExpression, fetchMyExpressions, type SavedMathExpression } from '../services/firestoreService.mathExpressions';
import { readAndClearMathEditorReturn, writeMathEditorResult } from '../utils/mathEditorBridge';
import { logger } from '../utils/logger';

// ─── Symbol palette ───────────────────────────────────────────────────────────
const SYMBOL_GROUPS = [
  {
    label: 'Основни',
    symbols: [
      { label: 'π',    latex: '\\pi' },
      { label: '√',    latex: '\\sqrt{}' },
      { label: '∛',    latex: '\\sqrt[3]{}' },
      { label: '∞',    latex: '\\infty' },
      { label: '±',    latex: '\\pm' },
      { label: '×',    latex: '\\times' },
      { label: '÷',    latex: '\\div' },
      { label: '≠',    latex: '\\neq' },
      { label: '≤',    latex: '\\leq' },
      { label: '≥',    latex: '\\geq' },
      { label: '≈',    latex: '\\approx' },
      { label: '|x|',  latex: '\\left|x\\right|' },
    ],
  },
  {
    label: 'Алгебра',
    symbols: [
      { label: 'x²',   latex: 'x^2' },
      { label: 'xⁿ',   latex: 'x^n' },
      { label: 'a/b',  latex: '\\frac{a}{b}' },
      { label: 'Σ',    latex: '\\sum_{i=1}^{n}' },
      { label: 'Π',    latex: '\\prod_{i=1}^{n}' },
      { label: 'log',  latex: '\\log_{b}' },
      { label: 'ln',   latex: '\\ln' },
      { label: 'eˣ',   latex: 'e^x' },
    ],
  },
  {
    label: 'Анализа',
    symbols: [
      { label: "f'",   latex: "f'(x)" },
      { label: 'd/dx', latex: '\\frac{d}{dx}' },
      { label: '∫',    latex: '\\int_{a}^{b}' },
      { label: 'lim',  latex: '\\lim_{x \\to a}' },
      { label: 'Δ',    latex: '\\Delta' },
      { label: '∂',    latex: '\\partial' },
    ],
  },
  {
    label: 'Геометрија',
    symbols: [
      { label: '°',    latex: '^{\\circ}' },
      { label: '△',    latex: '\\triangle' },
      { label: '⊥',    latex: '\\perp' },
      { label: '∥',    latex: '\\parallel' },
      { label: '∠',    latex: '\\angle' },
      { label: 'α',    latex: '\\alpha' },
      { label: 'β',    latex: '\\beta' },
      { label: 'θ',    latex: '\\theta' },
      { label: 'sin',  latex: '\\sin' },
      { label: 'cos',  latex: '\\cos' },
      { label: 'tan',  latex: '\\tan' },
    ],
  },
  {
    label: 'Множества',
    symbols: [
      { label: '∈',    latex: '\\in' },
      { label: '∉',    latex: '\\notin' },
      { label: '⊆',    latex: '\\subseteq' },
      { label: '∪',    latex: '\\cup' },
      { label: '∩',    latex: '\\cap' },
      { label: 'ℕ',    latex: '\\mathbb{N}' },
      { label: 'ℤ',    latex: '\\mathbb{Z}' },
      { label: 'ℚ',    latex: '\\mathbb{Q}' },
      { label: 'ℝ',    latex: '\\mathbb{R}' },
    ],
  },
];

type AIMode = 'explain' | 'solve' | 'check' | 'similar';
const AI_MODES: { id: AIMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'explain', label: 'Објасни',  icon: <Lightbulb className="w-4 h-4" />,      desc: 'Што значи овој израз?' },
  { id: 'solve',   label: 'Реши',     icon: <Calculator className="w-4 h-4" />,      desc: 'Чекор-по-чекор решение' },
  { id: 'check',   label: 'Провери',  icon: <CheckCircle2 className="w-4 h-4" />,    desc: 'Провери точност' },
  { id: 'similar', label: 'Слични',   icon: <Shuffle className="w-4 h-4" />,         desc: 'Генерирај слични задачи' },
];

const MAX_HISTORY = 12;

function useCopyToClipboard(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }, []);
  return [copied, copy];
}

export function MathEditorView() {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const mfRef = useRef<MathfieldElement>(null);
  const [latex, setLatex] = useState('');
  const [activeSymGroup, setActiveSymGroup] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [savedExpressions, setSavedExpressions] = useState<SavedMathExpression[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('explain');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [latexCopied, copyLatex] = useCopyToClipboard();
  const settingRef = useRef(false);

  // Set only when this view was opened from another view's "🧮 Отвори Математички
  // Уредник" button (utils/mathEditorBridge.ts) — shows an "Вметни" action that writes
  // the current expression back and returns, instead of the plain standalone editor.
  const [returnPath] = useState<string | null>(() => readAndClearMathEditorReturn());

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    let cancelled = false;
    fetchMyExpressions(firebaseUser.uid)
      .then(list => { if (!cancelled) setSavedExpressions(list); })
      .catch(err => { if (!cancelled) logger.warn('[MathEditorView] fetchMyExpressions failed:', err); });
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  const handleSaveExpression = useCallback(async () => {
    if (!firebaseUser?.uid || !latex.trim() || saving) return;
    setSaving(true);
    try {
      await saveExpression(firebaseUser.uid, latex);
      setSavedExpressions(await fetchMyExpressions(firebaseUser.uid));
    } finally {
      setSaving(false);
    }
  }, [firebaseUser?.uid, latex, saving]);

  const handleInsertAndReturn = useCallback(() => {
    if (!returnPath || !latex.trim()) return;
    writeMathEditorResult(latex);
    navigate(returnPath);
  }, [returnPath, latex, navigate]);

  // Wire MathLive event
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    const onInput = () => {
      if (!settingRef.current) setLatex(mf.value);
    };
    mf.addEventListener('input', onInput);
    return () => mf.removeEventListener('input', onInput);
  }, []);

  const setMFValue = useCallback((val: string) => {
    const mf = mfRef.current;
    if (!mf) return;
    settingRef.current = true;
    mf.setValue(val, { insertionMode: 'replaceAll' });
    settingRef.current = false;
    setLatex(val);
    mf.focus();
  }, []);

  const insertSymbol = useCallback((sym: string) => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.executeCommand(['insert', sym]);
    mf.focus();
  }, []);

  const saveToHistory = useCallback(() => {
    if (!latex.trim()) return;
    setHistory(h => {
      const next = [latex, ...h.filter(x => x !== latex)].slice(0, MAX_HISTORY);
      return next;
    });
  }, [latex]);

  const handleClear = () => { setMFValue(''); setAiResult(''); };

  const handleAI = useCallback(async () => {
    if (!latex.trim()) return;
    saveToHistory();
    setAiLoading(true);
    setAiResult('');
    try {
      let result = '';
      switch (aiMode) {
        case 'explain': result = await duggaAPI.explainExpression(latex); break;
        case 'solve':   result = await duggaAPI.solveExpression(latex);   break;
        case 'check':   result = await duggaAPI.checkExpression(latex);   break;
        case 'similar': result = await duggaAPI.generateSimilarProblem(latex); break;
      }
      setAiResult(result);
    } catch {
      setAiResult('Неуспешна AI операција. Обиди се повторно.');
    } finally {
      setAiLoading(false);
    }
  }, [latex, aiMode, saveToHistory]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<title>Математички Уредник — Извоз</title>' +
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' +
      '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><' + '/script>' +
      '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body,{delimiters:[{left:\'$$\',right:\'$$\',display:true},{left:\'$\',right:\'$\',display:false}]})"><' + '/script>' +
      '<style>body{font-family:Georgia,serif;padding:40px;font-size:18px;max-width:800px;margin:auto;}</style>' +
      '</head><body>' +
      '<h2 style="color:#4f46e5;margin-bottom:24px;">Математички израз</h2>' +
      '<div style="font-size:2rem;text-align:center;padding:30px 0;">$$' + latex.replace(/\\/g, '\\\\') + '$$</div>' +
      '<hr style="margin:24px 0;border-color:#e5e7eb;">' +
      '<p style="color:#6b7280;font-size:14px;">LaTeX: <code>' + latex.replace(/</g, '&lt;') + '</code></p>' +
      (aiResult ? '<h3 style="margin-top:24px;">AI Анализа</h3><pre style="white-space:pre-wrap;font-size:14px;background:#f9fafb;padding:16px;border-radius:8px;">' + aiResult.replace(/</g, '&lt;') + '</pre>' : '') +
      '</body></html>'
    );
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const selectedAiMode = AI_MODES.find(m => m.id === aiMode)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Sigma className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Математички Уредник</h1>
            <p className="text-xs text-gray-400 mt-0.5">MathLive · LaTeX · AI Анализа · Печати</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {firebaseUser && (
              <button
                onClick={handleSaveExpression}
                disabled={!latex.trim() || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Зачувај
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={!latex.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              Печати
            </button>
            {returnPath && (
              <button
                onClick={handleInsertAndReturn}
                disabled={!latex.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-40 shadow-sm"
              >
                <ArrowLeftCircle className="w-4 h-4" />
                Вметни и врати се
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── MathLive input ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm focus-within:border-indigo-400 transition-colors">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Математички израз</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { saveToHistory(); setShowHistory(h => !h); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Историја {history.length > 0 && <span className="bg-indigo-100 text-indigo-600 rounded-full px-1.5">{history.length}</span>}
              </button>
              <button
                onClick={() => copyLatex(latex)}
                disabled={!latex.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                {latexCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {latexCopied ? 'Копирано!' : 'LaTeX'}
              </button>
              <button
                onClick={handleClear}
                disabled={!latex.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Исчисти
              </button>
            </div>
          </div>

          {/* History dropdown */}
          {showHistory && (history.length > 0 || savedExpressions.length > 0) && (
            <div className="border-b border-gray-100 px-4 py-2 bg-gray-50 space-y-3">
              {history.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-semibold">Последни изрази (оваа сесија)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => { setMFValue(h); setShowHistory(false); }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors font-mono max-w-[200px] truncate"
                        title={h}
                      >
                        {h.length > 30 ? h.slice(0, 30) + '…' : h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {savedExpressions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-semibold">Зачувани изрази</p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedExpressions.map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setMFValue(e.latex); setShowHistory(false); }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 hover:border-indigo-400 transition-colors font-mono max-w-[200px] truncate"
                        title={e.latex}
                      >
                        {e.latex.length > 30 ? e.latex.slice(0, 30) + '…' : e.latex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4">
            <math-field
              ref={mfRef}
              virtual-keyboard-mode="onfocus"
              placeholder="Внеси математички израз... (пр. x^2 + 2x + 1)"
              style={{
                width: '100%',
                fontSize: '1.6rem',
                outline: 'none',
                border: 'none',
                backgroundColor: 'transparent',
                minHeight: '56px',
              }}
            />
          </div>

          {latex.trim() && (
            <div className="px-4 pb-3">
              <p className="text-xs font-mono text-gray-300 select-all">{latex}</p>
            </div>
          )}
        </div>

        {/* ── Symbol palette ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex gap-2 mb-3 flex-wrap">
            {SYMBOL_GROUPS.map((g, i) => (
              <button
                key={i}
                onClick={() => setActiveSymGroup(i)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeSymGroup === i
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SYMBOL_GROUPS[activeSymGroup].symbols.map(sym => (
              <button
                key={sym.latex}
                onClick={() => insertSymbol(sym.latex)}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-sm font-medium transition-colors min-w-[42px] text-center"
                title={sym.latex}
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── AI Panel ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">AI Асистент</span>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-gray-100">
            {AI_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setAiMode(m.id); setAiResult(''); }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  aiMode === m.id
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <div className="p-5">
            <p className="text-sm text-gray-500 mb-4">{selectedAiMode.desc}</p>
            <button
              onClick={handleAI}
              disabled={!latex.trim() || aiLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 text-sm"
            >
              {aiLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Анализирање...</>
                : <>{selectedAiMode.icon} {selectedAiMode.label}</>
              }
            </button>

            {aiResult && (
              <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">AI Резултат — {selectedAiMode.label}</span>
                  <button
                    onClick={() => copyLatex(aiResult)}
                    className="text-xs text-indigo-400 hover:text-indigo-600 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Копирај
                  </button>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {aiResult}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick reference card ───────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Брза референца — LaTeX симболи
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm font-mono opacity-90">
            {[
              ['\\frac{a}{b}', 'дропка'],
              ['\\sqrt{x}', 'квадратен корен'],
              ['x^{2}', 'степен'],
              ['\\pi', 'пи (3.14...)'],
              ['\\infty', 'бесконечно'],
              ['\\leq, \\geq', '≤, ≥'],
              ['\\sum_{i=1}^{n}', 'сума'],
              ['\\int_{a}^{b}', 'интеграл'],
              ['\\log_{b}(x)', 'логаритам'],
              ['\\alpha, \\beta', 'α, β'],
              ['\\triangle', 'триаголник'],
              ['\\perp', 'нормала'],
            ].map(([code, label]) => (
              <div key={code} className="flex items-baseline gap-2">
                <code className="text-indigo-200 text-xs">{code}</code>
                <span className="text-indigo-100 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
