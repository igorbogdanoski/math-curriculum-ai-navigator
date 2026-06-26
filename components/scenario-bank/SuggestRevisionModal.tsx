import React, { useState } from 'react';
import { X, Lightbulb, Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import type { ScenarioSuggestion } from '../../services/firestoreService.scenarioSuggestions';
import { submitSuggestion } from '../../services/firestoreService.scenarioSuggestions';

interface Props {
  scenario: ScenarioBankEntry;
  authorUid: string;
  authorName: string;
  schoolName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const SECTIONS: { value: ScenarioSuggestion['section']; labelMk: string; labelSq: string; labelTr: string; labelEn: string }[] = [
  { value: 'intro',       labelMk: 'Воведна активност',   labelSq: 'Aktiviteti hyrës',    labelTr: 'Giriş aktivitesi',   labelEn: 'Introduction' },
  { value: 'main',        labelMk: 'Главни активности',    labelSq: 'Aktivitetet kryesore', labelTr: 'Ana aktiviteler',   labelEn: 'Main activities' },
  { value: 'concluding',  labelMk: 'Завршна активност',    labelSq: 'Aktiviteti përfundimtar', labelTr: 'Kapanış aktivitesi', labelEn: 'Conclusion' },
  { value: 'objectives',  labelMk: 'Цели на часот',        labelSq: 'Objektivat',           labelTr: 'Hedefler',          labelEn: 'Objectives' },
  { value: 'general',     labelMk: 'Општа забелешка',      labelSq: 'Vërejtje e përgjithshme', labelTr: 'Genel yorum',  labelEn: 'General note' },
];

const I18N = {
  mk: {
    title: 'Предложи измена',
    subtitle: 'Lesson Study: твојот предлог ќе биде испратен до авторот.',
    section: 'Дел на сценариото',
    suggestion: 'Твој предлог',
    placeholder: 'Опиши ја измената или подобрувањето. Биди конкретен — "Во воведот, наместо... предлагам..."',
    lessonStudy: '🎌 Lesson Study дух: Авторот може да го прифати и да го направи официјален ремикс, или да те контактира за дискусија.',
    submit: 'Испрати предлог',
    cancel: 'Откажи',
    success: 'Предлогот е испратен!',
  },
  sq: {
    title: 'Propozoni ndryshim',
    subtitle: 'Lesson Study: propozimi juaj do t\'i dërgohet autorit.',
    section: 'Pjesa e skenarit',
    suggestion: 'Propozimi juaj',
    placeholder: 'Përshkruani ndryshimin ose përmirësimin...',
    lessonStudy: '🎌 Frymë Lesson Study: Autori mund ta pranojë dhe ta bëjë remix zyrtar.',
    submit: 'Dërgoni propozimin',
    cancel: 'Anulo',
    success: 'Propozimi u dërgua!',
  },
  tr: {
    title: 'Düzenleme öner',
    subtitle: 'Lesson Study: öneriniz yazara gönderilecek.',
    section: 'Senaryo bölümü',
    suggestion: 'Öneriniz',
    placeholder: 'Değişikliği veya iyileştirmeyi açıklayın...',
    lessonStudy: '🎌 Lesson Study ruhu: Yazar kabul edip resmi remix yapabilir.',
    submit: 'Öneriyi gönder',
    cancel: 'İptal',
    success: 'Öneri gönderildi!',
  },
  en: {
    title: 'Suggest a revision',
    subtitle: 'Lesson Study: your suggestion will be sent to the author.',
    section: 'Scenario section',
    suggestion: 'Your suggestion',
    placeholder: 'Describe the change or improvement. Be specific — "In the introduction, instead of... I suggest..."',
    lessonStudy: '🎌 Lesson Study spirit: The author can accept and make it an official remix, or contact you to discuss.',
    submit: 'Send suggestion',
    cancel: 'Cancel',
    success: 'Suggestion sent!',
  },
};

export const SuggestRevisionModal: React.FC<Props> = ({
  scenario, authorUid, authorName, schoolName, onClose, onSubmitted,
}) => {
  const { language } = useLanguage();
  const lang = (language as string) in I18N ? (language as string) : 'mk';
  const s = I18N[lang as keyof typeof I18N];
  const sectionLabel = (sec: typeof SECTIONS[number]) => {
    if (lang === 'sq') return sec.labelSq;
    if (lang === 'tr') return sec.labelTr;
    if (lang === 'en') return sec.labelEn;
    return sec.labelMk;
  };

  const [section, setSection] = useState<ScenarioSuggestion['section']>('general');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await submitSuggestion({ scenario, authorUid, authorName, schoolName, section, suggestionText: text.trim() });
      onSubmitted();
      onClose();
    } catch {
      // parent handles error notification
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {s.title}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{s.subtitle}</p>
            <p className="text-sm font-bold text-indigo-700 mt-1 truncate">「{scenario.title}」</p>
          </div>
          <button type="button" onClick={onClose} title={s.cancel} aria-label={s.cancel} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Section selector */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.section}</p>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map(sec => (
                <button
                  key={sec.value}
                  type="button"
                  onClick={() => setSection(sec.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    section === sec.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {sectionLabel(sec)}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestion text */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.suggestion}</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={s.placeholder}
              rows={5}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              autoFocus
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            {s.lessonStudy}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            {s.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || isSubmitting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
            {s.submit}
          </button>
        </div>
      </div>
    </div>
  );
};
