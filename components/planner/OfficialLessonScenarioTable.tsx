import React from 'react';
import type { LessonPlan } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

interface OfficialLessonScenarioTableProps {
  plan: LessonPlan | Omit<LessonPlan, 'id'>;
}

export const OfficialLessonScenarioTable: React.FC<OfficialLessonScenarioTableProps> = ({ plan }) => {
  // Helper to safely get text from scenario steps
  const getStepText = (step: any) => {
    if (!step) return '';
    if (typeof step === 'string') return step;
    return step.text || '';
  };

  return (
    <div className="official-lesson-scenario bg-white p-4 print:p-0 print:m-0 text-black font-serif leading-tight">
      {/* --- HEADER --- */}
      <div className="border-2 border-black mb-4 overflow-hidden">
        <div className="bg-blue-600 print:bg-blue-600 text-white p-2 border-b-2 border-black font-bold text-center uppercase">
          Сценарио за наставен час
        </div>
        <div className="grid grid-cols-2">
          <div className="p-2 border-r-2 border-black bg-blue-600 text-white font-semibold">
            Предмет: {plan.subject || 'Математика за VII одделение'}
          </div>
          <div className="p-2"></div>
          
          <div className="p-2 border-t-2 border-r-2 border-black flex items-center">
            <span className="font-bold mr-2">Тема:</span>
            <span className="uppercase font-bold underline italic tracking-tight">{plan.theme || 'Операции со броеви'}</span>
          </div>
          <div className="p-2 border-t-2 border-black flex items-center">
            <span className="font-bold mr-2">Време за реализација:</span>
            <span>{plan.scenario?.introductory?.duration || (plan as any).scenario?.intro?.duration || '45 мин'}</span>
          </div>
          
          <div className="p-2 border-t-2 border-r-2 border-black">
             <span className="font-bold mr-2">Изготвил/-а:</span>
             <span className="border-b border-black border-dotted flex-grow inline-block min-w-[200px]">
               {plan.authorName || '________________________________'}
             </span>
          </div>
          <div className="p-2 border-t-2 border-black">
             <span className="font-bold mr-2">од ООУ:</span>
             <span className="border-b border-black border-dotted flex-grow inline-block min-w-[200px]">
               {plan.schoolName || '________________________________'}
             </span>
          </div>
        </div>
      </div>

      {/* --- TABLE --- */}
      <table className="w-full border-collapse border-2 border-black text-[12px]">
        <thead>
          <tr className="bg-gray-50 text-center font-bold">
            <th className="border border-black p-2 w-[15%]">содржини (и поими)</th>
            <th className="border border-black p-2 w-[15%]">стандарди за оценување</th>
            <th className="border border-black p-2 w-[10%]">час и дата на реализација</th>
            <th className="border border-black p-2 w-[35%] uppercase">Сценарио</th>
            <th className="border border-black p-2 w-[10%] uppercase">средства</th>
            <th className="border border-black p-2 w-[15%]">следење на напредокот</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 align-top text-center font-medium">
              <MathRenderer text={Array.isArray((plan as any).concepts) ? (plan as any).concepts.map((c: any) => c.title).join(', ') : plan.title} />
            </td>
            <td className="border border-black p-2 align-top text-left italic">
              <ul className="list-none space-y-2">
                {(plan.assessmentStandards || []).map((std, i) => (
                  <li key={i}><MathRenderer text={std} /></li>
                ))}
              </ul>
            </td>
            <td className="border border-black p-2 align-top text-center font-bold">
               {plan.lessonNumber || 1}<br />
               <span className="text-[10px] font-normal">
                 {new Date().toLocaleDateString('mk-MK')}<br />
                 (бр. во дневник - за ориентација)
               </span>
            </td>
            <td className="border border-black p-2 align-top">
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold underline mb-2">Воведна активност:</h4>
                  <div className="pl-2 space-y-2">
                    <MathRenderer text={getStepText(plan.scenario?.introductory || (plan as any).scenario?.intro || '')} />
                    {(plan.scenario?.introductory?.duration || (plan as any).scenario?.intro?.duration) && (
                       <p className="mt-2 font-bold italic">({plan.scenario?.introductory?.duration || (plan as any).scenario?.intro?.duration})</p>
                    )}
                  </div>
                </section>
                
                <section>
                  <h4 className="font-bold underline mb-2 uppercase">Главна активност:</h4>
                  <div className="pl-2 space-y-4">
                    {Array.isArray(plan.scenario?.main || (plan as any).scenario?.activities) ? (plan.scenario?.main || (plan as any).scenario?.activities || []).map((step: any, i: number) => (
                      <div key={i} className="flex">
                        <span className="font-bold mr-2">{i + 1}.</span>
                        <div><MathRenderer text={getStepText(step)} /></div>
                      </div>
                    )) : (
                      <div><MathRenderer text={getStepText(plan.scenario?.main || (plan as any).scenario?.activities)} /></div>
                    )}
                    {(plan as any).mainDuration && (
                       <p className="mt-2 font-bold italic">({(plan as any).mainDuration})</p>
                    )}
                  </div>
                </section>
                
                <section>
                  <h4 className="font-bold underline mb-2 uppercase">Завршна активност:</h4>
                  <div className="pl-2 space-y-4">
                    <MathRenderer text={getStepText(plan.scenario?.concluding || (plan as any).scenario?.conclusion || '')} />
                    
                    {/* Reflection questions often included in concluding step or separately */}
                    {plan.selfAssessmentPrompt && (
                      <div className="mt-4 border-t border-black pt-2">
                        <MathRenderer text={plan.selfAssessmentPrompt} />
                      </div>
                    )}

                    <div className="mt-4">
                      <span className="font-bold">Домашна работа:</span>
                      <p className="italic">Учениците треба да ги завршат задачите од работниот лист.</p>
                    </div>
                    {(plan.scenario?.concluding?.duration || (plan as any).scenario?.conclusion?.duration) && (
                       <p className="mt-2 font-bold italic">({plan.scenario?.concluding?.duration || (plan as any).scenario?.conclusion?.duration})</p>
                    )}
                  </div>
                </section>
              </div>
            </td>
            <td className="border border-black p-2 align-top">
               <ul className="list-none space-y-1">
                 {(plan.materials || []).map((mat, i) => (
                   <li key={i} className="flex">
                     <span className="mr-1">•</span>
                     <MathRenderer text={mat} />
                   </li>
                 ))}
               </ul>
            </td>
            <td className="border border-black p-2 align-top">
               <ul className="list-none space-y-2">
                 {(plan.progressMonitoring || []).map((mon, i) => (
                   <li key={i} className="flex">
                     <span className="mr-1">•</span>
                     <MathRenderer text={mon} />
                   </li>
                 ))}
               </ul>
            </td>
          </tr>
        </tbody>
      </table>
      
      {/* CSS for print optimization */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .official-lesson-scenario, .official-lesson-scenario * { visibility: visible; }
          .official-lesson-scenario { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 0;
            margin: 0;
          }
          table { border-width: 2px !important; border-color: black !important; }
          th, td { border-width: 1px !important; border-color: black !important; }
          @page { size: A4; margin: 1cm; }
        }
      `}} />
    </div>
  );
};
