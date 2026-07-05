import React, { forwardRef } from 'react';
import { PrintShell } from '../common/PrintShell';
import type { GradeEntry } from '../../types';

interface GradebookPrintShellProps {
  entries: GradeEntry[];
  className: string;
  gradeLevel: number;
  avg: number;
  mastered: number;
  atRisk: number;
}

/** Hidden print layout for the gradebook, printed via the "Печати PDF" action. */
export const GradebookPrintShell = forwardRef<HTMLDivElement, GradebookPrintShellProps>(
  ({ entries, className, gradeLevel, avg, mastered, atRisk }, ref) => (
    <div className="absolute -left-[9999px] top-0">
      <PrintShell
        ref={ref}
        title="Електронска тетратка за оценување"
        subtitle={`${className || 'Класа'} · ${gradeLevel}. одделение · Математика`}
        grade={gradeLevel}
        subject="Математика"
      >
        <table className="w-full border-collapse text-[9pt]">
          <thead>
            <tr className="print-header-bg">
              <th className="border border-gray-600 px-2 py-1 text-left font-bold">#</th>
              <th className="border border-gray-600 px-2 py-1 text-left font-bold">Ученик</th>
              <th className="border border-gray-600 px-2 py-1 text-left font-bold">Тест</th>
              <th className="border border-gray-600 px-2 py-1 text-center font-bold">%</th>
              <th className="border border-gray-600 px-2 py-1 text-center font-bold">Оценка</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => {
              const grade = e.percentage >= 85 ? 5 : e.percentage >= 75 ? 4 : e.percentage >= 65 ? 3 : e.percentage >= 50 ? 2 : 1;
              return (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-400 px-2 py-1 text-center text-gray-500">{idx + 1}</td>
                  <td className="border border-gray-400 px-2 py-1 font-medium">{e.studentName}</td>
                  <td className="border border-gray-400 px-2 py-1 text-gray-700">{e.testTitle}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center font-bold">{e.percentage}%</td>
                  <td className="border border-gray-400 px-2 py-1 text-center font-black text-lg">{grade}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="print-header-bg font-bold">
              <td colSpan={3} className="border border-gray-600 px-2 py-1 text-right">Просек на класата:</td>
              <td className="border border-gray-600 px-2 py-1 text-center">{avg}%</td>
              <td className="border border-gray-600 px-2 py-1 text-center">
                {avg >= 85 ? 5 : avg >= 75 ? 4 : avg >= 65 ? 3 : avg >= 50 ? 2 : 1}
              </td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-4 text-[8pt] text-gray-600">
          <span className="font-bold">Вкупно ученици:</span> {entries.length} &nbsp;·&nbsp;
          <span className="font-bold">Совладале (≥80%):</span> {mastered} &nbsp;·&nbsp;
          <span className="font-bold">Во ризик (&lt;60%):</span> {atRisk}
        </div>
      </PrintShell>
    </div>
  )
);
GradebookPrintShell.displayName = 'GradebookPrintShell';
