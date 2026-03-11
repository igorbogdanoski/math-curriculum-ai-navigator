import React from 'react';
import type { AIGeneratedThematicPlan, Grade, Topic } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

interface OfficialThematicPlanTableProps {
  data: AIGeneratedThematicPlan;
  grade?: Grade;
  topic?: Topic;
  authorName?: string;
  schoolName?: string;
}

export const OfficialThematicPlanTable: React.FC<OfficialThematicPlanTableProps> = ({ 
  data, 
  grade, 
  topic, 
  authorName, 
  schoolName 
}) => {
  const totalHours = data.lessons.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

  return (
    <div className="official-thematic-plan bg-white p-4 print:p-0 print:m-0 text-black font-serif leading-tight">
      {/* --- PAGE HEADER (Optional but helpful) --- */}
      <div className="text-center mb-6 no-print">
        <h1 className="text-xl font-bold uppercase underline">
          ПЛАНИРАЊЕ НА НАСТАВАТА ПО МАТЕРИЈАЛИ ЗА {grade?.title || 'ШЕСТО'} ОДДЕЛЕНИЕ СПОРЕД НАСТАВНАТА ПРОГРАМА
        </h1>
      </div>

      {/* --- TABLE HEADER --- */}
      <div className="border-2 border-black mb-4 overflow-hidden">
        <div className="bg-[#1e40af] print:bg-[#1e40af] text-white p-2 border-b-2 border-black font-bold">
          Предмет: Математика
        </div>
        <div className="grid grid-cols-12">
          <div className="col-span-3 p-2 border-r-2 border-black font-bold">
            Тема: <span className="uppercase">{data.thematicUnit || topic?.title}</span>
          </div>
          <div className="col-span-3 p-2 border-r-2 border-black font-bold text-center">
            Вкупно часа: {totalHours || topic?.suggestedHours || ''}
          </div>
          <div className="col-span-6 p-2 font-bold text-right italic">
            Време за реализација: _______________
          </div>
          
          <div className="col-span-6 p-2 border-t-2 border-r-2 border-black">
             <span className="font-bold mr-2">Изготвиле:</span>
             <span className="border-b border-black border-dotted flex-grow inline-block min-w-[200px]">
               {authorName || '________________________________'}
             </span>
          </div>
          <div className="col-span-6 p-2 border-t-2 border-black text-right">
             <span className="font-bold mr-2">од ОУ:</span>
             <span className="border-b border-black border-dotted flex-grow inline-block min-w-[200px]">
               {schoolName || '________________________________'}
             </span>
          </div>
          <div className="col-span-6 p-2 border-t-2 border-r-2 border-black">
             <span className="font-bold mr-2">Адаптирале:</span>
             <span className="border-b border-black border-dotted flex-grow inline-block min-w-[200px]">
               ________________________________
             </span>
          </div>
          <div className="col-span-6 p-2 border-t-2 border-black text-right">
             <span className="font-bold mr-2">од ОУ:</span>
             <span className="border-b border-black border-dotted flex-grow inline-block min-w-[200px]">
               ________________________________
             </span>
          </div>
        </div>
      </div>

      {/* --- MAIN TABLE --- */}
      <table className="w-full border-collapse border-2 border-black text-[12px]">
        <thead>
          <tr className="bg-gray-50 text-center font-bold h-12">
            <th className="border border-black p-2 w-[18%]">содржини (и поими)</th>
            <th className="border border-black p-2 w-[18%]">стандарди за оценување</th>
            <th className="border border-black p-2 w-[8%]">часови</th>
            <th className="border border-black p-2 w-[30%]">активности</th>
            <th className="border border-black p-2 w-[11%]">средства</th>
            <th className="border border-black p-2 w-[15%]">следење на напредокот</th>
          </tr>
        </thead>
        <tbody>
          {data.lessons.map((lesson, idx) => (
            <tr key={idx} className="border-b border-black last:border-b-0">
              <td className="border border-black p-2 align-top text-left font-medium leading-normal">
                <MathRenderer text={lesson.lessonUnit} />
              </td>
              <td className="border border-black p-2 align-top text-left italic leading-normal">
                 <MathRenderer text={lesson.learningOutcomes} />
              </td>
              <td className="border border-black p-2 align-top text-center font-bold">
                {lesson.hours || ''}
              </td>
              <td className="border border-black p-2 align-top text-left leading-relaxed">
                 <MathRenderer text={lesson.keyActivities} />
              </td>
              <td className="border border-black p-2 align-top text-left leading-normal">
                 <ul className="list-disc list-outside ml-3 space-y-1">
                   {(typeof lesson.resources === 'string' ? lesson.resources.split(',') : []).map((res, i) => (
                     <li key={i}><MathRenderer text={res.trim()} /></li>
                   ))}
                 </ul>
              </td>
              <td className="border border-black p-2 align-top text-left leading-normal">
                 <ul className="list-disc list-outside ml-3 space-y-2">
                    {(typeof lesson.assessment === 'string' ? lesson.assessment.split(';') : []).map((item, i) => (
                      <li key={i}><MathRenderer text={item.trim()} /></li>
                    ))}
                 </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CSS for print optimization */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .official-thematic-plan, .official-thematic-plan * { visibility: visible; }
          .official-thematic-plan { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 0;
            margin: 0;
          }
          table { border-width: 2px !important; border-color: black !important; }
          th, td { border-width: 1px !important; border-color: black !important; padding: 6px !important; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 1cm; }
        }
      `}} />
    </div>
  );
};
