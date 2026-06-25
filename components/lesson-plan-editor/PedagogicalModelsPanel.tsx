import React, { useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';

interface Phase {
  label: string;
  desc: string;
  timeHint?: string;
}

interface PedaModel {
  key: string;
  name: string;
  icon: string;
  color: { border: string; bg: string; badge: string; text: string; dot: string };
  tagline: string;
  evidence: string;
  when: string;
  whenNot: string;
  academyId: string;
  phases: Phase[];
}

const MODELS: PedaModel[] = [
  {
    key: '5e',
    name: '5E модел',
    icon: '🔬',
    color: { border: 'border-indigo-200', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700', text: 'text-indigo-700', dot: 'bg-indigo-500' },
    tagline: 'Конструктивистички циклус',
    evidence: 'Inquiry-based learning: effect size d=0.50 (Hattie, 2009).',
    when: 'Нови концепти, каде учениците треба да го разберат ЗОШТО — не само постапката.',
    whenNot: 'Процедурални вештини кои мора да се применуваат точно (алгоритми, формули) — Gagné е подобар.',
    academyId: 'model-5e-model',
    phases: [
      { label: 'Engage', desc: 'Поврзи го вниманието со реален проблем или прашање.', timeHint: '5 мин' },
      { label: 'Explore', desc: 'Учениците сами истражуваат, практикуваат, грешат.', timeHint: '10 мин' },
      { label: 'Explain', desc: 'Наставникот ги систематизира концептите.', timeHint: '10 мин' },
      { label: 'Elaborate', desc: 'Примена во нов контекст — трансфер на знаење.', timeHint: '10 мин' },
      { label: 'Evaluate', desc: 'Формативна евалуација — квиз, излезна картичка.', timeHint: '5 мин' },
    ],
  },
  {
    key: 'pbl',
    name: 'PBL',
    icon: '🎯',
    color: { border: 'border-amber-200', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700', dot: 'bg-amber-500' },
    tagline: 'Проблемски ориентирано учење',
    evidence: 'Situated learning / трансфер на знаење: effect size d=0.46 (Hattie).',
    when: 'Теми поврзани со реален живот; кога сакате долготраен трансфер на знаење надвор од час.',
    whenNot: 'Кога учениците немаат доволно предзнаење — прво изградете база со директна настава.',
    academyId: 'model-pbl',
    phases: [
      { label: 'Проблем', desc: 'Претстави автентичен математички проблем без готово решение.', timeHint: '5 мин' },
      { label: 'Истражување', desc: 'Ученици (во групи) го анализираат и планираат решението.', timeHint: '15 мин' },
      { label: 'Решение', desc: 'Изработка и тестирање на решението.', timeHint: '10 мин' },
      { label: 'Презентација', desc: 'Групи ги споделуваат решенијата и методите.', timeHint: '7 мин' },
      { label: 'Рефлексија', desc: 'Синтеза — шта научивме? Дали решението е оптимално?', timeHint: '3 мин' },
    ],
  },
  {
    key: 'zpd',
    name: 'ZPD / Скафолдинг',
    icon: '📶',
    color: { border: 'border-emerald-200', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    tagline: 'Виготски — зона на потенцијален развој',
    evidence: 'Scaffolding: effect size d=0.53 (Hattie, 2009) — силен за диференцирана настава.',
    when: 'Кога ученикот е непосредно пред следното ниво — задачата е малку над нивото на самостојност.',
    whenNot: 'НЕ оставајте скафолдот постојано — мора постепено да се отстранува за да нема зависност.',
    academyId: 'model-zpd',
    phases: [
      { label: 'I Do', desc: 'Наставникот моделира — гласно мисли низ задачата.', timeHint: '5 мин' },
      { label: 'We Do', desc: 'Заедно со учениците — постепено ги зема водечките прашања.', timeHint: '10 мин' },
      { label: 'You Do', desc: 'Ученикот самостојно применува. Наставникот набљудува.', timeHint: '15 мин' },
      { label: 'Reflect', desc: 'Самооценување — „Каде сум сè уште несигурен?"', timeHint: '5 мин' },
      { label: 'Extend', desc: 'Предизвик за брзи — нова ситуација, повисоко ниво.', timeHint: '5 мин' },
    ],
  },
  {
    key: 'coop',
    name: 'Кооперативно',
    icon: '🤝',
    color: { border: 'border-rose-200', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700', text: 'text-rose-700', dot: 'bg-rose-500' },
    tagline: 'Позитивна меѓузависност + одговорност',
    evidence: 'Cooperative vs индивидуално учење: effect size d=0.55 (Hattie); peer teaching d=0.55.',
    when: 'Кога задачата е доволно комплексна за поделба на улоги; кога сакате Феинман ефект.',
    whenNot: 'Без индивидуална одговорност (случаен претставник), тоа е само групна работа — еден работи, останатите чекаат.',
    academyId: 'model-cooperative',
    phases: [
      { label: 'Поставување', desc: 'Формирај групи (2-4 ученика) со јасни улоги.', timeHint: '3 мин' },
      { label: 'Задача', desc: 'Сите членови мора да можат да го објаснат резултатот.', timeHint: '15 мин' },
      { label: 'Интеракција', desc: 'Поттикни ги учениците да си помагаат — не само да копираат.', timeHint: '10 мин' },
      { label: 'Споделување', desc: 'Случаен претставник ја презентира стратегијата.', timeHint: '7 мин' },
      { label: 'Процена', desc: 'Групна рефлексија: „Дали соработивме добро?"', timeHint: '5 мин' },
    ],
  },
];

export const PedagogicalModelsPanel: React.FC = () => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { navigate } = useNavigation();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <span className="text-base">📚</span>
        Педагошки модели
        <span className="ml-auto text-[10px] font-normal text-gray-400">референца</span>
      </h3>
      <p className="text-[10px] text-gray-400 pb-1">
        Избери модел за фази, тајминг и совети. „Научи повеќе" отвара целосна Academy лекција.
      </p>

      {MODELS.map(model => {
        const isOpen = openKey === model.key;
        return (
          <div key={model.key} className={`rounded-lg border ${model.color.border} overflow-hidden`}>
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : model.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold ${model.color.text} ${model.color.bg} hover:opacity-80 transition-opacity`}
            >
              <span>{model.icon}</span>
              <span>{model.name}</span>
              <span className="ml-1 font-normal opacity-60 text-[10px]">{model.tagline}</span>
              <span className="ml-auto opacity-50">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-2 space-y-2.5">
                {/* Research evidence */}
                <p className="text-[10px] text-gray-500 italic border-l-2 border-gray-200 pl-2">{model.evidence}</p>

                {/* Phases */}
                <div className="space-y-1.5">
                  {model.phases.map((phase, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className={`w-4 h-4 rounded-full ${model.color.dot} text-white text-[9px] font-black flex items-center justify-center`}>
                          {i + 1}
                        </span>
                        <span className={`text-[10px] font-bold ${model.color.text} w-20 truncate`}>{phase.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-600 flex-1 leading-relaxed">{phase.desc}</p>
                      {phase.timeHint && (
                        <span className={`text-[9px] shrink-0 px-1.5 py-0.5 rounded-full border ${model.color.border} ${model.color.badge} font-medium`}>
                          {phase.timeHint}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* When / When NOT */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div className="bg-green-50 border border-green-100 rounded-md px-2 py-1.5">
                    <p className="text-[9px] font-bold text-green-700 mb-0.5">✓ Кога да го користиш</p>
                    <p className="text-[9px] text-gray-600 leading-relaxed">{model.when}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
                    <p className="text-[9px] font-bold text-red-600 mb-0.5">✗ Кога НЕ</p>
                    <p className="text-[9px] text-gray-600 leading-relaxed">{model.whenNot}</p>
                  </div>
                </div>

                {/* Academy link */}
                <button
                  type="button"
                  onClick={() => navigate(`/academy/lesson/${model.academyId}`)}
                  className={`w-full text-[10px] font-semibold py-1.5 px-3 rounded-md border ${model.color.border} ${model.color.badge} hover:opacity-80 transition-opacity flex items-center justify-center gap-1.5`}
                >
                  🎓 Научи повеќе во Academy →
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
