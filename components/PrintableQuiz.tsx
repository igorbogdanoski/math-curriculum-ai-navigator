import React from 'react';

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
            <div className="flex gap-2 font-bold text-lg mb-2">
                <span>{i + 1}.</span>
                <span>{q.question}</span>
            </div>
            
            {/* ОПЦИИ (Ако има) */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-8 ml-6 mt-3">
              {q.options.map((opt: string, j: number) => (
                <div key={j} className="flex items-center gap-3">
                   <div className="w-5 h-5 border-2 border-black rounded-full flex-shrink-0"></div>
                   <span className="text-base">{opt}</span>
                </div>
              ))}
            </div>
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
