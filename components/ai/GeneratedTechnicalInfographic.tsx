import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { Card } from '../common/Card';
import type { AIGeneratedTechnicalInfographic, MultiLangText } from '../../types';
import { LANGUAGES, type Language } from '../../i18n';

interface GeneratedTechnicalInfographicProps {
  material: AIGeneratedTechnicalInfographic;
}

/** Text is pre-translated once at generation time (see services/gemini/creativeContent.ts) —
 *  switching language here only picks a different key, it never re-generates the image
 *  or re-calls the AI. */
export const GeneratedTechnicalInfographic: React.FC<GeneratedTechnicalInfographicProps> = ({ material }) => {
  const [lang, setLang] = useState<Language>('mk');

  if (material.error) {
    return <p className="text-red-500">{material.error}</p>;
  }

  const pick = (text: MultiLangText) => text[lang] || text.en;

  return (
    <Card id="printable-area" className="mt-6 border-l-4 border-pink-500">
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-2xl font-bold">{pick(material.title)}</h3>
          <p className="text-sm text-gray-500 mt-1">Технички инфографик</p>
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
            title="Печати го инфографикот"
          >
            <Printer className="w-5 h-5 mr-1" />
            Печати
          </button>
        </div>
      </div>

      <div className="flex justify-center items-center bg-white p-4 rounded-lg border border-gray-100 mb-5">
        <img
          src={material.imageUrl}
          alt={pick(material.title)}
          className="max-w-full max-h-[420px] object-contain"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {material.sections.map((section) => (
          <div key={section.key} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
              {pick(section.heading)}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{pick(section.body)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
