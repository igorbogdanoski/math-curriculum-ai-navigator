import React from 'react';
import type { LessonPlan } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

// Legacy/alternative field names that may appear in AI-generated plans
interface LessonPlanLegacy {
  concepts?: Array<{ title?: string }>;
  mainDuration?: string;
  scenario?: {
    intro?: { text?: string; duration?: string };
    activities?: Array<{ text?: string } | string>;
    conclusion?: { text?: string; duration?: string };
  };
}

interface OfficialLessonScenarioTableProps {
  plan: LessonPlan | Omit<LessonPlan, 'id'>;
}

export const OfficialLessonScenarioTable: React.FC<OfficialLessonScenarioTableProps> = ({ plan }) => {
  const legacy = plan as unknown as LessonPlanLegacy;

  // Helper to safely get text from scenario steps
  const getStepText = (step: { text?: string } | string | null | undefined): string => {
    if (!step) return '';
    if (typeof step === 'string') return step;
    return step.text || '';
  };

  const mainSteps = plan.scenario?.main ?? legacy.scenario?.activities ?? [];
  const introDuration = plan.scenario?.introductory?.duration ?? legacy.scenario?.intro?.duration;
  const concludingDuration = plan.scenario?.concluding?.duration ?? legacy.scenario?.conclusion?.duration;

  return (
    <div className="official-lesson-scenario bg-white p-4 print:p-0 print:m-0 text-black font-serif leading-tight">
      {/* --- HEADER --- */}
      <div className="border-2 border-black mb-4 overflow-hidden">
        <div className="bg-blue-600 print:bg-blue-600 text-white p-2 border-b-2 border-black font-bold text-center uppercase">
          Сценарио за наставен час
        </div>
        <div className="grid grid-cols-3">
          <div className="p-2 border-r-2 border-black bg-blue-600 text-white font-semibold col-span-2">
            Предмет: {plan.subject || 'Математика за VII одделение'}
          </div>
          <div className="p-2 border-l border-black bg-gray-50 flex flex-col justify-center items-center">
             <span className="font-bold text-[10px] uppercase">час и дата на реализација</span>
             <div className="text-center font-bold">
               {plan.lessonNumber || 1} / {new Date().toLocaleDateString('mk-MK')}
             </div>
          </div>

          <div className="p-2 border-t-2 border-r-2 border-black flex items-center col-span-2">
            <span className="font-bold mr-2">Тема:</span>
            <span className="uppercase font-bold underline italic tracking-tight">{plan.theme || 'Операции со броеви'}</span>
          </div>
          <div className="p-2 border-t-2 border-black flex items-center">
            <span className="font-bold mr-2">Време за реализација:</span>
            <span>40 мин</span>
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
            <th className="border border-black p-2 w-[20%]">стандарди за оценување</th>
            <th className="border border-black p-2 w-[40%] uppercase">Сценарио</th>
            <th className="border border-black p-2 w-[10%] uppercase">средства</th>
            <th className="border border-black p-2 w-[15%]">следење на напредокот</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 align-top text-center font-medium">
              <MathRenderer text={Array.isArray(legacy.concepts) ? legacy.concepts.map(c => c?.title || '').join(', ') : (plan.title || '')} />
            </td>
            <td className="border border-black p-2 align-top text-left italic">
              <ul className="list-none space-y-2">
                {Array.isArray(plan.assessmentStandards) && plan.assessmentStandards.map((std, i) => (
                  <li key={i}><MathRenderer text={std} /></li>
                ))}
              </ul>
            </td>
            <td className="border border-black p-2 align-top">
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold underline mb-2">Воведна активност:</h4>
                  <div className="pl-2 space-y-2">
                    <MathRenderer text={getStepText(plan.scenario?.introductory ?? legacy.scenario?.intro ?? '')} />
                    {introDuration && (
                       <p className="mt-2 font-bold italic">({introDuration})</p>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="font-bold underline mb-2 uppercase">Главна активност:</h4>
                  <div className="pl-2 space-y-4">
                    {Array.isArray(mainSteps) ? mainSteps.map((step, i) => (
                      <div key={i} className="flex">
                        <span className="font-bold mr-2">{i + 1}.</span>
                        <div><MathRenderer text={getStepText(step)} /></div>
                      </div>
                    )) : (
                      <div><MathRenderer text={getStepText(plan.scenario?.main?.[0])} /></div>
                    )}
                    {legacy.mainDuration && (
                       <p className="mt-2 font-bold italic">({legacy.mainDuration})</p>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="font-bold underline mb-2 uppercase">Завршна активност:</h4>
                  <div className="pl-2 space-y-4">
                    <MathRenderer text={getStepText(plan.scenario?.concluding ?? legacy.scenario?.conclusion ?? '')} />

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
                    {concludingDuration && (
                       <p className="mt-2 font-bold italic">({concludingDuration})</p>
                    )}
                  </div>
                </section>

                {plan.illustrationUrl && (
                  <section className="mt-4 pt-4 border-t border-black">
                    <h4 className="font-bold underline mb-2 uppercase">Визуелна илустрација / Приказ:</h4>
                    <div className="flex justify-center">
                      <img
                        src={plan.illustrationUrl}
                        alt="Илустрација за часот"
                        className="max-w-[300px] border border-black shadow-sm"
                      />
                    </div>
                  </section>
                )}
              </div>
            </td>
            <td className="border border-black p-2 align-top">
               <ul className="list-none space-y-1">
                 {Array.isArray(plan.materials) && plan.materials.map((mat, i) => (
                   <li key={i} className="flex">
                     <span className="mr-1">•</span>
                     <MathRenderer text={mat} />
                   </li>
                 ))}
               </ul>
            </td>
            <td className="border border-black p-2 align-top">
               <ul className="list-none space-y-2">
                 {Array.isArray(plan.progressMonitoring) && plan.progressMonitoring.map((mon, i) => (
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
          @page { size: landscape; margin: 1cm; }
        }
      `}} />
    </div>
  );
};
