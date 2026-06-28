/**
 * ThematicPlanOfficialForm — S94-E1
 * МОН-усогласен печатлив образец за тематски (единечен) план.
 * Паттерн: ист со AnnualPlanOfficialForm — inline-editable хедер + read-only табела.
 */
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { AIGeneratedThematicPlan } from '../../types';

export interface ThematicPlanOfficialFormProps {
  data: AIGeneratedThematicPlan;
  gradeLabel: string;       // e.g. "VI одделение"
  subject: string;          // e.g. "Математика"
  authorName: string;
  schoolName: string;
  period: string;           // e.g. "Септември–Октомври 2026/2027"
  academicYear: string;     // e.g. "2026/2027"
  onClose: () => void;
}

export const ThematicPlanOfficialForm: React.FC<ThematicPlanOfficialFormProps> = ({
  data, gradeLabel, subject, authorName, schoolName, period, academicYear, onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Тематски план — ${data.thematicUnit}`,
  });

  const totalHours = data.lessons.reduce((s, l) => s + (l.hours ?? 1), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b no-print flex-shrink-0">
          <h2 className="text-lg font-black text-slate-900">📄 Официјален образец — Тематски план</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePrint()}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-brand-secondary transition-colors"
            >
              🖨️ Испечати / Зачувај PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Затвори
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div ref={printRef} className="p-8 print:p-6 font-serif text-[13px] leading-snug">

          {/* MoN Header */}
          <div className="text-center mb-6 print:mb-4">
            <p className="text-[11px] uppercase tracking-widest text-gray-500 print:text-gray-700">
              Република Македонија — Министерство за образование и наука
            </p>
            <h1 className="text-[18px] font-black uppercase tracking-wide mt-1 print:text-[16px]">
              ТЕМАТСКИ ПЛАН
            </h1>
            <p className="text-[12px] text-gray-600 mt-0.5">Учебна {academicYear} година</p>
          </div>

          {/* Meta grid */}
          <table className="w-full border border-gray-400 mb-6 print:mb-4 text-[12px]" style={{borderCollapse:'collapse'}}>
            <tbody>
              <tr>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50 w-40">Училиште</td>
                <td className="border border-gray-400 px-3 py-1.5">{schoolName || '___________________________'}</td>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50 w-40">Наставник</td>
                <td className="border border-gray-400 px-3 py-1.5">{authorName || '___________________________'}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50">Предмет</td>
                <td className="border border-gray-400 px-3 py-1.5">{subject}</td>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50">Одделение</td>
                <td className="border border-gray-400 px-3 py-1.5">{gradeLabel}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50">Тематска единица</td>
                <td className="border border-gray-400 px-3 py-1.5 font-semibold" colSpan={3}>{data.thematicUnit}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50">Период</td>
                <td className="border border-gray-400 px-3 py-1.5">{period || '___________________________'}</td>
                <td className="border border-gray-400 px-3 py-1.5 font-bold bg-gray-50">Вкупно часови</td>
                <td className="border border-gray-400 px-3 py-1.5 font-semibold">{totalHours}</td>
              </tr>
            </tbody>
          </table>

          {/* Lessons table */}
          <table className="w-full border border-gray-400 text-[11px] print:text-[10px]" style={{borderCollapse:'collapse'}}>
            <thead>
              <tr className="bg-gray-100 print:bg-gray-200">
                <th className="border border-gray-400 px-2 py-2 text-center font-bold w-8">Бр.</th>
                <th className="border border-gray-400 px-2 py-2 text-left font-bold w-48">Наслов на лекцијата</th>
                <th className="border border-gray-400 px-2 py-2 text-left font-bold">Наставни цели / Исходи</th>
                <th className="border border-gray-400 px-2 py-2 text-left font-bold">Клучни активности</th>
                <th className="border border-gray-400 px-2 py-2 text-left font-bold w-32">Оценување</th>
                <th className="border border-gray-400 px-2 py-2 text-center font-bold w-10">Ч.</th>
              </tr>
            </thead>
            <tbody>
              {data.lessons.map((lesson, i) => (
                <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50 print:bg-gray-50'}>
                  <td className="border border-gray-400 px-2 py-2 text-center font-semibold align-top">
                    {lesson.lessonNumber ?? i + 1}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 font-semibold align-top leading-snug">
                    {lesson.lessonUnit}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 align-top leading-snug text-gray-800">
                    {lesson.learningOutcomes}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 align-top leading-snug text-gray-800">
                    {lesson.keyActivities}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 align-top leading-snug text-gray-700">
                    {lesson.assessment}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 text-center align-top">
                    {lesson.hours ?? 1}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="font-bold bg-gray-100 print:bg-gray-200">
                <td className="border border-gray-400 px-2 py-2 text-center" colSpan={5}>Вкупно часови</td>
                <td className="border border-gray-400 px-2 py-2 text-center">{totalHours}</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="mt-8 print:mt-6 grid grid-cols-2 gap-8 text-[12px]">
            <div>
              <p className="font-bold mb-6">Изготвил/-а:</p>
              <div className="border-b border-gray-500 w-48" />
              <p className="text-gray-600 mt-1">{authorName || 'Наставник'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold mb-6">Одобрил/-а (директор):</p>
              <div className="border-b border-gray-500 w-48 ml-auto" />
              <p className="text-gray-600 mt-1">Потпис и печат</p>
            </div>
          </div>

          {/* Print styles */}
          <style>{`
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              @page { size: A4 landscape; margin: 15mm; }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
};
