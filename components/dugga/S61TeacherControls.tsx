/**
 * S61-A2 — Per-question teacher controls panel.
 *
 * Renders a collapsible "🛠 Алатки за ученикот" pane attached to an
 * open-ended DuggaQuestion in the builder. The panel exposes per-question
 * opt-in controls (allowSolutionUpload, embedTool/embedConfig, answerInput,
 * studentDrawingMode, linkedConceptIds) — all optional, so existing tests do
 * not break.
 */
import React, { useState } from 'react';
import { Settings, ChevronUp, ChevronDown } from 'lucide-react';
import type {
  DuggaQuestion,
  DuggaQuestionType,
  DuggaEmbedTool,
  DuggaAnswerInput,
  DuggaDrawingMode,
} from '../../services/firestoreService.dugga';

const OPEN_ENDED_TYPES: DuggaQuestionType[] = [
  'essay', 'short_answer', 'fill_blanks', 'multi_part', 'list_items', 'geometry_construct',
];

export function isOpenEndedType(t: DuggaQuestionType): boolean {
  return OPEN_ENDED_TYPES.includes(t);
}

const EMBED_TOOL_LABELS: Record<DuggaEmbedTool, string> = {
  'none':              '— нема —',
  'geogebra-graphing': 'GeoGebra • Графици',
  'geogebra-cas':      'GeoGebra • CAS',
  'geogebra-geometry': 'GeoGebra • Геометрија',
  'geogebra-3d':       'GeoGebra • 3D',
  'desmos-calc':       'Desmos • Калкулатор',
  'desmos-graph':      'Desmos • Графици',
};

const ANSWER_INPUT_LABELS: Record<DuggaAnswerInput, string> = {
  'text':  'Текст (textarea)',
  'math':  'Мат. уредник (MathLive)',
  'mixed': 'Мешано (toggle)',
};

const DRAWING_MODE_LABELS: Record<DuggaDrawingMode, string> = {
  'none':       '— нема —',
  'bar-chart':  'Стапчест дијаграм',
  'line-chart': 'Линиски график',
  'free-draw':  'Слободно цртање',
};

export interface S61TeacherControlsProps {
  q: DuggaQuestion;
  onChange: (patch: Partial<DuggaQuestion>) => void;
  /** When true, panel starts expanded (used by tests). */
  defaultOpen?: boolean;
}

export const S61TeacherControls: React.FC<S61TeacherControlsProps> = ({
  q, onChange, defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const conceptCsv = (q.linkedConceptIds ?? []).join(', ');
  const embedTool = q.embedTool ?? 'none';
  const showEmbedConfig = embedTool !== 'none';

  return (
    <div
      data-testid="s61-teacher-controls"
      className="mt-1 rounded-xl border border-amber-100 bg-amber-50/40 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
        aria-expanded={open}
      >
        <Settings className="w-3.5 h-3.5" />
        🛠 Алатки за ученикот (по прашање)
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border-t border-amber-100">
          {/* Allow QR upload */}
          <label className="flex items-center gap-2 text-xs text-gray-700 select-none cursor-pointer">
            <input
              type="checkbox"
              data-testid="s61-allow-qr"
              checked={q.allowSolutionUpload ?? false}
              onChange={e => onChange({ allowSolutionUpload: e.target.checked })}
              className="w-4 h-4 accent-amber-600"
            />
            <span>Дозволи <strong>QR качување</strong> на решение (фотографија)</span>
          </label>

          {/* Embedded tool */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Вградена алатка</label>
            <select
              data-testid="s61-embed-tool"
              value={embedTool}
              onChange={e => onChange({ embedTool: e.target.value as DuggaEmbedTool })}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            >
              {(Object.keys(EMBED_TOOL_LABELS) as DuggaEmbedTool[]).map(k => (
                <option key={k} value={k}>{EMBED_TOOL_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Embed config — visible only when a tool is chosen */}
          {showEmbedConfig && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Material ID / state</label>
                <input
                  data-testid="s61-embed-material"
                  value={q.embedConfig?.materialId ?? ''}
                  onChange={e => onChange({
                    embedConfig: { ...(q.embedConfig ?? {}), materialId: e.target.value },
                  })}
                  placeholder="нпр. abc123 (опционално)"
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Висина (px)</label>
                <input
                  type="number"
                  min={240} max={900}
                  data-testid="s61-embed-height"
                  value={q.embedConfig?.height ?? 420}
                  onChange={e => onChange({
                    embedConfig: { ...(q.embedConfig ?? {}), height: Math.max(240, Number(e.target.value) || 420) },
                  })}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700 select-none cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  data-testid="s61-embed-persist"
                  checked={q.embedConfig?.persistState ?? false}
                  onChange={e => onChange({
                    embedConfig: { ...(q.embedConfig ?? {}), persistState: e.target.checked },
                  })}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>Зачувај ја состојбата на алатката како дел од одговорот</span>
              </label>
            </>
          )}

          {/* Answer input editor */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Уредник за одговор</label>
            <select
              data-testid="s61-answer-input"
              value={q.answerInput ?? 'mixed'}
              onChange={e => onChange({ answerInput: e.target.value as DuggaAnswerInput })}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            >
              {(Object.keys(ANSWER_INPUT_LABELS) as DuggaAnswerInput[]).map(k => (
                <option key={k} value={k}>{ANSWER_INPUT_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Drawing mode */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Дозволи цртање</label>
            <select
              data-testid="s61-drawing-mode"
              value={q.studentDrawingMode ?? 'none'}
              onChange={e => onChange({ studentDrawingMode: e.target.value as DuggaDrawingMode })}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            >
              {(Object.keys(DRAWING_MODE_LABELS) as DuggaDrawingMode[]).map(k => (
                <option key={k} value={k}>{DRAWING_MODE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Linked concept IDs */}
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">
              Поврзани концепти <span className="text-gray-400">(ID-а одделени со запирка)</span>
            </label>
            <input
              data-testid="s61-concept-ids"
              value={conceptCsv}
              onChange={e => {
                const ids = e.target.value
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean);
                onChange({ linkedConceptIds: ids });
              }}
              placeholder="нпр. concept.real-numbers, concept.proof"
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
          </div>
        </div>
      )}
    </div>
  );
};
