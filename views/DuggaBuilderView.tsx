import React, { useState, useCallback, useRef } from 'react';
import {
  ClipboardList, Plus, Trash2, ChevronDown, ChevronUp, Sparkles,
  Eye, EyeOff, Copy, Share2, Loader2, Check, GripVertical,
  CheckSquare, AlignLeft, List, ToggleLeft, Table2, Shuffle,
  ArrowUpDown, Layers, Hash, Save, BookOpen, Zap, Settings,
} from 'lucide-react';
import { MathInput } from '../components/common/MathInput';
import { MathRenderer } from '../components/common/MathRenderer';
import { duggaAPI } from '../services/gemini/dugga';
import { createDuggaTest, updateDuggaTest } from '../services/firestoreService.dugga';
import type {
  DuggaQuestion, DuggaQuestionType, DuggaTestType,
  DuggaOption, DuggaDok,
} from '../services/firestoreService.dugga';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// â”€â”€â”€ Question type metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Q_TYPES: { id: DuggaQuestionType; label: string; icon: React.ReactNode; desc: string; aiSupported: boolean }[] = [
  { id: 'multiple_choice',  label: 'ÐŸÐ¾Ð²ÐµÑœÐµ Ð¸Ð·Ð±Ð¾Ñ€ (1 Ñ‚Ð¾Ñ‡ÐµÐ½)',    icon: <CheckSquare className="w-4 h-4"/>,  desc: 'ÐšÐ»Ð°ÑÐ¸Ñ‡ÐµÐ½ MC ÑÐ¾ 4 Ð¾Ð¿Ñ†Ð¸Ð¸',                    aiSupported: true },
  { id: 'checklist',        label: 'ÐŸÐ¾Ð²ÐµÑœÐµ Ñ‚Ð¾Ñ‡Ð½Ð¸ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€Ð¸',     icon: <List className="w-4 h-4"/>,          desc: 'Ð•Ð´ÐµÐ½ Ð¸Ð»Ð¸ Ð¿Ð¾Ð²ÐµÑœÐµ Ñ‚Ð¾Ñ‡Ð½Ð¸',                     aiSupported: true },
  { id: 'true_false',       label: 'Ð¢Ð¾Ñ‡Ð½Ð¾ / ÐÐµÑ‚Ð¾Ñ‡Ð½Ð¾',           icon: <ToggleLeft className="w-4 h-4"/>,   desc: 'Ð¢Ð²Ñ€Ð´ÐµÑšÐµ T/F',                               aiSupported: true },
  { id: 'fill_blanks',      label: 'ÐŸÐ¾Ð¿Ð¾Ð»Ð½Ð¸ Ð¿Ñ€Ð°Ð·Ð½Ð¸Ð½Ð¸',          icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Ð Ð°Ð²ÐµÐ½ÐºÐ¸ ÑÐ¾ Ð¿Ñ€Ð°Ð·Ð½Ð¸ Ð¼ÐµÑÑ‚Ð°',                   aiSupported: true },
  { id: 'short_answer',     label: 'ÐšÑ€Ð°Ñ‚Ð¾Ðº Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€',            icon: <AlignLeft className="w-4 h-4"/>,    desc: 'Ð¢ÐµÐºÑÑ‚ Ð¸Ð»Ð¸ Ð¼Ð°Ñ‚. Ð¸Ð·Ñ€Ð°Ð·',                      aiSupported: true },
  { id: 'essay',            label: 'Ð•ÑÐµÑ˜ / Ð”Ð¾ÐºÐ°Ð¶',              icon: <AlignLeft className="w-4 h-4"/>,    desc: 'ÐŸÑ€Ð¾ÑˆÐ¸Ñ€ÐµÐ½ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€, AI Ð³Ñ€Ð°Ð´Ð¸Ñ€Ð°ÑšÐµ',             aiSupported: true },
  { id: 'ordering',         label: 'Ð ÐµÐ´Ð¾ÑÐ»ÐµÐ´ Ð½Ð° Ñ‡ÐµÐºÐ¾Ñ€Ð¸',        icon: <ArrowUpDown className="w-4 h-4"/>, desc: 'ÐŸÐ¾ÑÑ‚Ð°Ð²Ð¸ Ð´Ð¾ÐºÐ°Ð¶ÑƒÐ²Ð°ÑšÐµ Ð²Ð¾ Ñ€ÐµÐ´',                 aiSupported: true },
  { id: 'multi_match',      label: 'ÐŸÐ¾Ð²Ñ€Ð·ÑƒÐ²Ð°ÑšÐµ (match)',        icon: <Shuffle className="w-4 h-4"/>,       desc: 'ÐŸÐ¾Ð¸Ð¼Ð¸ â†” Ð´ÐµÑ„Ð¸Ð½Ð¸Ñ†Ð¸Ð¸',                         aiSupported: true },
  { id: 'statement_eval',   label: 'ÐžÑ†ÐµÐ½Ð¸ Ñ‚Ð²Ñ€Ð´ÐµÑšÐµ',             icon: <CheckSquare className="w-4 h-4"/>,  desc: 'Ð¢Ð¾Ñ‡Ð½Ð¾ / ÐÐµÑ‚Ð¾Ñ‡Ð½Ð¾ / Ð”ÐµÐ»ÑƒÐ¼Ð½Ð¾',                 aiSupported: true },
  { id: 'table_completion', label: 'ÐŸÐ¾Ð¿Ð¾Ð»Ð½Ð¸ Ñ‚Ð°Ð±ÐµÐ»Ð°',            icon: <Table2 className="w-4 h-4"/>,        desc: 'Ð¤ÑƒÐ½ÐºÑ†Ð¸ÑÐºÐ° Ñ‚Ð°Ð±ÐµÐ»Ð° xâ†’f(x)',                   aiSupported: true },
  { id: 'list_items',       label: 'Ð›Ð¸ÑÑ‚Ð°',                     icon: <List className="w-4 h-4"/>,          desc: 'ÐÐ°Ð±Ñ€Ð¾Ñ˜ (Ñ„Ð°ÐºÑ‚Ð¾Ñ€Ð¸Ð·Ð°Ñ†Ð¸Ñ˜Ð°, ÐºÐ¾Ñ€ÐµÐ½Ð¸â€¦)',            aiSupported: false },
  { id: 'multi_part',       label: 'ÐŸÐ¾Ð²ÐµÑœÐµÐ´ÐµÐ»Ð½Ð¾',               icon: <Layers className="w-4 h-4"/>,        desc: 'ÐŸÐ¾Ð´-Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ° 1.1, 1.2, 1.3',                aiSupported: false },
  { id: 'inline_select',    label: 'Ð’Ð³Ñ€Ð°Ð´ÐµÐ½ Ð¸Ð·Ð±Ð¾Ñ€',             icon: <ChevronDown className="w-4 h-4"/>, desc: 'Dropdown Ð²Ð¾ Ñ€ÐµÑ‡ÐµÐ½Ð¸Ñ†Ð°',                       aiSupported: false },
  { id: 'interactive_table',label: 'Ð˜Ð½Ñ‚ÐµÑ€Ð°ÐºÑ‚Ð¸Ð²Ð½Ð° Ñ‚Ð°Ð±ÐµÐ»Ð°',       icon: <Table2 className="w-4 h-4"/>,        desc: 'Cell checkboxes (Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ð° Ð½Ð° Ð²Ð¸ÑÑ‚Ð¸Ð½Ð°)',       aiSupported: false },
  { id: 'diagram_annotate', label: 'ÐžÐ·Ð½Ð°Ñ‡Ð¸ Ð´Ð¸Ñ˜Ð°Ð³Ñ€Ð°Ð¼',           icon: <Hash className="w-4 h-4"/>,          desc: 'Ð¡Ð»Ð¸ÐºÐ° + label-Ð¸',                           aiSupported: false },
  { id: 'section_header',   label: 'Ð”ÐµÐ» / Ð¡ÐµÐºÑ†Ð¸Ñ˜Ð°',             icon: <Layers className="w-4 h-4"/>,        desc: 'Ð¡Ñ‚Ñ€ÑƒÐºÑ‚ÑƒÑ€Ð°Ð»ÐµÐ½ (Ð”ÐµÐ» Ð, Ð”ÐµÐ» Ð‘)',               aiSupported: false },
];

const TEST_TYPES: { id: DuggaTestType; label: string; emoji: string }[] = [
  { id: 'topic',   label: 'Ð¢ÐµÐ¼Ð°Ñ‚ÑÐºÐ¸ Ñ‚ÐµÑÑ‚',      emoji: 'ðŸ“Œ' },
  { id: 'midterm', label: 'ÐŸÐ¾Ð»ÑƒÐ³Ð¾Ð´Ð¸ÑˆÐµÐ½ Ñ‚ÐµÑÑ‚',   emoji: 'ðŸ“…' },
  { id: 'annual',  label: 'Ð“Ð¾Ð´Ð¸ÑˆÐµÐ½ Ñ‚ÐµÑÑ‚',        emoji: 'ðŸ“†' },
  { id: 'exam',    label: 'Ð—Ð°Ð²Ñ€ÑˆÐµÐ½ Ð¸ÑÐ¿Ð¸Ñ‚',       emoji: 'ðŸŽ“' },
  { id: 'custom',  label: 'ÐŸÑ€Ð¸Ð»Ð°Ð³Ð¾Ð´ÐµÐ½',          emoji: 'âš™ï¸' },
];

const DOK_COLORS: Record<DuggaDok, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-red-100 text-red-700',
};

let _qid = 1;
function newQId() { return `q-${Date.now()}-${_qid++}`; }
function newOptId() { return `o-${Date.now()}-${_qid++}`; }

function makeBlankQuestion(type: DuggaQuestionType = 'multiple_choice'): DuggaQuestion {
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
  return base;
}

// â”€â”€â”€ Question editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function QuestionEditor({
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
          title="ÐŸÐ¾ÐµÐ½Ð¸"
        />
        <span className="text-xs text-gray-400">Ð¿Ð¾ÐµÐ½Ð¸</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setUseMathInput(m => !m)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${useMathInput ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-100'}`}
            title="MathLive Ñ€ÐµÐ¶Ð¸Ð¼">
            Î£
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
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Ð¢ÐµÐºÑÑ‚ Ð½Ð° Ð¿Ñ€Ð°ÑˆÐ°ÑšÐµÑ‚Ð¾</label>
            {useMathInput ? (
              <MathInput value={q.text} onChange={text => upd({ text })} placeholder="Ð’Ð½ÐµÑÐ¸ Ð¼Ð°Ñ‚ÐµÐ¼Ð°Ñ‚Ð¸Ñ‡ÐºÐ¸ Ð¸Ð·Ñ€Ð°Ð·..." />
            ) : (
              <textarea
                value={q.text}
                onChange={e => upd({ text: e.target.value })}
                placeholder="Ð’Ð½ÐµÑÐ¸ Ð³Ð¾ Ð¿Ñ€Ð°ÑˆÐ°ÑšÐµÑ‚Ð¾... (LaTeX: $x^2 + 1$)"
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
                ÐžÐ¿Ñ†Ð¸Ð¸ {q.type === 'multiple_choice' ? '(Ð¸Ð·Ð±ÐµÑ€Ð¸ 1 Ñ‚Ð¾Ñ‡ÐµÐ½)' : '(Ð¸Ð·Ð±ÐµÑ€Ð¸ ÑÐ¸Ñ‚Ðµ Ñ‚Ð¾Ñ‡Ð½Ð¸)'}
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
                      placeholder={`ÐžÐ¿Ñ†Ð¸Ñ˜Ð° ${String.fromCharCode(65 + oi)}`}
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
                  <Plus className="w-3 h-3" /> Ð”Ð¾Ð´Ð°Ñ˜ Ð¾Ð¿Ñ†Ð¸Ñ˜Ð°
                </button>
              </div>
            </div>
          )}

          {q.type === 'true_false' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Ð¢Ð¾Ñ‡ÐµÐ½ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€</label>
              <div className="flex gap-3">
                {(['true', 'false'] as const).map(v => (
                  <button type="button" key={v}
                    onClick={() => upd({ correctAnswer: v })}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      q.correctAnswer === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {v === 'true' ? 'âœ“ Ð¢Ð¾Ñ‡Ð½Ð¾' : 'âœ— ÐÐµÑ‚Ð¾Ñ‡Ð½Ð¾'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q.type === 'statement_eval' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Ð¢Ð¾Ñ‡ÐµÐ½ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€</label>
              <div className="flex gap-2">
                {['Ð¢Ð¾Ñ‡Ð½Ð¾', 'ÐÐµÑ‚Ð¾Ñ‡Ð½Ð¾', 'Ð”ÐµÐ»ÑƒÐ¼Ð½Ð¾ Ñ‚Ð¾Ñ‡Ð½Ð¾'].map(v => (
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
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Ð¢Ð¾Ñ‡ÐµÐ½ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€ / ÐšÐ»ÑƒÑ‡Ð½Ð¸ Ð·Ð±Ð¾Ñ€Ð¾Ð²Ð¸</label>
              <input
                value={q.correctAnswer ?? ''}
                onChange={e => upd({ correctAnswer: e.target.value })}
                placeholder="Ð’Ð½ÐµÑÐ¸ Ñ‚Ð¾Ñ‡Ð½Ð¸Ð¾Ñ‚ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
          )}

          {q.type === 'ordering' && q.orderItems && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Ð§ÐµÐºÐ¾Ñ€Ð¸ Ð¿Ð¾ Ñ‚Ð¾Ñ‡ÐµÐ½ Ñ€ÐµÐ´Ð¾ÑÐ»ÐµÐ´</label>
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
                      placeholder={`Ð§ÐµÐºÐ¾Ñ€ ${ii + 1}`}
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
                  <Plus className="w-3 h-3" /> Ð”Ð¾Ð´Ð°Ñ˜ Ñ‡ÐµÐºÐ¾Ñ€
                </button>
              </div>
            </div>
          )}

          {q.type === 'multi_match' && q.matchPairs && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">ÐŸÐ°Ñ€Ð¾Ð²Ð¸ Ð·Ð° Ð¿Ð¾Ð²Ñ€Ð·ÑƒÐ²Ð°ÑšÐµ</label>
              <div className="space-y-2">
                {q.matchPairs.map((pair, pi) => (
                  <div key={pi} className="flex items-center gap-2">
                    <input value={pair.left} onChange={e => {
                      const pairs = q.matchPairs!.map((p, i) => i === pi ? { ...p, left: e.target.value } : p);
                      upd({ matchPairs: pairs });
                    }} placeholder="Ð›ÐµÐ²Ð¾" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <span className="text-gray-300">â†”</span>
                    <input value={pair.right} onChange={e => {
                      const pairs = q.matchPairs!.map((p, i) => i === pi ? { ...p, right: e.target.value } : p);
                      upd({ matchPairs: pairs });
                    }} placeholder="Ð”ÐµÑÐ½Ð¾" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <button type="button" onClick={() => upd({ matchPairs: q.matchPairs!.filter((_, i) => i !== pi) })}
                      disabled={q.matchPairs!.length <= 2}
                      className="text-red-300 hover:text-red-500 disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => upd({ matchPairs: [...q.matchPairs!, { left: '', right: '' }] })}
                  className="text-xs text-violet-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Ð”Ð¾Ð´Ð°Ñ˜ Ð¿Ð°Ñ€
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
                  }} placeholder={`ÐšÐ¾Ð»Ð¾Ð½Ð° ${hi + 1}`} className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-300" />
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
                <Plus className="w-3 h-3" /> Ð”Ð¾Ð´Ð°Ñ˜ Ñ€ÐµÐ´
              </button>
            </div>
          )}

          {q.type === 'section_header' && (
            <p className="text-xs text-gray-400 italic">Ð¡ÐµÐºÑ†Ð¸ÑÐºÐ¸Ð¾Ñ‚ Ð½Ð°ÑÐ»Ð¾Ð² ÑœÐµ ÑÐµ Ð¿Ñ€Ð¸ÐºÐ°Ð¶Ðµ bold Ð²Ð¾ Ñ‚ÐµÑÑ‚Ð¾Ñ‚.</p>
          )}

          {q.type === 'essay' && (
            <p className="text-xs text-gray-400">Ð•ÑÐµÑ˜ Ð¾Ð´Ð³Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ ÑœÐµ Ð³Ð¾ Ð³Ñ€Ð°Ð´Ð¸ AI Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚ÑÐºÐ¸ Ð¿Ð¾ Rubric (Ð´ÐµÑ„Ð¸Ð½Ð¸Ñ€Ð°Ñ˜ Ñ˜Ð° Ð²Ð¾ Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ).</p>
          )}

          {/* Solution / Hint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-50">
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">Ð ÐµÑˆÐµÐ½Ð¸Ðµ (Ð·Ð° Ð½Ð°ÑÑ‚Ð°Ð²Ð½Ð¸Ðº)</label>
              <textarea value={q.solution ?? ''} onChange={e => upd({ solution: e.target.value })}
                placeholder="Ð§ÐµÐºÐ¾Ñ€-Ð¿Ð¾-Ñ‡ÐµÐºÐ¾Ñ€ Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ..." rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">Hint (Ð·Ð° ÑƒÑ‡ÐµÐ½Ð¸Ðº)</label>
              <textarea value={q.hint ?? ''} onChange={e => upd({ hint: e.target.value })}
                placeholder="ÐÐ°ÑÐ¾ÐºÐ° Ð·Ð° ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ¾Ñ‚..." rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ AI Generation Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AIGenerateModal({
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

  const handleGenerate = async () => {
    if (!topics.trim()) { setError('Ð’Ð½ÐµÑÐ¸ Ñ‚ÐµÐ¼Ð°(Ð¸).'); return; }
    setLoading(true); setError('');
    try {
      const raw = await duggaAPI.generateTestQuestions({
        grade, subject: 'ÐœÐ°Ñ‚ÐµÐ¼Ð°Ñ‚Ð¸ÐºÐ°',
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        testType, totalQuestions: count,
        dokDistribution: { 1: dokDist[1], 2: dokDist[2], 3: dokDist[3], 4: dokDist[4] },
      });
      const cleanJSON = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed: Array<{
        type?: string; dok?: number; points?: number; text?: string;
        options?: string[]; correctAnswer?: string; solution?: string; hint?: string;
      }> = JSON.parse(cleanJSON);

      const questions: DuggaQuestion[] = parsed.map(p => {
        const q = makeBlankQuestion((p.type as DuggaQuestionType) ?? 'multiple_choice');
        q.text = p.text ?? '';
        q.dok = (p.dok as DuggaDok) ?? 2;
        q.points = p.points ?? 1;
        q.solution = p.solution ?? '';
        q.hint = p.hint ?? '';
        q.correctAnswer = p.correctAnswer ?? '';
        if ((q.type === 'multiple_choice' || q.type === 'checklist') && p.options?.length) {
          q.options = p.options.map((opt, i) => ({
            id: newOptId(),
            text: opt.replace(/^[A-D]\)\s*/, ''),
            isCorrect: i === 0 && !!p.correctAnswer && (opt.startsWith(p.correctAnswer[0]) || p.correctAnswer.toLowerCase().includes(opt.toLowerCase().slice(0, 4))),
          }));
          const correctLetter = (p.correctAnswer ?? 'A')[0].toUpperCase();
          q.options = q.options!.map((o, i) => ({
            ...o,
            isCorrect: String.fromCharCode(65 + i) === correctLetter,
          }));
        }
        return q;
      });

      onGenerated(questions);
      onClose();
    } catch {
      setError('ÐÐµÑƒÑÐ¿ÐµÑˆÐ½Ð¾ Ð³ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°ÑšÐµ. ÐŸÑ€Ð¾Ð²ÐµÑ€Ð¸ Ñ˜Ð° JSON ÑÑ‚Ñ€ÑƒÐºÑ‚ÑƒÑ€Ð°Ñ‚Ð° Ð¸ Ð¾Ð±Ð¸Ð´Ð¸ ÑÐµ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾.');
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
            <h3 className="font-bold text-gray-900">AI Ð“ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°ÑšÐµ Ð½Ð° Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ°</h3>
            <p className="text-xs text-gray-400">Gemini AI Ð³Ð¸ Ð³ÐµÐ½ÐµÑ€Ð¸Ñ€Ð° Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ°Ñ‚Ð° Ð²Ñ€Ð· Ð¾ÑÐ½Ð¾Ð²Ð° Ð½Ð° MK Ð¿Ñ€Ð¾Ð³Ñ€Ð°Ð¼Ð°Ñ‚Ð°</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Ð Ð°Ð·Ñ€ÐµÐ´</label>
            <select value={grade} onChange={e => setGrade(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}. Ñ€Ð°Ð·Ñ€ÐµÐ´</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Ð¢Ð¸Ð¿ Ð½Ð° Ñ‚ÐµÑÑ‚</label>
            <select value={testType} onChange={e => setTestType(e.target.value as DuggaTestType)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
              {TEST_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Ð¢ÐµÐ¼Ð¸ (Ñ€Ð°Ð·Ð´ÐµÐ»ÐµÐ½Ð¸ ÑÐ¾ Ð·Ð°Ð¿Ð¸Ñ€ÐºÐ°)</label>
          <input value={topics} onChange={e => setTopics(e.target.value)}
            placeholder="Ð¿Ñ€. ÐšÐ²Ð°Ð´Ñ€Ð°Ñ‚Ð½Ð¸ Ñ€Ð°Ð²ÐµÐ½ÐºÐ¸, Ð¤ÑƒÐ½ÐºÑ†Ð¸Ð¸, Ð¢Ñ€Ð¸Ð³Ð¾Ð½Ð¾Ð¼ÐµÑ‚Ñ€Ð¸Ñ˜Ð°"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Ð‘Ñ€Ð¾Ñ˜ Ð½Ð° Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ°: {count}</label>
          <input type="range" min={4} max={30} value={count} onChange={e => setCount(Number(e.target.value))}
            className="w-full accent-violet-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>4</span><span>30</span></div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">DoK Ñ€Ð°ÑÐ¿Ñ€ÐµÐ´ÐµÐ»Ð±Ð°</label>
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

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            ÐžÑ‚ÐºÐ°Ð¶Ð¸
          </button>
          <button type="button" onClick={handleGenerate} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Ð“ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°ÑšÐµ...</> : <><Sparkles className="w-4 h-4" /> Ð“ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°Ñ˜</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function DuggaBuilderView() {
  const { user, firebaseUser } = useAuth();
  const { addNotification } = useNotification();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState(8);
  const [testType, setTestType] = useState<DuggaTestType>('topic');
  const [questions, setQuestions] = useState<DuggaQuestion[]>([makeBlankQuestion()]);
  const [isPublic, setIsPublic] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState('');
  const [savedCode, setSavedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const estimatedMinutes = Math.max(5, Math.round(totalPoints * 1.5));

  const updateQuestion = useCallback((idx: number, updated: DuggaQuestion) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? updated : q));
  }, []);

  const deleteQuestion = useCallback((idx: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  }, []);

  const moveQuestion = useCallback((idx: number, dir: 'up' | 'down') => {
    setQuestions(qs => {
      const arr = [...qs];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }, []);

  const addQuestion = (type: DuggaQuestionType) => {
    setQuestions(qs => [...qs, makeBlankQuestion(type)]);
  };

  const handleAIGenerated = (newQs: DuggaQuestion[]) => {
    setQuestions(qs => [...qs.filter(q => q.text.trim() !== ''), ...newQs]);
    addNotification(`${newQs.length} Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ° Ð³ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°Ð½Ð¸!`, 'success');
  };

  const handleSave = async () => {
    if (!title.trim()) { addNotification('Ð’Ð½ÐµÑÐ¸ Ð½Ð°ÑÐ»Ð¾Ð² Ð½Ð° Ñ‚ÐµÑÑ‚Ð¾Ñ‚.', 'error'); return; }
    if (!firebaseUser?.uid) { addNotification('ÐœÐ¾Ñ€Ð° Ð´Ð° ÑÐ¸ Ð½Ð°Ñ˜Ð°Ð²ÐµÐ½.', 'error'); return; }
    setSaving(true);
    try {
      const testData = {
        title: title.trim(),
        description: description.trim(),
        teacherUid: firebaseUser.uid,
        teacherName: user?.name ?? 'ÐÐ°ÑÑ‚Ð°Ð²Ð½Ð¸Ðº',
        grade, track: user?.secondaryTrack ?? 'primary',
        topics: [], testType, questions,
        isPublic, totalPoints,
        estimatedMinutes,
      };
      if (savedId) {
        await updateDuggaTest(savedId, testData);
        addNotification('Ð¢ÐµÑÑ‚Ð¾Ñ‚ Ðµ Ð·Ð°Ñ‡ÑƒÐ²Ð°Ð½!', 'success');
      } else {
        const id = await createDuggaTest(testData);
        setSavedId(id);
        const { getDuggaTest } = await import('../services/firestoreService.dugga');
        const saved = await getDuggaTest(id);
        if (saved) setSavedCode(saved.shareCode);
        addNotification('Ð¢ÐµÑÑ‚Ð¾Ñ‚ Ðµ Ð·Ð°Ñ‡ÑƒÐ²Ð°Ð½!', 'success');
      }
    } catch {
      addNotification('Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð·Ð°Ñ‡ÑƒÐ²ÑƒÐ²Ð°ÑšÐµ.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(savedCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Ð”Ð¸Ð³Ð° â€” Ð“Ñ€Ð°Ð´Ð¸Ñ‚ÐµÐ» Ð½Ð° Ñ‚ÐµÑÑ‚Ð¾Ð²Ð¸</h1>
            <p className="text-xs text-gray-400">{questions.length} Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ° Â· {totalPoints} Ð¿Ð¾ÐµÐ½Ð¸ Â· ~{estimatedMinutes} Ð¼Ð¸Ð½</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowPreview(p => !p)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Ð£Ñ€ÐµÐ´Ð¸' : 'ÐŸÑ€ÐµÐ³Ð»ÐµÐ´'}
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Ð—Ð°Ñ‡ÑƒÐ²Ð°Ñ˜
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Share code banner */}
        {savedCode && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-4">
            <Share2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Ð¢ÐµÑÑ‚Ð¾Ñ‚ Ðµ Ð·Ð°Ñ‡ÑƒÐ²Ð°Ð½! ÐšÐ¾Ð´ Ð·Ð° ÑƒÑ‡ÐµÐ½Ð¸Ñ†Ð¸:</p>
              <p className="text-2xl font-black text-emerald-700 tracking-widest mt-0.5">{savedCode}</p>
            </div>
            <button type="button" onClick={copyCode} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors">
              {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {codeCopied ? 'ÐšÐ¾Ð¿Ð¸Ñ€Ð°Ð½Ð¾' : 'ÐšÐ¾Ð¿Ð¸Ñ€Ð°Ñ˜'}
            </button>
          </div>
        )}

        {/* Test metadata */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">ÐÐ°ÑÐ»Ð¾Ð² Ð½Ð° Ñ‚ÐµÑÑ‚Ð¾Ñ‚</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ð¿Ñ€. Ð¢ÐµÑÑ‚ â€” ÐšÐ²Ð°Ð´Ñ€Ð°Ñ‚Ð½Ð¸ Ñ€Ð°Ð²ÐµÐ½ÐºÐ¸ â€” 8 Ð¾Ð´Ð´."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Ð Ð°Ð·Ñ€ÐµÐ´</label>
              <select value={grade} onChange={e => setGrade(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}. Ñ€Ð°Ð·Ñ€ÐµÐ´</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Ð¢Ð¸Ð¿</label>
              <select value={testType} onChange={e => setTestType(e.target.value as DuggaTestType)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                {TEST_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">ÐžÐ¿Ð¸Ñ (Ð¸Ð·Ð±Ð¾Ñ€Ð½Ð¾)</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="ÐšÑ€Ð°Ñ‚Ð¾Ðº Ð¾Ð¿Ð¸Ñ Ð·Ð° ÑƒÑ‡ÐµÐ½Ð¸Ñ†Ð¸Ñ‚Ðµ..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsPublic(p => !p)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-violet-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-600">ÐˆÐ°Ð²ÐµÐ½ Ñ‚ÐµÑÑ‚ (Ð²Ð¾ Ð±Ð¸Ð±Ð»Ð¸Ð¾Ñ‚ÐµÐºÐ°)</span>
          </div>
        </div>

        {/* AI generate bar */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-4 flex items-center gap-4">
          <Zap className="w-6 h-6 text-white flex-shrink-0" />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">AI Ð³ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°ÑšÐµ</p>
            <p className="text-violet-200 text-xs">Gemini Ð³ÐµÐ½ÐµÑ€Ð¸Ñ€Ð° Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ° Ð¿Ð¾ Ñ€Ð°Ð·Ñ€ÐµÐ´, Ñ‚ÐµÐ¼Ð° Ð¸ DoK Ñ€Ð°ÑÐ¿Ñ€ÐµÐ´ÐµÐ»Ð±Ð°</p>
          </div>
          <button type="button" onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-violet-700 text-sm font-bold rounded-xl hover:bg-violet-50 transition-colors flex-shrink-0">
            <Sparkles className="w-4 h-4" /> Ð“ÐµÐ½ÐµÑ€Ð¸Ñ€Ð°Ñ˜
          </button>
        </div>

        {/* Preview mode */}
        {showPreview ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold text-gray-900">{title || '(Ð±ÐµÐ· Ð½Ð°ÑÐ»Ð¾Ð²)'}</h2>
              {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <span>{grade}. Ñ€Ð°Ð·Ñ€ÐµÐ´</span>
                <span>Â·</span>
                <span>{questions.length} Ð¿Ñ€Ð°ÑˆÐ°ÑšÐ°</span>
                <span>Â·</span>
                <span>{totalPoints} Ð¿Ð¾ÐµÐ½Ð¸</span>
                <span>Â·</span>
                <span>~{estimatedMinutes} Ð¼Ð¸Ð½</span>
              </div>
            </div>
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-gray-600 min-w-[28px]">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">
                      {q.type === 'section_header'
                        ? <span className="text-lg font-bold text-violet-700">{q.text}</span>
                        : <MathRenderer text={q.text || '(Ð±ÐµÐ· Ñ‚ÐµÐºÑÑ‚)'} />
                      }
                    </div>
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((o, oi) => (
                          <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 text-sm">
                            <span className="font-semibold text-gray-400">{String.fromCharCode(65 + oi)})</span>
                            <MathRenderer text={o.text} />
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'true_false' && (
                      <div className="mt-2 flex gap-3">
                        <span className="px-3 py-1 rounded-lg border border-gray-200 text-sm">â˜ Ð¢Ð¾Ñ‡Ð½Ð¾</span>
                        <span className="px-3 py-1 rounded-lg border border-gray-200 text-sm">â˜ ÐÐµÑ‚Ð¾Ñ‡Ð½Ð¾</span>
                      </div>
                    )}
                    {(q.type === 'short_answer' || q.type === 'fill_blanks') && (
                      <div className="mt-2 h-9 border-b-2 border-dashed border-gray-300 w-64" />
                    )}
                    {q.type === 'essay' && (
                      <div className="mt-2 h-24 border border-dashed border-gray-300 rounded-xl" />
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DOK_COLORS[q.dok]}`}>DoK{q.dok}</span>
                    <p className="text-xs text-gray-400 mt-1">{q.points}Ð¿</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Edit mode */
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionEditor
                key={q.id} q={q} idx={idx}
                onChange={updated => updateQuestion(idx, updated)}
                onDelete={() => deleteQuestion(idx)}
                onMoveUp={() => moveQuestion(idx, 'up')}
                onMoveDown={() => moveQuestion(idx, 'down')}
                isFirst={idx === 0} isLast={idx === questions.length - 1}
              />
            ))}

            {/* Add question */}
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 mb-3 text-center">Ð”Ð¾Ð´Ð°Ñ˜ Ð¿Ñ€Ð°ÑˆÐ°ÑšÐµ</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Q_TYPES.map(t => (
                  <button type="button" key={t.id} onClick={() => addQuestion(t.id)}
                    title={t.desc}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors">
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAIModal && (
        <AIGenerateModal onClose={() => setShowAIModal(false)} onGenerated={handleAIGenerated} />
      )}
    </div>
  );
}

