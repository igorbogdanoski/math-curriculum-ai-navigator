import React from 'react';
import { QuizResult } from '../../services/firestoreService';

interface PrintableEDnevnikReportProps {
  results: QuizResult[];
  className?: string;
  reportContext?: string; // e.g. "Класен извештај за [Месец]"
}

export const PrintableEDnevnikReport = React.forwardRef<HTMLDivElement, PrintableEDnevnikReportProps>(
  ({ results, className = '', reportContext = "Официјален извештај од тестирање (е-Дневник)" }, ref) => {
    
    // Sort logically (by date descending usually, or alphabetical by concept)
    const sortedResults = [...results].sort((a, b) => {
      const dbA = a.playedAt?.toMillis?.() || 0;
      const dbB = b.playedAt?.toMillis?.() || 0;
      return dbB - dbA;
    });

    const calculateGrade = (percentage: number): number => {
      if (percentage < 30) return 1;
      if (percentage < 50) return 2;
      if (percentage < 70) return 3;
      if (percentage < 85) return 4;
      return 5;
    };

    return (
      <div className={`bg-white p-8 ${className}`} ref={ref}>
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold uppercase mb-2">МИНИСТЕРСТВО ЗА ОБРАЗОВАНИЕ И НАУКА</h1>
          <h2 className="text-xl font-semibold">{reportContext}</h2>
          <p className="text-sm text-gray-600 mt-2">Датум на генерирање: {new Date().toLocaleDateString('mk-MK')}</p>
        </div>

        <table className="w-full text-left border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-200">
              <th className="border border-gray-300 p-2 font-bold text-sm">Ученик / Идентификатор</th>
              <th className="border border-gray-300 p-2 font-bold text-sm">Тема / Квиз</th>
              <th className="border border-gray-300 p-2 font-bold text-sm">Поени (Освоени/Макс)</th>
              <th className="border border-gray-300 p-2 font-bold text-sm">Процент</th>
              <th className="border border-gray-300 p-2 font-bold text-sm bg-blue-50/50 print:bg-transparent">Оценка (1-5)</th>
              <th className="border border-gray-300 p-2 font-bold text-sm">Датум</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((r, idx) => {
              const perc = Math.round(r.percentage);
              const grade = calculateGrade(perc);
              
              return (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 text-sm font-medium">{r.studentName || 'Анонимен'}</td>
                  <td className="border border-gray-300 p-2 text-sm">{r.quizTitle}</td>
                  <td className="border border-gray-300 p-2 text-sm">{r.correctCount} / {r.totalQuestions}</td>
                  <td className="border border-gray-300 p-2 text-sm">{perc}%</td>
                  <td className="border border-gray-300 p-2 text-sm font-bold text-center">{grade}</td>
                  <td className="border border-gray-300 p-2 text-sm">{r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-12 flex justify-between px-10">
          <div className="text-center">
            <p className="mb-8">Одговорен наставник:</p>
            <div className="border-b border-black w-48 mx-auto"></div>
          </div>
          <div className="text-center">
            <p className="mb-8">Директор:</p>
            <div className="border-b border-black w-48 mx-auto"></div>
          </div>
        </div>

        {/* CSS for print mode */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 20mm; }
          }
        `}} />
      </div>
    );
  }
);
