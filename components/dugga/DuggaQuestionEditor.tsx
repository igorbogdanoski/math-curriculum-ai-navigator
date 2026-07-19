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
import { normalizeTrueFalse } from '../../utils/duggaScoring';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Question type metadata ───────────────────────────────────────────────────
// Wave 15.1 (audit_2026_07_18_full_app_review, 2026-07-19): label/desc hold i18n
// KEYS, not literal text — consumers must call t(qt.label)/t(qt.desc). Kept as a
// static array (not a getQTypes(t) function) so existing importers of Q_TYPES/
// TEST_TYPES don't need restructuring, just an extra t() at the render site.
export const Q_TYPES: { id: DuggaQuestionType; label: string; icon: React.ReactNode; desc: string; aiSupported: boolean }[] = [
  { id: 'multiple_choice',  label: 'duggaQType.multiple_choice.label',  icon: <CheckSquare className="w-4 h-4"/>,  desc: 'duggaQType.multiple_choice.desc',  aiSupported: true },
  { id: 'checklist',        label: 'duggaQType.checklist.label',        icon: <List className="w-4 h-4"/>,          desc: 'duggaQType.checklist.desc',        aiSupported: true },
  { id: 'true_false',       label: 'duggaQType.true_false.label',       icon: <ToggleLeft className="w-4 h-4"/>,   desc: 'duggaQType.true_false.desc',       aiSupported: true },
  { id: 'fill_blanks',      label: 'duggaQType.fill_blanks.label',      icon: <AlignLeft className="w-4 h-4"/>,    desc: 'duggaQType.fill_blanks.desc',      aiSupported: true },
  { id: 'short_answer',     label: 'duggaQType.short_answer.label',     icon: <AlignLeft className="w-4 h-4"/>,    desc: 'duggaQType.short_answer.desc',     aiSupported: true },
  { id: 'essay',            label: 'duggaQType.essay.label',            icon: <AlignLeft className="w-4 h-4"/>,    desc: 'duggaQType.essay.desc',            aiSupported: true },
  { id: 'ordering',         label: 'duggaQType.ordering.label',         icon: <ArrowUpDown className="w-4 h-4"/>, desc: 'duggaQType.ordering.desc',         aiSupported: true },
  { id: 'multi_match',      label: 'duggaQType.multi_match.label',      icon: <Shuffle className="w-4 h-4"/>,       desc: 'duggaQType.multi_match.desc',      aiSupported: true },
  { id: 'statement_eval',   label: 'duggaQType.statement_eval.label',   icon: <CheckSquare className="w-4 h-4"/>,  desc: 'duggaQType.statement_eval.desc',   aiSupported: true },
  { id: 'table_completion', label: 'duggaQType.table_completion.label', icon: <Table2 className="w-4 h-4"/>,        desc: 'duggaQType.table_completion.desc', aiSupported: true },
  { id: 'list_items',       label: 'duggaQType.list_items.label',       icon: <List className="w-4 h-4"/>,          desc: 'duggaQType.list_items.desc',       aiSupported: false },
  { id: 'multi_part',       label: 'duggaQType.multi_part.label',       icon: <Layers className="w-4 h-4"/>,        desc: 'duggaQType.multi_part.desc',       aiSupported: false },
  { id: 'inline_select',    label: 'duggaQType.inline_select.label',    icon: <ChevronDown className="w-4 h-4"/>, desc: 'duggaQType.inline_select.desc',    aiSupported: false },
  { id: 'interactive_table',label: 'duggaQType.interactive_table.label',icon: <Table2 className="w-4 h-4"/>,        desc: 'duggaQType.interactive_table.desc',aiSupported: false },
  { id: 'diagram_annotate', label: 'duggaQType.diagram_annotate.label', icon: <Hash className="w-4 h-4"/>,          desc: 'duggaQType.diagram_annotate.desc', aiSupported: false },
  { id: 'feynman_explain',  label: 'duggaQType.feynman_explain.label',  icon: <AlignLeft className="w-4 h-4"/>,    desc: 'duggaQType.feynman_explain.desc',  aiSupported: false },
  { id: 'proof_critique',  label: 'duggaQType.proof_critique.label',    icon: <AlignLeft className="w-4 h-4"/>,    desc: 'duggaQType.proof_critique.desc',   aiSupported: false },
  { id: 'proof_steps',      label: 'duggaQType.proof_steps.label',      icon: <ArrowUpDown className="w-4 h-4"/>, desc: 'duggaQType.proof_steps.desc',      aiSupported: false },
  { id: 'geometry_construct', label: 'duggaQType.geometry_construct.label', icon: <Compass className="w-4 h-4"/>, desc: 'duggaQType.geometry_construct.desc', aiSupported: false },
  { id: 'function_match',   label: 'duggaQType.function_match.label',   icon: <Sigma className="w-4 h-4"/>,        desc: 'duggaQType.function_match.desc',   aiSupported: false },
  { id: 'unit_circle_pick', label: 'duggaQType.unit_circle_pick.label', icon: <ToggleLeft className="w-4 h-4"/>,   desc: 'duggaQType.unit_circle_pick.desc', aiSupported: false },
  { id: 'student_chart',   label: 'duggaQType.student_chart.label',     icon: <Table2 className="w-4 h-4"/>,        desc: 'duggaQType.student_chart.desc',    aiSupported: false },
  { id: 'section_header',  label: 'duggaQType.section_header.label',    icon: <Layers className="w-4 h-4"/>,        desc: 'duggaQType.section_header.desc',   aiSupported: false },
];

// Same convention as Q_TYPES: `label` holds an i18n key, not literal text.
export const TEST_TYPES: { id: DuggaTestType; label: string; emoji: string }[] = [
  { id: 'topic',   label: 'duggaTestType.topic.label',   emoji: '📌' },
  { id: 'midterm', label: 'duggaTestType.midterm.label', emoji: '📅' },
  { id: 'annual',  label: 'duggaTestType.annual.label',  emoji: '📆' },
  { id: 'exam',    label: 'duggaTestType.exam.label',    emoji: '🎓' },
  { id: 'custom',  label: 'duggaTestType.custom.label',  emoji: '⚙️' },
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
    // MK value, not English — matches the student-facing answer value in
    // DuggaQuestionCard.tsx (see utils/duggaScoring.ts's normalizeTrueFalse for why).
    base.correctAnswer = 'Точно';
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
  const { t } = useLanguage();

  const upd = (patch: Partial<DuggaQuestion>) => onChange({ ...q, ...patch });

  const qTypeMeta = Q_TYPES.find(qt => qt.id === q.type)!;

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
          <span>{t(qTypeMeta.label)}</span>
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
          title={t('duggaEditor.pointsTitle')}
        />
        <span className="text-xs text-gray-400">{t('duggaEditor.points')}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setUseMathInput(m => !m)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${useMathInput ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-100'}`}
            title={t('duggaEditor.mathLiveMode')}>
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
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.questionText')}</label>
            {useMathInput ? (
              <MathInput value={q.text} onChange={text => upd({ text })} placeholder={t('duggaEditor.mathExprPlaceholder')} />
            ) : (
              <textarea
                value={q.text}
                onChange={e => upd({ text: e.target.value })}
                placeholder={t('duggaEditor.questionTextPlaceholder')}
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
                {q.type === 'multiple_choice' ? t('duggaEditor.optionsChooseOne') : t('duggaEditor.optionsChooseAll')}
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
                      placeholder={`${t('duggaEditor.optionPlaceholder')} ${String.fromCharCode(65 + oi)}`}
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
                  <Plus className="w-3 h-3" /> {t('duggaEditor.addOption')}
                </button>
              </div>
            </div>
          )}

          {q.type === 'true_false' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">{t('duggaEditor.correctAnswer')}</label>
              <div className="flex gap-3">
                {/* Value stays MK ('Точно'/'Неточно') — matches the student-facing answer
                    value in DuggaQuestionCard.tsx, and is compared via normalizeTrueFalse()
                    in utils/duggaScoring.ts (which also still accepts legacy 'true'/'false'
                    values already stored on questions authored before this fix). Only the
                    displayed label is translated. */}
                {(['Точно', 'Неточно'] as const).map(v => (
                  <button type="button" key={v}
                    onClick={() => upd({ correctAnswer: v })}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      normalizeTrueFalse(q.correctAnswer ?? '') === normalizeTrueFalse(v) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {v === 'Точно' ? `✓ ${t('duggaQuestion.true')}` : `✗ ${t('duggaQuestion.false')}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q.type === 'statement_eval' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">{t('duggaEditor.correctAnswer')}</label>
              <div className="flex gap-2">
                {/* Values stay MK ('Точно'/'Неточно'/'Делумно точно') — compared literally
                    against the student's answer in duggaScoring.ts, which uses the same MK
                    values (see DuggaQuestionCard.tsx). Only the label is translated. */}
                {([
                  ['Точно', t('duggaQuestion.true')],
                  ['Неточно', t('duggaQuestion.false')],
                  ['Делумно точно', t('duggaQuestion.partiallyTrue')],
                ] as [string, string][]).map(([v, label]) => (
                  <button type="button" key={v}
                    onClick={() => upd({ correctAnswer: v })}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      q.correctAnswer === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(q.type === 'fill_blanks' || q.type === 'short_answer' || q.type === 'list_items') && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.correctAnswerKeywords')}</label>
              <input
                value={q.correctAnswer ?? ''}
                onChange={e => upd({ correctAnswer: e.target.value })}
                placeholder={t('duggaEditor.correctAnswerPlaceholder')}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
          )}

          {q.type === 'ordering' && q.orderItems && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">{t('duggaEditor.stepsInOrder')}</label>
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
                      placeholder={`${t('duggaEditor.stepPlaceholder')} ${ii + 1}`}
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
                  <Plus className="w-3 h-3" /> {t('duggaEditor.addStep')}
                </button>
              </div>
            </div>
          )}

          {q.type === 'multi_match' && q.matchPairs && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">{t('duggaEditor.matchPairs')}</label>
              <div className="space-y-2">
                {q.matchPairs.map((pair, pi) => (
                  <div key={pi} className="flex items-center gap-2">
                    <input value={pair.left} onChange={e => {
                      const pairs = q.matchPairs!.map((p, i) => i === pi ? { ...p, left: e.target.value } : p);
                      upd({ matchPairs: pairs });
                    }} placeholder={t('duggaEditor.left')} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <span className="text-gray-300">↔</span>
                    <input value={pair.right} onChange={e => {
                      const pairs = q.matchPairs!.map((p, i) => i === pi ? { ...p, right: e.target.value } : p);
                      upd({ matchPairs: pairs });
                    }} placeholder={t('duggaEditor.right')} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <button type="button" onClick={() => upd({ matchPairs: q.matchPairs!.filter((_, i) => i !== pi) })}
                      disabled={q.matchPairs!.length <= 2}
                      className="text-red-300 hover:text-red-500 disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => upd({ matchPairs: [...q.matchPairs!, { left: '', right: '' }] })}
                  className="text-xs text-violet-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> {t('duggaEditor.addPair')}
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
                  }} placeholder={`${t('duggaEditor.columnPlaceholder')} ${hi + 1}`} className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-300" />
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
                <Plus className="w-3 h-3" /> {t('duggaEditor.addRow')}
              </button>
            </div>
          )}

          {q.type === 'section_header' && (
            <p className="text-xs text-gray-400 italic">{t('duggaEditor.sectionHeaderNote')}</p>
          )}

          {q.type === 'essay' && (
            <p className="text-xs text-gray-400">{t('duggaEditor.essayNote')}</p>
          )}

          {q.type === 'feynman_explain' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.feynmanConceptLabel')}</label>
              <input
                type="text"
                value={q.feynmanConcept ?? ''}
                onChange={e => upd({ feynmanConcept: e.target.value })}
                placeholder={t('duggaEditor.feynmanConceptPlaceholder')}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              <p className="text-[10px] text-gray-400 mt-1">{t('duggaEditor.feynmanNote')}</p>
            </div>
          )}

          {q.type === 'proof_critique' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.proofCritiqueStepsLabel')}</label>
                <textarea
                  rows={5}
                  value={(q.proofCritiqueSteps ?? []).join('\n')}
                  onChange={e => upd({ proofCritiqueSteps: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) })}
                  placeholder={t('duggaEditor.proofCritiqueStepsPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-rose-400 resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  {t('duggaEditor.errorStepIndexLabel')}
                </label>
                <input
                  type="number" min={0}
                  max={Math.max(0, (q.proofCritiqueSteps?.length ?? 1) - 1)}
                  title={t('duggaEditor.errorStepIndexTitle')}
                  value={q.proofCritiqueErrorStep ?? 0}
                  onChange={e => {
                    const max = Math.max(0, (q.proofCritiqueSteps?.length ?? 1) - 1);
                    upd({ proofCritiqueErrorStep: Math.min(parseInt(e.target.value) || 0, max) });
                  }}
                  className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
                <span className="text-[10px] text-gray-400 ml-2">
                  ({t('duggaEditor.totalSteps')} {q.proofCritiqueSteps?.length ?? 0})
                </span>
              </div>
              <p className="text-[10px] text-gray-400">{t('duggaEditor.proofCritiqueNote')}</p>
            </div>
          )}

          {q.type === 'proof_steps' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.proofStepsOrderLabel')}</label>
                <textarea
                  rows={4}
                  value={(q.expectedProof?.steps ?? []).map(s => s.text).join('\n')}
                  onChange={e => {
                    const steps = e.target.value.split('\n').map((text: string) => text.trim()).filter(Boolean)
                      .map(text => ({ id: newOptId(), text }));
                    upd({ expectedProof: { ...(q.expectedProof ?? { steps: [] }), steps } });
                  }}
                  placeholder={t('duggaEditor.proofStepsPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.distractorsLabel')}</label>
                <textarea
                  rows={2}
                  value={(q.expectedProof?.distractors ?? []).map(s => s.text).join('\n')}
                  onChange={e => {
                    const distractors = e.target.value.split('\n').map((text: string) => text.trim()).filter(Boolean)
                      .map(text => ({ id: newOptId(), text }));
                    upd({ expectedProof: { steps: q.expectedProof?.steps ?? [], ...q.expectedProof, distractors } });
                  }}
                  placeholder={t('duggaEditor.distractorsPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y"
                />
              </div>
              <p className="text-[10px] text-gray-400">{t('duggaEditor.proofStepsNote')}</p>
            </div>
          )}

          {q.type === 'geometry_construct' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.constructionDescLabel')}</label>
                <textarea
                  rows={3}
                  value={q.expectedConstruction?.description ?? ''}
                  onChange={e => upd({ expectedConstruction: { ...(q.expectedConstruction ?? { description: '' }), description: e.target.value } })}
                  placeholder={t('duggaEditor.constructionDescPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.rubricLabel')}</label>
                <textarea
                  rows={2}
                  value={q.expectedConstruction?.rubric ?? ''}
                  onChange={e => upd({ expectedConstruction: { description: q.expectedConstruction?.description ?? '', ...q.expectedConstruction, rubric: e.target.value } })}
                  placeholder={t('duggaEditor.rubricPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y"
                />
              </div>
              <p className="text-[10px] text-gray-400">{t('duggaEditor.geometryNote')}</p>
            </div>
          )}

          {q.type === 'function_match' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.baseFunctionLabel')}</label>
                <select
                  title={t('duggaEditor.baseFunctionLabel')}
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
                  {t('duggaEditor.targetLabel')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['a', 'b', 'c', 'd'] as const).map(k => (
                    <div key={k}>
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{k}</label>
                      <input
                        type="number" step={0.1}
                        title={`${t('duggaEditor.targetValueTitle')} ${k}`}
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
              <p className="text-[10px] text-gray-400">{t('duggaEditor.functionMatchNote')}</p>
            </div>
          )}

          {q.type === 'unit_circle_pick' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.targetAngle')}</label>
                  <input
                    type="number" step={1}
                    title={t('duggaEditor.targetAngle')}
                    value={q.expectedUnitCircle?.angle ?? 0}
                    onChange={e => upd({ expectedUnitCircle: { ...(q.expectedUnitCircle ?? { angle: 0, unit: 'deg' }), angle: Number(e.target.value) } })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.unit')}</label>
                  <select
                    title={t('duggaEditor.unit')}
                    value={q.expectedUnitCircle?.unit ?? 'deg'}
                    onChange={e => upd({ expectedUnitCircle: { ...(q.expectedUnitCircle ?? { angle: 0, unit: 'deg' }), unit: e.target.value as 'deg' | 'rad' } })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="deg">{t('duggaEditor.degrees')}</option>
                    <option value="rad">{t('duggaEditor.radians')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.whatIsChecked')}</label>
                <select
                  title={t('duggaEditor.whatIsChecked')}
                  value={q.expectedUnitCircle?.match ?? 'either'}
                  onChange={e => upd({ expectedUnitCircle: { ...(q.expectedUnitCircle ?? { angle: 0, unit: 'deg' }), match: e.target.value as 'angle' | 'point' | 'either' } })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="either">{t('duggaEditor.matchEither')}</option>
                  <option value="angle">{t('duggaEditor.matchAngleOnly')}</option>
                  <option value="point">{t('duggaEditor.matchPointOnly')}</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-400">{t('duggaEditor.unitCircleNote')}</p>
            </div>
          )}

          {q.type === 'student_chart' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.chartType')}</label>
                <select
                  title={t('duggaEditor.chartType')}
                  value={q.expectedChart?.kind ?? 'bar'}
                  onChange={e => upd({ expectedChart: { ...(q.expectedChart ?? { data: [] }), kind: e.target.value as 'bar' | 'line' | 'scatter' | 'pie' } })}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="bar">{t('duggaEditor.chartBar')}</option>
                  <option value="line">{t('duggaEditor.chartLine')}</option>
                  <option value="scatter">{t('duggaEditor.chartScatter')}</option>
                  <option value="pie">{t('duggaEditor.chartPie')}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={q.expectedChart?.xLabel ?? ''}
                  onChange={e => upd({ expectedChart: { ...(q.expectedChart ?? { kind: 'bar', data: [] }), xLabel: e.target.value } })}
                  placeholder={t('duggaEditor.xAxisLabel')} className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                <input type="text" value={q.expectedChart?.yLabel ?? ''}
                  onChange={e => upd({ expectedChart: { ...(q.expectedChart ?? { kind: 'bar', data: [] }), yLabel: e.target.value } })}
                  placeholder={t('duggaEditor.yAxisLabel')} className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaEditor.correctPairsLabel')}</label>
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
                  placeholder={t('duggaEditor.chartDataPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
                />
              </div>
              <p className="text-[10px] text-gray-400">{t('duggaEditor.chartNote')}</p>
            </div>
          )}

          {/* Solution / Hint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-50">
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">{t('duggaEditor.solutionForTeacher')}</label>
              <textarea value={q.solution ?? ''} onChange={e => upd({ solution: e.target.value })}
                placeholder={t('duggaEditor.solutionPlaceholder')} rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">{t('duggaEditor.hintForStudent')}</label>
              <textarea value={q.hint ?? ''} onChange={e => upd({ hint: e.target.value })}
                placeholder={t('duggaEditor.hintPlaceholder')} rows={2}
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
  const { t } = useLanguage();

  const handleGenerate = async () => {
    if (!topics.trim()) { setError(t('duggaAiGen.needTopics')); return; }
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
        setError(t('duggaAiGen.emptyJsonError'));
      } else if (msg.includes('quota') || msg.includes('429')) {
        setError(t('duggaAiGen.quotaError'));
      } else {
        setError(t('duggaAiGen.genericError'));
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
            <h3 className="font-bold text-gray-900">{t('duggaAiGen.header')}</h3>
            <p className="text-xs text-gray-400">{t('duggaAiGen.headerDesc')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('duggaAiGen.grade')}</label>
            <select value={grade} onChange={e => setGrade(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}{t('duggaAiGen.gradeSuffix')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('duggaAiGen.testType')}</label>
            <select value={testType} onChange={e => setTestType(e.target.value as DuggaTestType)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
              {TEST_TYPES.map(tt => <option key={tt.id} value={tt.id}>{tt.emoji} {t(tt.label)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('duggaAiGen.topicsLabel')}</label>
          <input value={topics} onChange={e => setTopics(e.target.value)}
            placeholder={t('duggaAiGen.topicsPlaceholder')}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('duggaAiGen.questionCountLabel')} {count}</label>
          <input type="range" min={4} max={30} value={count} onChange={e => setCount(Number(e.target.value))}
            className="w-full accent-violet-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>4</span><span>30</span></div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">{t('duggaAiGen.dokDistribution')}</label>
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
            <span className="text-xs font-semibold text-gray-500">{t('duggaAiGen.advancedParams')}</span>
            <span className="text-gray-400 text-xs">{showAdvanced ? '▲' : '▼'}</span>
          </button>
          {showAdvanced && (
            <div className="px-4 pb-4 pt-3 space-y-4 bg-white">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  {t('duggaAiGen.temperatureLabel')} <span className="text-violet-600 font-bold">{temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range" min={0} max={2} step={0.1}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>{t('duggaAiGen.tempStrict')}</span>
                  <span>{t('duggaAiGen.tempBalanced')}</span>
                  <span>{t('duggaAiGen.tempCreative')}</span>
                </div>
                {temperature > 1.2 && (
                  <p className="text-[10px] text-amber-600 mt-1">{t('duggaAiGen.highTempWarning')}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('duggaAiGen.depthLabel')}</label>
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
                      {d === 'brief' ? t('duggaAiGen.depthBrief') : d === 'standard' ? t('duggaAiGen.depthStandard') : t('duggaAiGen.depthDeep')}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {depth === 'brief' ? t('duggaAiGen.depthBriefNote') : depth === 'deep' ? t('duggaAiGen.depthDeepNote') : t('duggaAiGen.depthStandardNote')}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            {t('duggaAiGen.cancel')}
          </button>
          <button type="button" onClick={handleGenerate} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('duggaAiGen.generating')}</> : <><Sparkles className="w-4 h-4" /> {t('duggaAiGen.generate')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
