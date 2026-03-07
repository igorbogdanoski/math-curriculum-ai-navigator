import React from 'react';
import { GeneratedTest } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

interface PrintableTestProps {
  test: GeneratedTest;
  showKeys?: boolean;
}

export const PrintableTest = React.forwardRef<HTMLDivElement, PrintableTestProps>(
  ({ test, showKeys = true }, ref) => {
    return (
      <div ref={ref} className="bg-white text-black p-10 print-container" style={{ width: '100%', minHeight: '297mm' }}>
        {/* Style specific aimed at print */}
        <style dangerouslySetInlineStyle={{
          __html: `
            @media print {
              @page { size: A4 portrait; margin: 20mm; }
              body { -webkit-print-color-adjust: exact; }
              .page-break { page-break-before: always; }
              .avoid-break { page-break-inside: avoid; }
            }
          `
        }} />

        {test.groups.map((group, groupIndex) => (
          <div key={groupIndex} className={groupIndex > 0 ? 'page-break' : ''}>
            {/* Header */}
            <div className="border-b-2 border-black pb-4 mb-8">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h1 className="text-3xl font-bold uppercase tracking-wide">{test.title}</h1>
                  <h2 className="text-xl font-semibold mt-2 text-gray-700">Група: {group.groupName}</h2>
                  <p className="text-gray-600 mt-1">Одделение: {test.gradeLevel} | Предмет: Математика</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-800">Датум:</div>
                  <div className="w-32 border-b border-black mt-4"></div>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <div className="flex-1">
                  <span className="text-sm font-bold uppercase text-gray-800">Име и Презиме:</span>
                  <div className="border-b border-black mt-6 w-full max-w-[80%]"></div>
                </div>
                <div className="w-24 ml-8">
                  <span className="text-sm font-bold uppercase text-gray-800">Поени:</span>
                  <div className="border-b border-black mt-6 w-full"></div>
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="space-y-8">
              {group.questions.map((q, i) => (
                <div key={q.id} className="avoid-break mb-6">
                  <div className="flex gap-2 font-semibold text-lg mb-3 text-gray-900">
                    <span className="min-w-[24px]">{i + 1}.</span>
                    <div className="flex-1">
                      <MathRenderer text={q.text} />
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({q.points} поен{q.points !== 1 ? 'и' : ''})
                      </span>
                    </div>
                  </div>

                  {q.type === 'multiple-choice' && q.options && (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 ml-8 mt-4">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-start gap-3">
                          <span className="font-medium mt-[2px]">{String.fromCharCode(97 + oi)})</span>
                          <div className="flex-1">
                            <MathRenderer text={opt} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type !== 'multiple-choice' && (
                    <div className="ml-8 mt-6">
                      <div className="h-24 border border-dashed border-gray-300 rounded bg-gray-50/30 flex items-center justify-center text-gray-400 text-sm">
                        [Простор за решавање]
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Answer Key - Optional */}
        {showKeys && (
          <div className="page-break mt-10">
            <h2 className="text-2xl font-bold border-b-2 border-black pb-2 mb-6">Клуч за одговори (За наставникот)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {test.groups.map((group, index) => (
                <div key={index} className="avoid-break bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-lg mb-4 text-blue-800">{group.groupName}</h3>
                  <div className="space-y-3">
                    {group.questions.map((q, i) => (
                      <div key={q.id} className="flex gap-2 text-sm">
                         <span className="font-bold w-6">{i + 1}.</span>
                         <div className="flex-1 font-medium text-green-700">
                           <MathRenderer text={q.correctAnswer} />
                         </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-300 font-bold">
                    Вкупно поени: {group.questions.reduce((sum, q) => sum + q.points, 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

PrintableTest.displayName = 'PrintableTest';
