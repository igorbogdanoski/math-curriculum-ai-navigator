import React from 'react';
import { X, Sparkles, Check, Crown, Users } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string; // Optional message why they need to upgrade
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative flex flex-col md:flex-row overflow-hidden border border-purple-100">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-700 bg-white/50 backdrop-blur-sm rounded-full p-1"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Left Side: Pitch */}
        <div className="md:w-1/3 bg-gradient-to-br from-brand-primary to-purple-800 p-8 text-white flex flex-col justify-center">
          <div className="mb-6 bg-white/20 p-3 rounded-2xl inline-block w-fit">
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight">Отклучете сè за вашата настава.</h2>
          <p className="text-purple-100 mb-6 text-sm leading-relaxed">
            {reason || 'Преминете на Pro пакет за да генерирате неограничени материјали, комплетни пакети за оценување и диференцирани верзии.'}
          </p>
          <ul className="space-y-4">
            {[
              'Неограничени AI генерации',
              'Генерирање: тест, квиз и рубрика одеднаш',
              'Специјални 3× верзии на секој материјал',
              'Интегрирани GeoGebra и Desmos',
              'Приоритетна поддршка'
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Side: Plans */}
        <div className="md:w-2/3 p-8 bg-slate-50 flex flex-col justify-center">
          <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Изберете го вашиот план</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pro Plan */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative flex flex-col h-full hover:border-brand-primary transition-colors">
              <div className="absolute top-0 right-0 bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">Најпопуларно</div>
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-6 h-6 text-brand-primary" />
                <h4 className="text-lg font-bold text-gray-800">Pro Наставник</h4>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-black text-gray-900">1200</span>
                <span className="text-gray-500 font-medium"> МКД / год.</span>
              </div>
              <p className="text-xs text-gray-500 mb-6">Тоа е само 100 денари месечно. Целосен пристап до сите алатки.</p>
              
              <div className="mt-auto bg-slate-50 p-4 rounded-lg text-sm text-gray-700 border border-slate-200">
                <p className="font-bold flex items-center gap-2 mb-2 text-brand-primary">💳 Инструкции за плаќање:</p>
                <div className="space-y-1 mb-3 bg-white p-2 rounded border border-gray-100">
                  <p><strong>Примач:</strong> Игор Богданоски</p>
                  <p><strong>Банка:</strong> NLB Banka</p>
                  <p><strong>Сметка:</strong> 210501596102457</p>
                  <p><strong>Цел:</strong> Претплата за AI Navigator</p>
                </div>
                <p className="text-xs text-gray-600 mb-2">Откако ќе уплатите, пратете доказ на:</p>
                <div className="flex flex-col gap-1.5">
                  <a href="mailto:bogdanoskiigor@gmail.com" className="text-brand-primary font-bold flex items-center gap-2 hover:underline">✉️ bogdanoskiigor@gmail.com</a>
                  <a href="https://viber.click/389702468124" target="_blank" rel="noopener noreferrer" className="text-brand-primary font-bold flex items-center gap-2 hover:underline">📞 +389702468124 (Viber)</a>
                </div>
              </div>
            </div>

            {/* School Plan */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative flex flex-col h-full hover:border-purple-600 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-purple-600" />
                <h4 className="text-lg font-bold text-gray-800">Училишна B2B</h4>
              </div>
              <div className="mb-4">
                <span className="text-xl font-bold text-gray-900">По договор</span>
              </div>
              <p className="text-xs text-gray-500 mb-6">За сите наставници во вашето училиште преку фактура.</p>
              
              <div className="mt-auto bg-purple-50 p-3 rounded-lg text-sm text-purple-900">
                <p className="font-bold mb-1">Побарајте понуда:</p>
                Контактирајте нè за да ви подготвиме официјална понуда за вашето училиште на:<br/>
                <a href="mailto:contact@mismath.net" className="text-purple-700 font-bold block mt-1 hover:underline">contact@mismath.net</a>
              </div>
            </div>
          </div>
          
          <p className="text-center text-xs text-gray-400 mt-6">
            Наскоро ќе биде достапно директно плаќање со платежна картичка. Засега, по уплатата вашиот профил ќе биде веднаш надграден.
          </p>
        </div>

      </div>
    </div>
  );
};
