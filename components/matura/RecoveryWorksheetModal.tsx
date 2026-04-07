/**
 * RecoveryWorksheetModal — M6 Phase 1
 *
 * Генерира персонализиран Recovery Worksheet за слабите концепти на ученикот.
 * Gemini го создава worksheet-от во HTML формат → се прикажува во модал → Print/PDF.
 *
 * Влезни податоци: weakConcepts од useMaturaStats (концепт, %, прашања, тема)
 * Излез: структуриран worksheet со теорија + задачи по концепт → window.print()
 */
import React, { useState, useRef, useCallback } from 'react';
import { X, Sparkles, Printer, Loader2, AlertTriangle, BookOpen, RefreshCcw } from 'lucide-react';
import { callGeminiProxy } from '../../services/gemini/core';

const MODEL = 'gemini-2.5-flash';

// ─── Sanitizer ────────────────────────────────────────────────────────────────
// Strips <script>, javascript: hrefs and on* event attributes from AI-generated HTML.
// DOMPurify-level protection is not needed here (teacher-only, Gemini-generated),
// but we still guard against prompt-injection scenarios.
function sanitizeWorksheetHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/\bon\w+\s*=/gi, 'data-blocked=');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeakConceptItem {
  conceptId: string;
  conceptTitle: string;
  gradeTitle?: string;
  topicTitle?: string;
  pct: number;
  questions: number;
  topicArea?: string;
}

interface Props {
  weakConcepts: WeakConceptItem[];
  studentName?: string;
  onClose: () => void;
}

// ─── Gemini prompt ────────────────────────────────────────────────────────────

function buildPrompt(concepts: WeakConceptItem[], lang = 'mk'): string {
  const conceptList = concepts
    .map((c, i) => `${i + 1}. ${c.conceptTitle} (${c.gradeTitle ?? ''}) — успешност: ${c.pct.toFixed(0)}%`)
    .join('\n');

  return `Ти си македонски наставник по математика. Генерирај персонализиран Recovery Worksheet на македонски јазик.

Слаби концепти на ученикот:
${conceptList}

Барања за worksheet-от:
- За СЕКОЈ концепт: кратко теоретско потсетување (2-3 реченици) + 2 задачи со зголемена тежина (прва полесна, втора потешка)
- Задачите мора да бидат нови (не ги повторувај задачите од испитот)
- Користи LaTeX нотација: $формула$ за inline, $$формула$$ за display
- На крај: 1 предизвик задача која комбинира 2+ концепти
- Тон: охрабрувачки, јасен, структуриран

Врати САМО валиден HTML (без DOCTYPE, без <html>/<body> тагови).
Структура:
<div class="worksheet">
  <h1>Recovery Worksheet</h1>
  <p class="subtitle">Персонализирано по твоите резултати</p>

  <section class="concept-section">
    <h2>1. [Назив на концептот]</h2>
    <div class="theory-box">
      <h3>Теорија</h3>
      <p>...</p>
    </div>
    <div class="tasks">
      <div class="task">
        <span class="task-label">Задача 1 (основна)</span>
        <p>...</p>
        <div class="answer-space"></div>
      </div>
      <div class="task">
        <span class="task-label">Задача 2 (напредна)</span>
        <p>...</p>
        <div class="answer-space"></div>
      </div>
    </div>
  </section>

  [... повтори за секој концепт ...]

  <section class="challenge-section">
    <h2>Предизвик задача</h2>
    <p>...</p>
    <div class="answer-space large"></div>
  </section>
</div>`;
}

// ─── Print styles (injected only during print) ────────────────────────────────

const PRINT_STYLES = `
  @media print {
    body > * { display: none !important; }
    #recovery-worksheet-print { display: block !important; }
  }
  #recovery-worksheet-print {
    display: none;
    font-family: 'Times New Roman', serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    color: #111;
  }
  #recovery-worksheet-print .worksheet h1 {
    font-size: 22px; text-align: center; border-bottom: 2px solid #1e40af;
    padding-bottom: 8px; margin-bottom: 4px;
  }
  #recovery-worksheet-print .worksheet .subtitle {
    text-align: center; color: #6b7280; font-size: 13px; margin-bottom: 24px;
  }
  #recovery-worksheet-print .concept-section {
    margin-bottom: 28px; page-break-inside: avoid;
  }
  #recovery-worksheet-print .concept-section h2 {
    font-size: 16px; color: #1e40af; border-left: 4px solid #1e40af;
    padding-left: 8px; margin-bottom: 8px;
  }
  #recovery-worksheet-print .theory-box {
    background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 6px; padding: 10px 14px; margin-bottom: 12px;
  }
  #recovery-worksheet-print .theory-box h3 {
    font-size: 12px; font-weight: bold; color: #1e40af;
    margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;
  }
  #recovery-worksheet-print .task {
    margin-bottom: 14px;
  }
  #recovery-worksheet-print .task-label {
    font-size: 11px; font-weight: bold; color: #7c3aed;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  #recovery-worksheet-print .answer-space {
    border: 1px dashed #d1d5db; border-radius: 4px;
    min-height: 50px; margin-top: 6px;
  }
  #recovery-worksheet-print .answer-space.large { min-height: 80px; }
  #recovery-worksheet-print .challenge-section {
    background: #fef9c3; border: 1px solid #fde047;
    border-radius: 6px; padding: 14px; page-break-inside: avoid;
  }
  #recovery-worksheet-print .challenge-section h2 {
    font-size: 15px; color: #854d0e; margin-bottom: 8px;
  }
  #recovery-worksheet-print p { font-size: 14px; line-height: 1.6; margin: 4px 0; }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export const RecoveryWorksheetModal: React.FC<Props> = ({ weakConcepts, studentName, onClose }) => {
  const [phase, setPhase] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const printDivRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Max 5 concepts — more would make the worksheet too long
  const concepts = weakConcepts.slice(0, 5);

  const generate = useCallback(async () => {
    setPhase('generating');
    setError('');
    try {
      const prompt = buildPrompt(concepts);
      // 45-second timeout — worksheet generation is longer than typical calls
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Генерирањето траеше премногу долго. Обиди се повторно.')), 45_000)
      );
      const resp = await Promise.race([
        callGeminiProxy({
          model: MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
        timeout,
      ]);
      const raw = resp.text?.trim() ?? '';
      // Strip any accidental markdown code fences
      const cleaned = raw.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
      if (!cleaned || !cleaned.includes('<')) throw new Error('Неочекуван формат на одговор');
      setHtml(sanitizeWorksheetHtml(cleaned));
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Грешка при генерирање');
      setPhase('error');
    }
  }, [concepts]);

  const handlePrint = useCallback(() => {
    if (!printDivRef.current) return;

    // Inject content into the hidden print div (already sanitized at generation time)
    printDivRef.current.innerHTML = sanitizeWorksheetHtml(html);

    // Add print styles once
    if (!styleRef.current) {
      const style = document.createElement('style');
      style.id = 'recovery-print-styles';
      style.textContent = PRINT_STYLES;
      document.head.appendChild(style);
      styleRef.current = style;
    }

    // Set the print div visible, print, restore
    printDivRef.current.style.display = 'block';
    window.print();
    printDivRef.current.style.display = 'none';
  }, [html]);

  return (
    <>
      {/* Hidden print target */}
      <div id="recovery-worksheet-print" ref={printDivRef} />

      {/* Modal overlay */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow">
                <BookOpen className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-base">Recovery Worksheet</h2>
                <p className="text-xs text-gray-500">{concepts.length} слаби концепти · персонализиран</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* Idle — concept list + generate button */}
            {phase === 'idle' && (
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Ќе се генерира worksheet за овие концепти:
                  </p>
                  {concepts.map((c, i) => (
                    <div key={c.conceptId}
                      className="flex items-center gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50/40">
                      <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{c.conceptTitle}</p>
                        <p className="text-xs text-gray-500">{c.gradeTitle} · {c.topicTitle}</p>
                      </div>
                      <span className="text-xs font-black text-rose-600 flex-shrink-0">
                        {c.pct.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  {weakConcepts.length > 5 && (
                    <p className="text-xs text-gray-500 text-center">
                      + {weakConcepts.length - 5} концепти не се вклучени (максимум 5)
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
                  <p className="font-bold text-blue-900">Worksheet содржи:</p>
                  <p>• Теоретско потсетување за секој концепт</p>
                  <p>• 2 задачи по концепт (основна + напредна)</p>
                  <p>• 1 предизвик задача (комбинација)</p>
                  <p>• Простор за решавање → директно на печатење</p>
                </div>

                <button type="button" onClick={generate}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-base hover:opacity-90 transition shadow-lg">
                  <Sparkles className="w-5 h-5" />
                  Генерирај со AI
                </button>
              </div>
            )}

            {/* Generating */}
            {phase === 'generating' && (
              <div className="flex flex-col items-center justify-center gap-5 py-20 px-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl animate-pulse">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-black text-gray-800 text-lg">AI генерира worksheet…</p>
                  <p className="text-sm text-gray-500">Креира персонализирани задачи за {concepts.length} концепти</p>
                </div>
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <p className="text-sm text-rose-700 font-medium">{error}</p>
                </div>
                <button type="button" onClick={generate}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-violet-300 text-violet-700 font-bold text-sm hover:bg-violet-50 transition">
                  <RefreshCcw className="w-4 h-4" /> Обиди се повторно
                </button>
              </div>
            )}

            {/* Done — preview */}
            {phase === 'done' && html && (
              <div className="p-6 space-y-4">
                {/* Rendered preview */}
                <div
                  className="prose prose-sm max-w-none border border-gray-200 rounded-2xl p-5 bg-gray-50/50 overflow-auto max-h-96 text-sm text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <p className="text-xs text-gray-500 text-center">
                  LaTeX ќе се рендерира правилно при печатење
                </p>
              </div>
            )}
          </div>

          {/* Footer — actions */}
          {phase === 'done' && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
              <button type="button" onClick={() => { setPhase('idle'); setHtml(''); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                <RefreshCcw className="w-3.5 h-3.5" /> Регенерирај
              </button>
              <button type="button" onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:opacity-90 transition shadow">
                <Printer className="w-4 h-4" /> Печати / Зачувај PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
