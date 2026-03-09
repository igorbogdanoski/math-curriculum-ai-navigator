import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, BookOpen, Lightbulb, Star } from 'lucide-react';
import type { AdaptiveHomework } from '../../types';

interface Props {
  homework: AdaptiveHomework;
  studentName: string;
  onClose: () => void;
}

const LEVEL_STYLE: Record<string, { badge: string; border: string; title: string }> = {
  remedial:  { badge: 'bg-amber-100 text-amber-800 border-amber-300',  border: 'border-amber-400', title: '🌱 Ремедијална' },
  standard:  { badge: 'bg-blue-100 text-blue-800 border-blue-300',     border: 'border-blue-400',  title: '📘 Стандардна' },
  challenge: { badge: 'bg-violet-100 text-violet-800 border-violet-300', border: 'border-violet-400', title: '🚀 Предизвик' },
};

// The printable sheet — rendered off-screen, triggered via useReactToPrint
const HomeworkSheet = React.forwardRef<HTMLDivElement, { homework: AdaptiveHomework; studentName: string }>(
  ({ homework, studentName }, ref) => {
    const style = LEVEL_STYLE[homework.level] ?? LEVEL_STYLE.standard;
    const today = new Date().toLocaleDateString('mk-MK', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
      <div ref={ref} className="p-10 bg-white text-black font-sans hidden print:block">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide">Домашна задача</h1>
              <p className="text-base font-bold mt-1">{homework.conceptTitle} — {homework.gradeLevel}. одделение</p>
              <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full border ${style.badge}`}>
                {style.title}
              </span>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p className="font-bold">Датум: {today}</p>
              <p className="mt-1">Предмет: Математика</p>
            </div>
          </div>
          <div className="flex gap-8 mt-5">
            <div className="flex-1">
              <span className="text-xs font-bold uppercase">Ime и Презиме:</span>
              <div className="border-b border-black mt-5 w-full" />
            </div>
            <div className="w-28">
              <span className="text-xs font-bold uppercase">Поени:</span>
              <div className="border-b border-black mt-5 w-full" />
            </div>
          </div>
          {/* Encouragement banner */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
            <p className="text-sm italic text-gray-700">💬 {homework.encouragement}</p>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-7">
          {homework.exercises.map((ex) => (
            <div key={ex.number} className="break-inside-avoid">
              <div className="flex gap-3 items-start mb-1">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-black text-white text-sm font-black flex items-center justify-center">
                  {ex.number}
                </span>
                <p className="text-base font-semibold leading-snug">{ex.problem}</p>
              </div>
              {ex.hint && (
                <div className="ml-10 mt-1 flex items-start gap-1.5 text-xs text-gray-500 italic">
                  <span className="font-bold not-italic">💡 Совет:</span>
                  <span>{ex.hint}</span>
                </div>
              )}
              {/* Answer lines */}
              <div className="ml-10 mt-3 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border-b border-gray-300 h-7" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
          Генерирано со Math AI Navigator · Адаптирано за {studentName}
        </div>
      </div>
    );
  }
);
HomeworkSheet.displayName = 'HomeworkSheet';

// The interactive preview card shown in StudentPlayView
export const PrintableHomework: React.FC<Props> = ({ homework, studentName, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `DZ_${homework.conceptTitle.replace(/\s/g, '_')}_${studentName}`,
  });

  const style = LEVEL_STYLE[homework.level] ?? LEVEL_STYLE.standard;

  return (
    <>
      {/* Hidden printable sheet */}
      <HomeworkSheet ref={printRef} homework={homework} studentName={studentName} />

      {/* Visible preview card */}
      <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-sm overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white/10 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-white" />
            <p className="text-white font-bold text-sm">Домашна задача</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
              {style.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white text-xs transition"
          >
            ✕
          </button>
        </div>

        {/* Encouragement */}
        <div className="px-5 pt-3 pb-1">
          <p className="text-white/80 text-xs italic">💬 {homework.encouragement}</p>
        </div>

        {/* Exercise preview — first 3 */}
        <div className="px-5 py-3 space-y-3">
          {homework.exercises.slice(0, 3).map((ex) => (
            <div key={ex.number} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 text-white text-[10px] font-black flex items-center justify-center">
                {ex.number}
              </span>
              <div className="min-w-0">
                <p className="text-white/90 text-xs leading-snug">{ex.problem}</p>
                {ex.hint && (
                  <p className="flex items-center gap-1 text-white/50 text-[10px] italic mt-0.5">
                    <Lightbulb className="w-3 h-3 flex-shrink-0" />
                    {ex.hint}
                  </p>
                )}
              </div>
            </div>
          ))}
          {homework.exercises.length > 3 && (
            <p className="text-white/40 text-[10px] pl-8">
              + уште {homework.exercises.length - 3} задачи во испринтаната верзија
            </p>
          )}
        </div>

        {/* Print button */}
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="w-full flex items-center justify-center gap-2 bg-white text-indigo-700 font-black text-sm py-2.5 rounded-xl hover:bg-indigo-50 transition shadow"
          >
            <Printer className="w-4 h-4" />
            Печати / Зачувај PDF
          </button>
        </div>

        {/* Stars decoration */}
        <div className="flex justify-center gap-1 pb-3">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3 h-3 text-yellow-300/60 fill-yellow-300/60" />
          ))}
        </div>
      </div>
    </>
  );
};
