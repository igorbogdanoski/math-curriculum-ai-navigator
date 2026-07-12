import React, { useState, useEffect } from 'react';
import type { AIGeneratedThematicPlan, ThematicPlanLessonScenario, Grade, Topic } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scenarioToText(s: ThematicPlanLessonScenario): string {
  const parts = [
    `Воведна активност (10 мин.)\n${s.intro}`,
    `\nГлавни активности (25 мин.)\n${s.main.map((m, i) => `${i + 1}. ${m}`).join('\n')}`,
    `\nЗавршна активност (5 мин.)\n${s.closing}`,
    `\nРефлексија\n${s.reflection}`,
  ];
  if (s.homework) parts.push(`\nДомашна работа\n${s.homework}`);
  return parts.join('');
}

function gradeRoman(level: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
  return map[level] ?? String(level);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ScenarioView: React.FC<{ scenario: ThematicPlanLessonScenario }> = ({ scenario }) => (
  <div className="space-y-2 text-[10.5px] leading-snug print:text-[10px]">
    <div>
      <span className="font-bold text-gray-800">Воведна активност</span>
      <span className="text-gray-400 text-[9px] ml-1">(10 мин.)</span>
      <p className="mt-0.5 whitespace-pre-line">{scenario.intro}</p>
    </div>
    <div>
      <span className="font-bold text-gray-800">Главни активности</span>
      <span className="text-gray-400 text-[9px] ml-1">(25 мин.)</span>
      <ol className="mt-0.5 list-decimal list-outside ml-4 space-y-1">
        {scenario.main.map((m, i) => <li key={i}>{m}</li>)}
      </ol>
    </div>
    <div>
      <span className="font-bold text-gray-800">Завршна активност</span>
      <span className="text-gray-400 text-[9px] ml-1">(5 мин.)</span>
      <p className="mt-0.5 whitespace-pre-line">{scenario.closing}</p>
    </div>
    <div>
      <span className="font-bold text-gray-800">Рефлексија</span>
      <p className="mt-0.5 whitespace-pre-line">{scenario.reflection}</p>
    </div>
    {scenario.homework && (
      <div>
        <span className="font-bold text-gray-800">Домашна работа</span>
        <p className="mt-0.5 whitespace-pre-line">{scenario.homework}</p>
      </div>
    )}
  </div>
);

// ── Types ─────────────────────────────────────────────────────────────────────

type HeaderField = 'authorName' | 'schoolName' | 'period';

export interface OfficialThematicPlanTableProps {
  data: AIGeneratedThematicPlan;
  grade?: Grade;
  topic?: Topic;
  authorName: string;
  schoolName: string;
  period: string;
  isEditable?: boolean;
  onLessonChange?: (idx: number, field: string, value: string | number) => void;
  onHeaderChange?: (field: HeaderField, value: string) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────

export const OfficialThematicPlanTable: React.FC<OfficialThematicPlanTableProps> = ({
  data,
  grade,
  topic,
  authorName,
  schoolName,
  period,
  isEditable = false,
  onLessonChange,
  onHeaderChange,
}) => {
  // Local editing state — mirrors data.lessons in edit mode
  const [editVals, setEditVals] = useState<Record<string, string | number>>({});

  useEffect(() => {
    // Reset local edits when data changes externally or edit mode exits
    setEditVals({});
  }, [data, isEditable]);

  const getVal = (key: string, fallback: string | number): string | number =>
    key in editVals ? editVals[key] : fallback;

  const handleChange = (idx: number, field: string, value: string | number) => {
    setEditVals(prev => ({ ...prev, [`${idx}-${field}`]: value }));
  };

  const handleBlur = (idx: number, field: string) => {
    const key = `${idx}-${field}`;
    if (key in editVals) {
      onLessonChange?.(idx, field, editVals[key]);
    }
  };

  const totalHours = data.lessons.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
  const gradeName = grade
    ? `Математика за ${gradeRoman(grade.level)} одделение`
    : 'Математика';

  // ── Edit mode cell renderers ───────────────────────────────────────────────

  const editCellClass = 'w-full min-h-[72px] resize-y outline-none bg-transparent font-serif text-[11px] leading-snug border-none p-0 focus:ring-0';

  const renderTextCell = (idx: number, field: string, fallback: string, minH = 72) => (
    isEditable ? (
      <textarea
        className={`${editCellClass} min-h-[${minH}px]`}
        value={String(getVal(`${idx}-${field}`, fallback))}
        onChange={e => handleChange(idx, field, e.target.value)}
        onBlur={() => handleBlur(idx, field)}
      />
    ) : null
  );

  return (
    <div className="official-thematic-plan bg-white text-black font-serif text-[12px] leading-tight select-text">

      {/* ── HEADER TABLE ──────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[12px]">
        <tbody>
          <tr>
            <td colSpan={2} className="border border-black px-3 py-2 font-bold">
              Предмет: {gradeName}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 w-1/2">
              <span className="font-bold">Тема: </span>
              <span className="uppercase font-semibold">{data.thematicUnit || topic?.title || ''}</span>
            </td>
            <td className="border border-black px-3 py-2 text-right">
              Вкупно часа: <strong>{totalHours}</strong>
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2">
              <span className="font-bold">Изготвил/-а: </span>
              {isEditable ? (
                <input
                  type="text"
                  className="border-b border-black outline-none bg-transparent font-serif text-[12px] min-w-[200px] ml-1"
                  value={authorName}
                  onChange={e => onHeaderChange?.('authorName', e.target.value)}
                  placeholder="Наставник/Наставничка"
                />
              ) : (
                <span className="border-b border-dotted border-black min-w-[220px] inline-block ml-1">
                  {authorName || '______________________________'}
                </span>
              )}
            </td>
            <td className="border border-black px-3 py-2 text-right">
              <span className="font-bold">од ОУ: </span>
              {isEditable ? (
                <input
                  type="text"
                  className="border-b border-black outline-none bg-transparent font-serif text-[12px] min-w-[200px] ml-1"
                  value={schoolName}
                  onChange={e => onHeaderChange?.('schoolName', e.target.value)}
                  placeholder="Основно Училиште"
                />
              ) : (
                <span className="border-b border-dotted border-black min-w-[220px] inline-block ml-1">
                  {schoolName || '______________________________'}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2">
              <span className="font-bold">Адаптирале: </span>
              <span className="border-b border-dotted border-black min-w-[220px] inline-block ml-1">
                ______________________________
              </span>
            </td>
            <td className="border border-black px-3 py-2 text-right">
              <span className="font-bold">Време за реализација: </span>
              {isEditable ? (
                <input
                  type="text"
                  className="border-b border-black outline-none bg-transparent font-serif text-[12px] min-w-[160px] ml-1"
                  value={period}
                  onChange={e => onHeaderChange?.('period', e.target.value)}
                  placeholder="Нед. 1–4 / Септември"
                />
              ) : (
                <span className="border-b border-dotted border-black min-w-[180px] inline-block ml-1">
                  {period || '___________________________'}
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── MAIN TABLE ────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <thead>
          <tr className="text-center font-bold bg-gray-50 print:bg-gray-100">
            <th className="border border-black p-2 w-[17%] align-middle leading-tight">содржини<br/>(и поими)</th>
            <th className="border border-black p-2 w-[16%] align-middle leading-tight">стандарди за<br/>оценување</th>
            <th className="border border-black p-2 w-[8%] align-middle leading-tight">часови и дата<br/>на реализација</th>
            <th className="border border-black p-2 w-[31%] align-middle leading-tight">сценарио за часот</th>
            <th className="border border-black p-2 w-[12%] align-middle leading-tight">средства</th>
            <th className="border border-black p-2 w-[16%] align-middle leading-tight">следење на<br/>напредокот</th>
          </tr>
        </thead>
        <tbody>
          {data.lessons.map((lesson, idx) => {
            const scenarioText = lesson.scenario
              ? scenarioToText(lesson.scenario)
              : (lesson.keyActivities || '');

            const resourceList = typeof lesson.resources === 'string'
              ? lesson.resources.split(/[,;]\s*/).filter(Boolean)
              : [];
            const assessmentList = typeof lesson.assessment === 'string'
              ? lesson.assessment.split(/[;]\s*/).filter(Boolean)
              : [];

            return (
              <tr
                key={idx}
                className={`border-b border-black last:border-b-0 ${isEditable ? 'hover:bg-blue-50/20' : ''}`}
              >
                {/* Col 1: Contents */}
                <td className="border border-black p-2 align-top">
                  {isEditable ? (
                    renderTextCell(idx, 'lessonUnit', lesson.lessonUnit)
                  ) : (
                    <MathRenderer text={lesson.lessonUnit} />
                  )}
                </td>

                {/* Col 2: Standards */}
                <td className="border border-black p-2 align-top italic">
                  {isEditable ? (
                    <textarea
                      className={`${editCellClass} italic`}
                      value={String(getVal(`${idx}-learningOutcomes`, lesson.learningOutcomes))}
                      onChange={e => handleChange(idx, 'learningOutcomes', e.target.value)}
                      onBlur={() => handleBlur(idx, 'learningOutcomes')}
                    />
                  ) : (
                    <MathRenderer text={lesson.learningOutcomes} />
                  )}
                </td>

                {/* Col 3: Hours */}
                <td className="border border-black p-2 align-top text-center font-bold">
                  {isEditable ? (
                    <input
                      type="number"
                      className="w-full text-center outline-none bg-transparent font-bold font-serif text-[11px] border-none p-0 focus:ring-0"
                      value={String(getVal(`${idx}-hours`, lesson.hours ?? ''))}
                      min={0}
                      max={99}
                      onChange={e => handleChange(idx, 'hours', Number(e.target.value))}
                      onBlur={() => handleBlur(idx, 'hours')}
                    />
                  ) : (
                    <span>{lesson.hours ?? ''}</span>
                  )}
                </td>

                {/* Col 4: Scenario */}
                <td className="border border-black p-2 align-top">
                  {isEditable ? (
                    <textarea
                      className={`${editCellClass} min-h-[160px]`}
                      value={String(getVal(`${idx}-keyActivities`, scenarioText))}
                      onChange={e => handleChange(idx, 'keyActivities', e.target.value)}
                      onBlur={() => handleBlur(idx, 'keyActivities')}
                    />
                  ) : lesson.scenario ? (
                    <ScenarioView scenario={lesson.scenario} />
                  ) : (
                    <div className="whitespace-pre-line leading-snug text-[10.5px]">
                      <MathRenderer text={lesson.keyActivities || ''} />
                    </div>
                  )}
                </td>

                {/* Col 5: Resources */}
                <td className="border border-black p-2 align-top">
                  {isEditable ? (
                    <textarea
                      className={editCellClass}
                      value={String(getVal(`${idx}-resources`, lesson.resources ?? ''))}
                      onChange={e => handleChange(idx, 'resources', e.target.value)}
                      onBlur={() => handleBlur(idx, 'resources')}
                    />
                  ) : (
                    <ul className="list-disc list-outside ml-3 space-y-1">
                      {resourceList.map((r, i) => <li key={i}><MathRenderer text={r} /></li>)}
                    </ul>
                  )}
                </td>

                {/* Col 6: Progress monitoring */}
                <td className="border border-black p-2 align-top">
                  {isEditable ? (
                    <textarea
                      className={editCellClass}
                      value={String(getVal(`${idx}-assessment`, lesson.assessment))}
                      onChange={e => handleChange(idx, 'assessment', e.target.value)}
                      onBlur={() => handleBlur(idx, 'assessment')}
                    />
                  ) : (
                    <ul className="list-disc list-outside ml-3 space-y-1">
                      {assessmentList.map((a, i) => <li key={i}><MathRenderer text={a.trim()} /></li>)}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── PRINT CSS ──────────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .official-thematic-plan,
          .official-thematic-plan * { visibility: visible; }
          .official-thematic-plan {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            font-size: 10.5px;
            font-family: 'Times New Roman', serif;
          }
          .official-thematic-plan table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .official-thematic-plan th,
          .official-thematic-plan td {
            border: 1px solid black !important;
            padding: 4px 6px !important;
            vertical-align: top;
          }
          .official-thematic-plan thead th {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .official-thematic-plan textarea,
          .official-thematic-plan input[type="text"],
          .official-thematic-plan input[type="number"] {
            border: none !important;
            outline: none !important;
            resize: none !important;
            background: transparent !important;
            font-family: inherit !important;
            font-size: inherit !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            overflow: hidden !important;
          }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 1.5cm 1cm; }
        }
      `}} />
    </div>
  );
};
