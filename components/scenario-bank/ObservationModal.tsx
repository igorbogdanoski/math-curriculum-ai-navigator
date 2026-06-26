import React, { useState, useEffect } from 'react';
import { X, Eye, BookOpen, Star } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import {
  submitObservation, fetchObservations,
  type ScenarioObservation,
} from '../../services/firestoreService.scenarioObservations';

interface Props {
  scenario: ScenarioBankEntry;
  authorUid: string;
  authorName: string;
  schoolName: string;
  observedGrade: number;
  onClose: () => void;
}

const I18N = {
  mk: {
    title: 'Набљудување на час',
    subtitle: 'Lesson Study протокол — твоето искуство е злато за следната генерација.',
    role: 'Твојата улога',
    delivered: '📋 Ја одржав оваа лекција',
    observed: '👁 Ја набљудував оваа лекција',
    whatWorked: 'Што проработи одлично?',
    whatToImprove: 'Што би сменил/а?',
    engagement: 'Ангажираност на учениците',
    submit: 'Зачувај набљудување',
    cancel: 'Откажи',
    previousObs: 'Претходни набљудувања',
    noObs: 'Сè уште нема набљудувања.',
    engLabels: ['Слаба', 'Ниска', 'Средна', 'Висока', 'Одлична'],
  },
  sq: {
    title: 'Vëzhgim i mësimit',
    subtitle: 'Protokolli Lesson Study — përvoja juaj është ar për gjeneratën tjetër.',
    role: 'Roli juaj',
    delivered: '📋 E mbajta këtë mësim',
    observed: '👁 E vëzhgova këtë mësim',
    whatWorked: 'Çfarë funksionoi shkëlqyeshëm?',
    whatToImprove: 'Çfarë do të ndryshonit?',
    engagement: 'Angazhimi i nxënësve',
    submit: 'Ruaj vëzhgimin',
    cancel: 'Anulo',
    previousObs: 'Vëzhgime të mëparshme',
    noObs: 'Akoma nuk ka vëzhgime.',
    engLabels: ['E dobët', 'E ulët', 'Mesatare', 'E lartë', 'Shkëlqyese'],
  },
  tr: {
    title: 'Ders gözlemi',
    subtitle: 'Lesson Study protokolü — deneyiminiz gelecek nesil için altın değerinde.',
    role: 'Rolünüz',
    delivered: '📋 Bu dersi anlattım',
    observed: '👁 Bu dersi gözlemledim',
    whatWorked: 'Ne mükemmel çalıştı?',
    whatToImprove: 'Ne değiştirirdiniz?',
    engagement: 'Öğrenci katılımı',
    submit: 'Gözlemi kaydet',
    cancel: 'İptal',
    previousObs: 'Önceki gözlemler',
    noObs: 'Henüz gözlem yok.',
    engLabels: ['Zayıf', 'Düşük', 'Orta', 'Yüksek', 'Mükemmel'],
  },
  en: {
    title: 'Lesson observation',
    subtitle: 'Lesson Study protocol — your experience is gold for the next generation.',
    role: 'Your role',
    delivered: '📋 I delivered this lesson',
    observed: '👁 I observed this lesson',
    whatWorked: 'What worked excellently?',
    whatToImprove: 'What would you change?',
    engagement: 'Student engagement',
    submit: 'Save observation',
    cancel: 'Cancel',
    previousObs: 'Previous observations',
    noObs: 'No observations yet.',
    engLabels: ['Poor', 'Low', 'Medium', 'High', 'Excellent'],
  },
};

export const ObservationModal: React.FC<Props> = ({
  scenario, authorUid, authorName, schoolName, observedGrade, onClose,
}) => {
  const { language } = useLanguage();
  const lang = (language as string) in I18N ? (language as string) : 'mk';
  const s = I18N[lang as keyof typeof I18N];

  const [role, setRole] = useState<ScenarioObservation['role']>('delivered');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatToImprove, setWhatToImprove] = useState('');
  const [engagement, setEngagement] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [observations, setObservations] = useState<ScenarioObservation[]>([]);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    fetchObservations(scenario.id).then(setObservations).catch(() => {});
  }, [scenario.id]);

  const handleSubmit = async () => {
    if (!whatWorked.trim() && !whatToImprove.trim()) return;
    setIsSubmitting(true);
    try {
      await submitObservation({
        scenarioId: scenario.id,
        authorUid,
        authorName,
        schoolName,
        role,
        whatWorked: whatWorked.trim(),
        whatToImprove: whatToImprove.trim(),
        engagementLevel: engagement,
        observedGrade,
      });
      onClose();
    } catch {
      /* silent — parent handles */
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
              <Eye className="w-5 h-5 text-indigo-500" />
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
          {/* Role */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.role}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['delivered', 'observed'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-colors text-left ${
                    role === r ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {r === 'delivered' ? s.delivered : s.observed}
                </button>
              ))}
            </div>
          </div>

          {/* What worked */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-emerald-700 uppercase tracking-wide">✅ {s.whatWorked}</label>
            <textarea
              value={whatWorked}
              onChange={e => setWhatWorked(e.target.value)}
              rows={3}
              className="w-full text-sm border border-emerald-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none bg-emerald-50/30"
            />
          </div>

          {/* What to improve */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-amber-700 uppercase tracking-wide">🔧 {s.whatToImprove}</label>
            <textarea
              value={whatToImprove}
              onChange={e => setWhatToImprove(e.target.value)}
              rows={3}
              className="w-full text-sm border border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none bg-amber-50/30"
            />
          </div>

          {/* Engagement */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.engagement}</p>
            <div className="flex gap-1.5">
              {([1, 2, 3, 4, 5] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEngagement(n)}
                  title={s.engLabels[n - 1]}
                  className={`flex-1 py-2 rounded-lg font-black text-sm border-2 transition-colors ${
                    engagement >= n
                      ? 'bg-amber-400 border-amber-400 text-white'
                      : 'border-gray-200 text-gray-300 hover:border-amber-200'
                  }`}
                >
                  <Star className="w-4 h-4 mx-auto" fill={engagement >= n ? 'white' : 'none'} />
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500">{s.engLabels[engagement - 1]}</p>
          </div>

          {/* Previous observations */}
          {observations.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPrevious(v => !v)}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {s.previousObs} ({observations.length})
              </button>
              {showPrevious && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {observations.map(obs => (
                    <div key={obs.id} className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-700">{obs.authorName}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: obs.engagementLevel }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-amber-400" fill="#fbbf24" />
                          ))}
                        </div>
                      </div>
                      {obs.whatWorked && <p className="text-emerald-700">✅ {obs.whatWorked}</p>}
                      {obs.whatToImprove && <p className="text-amber-700">🔧 {obs.whatToImprove}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            {s.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!whatWorked.trim() && !whatToImprove.trim()) || isSubmitting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Eye className="w-4 h-4" />
            }
            {s.submit}
          </button>
        </div>
      </div>
    </div>
  );
};
