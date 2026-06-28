/**
 * ParentLetterModal — S92
 * AI-генерира родителско писмо по завршена тема/недела.
 * Поддржува МК / СК / ТР / АЛ.
 */
import React, { useState } from 'react';
import { X, Mail, Copy, Check, Loader2, Languages } from 'lucide-react';
import { reportsAPI } from '../../services/gemini/reports';

interface Props {
  topicTitle: string;
  gradeLevel: number;
  objectives: string[];
  weekNumber?: number;
  onClose: () => void;
}

type Lang = 'mk' | 'sq' | 'tr' | 'en';

const LANG_OPTIONS: { id: Lang; label: string; flag: string }[] = [
  { id: 'mk', label: 'Македонски',  flag: '🇲🇰' },
  { id: 'sq', label: 'Shqip',        flag: '🇦🇱' },
  { id: 'tr', label: 'Türkçe',       flag: '🇹🇷' },
  { id: 'en', label: 'English',      flag: '🇬🇧' },
];

export const ParentLetterModal: React.FC<Props> = ({
  topicTitle, gradeLevel, objectives, weekNumber, onClose,
}) => {
  const [lang, setLang] = useState<Lang>('mk');
  const [letterText, setLetterText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setLetterText('');
    try {
      const text = await reportsAPI.generateTopicParentLetter({
        topicTitle,
        gradeLevel,
        objectives,
        weekNumber,
        language: lang,
      });
      setLetterText(text);
    } catch (e) {
      setError('Грешка при генерирање. Провери AI квота и обиди се повторно.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!letterText) return;
    await navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-500" />
              Родителско писмо
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-sm">
              Тема: „{topicTitle}" · {gradeLevel}. одд.{weekNumber ? ` · Нед. ${weekNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Language selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" /> Јазик на писмото
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {LANG_OPTIONS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setLang(l.id); setLetterText(''); }}
                  className={`py-2 px-1 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                    lang === l.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Objectives preview */}
          {objectives.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Совладани исходи (се вклучуваат во писмото)</p>
              <ul className="space-y-0.5">
                {objectives.slice(0, 4).map((o, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                    <span>{o}</span>
                  </li>
                ))}
                {objectives.length > 4 && (
                  <li className="text-xs text-slate-400">+{objectives.length - 4} повеќе...</li>
                )}
              </ul>
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:bg-gray-300 text-sm"
          >
            {isGenerating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерирам...</>
              : <><Mail className="w-4 h-4" /> Генерирај писмо</>
            }
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>
          )}

          {/* Generated letter */}
          {letterText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Генерирано писмо</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Копирано!' : 'Копирај'}
                </button>
              </div>
              <textarea
                value={letterText}
                onChange={e => setLetterText(e.target.value)}
                rows={10}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed text-slate-700"
              />
              <p className="text-[10px] text-slate-400">Можеш да го уредиш текстот пред да го испратиш.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Затвори
          </button>
        </div>
      </div>
    </div>
  );
};
