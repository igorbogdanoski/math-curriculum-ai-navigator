import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, Check, Crown, Users, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AppError, ErrorCode } from '../../utils/errors';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  const { firebaseUser } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStripeCheckout = async () => {
    if (!firebaseUser) {
      setCheckoutError('Прво се најавете за да продолжите.');
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { const msg = data.error || 'Грешка при плаќање.'; throw new AppError(msg, ErrorCode.UNKNOWN, msg, false); }
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Непозната грешка.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative flex flex-col md:flex-row overflow-hidden border border-purple-100">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-700 bg-white/50 backdrop-blur-sm rounded-full p-1"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Left: Pitch */}
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

        {/* Right: Plans */}
        <div className="md:w-2/3 p-8 bg-slate-50 flex flex-col justify-center">
          <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Изберете го вашиот план</h3>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pro Plan */}
            <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm p-6 relative flex flex-col h-full">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">Најпопуларно</div>
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-6 h-6 text-indigo-600" />
                <h4 className="text-lg font-bold text-gray-800">Pro Наставник</h4>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-black text-gray-900">1200</span>
                <span className="text-gray-500 font-medium"> МКД / год.</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Само 100 денари месечно. Целосен пристап до сите алатки.</p>

              {/* Primary: Stripe */}
              <button
                type="button"
                onClick={handleStripeCheckout}
                disabled={checkoutLoading}
                className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 mb-3"
              >
                {checkoutLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Се подготвува...</>
                  : '💳 Плати со картичка'}
              </button>

              {checkoutError && (
                <p className="text-red-500 text-xs text-center mb-2">{checkoutError}</p>
              )}

              {/* Fallback: bank transfer */}
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium mb-2">
                  или банкарски трансфер →
                </summary>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-gray-700 mt-1">
                  <p><strong>Примач:</strong> Игор Богданоски</p>
                  <p><strong>Банка:</strong> NLB Banka</p>
                  <p><strong>Сметка:</strong> 210501596102457</p>
                  <p><strong>Цел:</strong> Претплата за AI Navigator</p>
                  <p className="text-gray-500 pt-1">Пратете доказ на:</p>
                  <a href="mailto:bogdanoskiigor@gmail.com" className="text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                    ✉️ bogdanoskiigor@gmail.com
                  </a>
                </div>
              </details>

              <div className="mt-3">
                <Link
                  to="/pricing"
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 justify-center"
                >
                  Целосна споредба на планови <ExternalLink className="w-3 h-3" />
                </Link>
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
                Контактирајте нè за официјална понуда на:<br/>
                <a href="mailto:contact@mismath.net" className="text-purple-700 font-bold block mt-1 hover:underline">
                  contact@mismath.net
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
