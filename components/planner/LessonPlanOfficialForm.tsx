import React, { useState, useEffect } from 'react';
import type { LessonPlan } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type LessonType = 'Обработка' | 'Повторување' | 'Вежбање' | 'Проверка';

export interface LessonPlanOfficialFormProps {
  plan: Partial<LessonPlan>;
  lessonDate?: string;
  isEditable?: boolean;
  onFieldChange?: (field: string, value: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStepText(step: { text?: string } | string | null | undefined): string {
  if (!step) return '';
  if (typeof step === 'string') return step;
  return step.text ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const LessonPlanOfficialForm: React.FC<LessonPlanOfficialFormProps> = ({
  plan,
  lessonDate: initialDate,
  isEditable = false,
  onFieldChange,
}) => {
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [lessonType, setLessonType] = useState<LessonType>('Обработка');

  useEffect(() => {
    setEditVals({});
  }, [plan, isEditable]);

  const getVal = (key: string, fallback: string): string =>
    key in editVals ? editVals[key] : fallback;

  const handleChange = (key: string, value: string) => {
    setEditVals(prev => ({ ...prev, [key]: value }));
  };

  const handleBlur = (key: string) => {
    if (key in editVals) onFieldChange?.(key, editVals[key]);
  };

  // Pre-computed defaults from plan
  const introText = getStepText(plan.scenario?.introductory);
  const mainText = (plan.scenario?.main ?? []).map((s, i) => `${i + 1}. ${getStepText(s)}`).join('\n');
  const concludingText = getStepText(plan.scenario?.concluding);
  const homeworkText = plan.reflectionPrompt ?? plan.selfAssessmentPrompt ?? '';
  const materialsText = (plan.materials ?? []).join('\n');
  const objectivesText = (plan.objectives ?? []).map(o => o.text).join('\n');
  const standardsText = (plan.assessmentStandards ?? []).join('\n');
  const progressText = (plan.progressMonitoring ?? []).join('\n');
  const diffText = plan.differentiation ?? (plan.differentiationTabs
    ? `Поддршка: ${plan.differentiationTabs.support}\nСтандард: ${plan.differentiationTabs.standard}\nНапредно: ${plan.differentiationTabs.advanced}`
    : '');
  const today = initialDate ?? new Date().toLocaleDateString('mk-MK');

  const inputCls = 'w-full outline-none bg-transparent font-serif text-[11px] border-none p-0 focus:ring-0 resize-none leading-snug';
  const hInputCls = 'border-b border-black outline-none bg-transparent font-serif text-[12px] focus:ring-0 inline-block';

  // ── Editable / view cell wrappers ─────────────────────────────────────────

  const TextareaCell = ({ id, fallback, minH = 48 }: { id: string; fallback: string; minH?: number }) =>
    isEditable ? (
      <textarea
        className={inputCls}
        style={{ minHeight: minH }}
        value={getVal(id, fallback)}
        onChange={e => handleChange(id, e.target.value)}
        onBlur={() => handleBlur(id)}
      />
    ) : (
      <span className="whitespace-pre-line text-[11px] leading-snug">{fallback}</span>
    );

  const HInput = ({ id, fallback, width = 200 }: { id: string; fallback: string; width?: number }) =>
    isEditable ? (
      <input
        type="text"
        className={hInputCls}
        style={{ minWidth: width }}
        value={getVal(id, fallback)}
        onChange={e => handleChange(id, e.target.value)}
        onBlur={() => handleBlur(id)}
      />
    ) : (
      <span className={`border-b border-dotted border-black inline-block ml-1`} style={{ minWidth: width }}>
        {fallback || '_______________'}
      </span>
    );

  return (
    <div className="lesson-plan-official-form bg-white text-black font-serif text-[12px] leading-tight select-text p-4 print:p-0">

      {/* ── TITLE ─────────────────────────────────────────────────────────── */}
      <div className="text-center font-bold text-[14px] uppercase tracking-wide mb-1">
        Подготовка за наставен час
      </div>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[12px] mb-0">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1.5 w-1/2">
              <span className="font-bold">Предмет: </span>
              <HInput id="subject" fallback={plan.subject ?? 'Математика'} />
            </td>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">Одделение: </span>
              <HInput id="grade" fallback={plan.grade ? `${plan.grade}. одд.` : ''} width={80} />
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">Тема: </span>
              <HInput id="theme" fallback={plan.theme ?? ''} />
            </td>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">Датум: </span>
              <HInput id="date" fallback={getVal('date', today)} width={100} />
              <span className="font-bold ml-4">Траење: </span>
              <HInput id="duration" fallback="40 мин." width={60} />
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">Наставна единица: </span>
              <HInput id="title" fallback={plan.title ?? ''} />
            </td>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">Час бр.: </span>
              <HInput id="lessonNumber" fallback={plan.lessonNumber ? String(plan.lessonNumber) : ''} width={50} />
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">Наставник/-чка: </span>
              <HInput id="authorName" fallback={plan.authorName ?? ''} />
            </td>
            <td className="border border-black px-2 py-1.5">
              <span className="font-bold">ООУ: </span>
              <HInput id="schoolName" fallback={plan.schoolName ?? ''} />
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-2 py-1.5">
              <span className="font-bold mr-3">Тип на час: </span>
              {(['Обработка', 'Повторување', 'Вежбање', 'Проверка'] as LessonType[]).map(t => (
                <label key={t} className="mr-4 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-1 accent-black"
                    checked={lessonType === t}
                    onChange={() => setLessonType(t)}
                    disabled={!isEditable}
                  />
                  {t}
                </label>
              ))}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── GOALS ─────────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <thead>
          <tr>
            <th colSpan={3} className="border border-black px-2 py-1 font-bold bg-gray-50 print:bg-gray-100 text-left uppercase">
              Цели на учење
            </th>
          </tr>
          <tr className="text-center font-bold bg-gray-50 print:bg-gray-100">
            <th className="border border-black px-2 py-1 w-1/3">Когнитивни цели</th>
            <th className="border border-black px-2 py-1 w-1/3">Психомоторни цели</th>
            <th className="border border-black px-2 py-1 w-1/3">Афективни цели</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black px-2 py-2 align-top">
              <TextareaCell id="objectives" fallback={objectivesText} minH={60} />
            </td>
            <td className="border border-black px-2 py-2 align-top">
              <TextareaCell id="psychomotorGoals" fallback={getVal('psychomotorGoals', '')} minH={60} />
            </td>
            <td className="border border-black px-2 py-2 align-top">
              <TextareaCell id="affectiveGoals" fallback={getVal('affectiveGoals', '')} minH={60} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── STANDARDS ─────────────────────────────────────────────────────── */}
      {(standardsText || isEditable) && (
        <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1.5 font-bold w-[22%] bg-gray-50 print:bg-gray-100 align-top">
                Стандарди за оценување
              </td>
              <td className="border border-black px-2 py-1.5 align-top">
                <TextareaCell id="standards" fallback={standardsText} minH={44} />
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ── SCENARIO TABLE ────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <thead>
          <tr className="text-center font-bold bg-gray-50 print:bg-gray-100">
            <th className="border border-black p-2 w-[13%] align-middle">Фаза на часот</th>
            <th className="border border-black p-2 w-[52%] align-middle">Содржина / Активности на наставникот и учениците</th>
            <th className="border border-black p-2 w-[10%] align-middle">Траење</th>
            <th className="border border-black p-2 w-[25%] align-middle">Методи, форми и средства</th>
          </tr>
        </thead>
        <tbody>
          {/* Воведна */}
          <tr>
            <td className="border border-black p-2 align-top text-center font-bold text-[10px] bg-gray-50 print:bg-gray-100">
              ВОВЕДНА<br/>АКТИВНОСТ
            </td>
            <td className="border border-black p-2 align-top">
              <TextareaCell id="introActivity" fallback={introText} minH={64} />
            </td>
            <td className="border border-black p-2 align-top text-center text-[10px]">
              <TextareaCell id="introDuration" fallback="5–10 мин." minH={24} />
            </td>
            <td className="border border-black p-2 align-top">
              <TextareaCell id="introMethods" fallback={getVal('introMethods', '')} minH={64} />
            </td>
          </tr>

          {/* Главна */}
          <tr>
            <td className="border border-black p-2 align-top text-center font-bold text-[10px] bg-gray-50 print:bg-gray-100">
              ГЛАВНА<br/>АКТИВНОСТ
            </td>
            <td className="border border-black p-2 align-top">
              <TextareaCell id="mainActivity" fallback={mainText} minH={120} />
            </td>
            <td className="border border-black p-2 align-top text-center text-[10px]">
              <TextareaCell id="mainDuration" fallback="25–30 мин." minH={24} />
            </td>
            <td className="border border-black p-2 align-top">
              <TextareaCell id="mainMethods" fallback={getVal('mainMethods', '')} minH={120} />
            </td>
          </tr>

          {/* Завршна */}
          <tr>
            <td className="border border-black p-2 align-top text-center font-bold text-[10px] bg-gray-50 print:bg-gray-100">
              ЗАВРШНА<br/>АКТИВНОСТ
            </td>
            <td className="border border-black p-2 align-top">
              <TextareaCell id="closingActivity" fallback={concludingText} minH={64} />
            </td>
            <td className="border border-black p-2 align-top text-center text-[10px]">
              <TextareaCell id="closingDuration" fallback="5 мин." minH={24} />
            </td>
            <td className="border border-black p-2 align-top">
              <TextareaCell id="closingMethods" fallback={getVal('closingMethods', '')} minH={64} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── MATERIALS + MONITORING ────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1.5 font-bold w-[22%] bg-gray-50 print:bg-gray-100 align-top">
              Наставни средства
            </td>
            <td className="border border-black px-2 py-1.5 align-top">
              <TextareaCell id="materials" fallback={materialsText} minH={36} />
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1.5 font-bold bg-gray-50 print:bg-gray-100 align-top">
              Домашна работа
            </td>
            <td className="border border-black px-2 py-1.5 align-top">
              <TextareaCell id="homework" fallback={homeworkText} minH={36} />
            </td>
          </tr>
          {(diffText || isEditable) && (
            <tr>
              <td className="border border-black px-2 py-1.5 font-bold bg-gray-50 print:bg-gray-100 align-top">
                Диференцирана настава
              </td>
              <td className="border border-black px-2 py-1.5 align-top">
                <TextareaCell id="differentiation" fallback={diffText} minH={48} />
              </td>
            </tr>
          )}
          <tr>
            <td className="border border-black px-2 py-1.5 font-bold bg-gray-50 print:bg-gray-100 align-top">
              Следење на напредокот
            </td>
            <td className="border border-black px-2 py-1.5 align-top">
              <TextareaCell id="progressMonitoring" fallback={progressText} minH={36} />
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1.5 font-bold bg-gray-50 print:bg-gray-100 align-top">
              Рефлексија / Белешки
            </td>
            <td className="border border-black px-2 py-2 align-top">
              <TextareaCell id="reflection" fallback={getVal('reflection', '')} minH={40} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── SIGNATURE BLOCK ───────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-2 border-black text-[11px] mt-0">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-3 w-1/3">
              <div className="font-bold mb-5">Наставник/-чка:</div>
              <div className="border-b border-black w-44 h-px" />
              <div className="text-[10px] text-gray-500 mt-1">Потпис</div>
            </td>
            <td className="border border-black px-3 py-3 w-1/3">
              <div className="font-bold mb-5">Директор/-ка:</div>
              <div className="border-b border-black w-44 h-px" />
              <div className="text-[10px] text-gray-500 mt-1">Потпис и Печат</div>
            </td>
            <td className="border border-black px-3 py-3 w-1/3">
              <div className="font-bold mb-2">Датум:</div>
              <div className="border-b border-dotted border-black min-w-[140px] inline-block mt-4">&nbsp;</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── PRINT CSS ─────────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .lesson-plan-official-form,
          .lesson-plan-official-form * { visibility: visible; }
          .lesson-plan-official-form {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            font-size: 10px;
            font-family: 'Times New Roman', serif;
            padding: 0;
          }
          .lesson-plan-official-form table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .lesson-plan-official-form th,
          .lesson-plan-official-form td {
            border: 1px solid black !important;
            padding: 3px 5px !important;
            vertical-align: top;
          }
          .lesson-plan-official-form thead th,
          .lesson-plan-official-form td.bg-gray-50 {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .lesson-plan-official-form textarea,
          .lesson-plan-official-form input[type="text"],
          .lesson-plan-official-form input[type="number"] {
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
          .lesson-plan-official-form input[type="checkbox"] {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 1.5cm 1cm; }
        }
      `}} />
    </div>
  );
};
