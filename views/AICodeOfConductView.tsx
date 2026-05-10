import React, { useState } from 'react';
import { Shield, CheckCircle2, ChevronDown, ChevronUp, BookOpen, Brain, Eye, Users, Lock } from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  borderColor: string;
  bgColor: string;
  rules: Array<{ emoji: string; title: string; body: string }>;
}

const SECTIONS: Section[] = [
  {
    id: 'honesty',
    icon: <Shield className="w-5 h-5" />,
    title: '1. Чесност и транспарентност',
    color: 'text-blue-700',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50',
    rules: [
      { emoji: '✅', title: 'Кажи кога користиш AI', body: 'Ако предадеш работа напишана со помош на AI, кажи го тоа на наставникот. Транспарентноста е основа на академскиот интегритет.' },
      { emoji: '❌', title: 'Не лажи дека AI е твое', body: 'Претставувањето на AI генерирани текстови или одговори како свои без наведување извор е академска нечесност — еднакво на преписување.' },
      { emoji: '✅', title: 'Наведи го AI-то во цитати', body: 'Кога цитираш AI одговор, наведи го: „Одговор генериран со Gemini AI, [датум]". Третирај го AI-то исто како друг извор.' },
    ],
  },
  {
    id: 'verification',
    icon: <Eye className="w-5 h-5" />,
    title: '2. Верификација и критичко мислење',
    color: 'text-amber-700',
    borderColor: 'border-amber-300',
    bgColor: 'bg-amber-50',
    rules: [
      { emoji: '🔍', title: 'Секогаш проверувај', body: 'AI може да прави грешки — дури и кога звучи самоуверено. Математички пресметки, историски датуми, научни факти — сè треба да се провери од доверлив извор.' },
      { emoji: '🧠', title: 'Размислувај критички', body: 'Не прифаќај ги AI одговорите слепо. Прашај: „Дали ова има смисла? Дали знам зошто е точно?" Ако не го разбираш одговорот, не можеш да го употребиш.' },
      { emoji: '📚', title: 'AI = почетна точка', body: 'Употребувај AI за да почнеш да учиш, не за да избегнеш учење. Вистинско знаење мораш сам да го изградиш.' },
    ],
  },
  {
    id: 'learning',
    icon: <Brain className="w-5 h-5" />,
    title: '3. AI и твоето учење',
    color: 'text-green-700',
    borderColor: 'border-green-300',
    bgColor: 'bg-green-50',
    rules: [
      { emoji: '💡', title: 'Учи со AI, не наместо AI', body: 'Добра употреба: „Objasni mi ovoj korak." Лоша употреба: „Реши ја задачата за мене." Дозволи AI да те води, не да работи наместо тебе.' },
      { emoji: '🎯', title: 'Феинман техника', body: 'Кога AI ти објасни нешто, обиди се да го преподадеш со свои зборови. Ако не можеш, тоа значи дека уште не си го разбрал — врати се на материјалот.' },
      { emoji: '⚖️', title: 'Балансирај AI и сопствен труд', body: 'Некои задачи се дизајнирани за да градат твои вештини. Ако AI ги реши за тебе, ти ги губиш — дури и ако добиеш добра оценка.' },
    ],
  },
  {
    id: 'privacy',
    icon: <Lock className="w-5 h-5" />,
    title: '4. Приватност и безбедност',
    color: 'text-rose-700',
    borderColor: 'border-rose-300',
    bgColor: 'bg-rose-50',
    rules: [
      { emoji: '🔒', title: 'Не споделувај лични податоци', body: 'Никогаш не внесувај во AI: лозинки, лични документи, адреси, финансиски информации или сензитивни информации за другите.' },
      { emoji: '👥', title: 'Почитувај приватноста на другите', body: 'Не внесувај информации за своите пријатели, семејство или соученици без нивна согласност. Нивните приватни информации не се твои за споделување.' },
      { emoji: '🌐', title: 'Разбирај ги ризиците', body: 'Информациите кои ги внесуваш во AI системи можат да се зачуваат и анализираат. Размислувај пред да пишуваш.' },
    ],
  },
  {
    id: 'community',
    icon: <Users className="w-5 h-5" />,
    title: '5. Одговорност кон заедницата',
    color: 'text-purple-700',
    borderColor: 'border-purple-300',
    bgColor: 'bg-purple-50',
    rules: [
      { emoji: '🤝', title: 'Помагај, не преписувај', body: 'Ако му помогнеш на другар со AI, објасни му го решението — не само дај му го резултатот. Вистинска помош значи учење, не преписување.' },
      { emoji: '🚫', title: 'Не создавај штетна содржина', body: 'Никогаш не употребувај AI за да создадеш лажни информации, злонамерни пораки, или содржина која навредува или лаже за некого.' },
      { emoji: '📣', title: 'Пријави злоупотреба', body: 'Ако забележиш дека некој злоупотребува AI за измама или создавање штета, пријави го на наставник или администратор.' },
    ],
  },
];

export function AICodeOfConductView() {
  const [openSection, setOpenSection] = useState<string | null>('honesty');
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-gray-900">Кодекс за употреба на AI</h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Упатство за одговорна, чесна и безбедна употреба на вештачката интелигенција во образованието — за ученици и наставници.
        </p>
      </div>

      {/* Hero callout */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 px-6 py-5">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-900 mb-1">AI е алатка, не замена за умот</p>
            <p className="text-sm text-indigo-700">
              Вештачката интелигенција може да ти помогне да учиш побрзо, да разбереш потешки концепти и да добиеш повратни информации во моментот. Но AI не може да гради карактер, критичко мислење или вистинско знаење — тоа е твоја работа.
            </p>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {SECTIONS.map(section => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              className={`rounded-2xl border-2 overflow-hidden transition-all ${
                isOpen ? section.borderColor : 'border-gray-100'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
                  isOpen ? section.bgColor : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isOpen ? section.color : 'text-gray-400'}>{section.icon}</span>
                  <span className={`font-bold text-sm ${isOpen ? section.color : 'text-gray-700'}`}>{section.title}</span>
                </div>
                {isOpen
                  ? <ChevronUp className={`w-4 h-4 ${section.color}`} />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>

              {isOpen && (
                <div id={`section-content-${section.id}`} className="px-5 pb-5 pt-3 bg-white space-y-4">
                  {section.rules.map((rule, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-xl leading-none shrink-0 mt-0.5">{rule.emoji}</span>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm mb-0.5">{rule.title}</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{rule.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agreement */}
      <div className={`rounded-2xl border-2 p-5 transition-all ${agreed ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative shrink-0 mt-0.5">
            <input
              id="conduct-agreement"
              type="checkbox"
              className="sr-only"
              aria-label="Се согласувам со кодексот за употреба на AI"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            <div aria-hidden="true" className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              agreed ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
            }`}>
              {agreed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
          </div>
          <div>
            <p className={`font-semibold text-sm ${agreed ? 'text-green-800' : 'text-gray-700'}`}>
              {agreed ? '✅ Се согласив со кодексот!' : 'Се согласувам со кодексот за употреба на AI'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Ќе употребувам AI одговорно, чесно и во корист на своето учење.</p>
          </div>
        </label>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400">
        Овој кодекс се темели на принципите на AI писменост за K-12 образование. Наменет е за ученици и наставници кои сакаат да ја користат AI ефикасно и одговорно.
      </p>
    </div>
  );
}
