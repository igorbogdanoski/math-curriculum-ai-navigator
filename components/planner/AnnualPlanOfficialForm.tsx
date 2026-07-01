import React, { useState, useEffect } from 'react';
import type { AIGeneratedAnnualPlan } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_FOR_WEEK: Record<number, string> = {
  1: 'Септември', 2: 'Септември', 3: 'Септември', 4: 'Септември',
  5: 'Октомври', 6: 'Октомври', 7: 'Октомври', 8: 'Октомври',
  9: 'Ноември', 10: 'Ноември', 11: 'Ноември', 12: 'Ноември',
  13: 'Декември', 14: 'Декември', 15: 'Декември', 16: 'Декември',
  17: 'Јануари', 18: 'Јануари', 19: 'Јануари', 20: 'Јануари',
  21: 'Февруари', 22: 'Февруари', 23: 'Февруари', 24: 'Февруари',
  25: 'Март', 26: 'Март', 27: 'Март', 28: 'Март',
  29: 'Април', 30: 'Април', 31: 'Април', 32: 'Април',
  33: 'Мај', 34: 'Мај', 35: 'Мај', 36: 'Јуни',
};

function weekRangeToPeriod(start: number, end: number): string {
  const s = MONTH_FOR_WEEK[Math.min(Math.max(start, 1), 36)] ?? 'Септември';
  const e = MONTH_FOR_WEEK[Math.min(Math.max(end, 1), 36)] ?? 'Јуни';
  return s === e ? s : `${s}–${e}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type HeaderField = 'authorName' | 'schoolName' | 'academicYear';
type RowField = 'title' | 'type' | 'hours' | 'period' | 'objectives' | 'methods' | 'assessment';

export interface AnnualPlanOfficialFormProps {
  data: AIGeneratedAnnualPlan;
  authorName: string;
  schoolName: string;
  academicYear: string;
  isEditable?: boolean;
  onHeaderChange?: (field: HeaderField, value: string) => void;
  onRowChange?: (idx: number, field: RowField, value: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AnnualPlanOfficialForm: React.FC<AnnualPlanOfficialFormProps> = ({
  data,
  authorName,
  schoolName,
  academicYear,
  isEditable = false,
  onHeaderChange,
  onRowChange,
}) => {
  const [editVals, setEditVals] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditVals({});
  }, [data, isEditable]);

  const getVal = (key: string, fallback: string): string =>
    key in editVals ? editVals[key] : fallback;

  const handleChange = (key: string, value: string) =>
    setEditVals(prev => ({ ...prev, [key]: value }));

  const handleBlur = (idx: number, field: RowField) => {
    const key = `${idx}-${field}`;
    if (key in editVals) onRowChange?.(idx, field, editVals[key]);
  };

  // Pre-compute cumulative week starts for each topic
  const weekStarts: number[] = [];
  let cumWeek = 1;
  for (const t of data.topics) {
    weekStarts.push(cumWeek);
    cumWeek += t.durationWeeks;
  }

  const totalHours = data.topics.reduce((acc, t) => acc + t.durationWeeks * 4, 0);

  const inputCls = 'w-full outline-none bg-transparent font-serif text-[11px] border-none p-0 focus:ring-0 resize-none';
  const hInputCls = 'border-b border-black outline-none bg-transparent font-serif text-[12px] min-w-[180px] ml-1 focus:ring-0';

  return (
    <div className="annual-plan-official-form bg-white text-black font-serif text-[12px] leading-tight select-text">

      {/* ── TITLE ──────────────────────────────────────────────────────────── */}
      <div className="text-center font-bold text-[14px] uppercase tracking-wide mb-2 print:text-[13px]">
        Годишна Глобална Програма
      </div>
      <div className="text-center text-[11px] mb-3 print:text-[11px]">
        (Годишна наставна програма по предмет)
      </div>

      {/* ── HEADER TABLE ────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[12px] mb-0">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-1.5 w-1/2">
              <span className="font-bold">Предмет: </span>
              <span>{data.subject}</span>
            </td>
            <td className="border border-black px-3 py-1.5">
              <span className="font-bold">Одделение: </span>
              <span>{data.grade}</span>
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1.5">
              <span className="font-bold">Учебна година: </span>
              {isEditable ? (
                <input
                  type="text"
                  className={hInputCls}
                  value={academicYear}
                  onChange={e => onHeaderChange?.('academicYear', e.target.value)}
                  placeholder="2026/2027"
                />
              ) : (
                <span className="border-b border-dotted border-black min-w-[160px] inline-block ml-1">
                  {academicYear || '_______________'}
                </span>
              )}
            </td>
            <td className="border border-black px-3 py-1.5">
              <span className="font-bold">Наставник/-чка: </span>
              {isEditable ? (
                <input
                  type="text"
                  className={hInputCls}
                  value={authorName}
                  onChange={e => onHeaderChange?.('authorName', e.target.value)}
                  placeholder="Внеси име и презиме"
                />
              ) : (
                <span className="border-b border-dotted border-black min-w-[200px] inline-block ml-1">
                  {authorName || '______________________________'}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-3 py-1.5">
              <span className="font-bold">Основно Училиште: </span>
              {isEditable ? (
                <input
                  type="text"
                  className={`${hInputCls} min-w-[300px]`}
                  value={schoolName}
                  onChange={e => onHeaderChange?.('schoolName', e.target.value)}
                  placeholder="Назив на училиштето"
                />
              ) : (
                <span className="border-b border-dotted border-black min-w-[320px] inline-block ml-1">
                  {schoolName || '________________________________________________'}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1.5">
              <span className="font-bold">Вкупно недели: </span>
              <strong>{data.totalWeeks}</strong>
            </td>
            <td className="border border-black px-3 py-1.5">
              <span className="font-bold">Вкупно часови: </span>
              <strong>{totalHours}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── MAIN TABLE ────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <thead>
          <tr className="text-center font-bold bg-gray-50 print:bg-gray-100">
            <th className="border border-black p-2 w-[4%] align-middle leading-tight">Бр.</th>
            <th className="border border-black p-2 w-[19%] align-middle leading-tight">Наслов на темата/<br/>наставната единица</th>
            <th className="border border-black p-2 w-[8%] align-middle leading-tight">Тип на<br/>наставата</th>
            <th className="border border-black p-2 w-[5%] align-middle leading-tight">Ч.</th>
            <th className="border border-black p-2 w-[9%] align-middle leading-tight">Временски<br/>период</th>
            <th className="border border-black p-2 w-[24%] align-middle leading-tight">Очекувани резултати/<br/>Цели на учењето</th>
            <th className="border border-black p-2 w-[18%] align-middle leading-tight">Наставни методи<br/>и форми</th>
            <th className="border border-black p-2 w-[13%] align-middle leading-tight">Евалуација/<br/>Оценување</th>
          </tr>
        </thead>
        <tbody>
          {data.topics.map((topic, idx) => {
            const startWeek = weekStarts[idx];
            const endWeek = startWeek + topic.durationWeeks - 1;
            const defaultPeriod = weekRangeToPeriod(startWeek, endWeek);
            const defaultHours = String(topic.durationWeeks * 4);
            const defaultObjectives = topic.objectives.join('\n');
            const defaultMethods = topic.suggestedActivities.slice(0, 3).join('\n');
            const defaultAssessment = 'Формативно оценување';

            return (
              <tr
                key={idx}
                className={`border-b border-black last:border-b-0 ${isEditable ? 'hover:bg-blue-50/20' : ''}`}
              >
                {/* Col 1: Number */}
                <td className="border border-black p-2 align-top text-center font-bold">
                  {idx + 1}
                </td>

                {/* Col 2: Title */}
                <td className="border border-black p-2 align-top font-semibold">
                  {isEditable ? (
                    <textarea
                      className={`${inputCls} min-h-[60px]`}
                      value={getVal(`${idx}-title`, topic.title)}
                      onChange={e => handleChange(`${idx}-title`, e.target.value)}
                      onBlur={() => handleBlur(idx, 'title')}
                    />
                  ) : (
                    <span className="font-semibold">{topic.title}</span>
                  )}
                </td>

                {/* Col 3: Type */}
                <td className="border border-black p-2 align-top text-center">
                  {isEditable ? (
                    <select
                      className="w-full outline-none bg-transparent font-serif text-[10px] border-none p-0 focus:ring-0"
                      value={getVal(`${idx}-type`, 'Нова')}
                      onChange={e => { handleChange(`${idx}-type`, e.target.value); onRowChange?.(idx, 'type', e.target.value); }}
                    >
                      <option>Нова</option>
                      <option>Повторување</option>
                      <option>Вежбање</option>
                      <option>Проверка</option>
                    </select>
                  ) : (
                    <span className="text-[10px]">{getVal(`${idx}-type`, 'Нова')}</span>
                  )}
                </td>

                {/* Col 4: Hours */}
                <td className="border border-black p-2 align-top text-center font-bold">
                  {isEditable ? (
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="w-full text-center outline-none bg-transparent font-bold font-serif text-[11px] border-none p-0 focus:ring-0"
                      value={getVal(`${idx}-hours`, defaultHours)}
                      onChange={e => handleChange(`${idx}-hours`, e.target.value)}
                      onBlur={() => handleBlur(idx, 'hours')}
                    />
                  ) : (
                    <span>{getVal(`${idx}-hours`, defaultHours)}</span>
                  )}
                </td>

                {/* Col 5: Period */}
                <td className="border border-black p-2 align-top text-center text-[10px]">
                  {isEditable ? (
                    <textarea
                      className={`${inputCls} min-h-[40px] text-center`}
                      value={getVal(`${idx}-period`, defaultPeriod)}
                      onChange={e => handleChange(`${idx}-period`, e.target.value)}
                      onBlur={() => handleBlur(idx, 'period')}
                    />
                  ) : (
                    <span>{getVal(`${idx}-period`, defaultPeriod)}</span>
                  )}
                </td>

                {/* Col 6: Objectives */}
                <td className="border border-black p-2 align-top">
                  {isEditable ? (
                    <textarea
                      className={`${inputCls} min-h-[80px]`}
                      value={getVal(`${idx}-objectives`, defaultObjectives)}
                      onChange={e => handleChange(`${idx}-objectives`, e.target.value)}
                      onBlur={() => handleBlur(idx, 'objectives')}
                    />
                  ) : (
                    <ul className="list-disc list-outside ml-3 space-y-0.5 text-[10.5px]">
                      {topic.objectives.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  )}
                </td>

                {/* Col 7: Methods */}
                <td className="border border-black p-2 align-top">
                  {isEditable ? (
                    <textarea
                      className={`${inputCls} min-h-[60px]`}
                      value={getVal(`${idx}-methods`, defaultMethods)}
                      onChange={e => handleChange(`${idx}-methods`, e.target.value)}
                      onBlur={() => handleBlur(idx, 'methods')}
                    />
                  ) : (
                    <ul className="list-disc list-outside ml-3 space-y-0.5 text-[10.5px]">
                      {topic.suggestedActivities.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                </td>

                {/* Col 8: Assessment */}
                <td className="border border-black p-2 align-top text-[10.5px]">
                  {isEditable ? (
                    <textarea
                      className={`${inputCls} min-h-[50px]`}
                      value={getVal(`${idx}-assessment`, defaultAssessment)}
                      onChange={e => handleChange(`${idx}-assessment`, e.target.value)}
                      onBlur={() => handleBlur(idx, 'assessment')}
                    />
                  ) : (
                    <span>{getVal(`${idx}-assessment`, defaultAssessment)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── SIGNATURE BLOCK ───────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-3 w-1/3">
              <div className="font-bold mb-6">Наставник/-чка:</div>
              <div className="border-b border-black w-48 h-px" />
              <div className="text-[10px] text-gray-500 mt-1">Потпис</div>
            </td>
            <td className="border border-black px-3 py-3 w-1/3">
              <div className="font-bold mb-6">Директор/-ка:</div>
              <div className="border-b border-black w-48 h-px" />
              <div className="text-[10px] text-gray-500 mt-1">Потпис и Печат</div>
            </td>
            <td className="border border-black px-3 py-3 w-1/3">
              <div className="font-bold mb-2">Датум на усвојување:</div>
              <div className="border-b border-dotted border-black min-w-[160px] inline-block mt-4">
                &nbsp;
              </div>
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  );
};
