import React from 'react';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TermsOfUse() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
          <div className="bg-brand-primary/10 p-3 rounded-lg">
            <FileText className="w-8 h-8 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Услови за користење</h1>
            <p className="text-slate-500 mt-1">Последно ажурирано: {new Date().toLocaleDateString('mk-MK')}</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          <p>
            Добредојдовте во <strong>AI Navigator</strong>. Со пристапување и користење на оваа платформа, се согласувате со следниве услови за користење. Ве молиме внимателно прочитајте ги.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">1. Опис на услугата</h3>
          <p>
            AI Navigator е алатка базирана на вештачка интелигенција наменета за наставници по математика. Овозможува креирање на планови за настава, активности и генерирање на едукативна содржина согласно официјалниот курикулум на МОН.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">2. Корисничка сметка</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>За да ги користите сите функционалности, мора да креирате корисничка сметка преку Google.</li>
            <li>Вие сте одговорни за одржување на безбедноста на вашата сметка.</li>
            <li>Платформата е наменета за наставници и образовни работници.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">3. AI Кредити и Плаќања</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>При регистрација, корисникот бесплатно добива пробен број на AI кредити.</li>
            <li>Генерирањето содржина троши кредити според сложеноста на барањето.</li>
            <li>Дополнителни кредити се купуваат преку банкарска уплата.</li>
            <li>Купените кредити не се рефундираат откако ќе бидат искористени. Купените кредити не застаруваат.</li>
          </ul>

          <h3 className="text-xl font-bold mt-8 mb-4">4. Содржина генерирана од AI</h3>
          <p>
            AI Navigator користи напредни модели за вештачка интелигенција за генерирање содржина. Иако се стремиме кон максимална точност, <strong>вие како наставник сте конечниот одговорен уредник</strong> на содржината што ја презентирате на учениците. Природно е AI повремено да генерира непрецизни или несоодветни резултати. Секогаш прегледувајте ги материјалите пред употреба.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">5. Интелектуална сопственост</h3>
          <p>
            Вие ги задржувате авторските права над оригиналните материјали кои ги внесувате во платформата. Ние ви доделуваме ограничена, неексклузивна лиценца за користење на генерираната содржина за вашите едукативни потреби во училница или онлајн настава.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">6. Ограничување на одговорност</h3>
          <p>
            Креаторот на AI Navigator не сноси одговорност за било каква директна или индиректна штета настаната од користењето на платформата, губење на податоци или неможност за пристап до услугата поради технички причини.
          </p>

          <h3 className="text-xl font-bold mt-8 mb-4">7. Контакт</h3>
          <p>
            За сите прашања и поддршка:<br />
            <strong>Е-пошта:</strong> bogdanoskiigor@gmail.com<br />
            <strong>Телефон:</strong> +389702468124
          </p>

        </div>
        
        <div className="mt-12 pt-6 border-t border-slate-100 flex justify-center">
          <Link to="/" className="text-brand-primary font-medium hover:underline">
            &larr; Назад кон почетна
          </Link>
        </div>
      </div>
    </div>
  );
}
