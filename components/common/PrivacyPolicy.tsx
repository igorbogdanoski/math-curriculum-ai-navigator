import React from 'react';
import { Shield } from 'lucide-react';


export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
          <div className="bg-brand-primary/10 p-3 rounded-lg">
            <Shield className="w-8 h-8 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Политика за приватност</h1>
            <p className="text-slate-500 mt-1">Последно ажурирано: {new Date().toLocaleDateString('mk-MK')}</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          <p>
            Оваа Политика за приватност објаснува како <strong>AI Navigator</strong> (во понатамошниот текст: "ние", "наш", или "платформата") ги собира, користи, споделува и заштитува вашите лични податоци при користење на нашата веб-апликација.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">1. Податоци кои ги собираме</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Информации за профилот:</strong> Кога креирате профил, собираме име, е-пошта и слика (преку Google најава).</li>
            <li><strong>Содржина генерирана од корисниците:</strong> Вашите планови за настава, активности, зачувани идеи и историја на генерирање преку AI.</li>
            <li><strong>Податоци за користење:</strong> Информации за тоа како ја користите платформата, тип на уред, прелистувач и IP адреса преку Firebase Analytics.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">2. Како ги користиме вашите податоци</h3>
          <p>Вашите податоци ги користиме за:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Да ја обезбедиме и одржуваме функционалноста на AI Navigator.</li>
            <li>Да ги персонализираме вашите планови за настава и предлози.</li>
            <li>Да ги процесираме вашите генерации преку вештачката интелигенција (Google Gemini API).</li>
            <li>За комуникација во врска со вашиот профил, претплата или техничка поддршка.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">3. Споделување на податоци</h3>
          <p>Ние не ги продаваме вашите лични податоци. Податоците може да се споделат исклучиво со:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Google services:</strong> За автентикација (Firebase Auth), хостирање и база на податоци (Cloud Firestore).</li>
            <li><strong>Google Gemini API:</strong> Текстот што го внесувате за генерирање содржина се испраќа до Gemini API за обработка. Не вклучувајте чувствителни лични податоци на вашите ученици во барањата.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">4. Безбедност</h3>
          <p>
            Преземаме соодветни технички и организациски мерки за заштита на вашите податоци од неовластен пристап, губење или злоупотреба. Вашата лозинка и автентикација се безбедно управувани преку Google Firebase.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">5. Вашите права</h3>
          <p>Во согласност со Законот за заштита на личните податоци (ЗЗЛП) и ГДПР, имате право да:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Пристапите</strong> до вашите лични податоци.</li>
            <li><strong>Побарате корекција</strong> на неточни податоци.</li>
            <li><strong>Преземете ги вашите податоци</strong> во машински читлив формат (JSON) преку Поставки → Приватност.</li>
            <li><strong>Побарате бришење</strong> на вашиот профил и сите поврзани податоци преку Поставки → Приватност → Избриши акаунт.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">6. Колачиња (Cookies)</h3>
          <p>Платформата користи следните видови колачиња:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Задолжителни:</strong> Firebase Auth колачиња за управување со сесии и автентикација.</li>
            <li><strong>Функционални:</strong> localStorage вредности за зачувување на поставките (јазик, пристапност, преференции).</li>
            <li><strong>Аналитички:</strong> Firebase Analytics за анонимни статистики за користење.</li>
          </ul>
          <p className="mt-2">Можете да ги одбиете аналитичките колачиња преку банерот при прва посета. Задолжителните колачиња не можат да бидат оневозможени.</p>

          <h3 className="text-xl font-bold mt-8 mb-4">7. Малолетни корисници</h3>
          <p>
            Платформата е наменета примарно за наставници. Ученичките податоци (резултати, напредок) се обработуваат анонимно — без имиња, е-пошта или директно идентификациски информации за малолетни лица, освен доброволно внесеното прекаре/псевдоним од страна на наставникот. Наставниците се одговорни за почитување на правата за приватност на своите ученици во согласност со ЗЗЛП.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">8. Задржување на податоци</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Активни кориснички акаунти: податоците се чуваат до барање за бришење.</li>
            <li>Неактивни акаунти (без активност повеќе од 3 години): автоматско бришење.</li>
            <li>Анонимни ученички резултати: максимум 2 години по последна активност.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">9. Контакт</h3>
          <p>
            Доколку имате прашања во врска со оваа Политика за приватност, ве молиме контактирајте нè на:<br />
            <strong>Е-пошта:</strong> bogdanoskiigor@gmail.com<br />
            <strong>Телефон:</strong> +389702468124
          </p>

        </div>
        
        <div className="mt-12 pt-6 border-t border-slate-100 flex justify-center">
          <a href="#/" className="text-brand-primary font-medium hover:underline">
            &larr; Назад кон почетна
          </a>
        </div>
      </div>
    </div>
  );
}
