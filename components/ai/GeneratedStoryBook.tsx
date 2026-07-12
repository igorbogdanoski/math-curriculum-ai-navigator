import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { Card } from '../common/Card';
import type { AIGeneratedStoryBook, MultiLangText } from '../../types';
import { LANGUAGES, type Language } from '../../i18n';

interface GeneratedStoryBookProps {
  material: AIGeneratedStoryBook;
}

/** Text is pre-translated once at generation time (see services/gemini/creativeContent.ts) —
 *  switching language here only picks a different key, it never re-generates the image
 *  or re-calls the AI. */
export const GeneratedStoryBook: React.FC<GeneratedStoryBookProps> = ({ material }) => {
  const [lang, setLang] = useState<Language>('mk');
  const [pageIndex, setPageIndex] = useState(0);

  if (material.error) {
    return <p className="text-red-500">{material.error}</p>;
  }

  const pick = (text: MultiLangText) => text[lang] || text.en;
  const page = material.pages[pageIndex];
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < material.pages.length - 1;

  return (
    <Card id="printable-area" className="mt-6 border-l-4 border-pink-500">
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-2xl font-bold">{pick(material.title)}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Детска математичка сликовница · {material.ageRange} години · страница {pageIndex + 1}/{material.pages.length}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            aria-label="Избери јазик на текстот"
            className="text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg py-2 px-2.5"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
            title="Печати ја сликовницата"
          >
            <Printer className="w-5 h-5 mr-1" />
            Печати
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex justify-center items-center bg-gray-100 p-4 rounded-lg w-full">
          <img
            src={page.imageUrl}
            alt={pick(page.caption)}
            className="max-w-full max-h-[500px] object-contain rounded-md shadow-md"
          />
        </div>
        <p className="text-lg text-center text-gray-800 font-medium max-w-2xl leading-relaxed">
          {pick(page.caption)}
        </p>

        <div className="no-print flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={!canPrev}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Претходна
          </button>
          <div className="flex gap-1.5">
            {material.pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPageIndex(i)}
                aria-label={`Страница ${i + 1}`}
                className={`w-2.5 h-2.5 rounded-full transition-all ${i === pageIndex ? 'bg-pink-500 w-6' : 'bg-gray-300 hover:bg-gray-400'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.min(material.pages.length - 1, i + 1))}
            disabled={!canNext}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Следна <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Print view — all pages stacked, since window.print() only sees what's rendered */}
      <div className="hidden print:block mt-6 space-y-8">
        {material.pages.slice(1).map((p, i) => (
          <div key={i} className="flex flex-col items-center gap-3 break-inside-avoid">
            <img src={p.imageUrl} alt={pick(p.caption)} className="max-w-full max-h-[500px] object-contain rounded-md" />
            <p className="text-lg text-center text-gray-800 font-medium max-w-2xl leading-relaxed">{pick(p.caption)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
