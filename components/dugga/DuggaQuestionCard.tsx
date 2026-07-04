import React from 'react';
import {
  CheckCircle2, XCircle, Clock, BookOpen, Sigma,
  ArrowUp, ArrowDown, ChevronRight,
} from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { MathInput } from '../common/MathInput';
import { QRSolutionUpload } from '../common/QRSolutionUpload';
import { EmbeddedMathTool } from '../math/EmbeddedMathTool';
import { FunctionTransformer } from '../math/FunctionTransformer';
import { UnitCirclePicker } from '../dataviz/UnitCirclePicker';
import type { DuggaQuestion } from '../../services/firestoreService.dugga';
import type { QResult } from '../../utils/duggaScoring';

/**
 * Deterministic shuffle seeded by a string (e.g. question id) — same seed
 * always produces the same order, so a `proof_steps` pool doesn't re-shuffle
 * on every re-render (no useState needed inside a switch-case component).
 */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const next = () => { h = (h * 1103515245 + 12345) >>> 0; return h / 0xFFFFFFFF; };
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Answer Input Components ──────────────────────────────────────────────────

/**
 * S61-A3 — Open-ended answer renderer that honours per-question
 * `answerInput` (text/math/mixed) and `allowSolutionUpload` flags. Used by
 * essay / short_answer / fill_blanks branches in the AnswerInput switch.
 */
function OpenEndedAnswer({
  q, answer, onChange, disabled,
  solutionImageUrl, onSolutionImage,
  defaultEditor, rows, placeholder,
}: {
  q: DuggaQuestion;
  answer: string;
  onChange: (v: string) => void;
  disabled: boolean;
  solutionImageUrl?: string;
  onSolutionImage?: (url: string) => void;
  defaultEditor: 'text' | 'math' | 'mixed';
  rows: number;
  placeholder: string;
}) {
  const editor = q.answerInput ?? defaultEditor;
  // For 'mixed' editor, render a toggle (legacy essay behaviour).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [useMath, setUseMath] = React.useState(editor === 'math');

  const showMath = editor === 'math' || (editor === 'mixed' && useMath);
  // QR upload: legacy essay had it via onSolutionImage prop; now also enabled
  // for any open-ended type when q.allowSolutionUpload === true.
  const showQR = (q.allowSolutionUpload ?? false) || (q.type === 'essay' && Boolean(onSolutionImage));

  return (
    <div className="mt-3 space-y-2">
      {editor === 'mixed' && !disabled && (
        <button
          type="button"
          onClick={() => setUseMath(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${useMath ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          <Sigma className="w-3.5 h-3.5" />
          {useMath ? 'Мат. уредник вклучен' : 'Вклучи мат. уредник'}
        </button>
      )}

      {disabled ? (
        <div className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm bg-gray-50 text-gray-600 whitespace-pre-wrap">
          {answer || '—'}
        </div>
      ) : showMath ? (
        <MathInput value={answer} onChange={onChange} placeholder={placeholder} className="w-full" />
      ) : (
        <textarea
          rows={rows}
          disabled={disabled}
          value={answer}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50"
        />
      )}

      {showQR && onSolutionImage && (
        <QRSolutionUpload
          questionKey={q.id}
          onImageUrl={onSolutionImage}
          disabled={disabled}
          existingUrl={solutionImageUrl}
        />
      )}
    </div>
  );
}

function AnswerInput({ q, answer, onChange, disabled, solutionImageUrl, onSolutionImage }: {
  q: DuggaQuestion; answer: string; onChange: (v: string) => void; disabled: boolean;
  solutionImageUrl?: string; onSolutionImage?: (url: string) => void;
}) {
  switch (q.type) {
    case 'multiple_choice': {
      const opts = q.options ?? [];
      return (
        <div className="space-y-2 mt-3">
          {opts.map(opt => (
            <label key={opt.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${answer === opt.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}>
              <input type="radio" className="accent-indigo-600" checked={answer === opt.id}
                onChange={() => !disabled && onChange(opt.id)} disabled={disabled} />
              <span className="text-sm text-gray-800"><MathRenderer text={opt.text} /></span>
            </label>
          ))}
        </div>
      );
    }
    case 'checklist': {
      const opts = q.options ?? [];
      const selected = answer ? answer.split(',').filter(Boolean) : [];
      return (
        <div className="space-y-2 mt-3">
          {opts.map(opt => {
            const checked = selected.includes(opt.id);
            return (
              <label key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}>
                <input type="checkbox" className="accent-indigo-600" checked={checked} disabled={disabled}
                  onChange={() => {
                    if (disabled) return;
                    const next = checked ? selected.filter(id => id !== opt.id) : [...selected, opt.id];
                    onChange(next.join(','));
                  }} />
                <span className="text-sm text-gray-800"><MathRenderer text={opt.text} /></span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'true_false': {
      const opts = ['Точно', 'Неточно'];
      return (
        <div className="flex gap-3 mt-3">
          {opts.map(v => (
            <button type="button" key={v} disabled={disabled}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-all ${answer === v ? (v === 'Точно' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}
              onClick={() => !disabled && onChange(v)}>
              {v === 'Точно' ? '✓ Точно' : '✗ Неточно'}
            </button>
          ))}
        </div>
      );
    }
    case 'statement_eval': {
      const opts = ['Точно', 'Неточно', 'Делумно точно'];
      return (
        <div className="flex gap-2 flex-wrap mt-3">
          {opts.map(v => (
            <button type="button" key={v} disabled={disabled}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${answer === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}
              onClick={() => !disabled && onChange(v)}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    case 'fill_blanks':
    case 'short_answer': {
      // S61-A3: honor q.answerInput (text|math|mixed); default = math (legacy).
      return (
        <OpenEndedAnswer
          q={q}
          answer={answer}
          onChange={onChange}
          disabled={disabled}
          solutionImageUrl={solutionImageUrl}
          onSolutionImage={onSolutionImage}
          defaultEditor="math"
          rows={1}
          placeholder="Внеси го одговорот..."
        />
      );
    }
    case 'essay': {
      // S61-A3: honor q.answerInput (text|math|mixed); default = mixed (legacy toggle).
      return (
        <OpenEndedAnswer
          q={q}
          answer={answer}
          onChange={onChange}
          disabled={disabled}
          solutionImageUrl={solutionImageUrl}
          onSolutionImage={onSolutionImage}
          defaultEditor="mixed"
          rows={5}
          placeholder="Напиши го твоето решение / доказ..."
        />
      );
    }
    case 'ordering': {
      const currentOrder = answer ? answer.split('|') : (q.orderItems ?? []);
      return (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500 mb-1">Постави ги во точен редослед:</p>
          {currentOrder.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-gray-200 bg-gray-50">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
              <span className="flex-1 text-sm text-gray-800"><MathRenderer text={item} /></span>
              {!disabled && (
                <div className="flex gap-0.5">
                  <button type="button" disabled={idx === 0} aria-label="Помести нагоре"
                    onClick={() => {
                      const next = [...currentOrder];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      onChange(next.join('|'));
                    }}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-20 transition-colors">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" disabled={idx === currentOrder.length - 1} aria-label="Помести надолу"
                    onClick={() => {
                      const next = [...currentOrder];
                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                      onChange(next.join('|'));
                    }}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-20 transition-colors">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'multi_match': {
      const pairs = q.matchPairs ?? [];
      const rightOptions = pairs.map(p => p.right);
      let parsed: Record<string, string> = {};
      try { parsed = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      return (
        <div className="mt-3 space-y-2">
          {pairs.map((pair, pi) => (
            <div key={pi} className="flex items-center gap-3">
              <div className="flex-1 text-sm font-medium bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
                <MathRenderer text={pair.left} />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              <select disabled={disabled} value={parsed[pair.left] ?? ''}
                aria-label={`Поврзи: ${pair.left}`}
                onChange={e => {
                  const next = { ...parsed, [pair.left]: e.target.value };
                  onChange(JSON.stringify(next));
                }}
                className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50">
                <option value="">— избери —</option>
                {rightOptions.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case 'table_completion': {
      const headers = q.tableHeaders ?? [];
      const rows = q.tableRows ?? [];
      let cells: Record<string, string> = {};
      try { cells = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-indigo-50">
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-indigo-200 px-3 py-2 text-center font-semibold text-indigo-700">
                    <MathRenderer text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-gray-200 px-2 py-1.5 text-center bg-white">
                      {cell === '' ? (
                        <input type="text" disabled={disabled} value={cells[`${ri}_${ci}`] ?? ''}
                          aria-label={`Ред ${ri + 1}, колона ${ci + 1}`}
                          placeholder="?"
                          onChange={e => {
                            const next = { ...cells, [`${ri}_${ci}`]: e.target.value };
                            onChange(JSON.stringify(next));
                          }}
                          className="w-20 text-center border-b-2 border-indigo-400 focus:outline-none bg-transparent text-sm" />
                      ) : (
                        <span className="text-gray-700"><MathRenderer text={cell} /></span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'list_items': {
      const count = Math.max(3, q.options?.length ?? 3);
      let items: string[] = [];
      try { items = answer ? JSON.parse(answer) : []; } catch { /* */ }
      while (items.length < count) items.push('');
      return (
        <div className="mt-3 space-y-2">
          {items.map((item, ii) => (
            <div key={ii} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-5 text-right shrink-0">{ii + 1}.</span>
              <input type="text" disabled={disabled} value={item}
                aria-label={`Ставка ${ii + 1}`}
                placeholder={`${ii + 1}. одговор`}
                onChange={e => {
                  const next = [...items];
                  next[ii] = e.target.value;
                  onChange(JSON.stringify(next));
                }}
                className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
            </div>
          ))}
        </div>
      );
    }
    case 'diagram_annotate': {
      return (
        <div className="mt-3 space-y-3">
          {q.imageUrl && <img src={q.imageUrl} alt="Дијаграм" className="max-w-full rounded-xl border border-gray-200" />}
          <textarea rows={4} disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
            placeholder="Опиши ги означените делови..."
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
        </div>
      );
    }
    case 'interactive_table': {
      const headers = q.tableHeaders ?? [];
      const rows = q.tableRows ?? [];
      let checked: Record<string, boolean> = {};
      try { checked = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2" aria-label="Ред"></th>
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-gray-200 px-4 py-2 text-center font-semibold text-gray-700">
                    <MathRenderer text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="border border-gray-200 px-3 py-2 font-medium text-gray-700 bg-gray-50">
                    <MathRenderer text={row[0] ?? ''} />
                  </td>
                  {headers.map((_, ci) => (
                    <td key={ci} className="border border-gray-200 px-4 py-2 text-center">
                      <input type="checkbox" className="accent-indigo-600 w-4 h-4" disabled={disabled}
                        aria-label={`${row[0] ?? `Ред ${ri + 1}`} — ${headers[ci] ?? `Кол ${ci + 1}`}`}
                        checked={!!checked[`${ri}_${ci}`]}
                        onChange={e => {
                          const next = { ...checked, [`${ri}_${ci}`]: e.target.checked };
                          onChange(JSON.stringify(next));
                        }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'multi_part': {
      return (
        <textarea rows={6} disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Одговори на сите делови..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
    }
    case 'inline_select': {
      return (
        <input type="text" disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Одговор..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
    }
    case 'feynman_explain': {
      return (
        <div className="mt-3 space-y-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-800">
            Замисли дека му/и го објаснуваш концептот <strong>„{q.feynmanConcept || q.text}"</strong> на дете од 10 години. Пиши со свои зборови — без учебнички дефиниции.
          </div>
          <textarea
            rows={5}
            disabled={disabled}
            value={answer}
            onChange={e => onChange(e.target.value)}
            placeholder="Пример: Па значи, замисли дека имаш кутии со топки..."
            className="w-full rounded-xl border-2 border-yellow-300 bg-white px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-gray-50"
          />
          <p className="text-[10px] text-gray-400">Твоето објаснување ќе биде оценето од AI по Феинман рубрика (точност · едноставност · комплетност · без жаргон).</p>
        </div>
      );
    }
    case 'proof_critique': {
      const steps = q.proofCritiqueSteps ?? [];
      let parsed: { step?: number; reason?: string } = {};
      try { parsed = JSON.parse(answer || '{}'); } catch { /* ignore */ }
      const selectedStep = parsed.step ?? -1;
      const reason = parsed.reason ?? '';
      const update = (patch: { step?: number; reason?: string }) => {
        onChange(JSON.stringify({ step: selectedStep, reason, ...patch }));
      };
      return (
        <div className="mt-3 space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-800 font-medium">
            Во следниот доказ постои намерна грешка. Кликни на чекорот кој е погрешен, потоа објасни зошто.
          </div>
          <ol className="space-y-2">
            {steps.map((step, i) => {
              const isSelected = selectedStep === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ step: i })}
                    className={`w-full text-left rounded-xl border-2 px-4 py-2.5 text-sm transition-all ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50 font-semibold text-rose-900 ring-2 ring-rose-300'
                        : 'border-gray-200 bg-white hover:border-rose-300 hover:bg-rose-50/40 text-gray-800'
                    } disabled:cursor-default`}
                  >
                    <span className="font-bold mr-2 text-gray-400">{i + 1}.</span>
                    <MathRenderer text={step} />
                    {isSelected && <span className="ml-2 text-xs bg-rose-600 text-white rounded-full px-2 py-0.5">❌ Избрано</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {selectedStep >= 0 && (
            <textarea
              rows={3}
              disabled={disabled}
              value={reason}
              onChange={e => update({ reason: e.target.value })}
              placeholder="Зошто е овој чекор погрешен? Опиши ја грешката..."
              className="w-full rounded-xl border-2 border-rose-300 bg-white px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-gray-50"
            />
          )}
          <p className="text-[10px] text-gray-400">50% поени за точниот чекор + 50% AI оценка на образложението.</p>
        </div>
      );
    }
    case 'proof_steps': {
      const steps = q.expectedProof?.steps ?? [];
      const distractors = q.expectedProof?.distractors ?? [];
      const pool = [...steps, ...distractors];
      let currentIds: string[];
      try {
        const parsed = answer ? JSON.parse(answer) : null;
        currentIds = Array.isArray(parsed) && parsed.length === pool.length ? parsed : seededShuffle(pool.map(s => s.id), q.id);
      } catch {
        currentIds = seededShuffle(pool.map(s => s.id), q.id);
      }
      const byId = new Map(pool.map(s => [s.id, s.text]));
      return (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500 mb-1">Постави ги чекорите во точен редослед (внимавај — некои може да не припаѓаат):</p>
          {currentIds.map((id, idx) => (
            <div key={id} className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-gray-200 bg-gray-50">
              <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
              <span className="flex-1 text-sm text-gray-800"><MathRenderer text={byId.get(id) ?? ''} /></span>
              {!disabled && (
                <div className="flex gap-0.5">
                  <button type="button" disabled={idx === 0} aria-label="Помести нагоре"
                    onClick={() => {
                      const next = [...currentIds];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      onChange(JSON.stringify(next));
                    }}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-20 transition-colors">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" disabled={idx === currentIds.length - 1} aria-label="Помести надолу"
                    onClick={() => {
                      const next = [...currentIds];
                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                      onChange(JSON.stringify(next));
                    }}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-20 transition-colors">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'geometry_construct': {
      return (
        <div className="mt-3 space-y-2">
          {q.expectedConstruction?.description && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-teal-800">
              <strong>Барана конструкција:</strong> {q.expectedConstruction.description}
            </div>
          )}
          <textarea rows={5} disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
            placeholder="Опиши ги чекорите на конструкцијата што ги направи (користи ја GeoGebra алатката подолу како скица, ако е достапна)..."
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent disabled:bg-gray-50" />
        </div>
      );
    }
    case 'function_match': {
      if (!q.expectedTransform) {
        return <p className="mt-3 text-xs text-red-500">Прашањето нема поставена цел (expectedTransform).</p>;
      }
      let initialParams: { a: number; b: number; c: number; d: number } | undefined;
      try { initialParams = answer ? JSON.parse(answer) : undefined; } catch { /* */ }
      return (
        <div className="mt-3">
          <FunctionTransformer
            initialFunction={q.expectedTransform.fnKey}
            initialParams={initialParams}
            lockFunction
            targetParams={q.expectedTransform.target}
            onParamsChange={(params) => { if (!disabled) onChange(JSON.stringify(params)); }}
          />
        </div>
      );
    }
    case 'unit_circle_pick': {
      let current: { angle?: number; x?: number; y?: number } = {};
      try { current = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      const angleDeg = typeof current.angle === 'number'
        ? (q.expectedUnitCircle?.unit === 'rad' ? current.angle * 180 / Math.PI : current.angle)
        : 0;
      return (
        <div className="mt-3">
          <UnitCirclePicker
            angleDeg={angleDeg}
            disabled={disabled}
            onChange={({ angle, x, y }) => {
              const emittedAngle = q.expectedUnitCircle?.unit === 'rad' ? (angle * Math.PI) / 180 : angle;
              onChange(JSON.stringify({ angle: emittedAngle, x, y }));
            }}
          />
        </div>
      );
    }
    default:
      return (
        <input type="text" disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Одговор..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
  }
}

// ─── Question Card ─────────────────────────────────────────────────────────────

const DOK_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-red-100 text-red-700',
};

export function QuestionCard({ q, idx, answer, onChange, result, showResults, solutionImageUrl, onSolutionImage }: {
  q: DuggaQuestion; idx: number; answer: string;
  onChange: (id: string, v: string) => void;
  result?: QResult; showResults: boolean;
  solutionImageUrl?: string; onSolutionImage?: (id: string, url: string) => void;
}) {
  if (q.type === 'section_header') {
    return (
      <div className="pt-4 pb-1">
        <h3 className="text-base font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <MathRenderer text={q.text} />
        </h3>
      </div>
    );
  }

  const borderClass = showResults && result
    ? result.correct === true ? 'border-green-300 bg-green-50'
    : result.correct === false ? 'border-red-300 bg-red-50'
    : 'border-amber-300 bg-amber-50'
    : 'border-gray-200 bg-white';

  const answered = answer.length > 0;

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${borderClass}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`shrink-0 w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${answered && !showResults ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0 text-sm font-medium text-gray-800 leading-relaxed">
            <MathRenderer text={q.text} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOK_COLORS[q.dok]}`}>DoK{q.dok}</span>
          <span className="text-xs font-semibold text-gray-500">{q.points}п</span>
          {showResults && result && (
            result.correct === true
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : result.correct === false
                ? <XCircle className="w-5 h-5 text-red-500" />
                : <Clock className="w-5 h-5 text-amber-500" />
          )}
        </div>
      </div>

      {/* Answer UI */}
      <AnswerInput
        q={q} answer={answer} onChange={v => onChange(q.id, v)} disabled={showResults}
        solutionImageUrl={solutionImageUrl}
        onSolutionImage={onSolutionImage ? (url) => onSolutionImage(q.id, url) : undefined}
      />

      {/* S61-A3 — embedded interactive math tool (per-question, teacher-controlled) */}
      {q.embedTool && q.embedTool !== 'none' && (
        <div className="mt-3">
          <EmbeddedMathTool tool={q.embedTool} config={q.embedConfig} />
        </div>
      )}

      {/* Results feedback */}
      {showResults && result && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
          {result.feedback && (
            <p className="text-xs text-gray-600">{result.feedback}</p>
          )}
          {result.aiGrade && (
            <div className="text-xs bg-blue-50 rounded-xl p-3 border border-blue-200 whitespace-pre-line">
              <span className="font-semibold text-blue-700 block mb-1">AI Оценување:</span>
              {result.aiGrade}
            </div>
          )}
          {q.hint && result.correct !== true && (
            <p className="text-xs text-amber-700 italic bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
              Совет: {q.hint}
            </p>
          )}
          {q.solution && (
            <details className="text-xs">
              <summary className="cursor-pointer text-indigo-600 font-semibold hover:text-indigo-800">
                Прикажи решение
              </summary>
              <div className="mt-1.5 p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-gray-700">
                <MathRenderer text={q.solution} />
              </div>
            </details>
          )}
          <div className="text-xs font-bold text-right text-gray-700">
            {result.earned} / {result.maxPoints} поени
          </div>
        </div>
      )}
    </div>
  );
}
