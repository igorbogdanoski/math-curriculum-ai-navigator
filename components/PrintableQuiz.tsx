import React from 'react';
import { MathRenderer } from './common/MathRenderer';

export const PrintableQuiz = React.forwardRef(({ title, questions, grade }: any, ref: any) => {
  return (
    <div ref={ref} className="print-container p-10 bg-white text-black hidden print:block">
      {/* ЗАГЛАВИЕ НА ТЕСТОТ */}
      <div className="border-b-2 border-black pb-4 mb-8">
        <div className="flex justify-between items-end mb-4">
            <div>
                <h1 className="text-3xl font-bold uppercase tracking-wide">{title}</h1>
                <p className="text-gray-600 mt-1">Предмет: Математика | Одделение: {grade}</p>
            </div>
            <div className="text-right">
                <div className="text-sm text-gray-500">Датум</div>
                <div className="w-32 border-b border-black mt-4"></div>
            </div>
        </div>
        
        <div className="flex justify-between mt-6">
            <div className="flex-1">
                <span className="text-sm font-bold uppercase">Име и Презиме:</span>
                <div className="border-b border-black mt-6 w-full"></div>
            </div>
            <div className="w-24 ml-8">
                <span className="text-sm font-bold uppercase">Поени:</span>
                <div className="border-b border-black mt-6 w-full"></div>
            </div>
        </div>
      </div>

      {/* ПРАШАЊА */}
      <div className="space-y-8">
        {questions.map((q: any, i: number) => (
          <div key={i} className="break-inside-avoid">
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 font-bold text-lg">
                <span>{i + 1}.</span>
                <div className="flex-1">
                  <MathRenderer text={q.question} />
                  {q.isWorkedExample && (
                    <span className="ml-2 text-xs uppercase font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                      Решен пример
                    </span>
                  )}
                </div>
              </div>
              {q.cognitiveLevel && (
                <span className="text-[10px] uppercase text-gray-500 font-bold px-2 py-1 bg-gray-50 border border-gray-200 rounded">
                  {q.cognitiveLevel}
                </span>
              )}
            </div>

            {q.isWorkedExample ? (
              <div className="ml-6 mt-3 p-4 bg-gray-50 border border-gray-300 rounded italic text-gray-800 text-sm">
                <div className="font-bold mb-1 text-gray-600 uppercase text-xs">Решение:</div>
                <MathRenderer text={q.explanation || q.answer || ''} />
              </div>
            ) : (
              /* ОПЦИИ (Ако има) */
              <div className="grid grid-cols-2 gap-y-3 gap-x-8 ml-6 mt-3">
                {q.options && q.options.map((opt: string, j: number) => (
                    <div key={j} className="flex items-start gap-3">
                       <div className="w-5 h-5 border-2 border-black rounded-full flex-shrink-0 mt-1"></div>
                       <div className="text-base flex-1"><MathRenderer text={opt} /></div>
                  </div>
                ))}
                {(!q.options || q.options.length === 0) && (
                   <div className="col-span-2 space-y-6 mt-4">
                     <div className="border-b border-gray-300 w-full"></div>
                     <div className="border-b border-gray-300 w-full"></div>
                     <div className="border-b border-gray-300 w-full"></div>
                   </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* ФУТЕР */}
      <div className="fixed bottom-0 left-0 w-full text-center text-xs text-gray-400 border-t pt-2 pb-4">
          Генерирано со Math Curriculum AI Navigator
      </div>
    </div>
  );
});
