import React, { useState } from 'react';
import { X, Globe, Lock, BookOpen, Star, Users } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';
import type { TeachingModel } from '../../services/firestoreService.scenarioBank';

export interface PublishScenarioOptions {
  isPublic: boolean;
  teachingModel: TeachingModel | null;
  dokLevel: 1 | 2 | 3 | 4 | null;
  authorNotes: string;
}

/** Minimal shape needed to render the dialog — any lesson plan or generated material satisfies this */
interface PublishableItem {
  title?: string;
}

interface Props {
  item: PublishableItem;
  isPro: boolean;
  onPublish: (opts: PublishScenarioOptions) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Hide the teaching-model picker for non-lesson-plan materials (worksheets/quizzes/tests). Default: true */
  showTeachingModel?: boolean;
}

const MODELS: TeachingModel[] = ['5E', 'PBL', 'ZPD', 'Cooperative', 'Traditional'];
const MODEL_DESC: Record<TeachingModel, string> = {
  '5E': 'Engage → Explore → Explain → Elaborate → Evaluate',
  'PBL': 'Project-Based Learning — реален проблем',
  'ZPD': 'Зона на блискиот развој — скеле',
  'Cooperative': 'Тимска работа — структурирани групи',
  'Traditional': 'Директна настава — изложба + вежбање',
};

const I18N: Record<string, Record<string, string>> = {
  mk: {
    title: 'Сподели во Банката на Сценарија',
    subtitle: 'Твоето сценарио ќе биде достапно за наставниците низ целата земја.',
    visibility: 'Видливост',
    public: 'Јавно — сите можат да го видат и ремиксираат',
    private: 'Приватно — само за мене (Pro)',
    proRequired: 'Приватни сценарија бараат Pro претплата',
    model: 'Наставен модел',
    dok: "Webb's DoK ниво",
    notes: 'Белешки за колеги (Lesson Study)',
    notesPlaceholder: 'Опционално: Што проработи? Што би сменил? Препораки за следниот наставник...',
    publish: 'Сподели во Банката',
    cancel: 'Откажи',
    lessonStudyHint: '💡 Добрите белешки го прават Lesson Study жив — следната генерација наставници ќе учат од тебе.',
  },
  sq: {
    title: 'Shpërndaj në Bankën e Skenarëve',
    subtitle: 'Skenari yt do të jetë i disponueshëm për mësuesit në të gjithë vendin.',
    visibility: 'Dukshmëria',
    public: 'Publike — të gjithë mund ta shohin dhe remiksojnë',
    private: 'Private — vetëm për mua (Pro)',
    proRequired: 'Skenarët privatë kërkojnë abonim Pro',
    model: 'Modeli mësimor',
    dok: "Niveli Webb's DoK",
    notes: 'Shënime për kolegët (Lesson Study)',
    notesPlaceholder: 'Opsionale: Çfarë funksionoi? Çfarë do të ndryshoje? Rekomandime...',
    publish: 'Shpërndaj në Bankë',
    cancel: 'Anulo',
    lessonStudyHint: '💡 Shënime të mira e bëjnë Lesson Study të gjallë — gjenerata tjetër do të mësojë nga ti.',
  },
  tr: {
    title: "Senaryo Bankasına Paylaş",
    subtitle: 'Senaryonuz ülke genelindeki öğretmenler için erişilebilir olacak.',
    visibility: 'Görünürlük',
    public: 'Herkese açık — herkes görebilir ve remix yapabilir',
    private: 'Özel — yalnızca benim için (Pro)',
    proRequired: 'Özel senaryolar Pro aboneliği gerektirir',
    model: 'Öğretim modeli',
    dok: "Webb's DoK seviyesi",
    notes: 'Meslektaşlar için notlar (Lesson Study)',
    notesPlaceholder: 'İsteğe bağlı: Ne işe yaradı? Ne değiştirirdiniz? Tavsiyeler...',
    publish: "Bankaya Paylaş",
    cancel: 'İptal',
    lessonStudyHint: '💡 İyi notlar Lesson Study\'yi yaşatır — gelecek nesil öğretmenler senden öğrenir.',
  },
  en: {
    title: 'Share to Scenario Bank',
    subtitle: 'Your scenario will be available to teachers across the country.',
    visibility: 'Visibility',
    public: 'Public — everyone can view and remix',
    private: 'Private — only for me (Pro)',
    proRequired: 'Private scenarios require a Pro subscription',
    model: 'Teaching model',
    dok: "Webb's DoK level",
    notes: 'Notes for colleagues (Lesson Study)',
    notesPlaceholder: 'Optional: What worked? What would you change? Recommendations for the next teacher...',
    publish: 'Share to Bank',
    cancel: 'Cancel',
    lessonStudyHint: '💡 Good notes keep Lesson Study alive — the next generation of teachers learns from you.',
  },
};

export const PublishScenarioDialog: React.FC<Props> = ({
  item, isPro, onPublish, onCancel, isLoading = false, showTeachingModel = true,
}) => {
  const { language } = useLanguage();
  const lang = (language as string) in I18N ? (language as string) : 'mk';
  const s = I18N[lang];

  const [isPublic, setIsPublic] = useState(true);
  const [teachingModel, setTeachingModel] = useState<TeachingModel | null>(null);
  const [dokLevel, setDokLevel] = useState<1 | 2 | 3 | 4 | null>(null);
  const [authorNotes, setAuthorNotes] = useState('');

  const handlePublish = () => {
    onPublish({ isPublic: isPro ? isPublic : true, teachingModel, dokLevel, authorNotes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-black text-gray-900">{s.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{s.subtitle}</p>
            {item.title && (
              <p className="mt-1 text-sm font-bold text-indigo-700 truncate">「{item.title}」</p>
            )}
          </div>
          <button type="button" onClick={onCancel} title={s.cancel} aria-label={s.cancel} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Visibility */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.visibility}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors text-left ${
                  isPublic ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Globe className={`w-5 h-5 ${isPublic ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span className="text-xs font-bold text-center leading-tight">
                  {s.public}
                </span>
              </button>
              <button
                type="button"
                onClick={() => isPro && setIsPublic(false)}
                disabled={!isPro}
                title={!isPro ? s.proRequired : undefined}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors text-left ${
                  !isPublic ? 'border-emerald-500 bg-emerald-50'
                  : !isPro ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Lock className={`w-5 h-5 ${!isPublic ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span className="text-xs font-bold text-center leading-tight">
                  {s.private}
                  {!isPro && <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">✦ Pro</span>}
                </span>
              </button>
            </div>
          </div>

          {/* Teaching model */}
          {showTeachingModel && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.model}</p>
            <div className="flex flex-wrap gap-1.5">
              {MODELS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTeachingModel(teachingModel === m ? null : m)}
                  title={MODEL_DESC[m]}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    teachingModel === m
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {teachingModel && (
              <p className="text-[11px] text-gray-500 italic">{MODEL_DESC[teachingModel]}</p>
            )}
          </div>
          )}

          {/* DoK level */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.dok}</p>
            <div className="flex gap-2">
              {([1,2,3,4] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDokLevel(dokLevel === d ? null : d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-black border-2 transition-colors ${
                    dokLevel === d
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex gap-2 text-[10px] text-gray-400">
              {['Recall', 'Skill', 'Strategic', 'Extended'].map(l => (
                <span key={l} className="flex-1 text-center">{l}</span>
              ))}
            </div>
          </div>

          {/* Lesson Study notes */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {s.notes}
            </p>
            <textarea
              value={authorNotes}
              onChange={e => setAuthorNotes(e.target.value)}
              placeholder={s.notesPlaceholder}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            <p className="text-[11px] text-indigo-600">{s.lessonStudyHint}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {s.cancel}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Star className="w-4 h-4" />
            )}
            {s.publish}
          </button>
        </div>
      </div>
    </div>
  );
};
