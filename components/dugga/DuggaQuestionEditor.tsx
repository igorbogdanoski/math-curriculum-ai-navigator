import React, { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Loader2, GripVertical,
  CheckSquare, AlignLeft, List, ToggleLeft, Table2, Shuffle,
  ArrowUpDown, Layers, Hash, Compass, Sigma,
} from 'lucide-react';
import { MathInput } from '../common/MathInput';
import { MathRenderer } from '../common/MathRenderer';
import { duggaAPI, parseGeneratedQuestionsJson } from '../../services/gemini/dugga';
import type {
  DuggaQuestion, DuggaQuestionType, DuggaTestType, DuggaDok,
} from '../../services/firestoreService.dugga';
import { S61TeacherControls, isOpenEndedType } from './S61TeacherControls';
import { BASE_FUNCTIONS, type BaseFunctionKey } from '../math/functionTransformerHelpers';

// ─── Question type metadata ───────────────────────────────────────────────────
export const Q_TYPES: { id: DuggaQuestionType; label: string; icon: React.ReactNode; desc: string; aiSupported: boolean }[] = [
  { id: 'multiple_choice',  label: 'Повеќе избор (1 точен)',    icon: <CheckSquare className="w-4 h-4"/>,  desc: 'Класичен MC со 4 опции',                    aiSupported: true },
  { id: 'checklist',        label: 'Повеќе точни одговори',     icon: <List className="w-4 h-4"/>,          desc: 'Еден или повеќе точни',                     aiSupported: true },
  { id: 'true_false',       label: 'Точно / Неточно',           icon: <ToggleLeft className="w-4 h-4"/>,   desc: 'Тврдење T/F',                               aiSupported: true },
  { id: 'fill_blanks',      label: 'Пополни празнини',          icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Равенки со празни места',                   aiSupported: true },
  { id: 'short_answer',     label: 'Краток одговор',            icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Текст или мат. израз',                      aiSupported: true },
  { id: 'essay',            label: 'Есеј / Докаж',              icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Проширен одговор, AI градирање',             aiSupported: true },
  { id: 'ordering',         label: 'Редослед на чекори',        icon: <ArrowUpDown className="w-4 h-4"/>, desc: 'Постави докажување во ред',                 aiSupported: true },
  { id: 'multi_match',      label: 'Поврзување (match)',        icon: <Shuffle className="w-4 h-4"/>,       desc: 'Поими ↔ дефиниции',                         aiSupported: true },
  { id: 'statement_eval',   label: 'Оцени тврдење',             icon: <CheckSquare className="w-4 h-4"/>,  desc: 'Точно / Неточно / Делумно',                 aiSupported: true },
  { id: 'table_completion', label: 'Пополни табела',            icon: <Table2 className="w-4 h-4"/>,        desc: 'Функциска табела x→f(x)',                   aiSupported: true },
  { id: 'list_items',       label: 'Листа',                     icon: <List className="w-4 h-4"/>,          desc: 'Наброј (факторизација, корени…)',            aiSupported: false },
  { id: 'multi_part',       label: 'Повеќеделно',               icon: <Layers className="w-4 h-4"/>,        desc: 'Под-прашања 1.1, 1.2, 1.3',                aiSupported: false },
  { id: 'inline_select',    label: 'Вграден избор',             icon: <ChevronDown className="w-4 h-4"/>, desc: 'Dropdown во реченица',                       aiSupported: false },
  { id: 'interactive_table',label: 'Интерактивна табела',       icon: <Table2 className="w-4 h-4"/>,        desc: 'Cell checkboxes (таблица на вистина)',       aiSupported: false },
  { id: 'diagram_annotate', label: 'Означи дијаграм',           icon: <Hash className="w-4 h-4"/>,          desc: 'Слика + label-и',                           aiSupported: false },
  { id: 'feynman_explain',  label: 'Феинман Предизвик',          icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Објасни концепт едноставно, AI рубрика',    aiSupported: false },
  { id: 'proof_critique',  label: 'Критика на доказ',           icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Намерно погрешен доказ — ученикот го наоѓа грешката', aiSupported: false },
  { id: 'proof_steps',      label: 'Редослед на доказ (со стапки)', icon: <ArrowUpDown className="w-4 h-4"/>, desc: 'Подреди чекори на доказ, вклучува дистрактори', aiSupported: false },
  { id: 'geometry_construct', label: 'Геометриска конструкција', icon: <Compass className="w-4 h-4"/>,      desc: 'GeoGebra конструкција + AI оценување',      aiSupported: false },
  { id: 'function_match',   label: 'Трансформација на функција', icon: <Sigma className="w-4 h-4"/>,        desc: 'Совпадни ги a,b,c,d со слајдери',            aiSupported: false },
  { id: 'unit_circle_pick', label: 'Единечна кружница',         icon: <ToggleLeft className="w-4 h-4"/>,   desc: 'Избери агол/точка на единечна кружница',    aiSupported: false },
  { id: 'student_chart',   label: 'Нацртај дијаграм',           icon: <Table2 className="w-4 h-4"/>,        desc: 'Ученикот внесува податоци и цртa дијаграм', aiSupported: false },
  { id: 'section_header',  label: 'Дел / Секција',              icon: <Layers className="w-4 h-4"/>,        desc: 'Структурален (Дел А, Дел Б)',               aiSupported: false },
];

export const TEST_TYPES: { id: DuggaTestType; label: string; emoji: string }[] = [
  { id: 'topic',   label: 'Тематски тест',      emoji: '📌' },
  { id: 'midterm', label: 'Полугодишен тест',   emoji: '📅' },
  { id: 'annual',  label: 'Годишен тест',        emoji: '📆' },
  { id: 'exam',    label: 'Завршен испит',       emoji: '🎓' },
  { id: 'custom',  label: 'Прилагоден',          emoji: '⚙️' },
];

export const DOK_COLORS: Record<DuggaDok, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-red-100 text-red-700',
};

let _qid = 1;
export function newQId() { return `q-${Date.now()}-${_qid++}`; }
function newOptId() { return `o-${Date.now()}-${_qid++}`; }

export function makeBlankQuestion(type: DuggaQuestionType = 'multiple_choice'): DuggaQuestion {
  const base: DuggaQuestion = {
    id: newQId(), type, text: '', dok: 2, points: 1,
    solution: '', hint: '',
  };
  if (type === 'multiple_choice' || type === 'checklist') {
    base.options = [
      { id: newOptId(), text: '', isCorrect: false },
      { id: newOptId(), text: '', isCorrect: false },
      { id: newOptId(), text: '', isCorrect: false },
      { id: newOptId(), text: '', isCorrect: false },
    ];
  }
  if (type === 'true_false') {
    base.correctAnswer = 'true';
  }
  if (type === 'ordering') {
    base.orderItems = ['', '', '', ''];
  }
  if (type === 'multi_match') {
    base.matchPairs = [{ left: '', right: '' }, { left: '', right: '' }];
  }
  if (type === 'table_completion') {
    base.tableHeaders = ['x', 'f(x)'];
    base.tableRows = [['', ''], ['', ''], ['', '']];
  }
  if (type === 'proof_critique') {
    base.proofCritiqueSteps = [];
    base.proofCritiqueErrorStep = 0;
  }
  return base;
}

// ─── Question editor ──────────────────────────────────────────────────────────
export function QuestionEditor({
  q, idx, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  q: DuggaQuestion;
  idx: number;
  onChange: (updated: DuggaQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [useMathInput, setUseMathInput] = useState(false);

  const upd = (patch: Partial<DuggaQuestion>) => onChange({ ...q, ...patch });

  const qTypeMeta = Q_TYPES.find(t => t.id === q.type)!;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <GripVertical className="w-4 h-4 text-gray-300" />
        <span className="text-xs font-bold text-gray-400 min-w-[24px]">{idx + 1}.</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white px-2 py-1 rounded-lg border border-gray-200">
          {qTypeMeta.icon}
          <span>{qTypeMeta.label}</span>
        </div>
        <select
          value={q.dok}
          onChange={e => upd({ dok: Number(e.target.value) as DuggaDok })}
          className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${DOK_COLORS[q.dok]}`}
        >
          <option value={1}>DoK 1</option>
          <option value={2}>DoK 2</option>
          <option value={3}>DoK 3</option>
          <option value={4}>DoK 4</option>
        </select>
        <input
          type="number"
          min={1} max={20}
          value={q.points}
          onChange={e => upd({ points: Math.max(1, Number(e.target.value)) })}
          className="w-14 text-xs text-center border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-violet-300"
          title="Поени"
        />
        <span className="text-xs text-gray-400">поени</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setUseMathInput(m => !m)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${useMathInput ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-100'}`}
            title="MathLive режим">
            Σ
          </button>
          <button type="button" onClick={() => setExpanded(e => !e)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onDelete} className="p-1 text-red-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Question text */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Текст на прашањето</label>
            {useMathInput ? (
              <MathInput value={q.text} onChange={text => upd({ text })} placeholder="Внеси математички израз..." />
            ) : (
              <textarea
                value={q.text}
                onChange={e => upd({ text: e.target.value })}
                placeholder="Внеси го прашањето... (LaTeX: $x^2 + 1$)"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
              />
            )}
            {q.text.includes('$') && (
              <div className="mt-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
                <MathRenderer text={q.text} />
              </div>
            )}
          </div>

          {/* Type-specific fields */}
          {(q.type === 'multiple_choice' || q.type === 'checklist') && q.options && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">
                Опции {q.type === 'multiple_choice' ? '(избери 1 точен)' : '(избери сите точни)'}
              </label>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                      checked={opt.isCorrect}
                      onChange={e => {
                        const newOpts = q.options!.map((o, i) =>
                          q.type === 'multiple_choice'
                            ? { ...o, isCorrect: i === oi }
                            : i === oi ? { ...o, isCorrect: e.target.checked } : o
                        );
                        upd({ options: newOpts });
                      }}
                      className="w-4 h-4 flex-shrink-0 accent-violet-600"
                    />
                    <input
                      value={opt.text}
                      onChange={e => {
                        const newOpts = q.options!.map((o, i) => i === oi ? { ...o, text: e.target.value } : o);
                        upd({ options: newOpts });
                      }}
                      placeholder={`Опција ${String.fromCharCode(65 + oi)}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <button type="button" onClick={() => upd({ options: q.options!.filter((_, i) => i !== oi) })}
                      disabled={q.options!.length <= 2}
                      className="text-red-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => upd({ options: [...q.options!, { id: newOptId(), text: '', isCorrect: false }] })}
                  disabled={q.options!.length >= 6}
                  className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus className="w-3 h-3" /> Додај опција
                </button>
              </div>
            </div>
          )}

          {q.type === 'true_false' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Точен одговор</label>
              <div className="flex gap-3">
                {(['true', 'false'] as const).map(v => (
                  <button type="button" key={v}
                    onClick={() => upd({ correctAnswer: v })}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      q.correctAnswer === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {v === 'true' ? '✓ Точно' : '✗ Неточно'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q.type === 'statement_eval' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Точен одговор</label>
              <div className="flex gap-2">
                {['Точно', 'Неточно', 'Делумно точно'].map(v => (
                  <button type="button" key={v}
                    onClick={() => upd({ correctAnswer: v })}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      q.correctAnswer === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(q.type === 'fill_blanks' || q.type === 'short_answer' || q.type === 'list_items') && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Точен одговор / Клучни зборови</label>
              <input
                value={q.correctAnswer ?? ''}
                onChange={e => upd({ correctAnswer: e.target.value })}
                placeholder="Внеси го точниот одговор..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
          )}

          {q.type === 'ordering' && q.orderItems && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Чекори по точен редослед</label>
              <div className="space-y-2">
                {q.orderItems.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold text-gray-400 text-center">{ii + 1}.</span>
                    <input
                      value={item}
                      onChange={e => {
                        const items = [...q.orderItems!];
                        items[ii] = e.target.value;
                        upd({ orderItems: items });
                      }}
                      placeholder={`Чекор ${ii + 1}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <button type="button" onClick={() => upd({ orderItems: q.orderItems!.filter((_, i) => i !== ii) })}
                      disabled={q.orderItems!.length <= 2}
                      className="text-red-300 hover:text-red-500 disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => upd({ orderItems: [...q.orderItems!, ''] })}
                  className="text-xs text-violet-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Додај чекор
                </button>
              </div>
            </div>
          )}

          {q.type === 'multi_match' && q.matchPairs && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Парови за поврзување</label>
              <div className="space-y-2">
                {q.matchPairs.map((pair, pi) => (
                  <div key={pi} className="flex items-center gap-2">
                    <input value={pair.left} onChange={e => {
                      const pairs = q.matchPairs!.map((p, i) => i === pi ? { ...p, left: e.target.value } : p);
                      upd({ matchPairs: pairs });
                    }} placeholder="Лево" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <span className="text-gray-300">↔</span>
                    <input value={pair.right} onChange={e => {
                      const pairs = q.matchPairs!.map((p, i) => i === pi ? { ...p, right: e.target.value } : p);
                      upd({ matchPairs: pairs });
                    }} placeholder="Десно" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <button type="button" onClick={() => upd({ matchPairs: q.matchPairs!.filter((_, i) => i !== pi) })}
                      disabled={q.matchPairs!.length <= 2}
                      className="text-red-300 hover:text-red-500 disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => upd({ matchPairs: [...q.matchPairs!, { left: '', right: '' }] })}
                  className="text-xs text-violet-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Додај пар
                </button>
              </div>
            </div>
          )}

          {q.type === 'table_completion' && q.tableRows && q.tableHeaders && (
            <div>
              <div className="flex gap-2 mb-2">
                {q.tableHeaders.map((h, hi) => (
                  <input key={hi} value={h} onChange={e => {
                    const hs = [...q.tableHeaders!];
                    hs[hi] = e.target.value;
                    upd({ tableHeaders: hs });
                  }} placeholder={`Колона ${hi + 1}`} className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-300" />
                ))}
              </div>
              {q.tableRows.map((row, ri) => (
                <div key={ri} className="flex gap-2 mb-1">
                  {row.map((cell, ci) => (
                    <input key={ci} value={cell} onChange={e => {
                      const rows = q.tableRows!.map((r, i) => i === ri ? r.map((c, j) => j === ci ? e.target.value : c) : r);
                      upd({ tableRows: rows });
                    }} placeholder={ci === 0 ? `x${ri + 1}` : '?'} className={`flex-1 px-2 py-1.5 rounded-lg border text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-300 ${ci > 0 ? 'border-dashed border-violet-200 bg-violet-50' : 'border-gray-200'}`} />
                  ))}
                </div>
              ))}
              <button type="button" onClick={() => upd({ tableRows: [...q.tableRows!, new Array(q.tableHeaders!.length).fill('')] })}
                className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3 h-3" /> Додај ред
              </button>
            </div>
          )}

          {q.type === 'section_header' && (
            <p className="text-xs text-gray-400 italic">Секцискиот наслов ќе се прикаже bold во тестот.</p>
          )}

          {q.type === 'essay' && (
            <p className="text-xs text-gray-400">Есеј одговорот ќе го гради AI автоматски по Rubric (дефинирај ја во решение).</p>
          )}

          {q.type === 'feynman_explain' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Концепт за Феинман объаснување</label>
              <input
                type="text"
                value={q.feynmanConcept ?? ''}
                onChange={e => upd({ feynmanConcept: e.target.value })}
                placeholder="пр. дефинитен интеграл, Питагорова теорема..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              <p className="text-[10px] text-gray-400 mt-1">Ученикот ќе го објасни концептот на дете, AI ќе оцени по 4 Феинман критериуми (точност · едноставност · комплетност · без жаргон).</p>
            </div>
          )}

          {q.type === 'proof_critique' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Чекори на доказот (еден чекор по ред)</label>
                <textarea
                  rows={5}
                  value={(q.proofCritiqueSteps ?? []).join('\n')}
                  onChange={e => upd({ proofCritiqueSteps: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) })}
                  placeholder={"Чекор 1: ...\nЧекор 2: ...\nЧекор 3: (ВО ОВОЈ ИМА ГРЕШКА)\nЧекор 4: ..."}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-rose-400 resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Индекс на погрешниот чекор (0-базиран, пр. 2 = трет чекор)
                </label>
                <input
                  type="number" min={0}
                  max={Math.max(0, (q.proofCritiqueSteps?.length ?? 1) - 1)}
                  title="Индекс на погрешниот чекор"
                  value={q.proofCritiqueErrorStep ?? 0}
                  onChange={e => {
                    const max = Math.max(0, (q.proofCritiqueSteps?.length ?? 1) - 1);
                    upd({ proofCritiqueErrorStep: Math.min(parseInt(e.target.value) || 0, max) });
                  }}
                  className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
                <span className="text-[10px] text-gray-400 ml-2">
                  (вкупно чекори: {q.proofCritiqueSteps?.length ?? 0})
                </span>
              </div>
              <p className="text-[10px] text-gray-400">Ученикот кликнува на погрешниот чекор и пишува образложение. 50% поени за точен чекор + 50% AI оценка на образложението.</p>
            </div>
          )}

          {q.type === 'proof_steps' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Точен редослед на чекори (еден чекор по ред)</label>
                <textarea
                  rows={4}
                  value={(q.expectedProof?.steps ?? []).map(s => s.text).join('\n')}
                  onChange={e => {
                    const steps = e.target.value.split('\n').map((text: string) => text.trim()).filter(Boolean)
                      .map(text => ({ id: newOptId(), text }));
                    upd({ expectedProof: { ...(q.expectedProof ?? { steps: [] }), steps } });
                  }}
                  placeholder={"Чекор 1: ...\nЧекор 2: ...\nЧекор 3: ..."}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Дистрактори (погрешни чекори — опционално, еден по ред)</label>
                <textarea
                  rows={2}
                  value={(q.expectedProof?.distractors ?? []).map(s => s.text).join('\n')}
                  onChange={e => {
                    const distractors = e.target.value.split('\n').map((text: string) => text.trim()).filter(Boolean)
                      .map(text => ({ id: newOptId(), text }));
                    upd({ expectedProof: { steps: q.expectedProof?.steps ?? [], ...q.expectedProof, distractors } });
                  }}
                  placeholder={"Погрешен чекор кој не припаѓа во доказот..."}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y"
                />
              </div>
              <p className="text-[10px] text-gray-400">Ученикот ги подредува сите чекори (точни + дистрактори, измешани). Оценување: точна позиција на секој точен чекор, казна за вклучен дистрактор.</p>
            </div>
          )}

          {q.type === 'geometry_construct' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Опис на бараната конструкција</label>
                <textarea
                  rows={3}
                  value={q.expectedConstruction?.description ?? ''}
                  onChange={e => upd({ expectedConstruction: { ...(q.expectedConstruction ?? { description: '' }), description: e.target.value } })}
                  placeholder="пр. Конструирај симетрала на отсечка AB користејќи шестар и линијар."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Рубрика за AI оценување (опционално)</label>
                <textarea
                  rows={2}
                  value={q.expectedConstruction?.rubric ?? ''}
                  onChange={e => upd({ expectedConstruction: { description: q.expectedConstruction?.description ?? '', ...q.expectedConstruction, rubric: e.target.value } })}
                  placeholder="пр. Бодувај: точност на конструкцијата (50%), објаснување на чекорите (30%), точна ознака (20%)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y"
                />
              </div>
              <p className="text-[10px] text-gray-400">Ученикот пишува белешки за конструкцијата (опционално со GeoGebra алатка како скица — вклучи ја преку „🛠 Алатки за ученикот" подолу). AI оценува врз основа на белешките и описот.</p>
            </div>
          )}

          {q.type === 'function_match' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Базна функција</label>
                <select
                  title="Базна функција"
                  value={q.expectedTransform?.fnKey ?? 'sin'}
                  onChange={e => upd({ expectedTransform: { ...(q.expectedTransform ?? { target: { a: 1, b: 1, c: 0, d: 0 } }), fnKey: e.target.value as BaseFunctionKey } })}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {Object.values(BASE_FUNCTIONS).map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Цел: y = a·f(b·x + c) + d
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['a', 'b', 'c', 'd'] as const).map(k => (
                    <div key={k}>
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{k}</label>
                      <input
                        type="number" step={0.1}
                        title={`Целна вредност на ${k}`}
                        value={q.expectedTransform?.target[k] ?? (k === 'a' || k === 'b' ? 1 : 0)}
                        onChange={e => {
                          const base = q.expectedTransform ?? { fnKey: 'sin' as BaseFunctionKey, target: { a: 1, b: 1, c: 0, d: 0 } };
                          upd({ expectedTransform: { ...base, target: { ...base.target, [k]: Number(e.target.value) } } });
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Ученикот ги подесува a, b, c, d со слајдери додека кривата не се совпадне со целната крива.</p>
            </div>
          )}

          {q.type === 'unit_circle_pick' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Целен агол</label>
                  <input
                    type="number" step={1}
                    title="Целен агол"
                    value={q.expectedUnitCircle?.angle ?? 0}
                    onChange={e => upd({ expectedUnitCircle: { ...(q.expectedUnitCircle ?? { angle: 0, unit: 'deg' }), angle: Number(e.target.value) } })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Единица</label>
                  <select
                    title="Единица за агол"
                    value={q.expectedUnitCircle?.unit ?? 'deg'}
                    onChange={e => upd({ expectedUnitCircle: { ...(q.expectedUnitCircle ?? { angle: 0, unit: 'deg' }), unit: e.target.value as 'deg' | 'rad' } })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="deg">Степени (°)</option>
                    <option value="rad">Радијани</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Што се проверува</label>
                <select
                  title="Што се проверува"
                  value={q.expectedUnitCircle?.match ?? 'either'}
                  onChange={e => upd({ expectedUnitCircle: { ...(q.expectedUnitCircle ?? { angle: 0, unit: 'deg' }), match: e.target.value as 'angle' | 'point' | 'either' } })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="either">Или агол или точка (пофлексибилно)</option>
                  <option value="angle">Само агол</option>
                  <option value="point">Само (x, y) точка</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-400">Ученикот ја влече точката на единечна кружница (или користи слајдер) додека не го погоди целниот агол/точка.</p>
            </div>
          )}

          {q.type === 'student_chart' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Тип на дијаграм</label>
                <select
                  title="Тип на дијаграм"
                  value={q.expectedChart?.kind ?? 'bar'}
                  onChange={e => upd({ expectedChart: { ...(q.expectedChart ?? { data: [] }), kind: e.target.value as 'bar' | 'line' | 'scatter' | 'pie' } })}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="bar">Стапчест</option>
                  <option value="line">Линиски</option>
                  <option value="scatter">Точки</option>
                  <option value="pie">Кружен</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={q.expectedChart?.xLabel ?? ''}
                  onChange={e => upd({ expectedChart: { ...(q.expectedChart ?? { kind: 'bar', data: [] }), xLabel: e.target.value } })}
                  placeholder="Ознака X-оска" className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                <input type="text" value={q.expectedChart?.yLabel ?? ''}
                  onChange={e => upd({ expectedChart: { ...(q.expectedChart ?? { kind: 'bar', data: [] }), yLabel: e.target.value } })}
                  placeholder="Ознака Y-оска" className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Точни (x, y) парови (еден по ред: x, y)</label>
                <textarea
                  rows={4}
                  value={(q.expectedChart?.data ?? []).map(p => `${p.x}, ${p.y}`).join('\n')}
                  onChange={e => {
                    const data = e.target.value.split('\n').map(line => {
                      const [x, y] = line.split(',').map(s => s.trim());
                      return { x: x ?? '', y: Number(y) || 0 };
                    }).filter(p => p.x !== '');
                    upd({ expectedChart: { ...(q.expectedChart ?? { kind: 'bar' }), data } });
                  }}
                  placeholder={"Јануари, 10\nФевруари, 15\nМарт, 8"}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
                />
              </div>
              <p className="text-[10px] text-gray-400">Ученикот ги внесува податоците и го избира типот на дијаграм; се оценува тип (20%) + ознаки (20%) + точност на податоците (60%).</p>
            </div>
          )}

          {/* Solution / Hint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-50">
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">Решение (за наставник)</label>
              <textarea value={q.solution ?? ''} onChange={e => upd({ solution: e.target.value })}
                placeholder="Чекор-по-чекор решение..." rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">Hint (за ученик)</label>
              <textarea value={q.hint ?? ''} onChange={e => upd({ hint: e.target.value })}
                placeholder="Насока за ученикот..." rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none" />
            </div>
          </div>

          {/* S61-A2 — Per-question teacher controls (open-ended types only) */}
          {isOpenEndedType(q.type) && (
            <S61TeacherControls q={q} onChange={upd} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Generation Modal ──────────────────────────────────────────────────────
export function AIGenerateModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (questions: DuggaQuestion[]) => void;
}) {
  const [grade, setGrade] = useState(8);
  const [topics, setTopics] = useState('');
  const [testType, setTestType] = useState<DuggaTestType>('topic');
  const [count, setCount] = useState(10);
  const [dokDist, setDokDist] = useState({ 1: 3, 2: 4, 3: 2, 4: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [depth, setDepth] = useState<'brief' | 'standard' | 'deep'>('standard');

  const handleGenerate = async () => {
    if (!topics.trim()) { setError('Внеси тема(и).'); return; }
    setLoading(true); setError('');
    try {
      const raw = await duggaAPI.generateTestQuestions({
        grade, subject: 'Математика',
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        testType, totalQuestions: count,
        dokDistribution: { 1: dokDist[1], 2: dokDist[2], 3: dokDist[3], 4: dokDist[4] },
        temperature, depth,
      });
      const parsed = parseGeneratedQuestionsJson(raw);
      if (!parsed.length) throw new Error('json_empty');

      const questions: DuggaQuestion[] = parsed.map(p => {
        const q = makeBlankQuestion((p.type as DuggaQuestionType) ?? 'multiple_choice');
        q.text = typeof p.text === 'string' ? p.text : '';
        q.dok = (p.dok as DuggaDok) ?? 2;
        q.points = typeof p.points === 'number' ? p.points : 1;
        q.solution = typeof p.solution === 'string' ? p.solution : '';
        q.hint = typeof p.hint === 'string' ? p.hint : '';
        q.correctAnswer = typeof p.correctAnswer === 'string' ? p.correctAnswer : '';
        const rawOpts = Array.isArray(p.options) ? p.options as unknown[] : [];
        if ((q.type === 'multiple_choice' || q.type === 'checklist') && rawOpts.length) {
          q.options = rawOpts.map((opt) => {
            const text = typeof opt === 'string' ? opt.replace(/^[A-D]\)\s*/, '') :
              (opt && typeof (opt as { text?: string }).text === 'string' ? (opt as { text: string }).text : '');
            return { id: newOptId(), text, isCorrect: false };
          });
          const ca = typeof p.correctAnswer === 'string' ? p.correctAnswer : '';
          const correctLetter = (ca || 'A')[0].toUpperCase();
          q.options = q.options!.map((o, i) => ({
            ...o,
            isCorrect: String.fromCharCode(65 + i) === correctLetter,
          }));
        }
        return q;
      });

      onGenerated(questions);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'json_empty') {
        setError('AI не врати валидни прашања. Обиди се со пониска температура (0.7) или промени ги темите.');
      } else if (msg.includes('quota') || msg.includes('429')) {
        setError('AI квотата е исцрпена. Обиди се по малку.');
      } else {
        setError('Неуспешно генерирање — можен проблем со мрежата или AI сервисот. Обиди се повторно.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Генерирање на прашања</h3>
            <p className="text-xs text-gray-400">Gemini AI ги генерира прашањата врз основа на MK програмата</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Разред</label>
            <select value={grade} onChange={e => setGrade(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}. разред</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Тип на тест</label>
            <select value={testType} onChange={e => setTestType(e.target.value as DuggaTestType)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
              {TEST_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Теми (разделени со запирка)</label>
          <input value={topics} onChange={e => setTopics(e.target.value)}
            placeholder="пр. Квадратни равенки, Функции, Тригонометрија"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Број на прашања: {count}</label>
          <input type="range" min={4} max={30} value={count} onChange={e => setCount(Number(e.target.value))}
            className="w-full accent-violet-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>4</span><span>30</span></div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">DoK распределба</label>
          <div className="grid grid-cols-4 gap-2">
            {([1,2,3,4] as DuggaDok[]).map(d => (
              <div key={d} className="text-center">
                <div className={`text-xs font-bold px-1 py-0.5 rounded-lg mb-1 ${DOK_COLORS[d]}`}>DoK {d}</div>
                <input type="number" min={0} max={count} value={dokDist[d]}
                  onChange={e => setDokDist(prev => ({ ...prev, [d]: Number(e.target.value) }))}
                  className="w-full text-center border border-gray-200 rounded-lg py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Advanced AI params (collapsed by default) */}
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-gray-500">⚙️ Напредни AI параметри</span>
            <span className="text-gray-400 text-xs">{showAdvanced ? '▲' : '▼'}</span>
          </button>
          {showAdvanced && (
            <div className="px-4 pb-4 pt-3 space-y-4 bg-white">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  Температура (креативност): <span className="text-violet-600 font-bold">{temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range" min={0} max={2} step={0.1}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>0.0 — точно/строго</span>
                  <span>0.7 — балансирано</span>
                  <span>2.0 — креативно</span>
                </div>
                {temperature > 1.2 && (
                  <p className="text-[10px] text-amber-600 mt-1">⚠ Висока температура може да предизвика невалиден JSON. Препорачано: 0.5–1.0</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Длабочина на прашањата</label>
                <div className="flex gap-2">
                  {(['brief', 'standard', 'deep'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDepth(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                        depth === d
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                      }`}
                    >
                      {d === 'brief' ? '📋 Кратко' : d === 'standard' ? '📝 Стандард' : '📚 Длабоко'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {depth === 'brief' ? 'Кратки прашања, минимални решенија.' : depth === 'deep' ? 'Детални прашања со педагошки коментари и повеќе методи.' : 'Стандарден баланс на длабочина и јасност.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            Откажи
          </button>
          <button type="button" onClick={handleGenerate} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерирање...</> : <><Sparkles className="w-4 h-4" /> Генерирај</>}
          </button>
        </div>
      </div>
    </div>
  );
}
