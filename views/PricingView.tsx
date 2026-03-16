import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, Users, Zap, Shield, HeadphonesIcon, BookOpen, BarChart3, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ── Pricing constants ──────────────────────────────────────────────────────
const PRO_PRICE_MKD = 1200;
const PRO_PRICE_MONTHLY = Math.round(PRO_PRICE_MKD / 12);

// ── Feature comparison ─────────────────────────────────────────────────────
const FEATURES: Array<{ label: string; free: string | boolean; pro: string | boolean; school: string | boolean }> = [
  { label: 'AI генерации / ден',          free: '5',             pro: 'Неограничени',    school: 'Неограничени' },
  { label: 'Квизови и тестови',           free: true,            pro: true,              school: true },
  { label: 'Планови за часови',           free: true,            pro: true,              school: true },
  { label: 'Диференцирани материјали 3×', free: false,           pro: true,              school: true },
  { label: 'Презентации (Math Gamma)',    free: false,           pro: true,              school: true },
  { label: 'GeoGebra + Desmos',           free: false,           pro: true,              school: true },
  { label: 'Годишен план со AI',          free: false,           pro: true,              school: true },
  { label: 'Аналитика за наставниците',  free: 'Основна',       pro: 'Целосна',         school: 'Целосна + Admin' },
  { label: 'Национална библиотека',       free: 'Само читање',   pro: 'Читање + Објавување', school: 'Читање + Објавување' },
  { label: 'Родителски портал',           free: true,            pro: true,              school: true },
  { label: 'IEP поддршка',               free: false,           pro: true,              school: true },
  { label: 'Офлајн режим (PWA)',          free: true,            pro: true,              school: true },
  { label: 'Школски администратор',       free: false,           pro: false,             school: true },
  { label: 'Приоритетна поддршка',        free: false,           pro: true,              school: 'Посветен менаџер' },
];

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'Дали могу да го откажам претплатата?',
    a: 'Нашиот Pro план е еднократна годишна уплата. Нема автоматско обновување. По истекот на годината, слободно изберете дали ќе продолжите.',
  },
  {
    q: 'Кои методи за плаќање се достапни?',
    a: 'Плаќање со картичка преку Stripe (Visa, Mastercard) или банкарски трансфер на NLB Banka. Сметка: 210501596102457, примач: Игор Богданоски.',
  },
  {
    q: 'Колку брзо се активира Pro?',
    a: 'При плаќање со картичка — веднаш автоматски. При банкарски трансфер — во рок од 24 часа по потврда на уплатата.',
  },
  {
    q: 'Дали постои попуст за повеќе наставници?',
    a: 'Да — за 5+ наставници нудиме школска лиценца со значителен попуст. Контактирајте нè на contact@mismath.net.',
  },
  {
    q: 'Дали моите материјали се безбедни?',
    a: 'Да. Сите материјали се приватни за вашиот акаунт. Само материјали кои вие изберете да ги објавите се видливи во Националната библиотека.',
  },
];

// ── Checkout hook ──────────────────────────────────────────────────────────
function useStripeCheckout() {
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    if (!firebaseUser) {
      setError('Прво се најавете за да продолжите со плаќање.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Грешка при создавање на плаќање.');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Непозната грешка.');
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading, error };
}

// ── FeatureCell ────────────────────────────────────────────────────────────
const FeatureCell: React.FC<{ value: string | boolean }> = ({ value }) => {
  if (value === true) return <Check className="w-5 h-5 text-emerald-500 mx-auto" />;
  if (value === false) return <span className="text-slate-300 text-lg mx-auto block text-center">—</span>;
  return <span className="text-sm text-slate-700 text-center block">{value}</span>;
};

// ── FAQ Item ───────────────────────────────────────────────────────────────
const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        {q}
        {open ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{a}</div>}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export const PricingView: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { startCheckout, loading, error } = useStripeCheckout();
  const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'Unlimited';

  // Success/cancel URL params
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const paymentStatus = params.get('payment');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">

      {/* Payment status banners */}
      {paymentStatus === 'success' && (
        <div className="bg-emerald-500 text-white text-center py-3 font-semibold text-sm">
          🎉 Плаќањето е успешно! Вашиот Pro акаунт е активиран. Добредојдовте!
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="bg-amber-500 text-white text-center py-3 font-semibold text-sm">
          Плаќањето е откажано. Можете да обидете повторно кога сакате.
        </div>
      )}

      {/* ── Hero ── */}
      <div className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
          <Sparkles className="w-4 h-4" />
          Едноставно. Транспарентно. Достапно.
        </div>
        <h1 className="text-5xl font-black text-slate-900 mb-4 leading-tight">
          Инвестирајте во<br />
          <span className="text-indigo-600">квалитетна настава.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-2">
          {PRO_PRICE_MONTHLY} денари месечно е сè што чини неограничен AI асистент за вашите часови.
        </p>
        {isPro && (
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-semibold mt-4">
            <Crown className="w-5 h-5" />
            Вашиот акаунт е Pro — уживајте во сите предности!
          </div>
        )}
      </div>

      {/* ── Pricing Cards ── */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6">

          {/* Free */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-700">Бесплатно</h3>
              </div>
              <div className="text-4xl font-black text-slate-900 mb-1">0 МКД</div>
              <p className="text-slate-400 text-sm">Засекогаш бесплатно</p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {['50 почетни AI кредити', 'Квизови и тестови', 'Планови за часови', 'Офлајн PWA', 'Родителски портал'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {isAuthenticated ? (
              <div className="text-center text-sm text-slate-400 py-2">Тековен план</div>
            ) : (
              <Link to="/" className="w-full text-center py-2.5 border border-slate-300 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm">
                Започни бесплатно
              </Link>
            )}
          </div>

          {/* Pro */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-7 flex flex-col shadow-xl shadow-indigo-200 relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-black px-4 py-1 rounded-full uppercase tracking-wide">
              Најпопуларно
            </div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-yellow-300" />
                <h3 className="text-lg font-bold text-white">Pro Наставник</h3>
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black text-white">{PRO_PRICE_MKD}</span>
                <span className="text-purple-200 text-sm mb-1.5">МКД / год.</span>
              </div>
              <p className="text-purple-200 text-sm">
                = {PRO_PRICE_MONTHLY} МКД / месечно
              </p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                'Неограничени AI генерации',
                'Диференцирани материјали 3×',
                'Презентации (Math Gamma)',
                'GeoGebra + Desmos',
                'Годишен план со AI',
                'Целосна аналитика',
                'IEP поддршка',
                'Приоритетна поддршка',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/90">
                  <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <div className="w-full text-center py-2.5 bg-white/20 rounded-xl text-white font-semibold text-sm">
                ✅ Активен план
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={startCheckout}
                  disabled={loading}
                  className="w-full py-3 bg-white text-indigo-700 font-black rounded-xl hover:bg-indigo-50 transition-colors shadow-lg disabled:opacity-60 text-sm"
                >
                  {loading ? 'Се подготвува...' : '💳 Плати со картичка'}
                </button>
                {!isAuthenticated && (
                  <p className="text-purple-200 text-xs text-center">
                    <Link to="/" className="underline">Најавете се</Link> пред плаќање
                  </p>
                )}
                {error && <p className="text-red-300 text-xs text-center">{error}</p>}
                <div className="border-t border-white/20 pt-2">
                  <p className="text-purple-200 text-xs text-center mb-1">или банкарски трансфер:</p>
                  <p className="text-white/80 text-xs text-center font-mono">NLB 210501596102457</p>
                  <a href="mailto:bogdanoskiigor@gmail.com" className="text-purple-200 text-xs text-center block hover:text-white">
                    bogdanoskiigor@gmail.com
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* School */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-700">Училишна лиценца</h3>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">По договор</div>
              <p className="text-slate-400 text-sm">За сите наставници преку фактура</p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                'Сè од Pro за сите наставници',
                'Школски администратор',
                'Централна аналитика',
                'Масовни извози и извештаи',
                'Посветен менаџер',
                'SLA и приоритетна поддршка',
                'Обука и onboarding',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="mailto:contact@mismath.net?subject=Школска лиценца — AI Navigator&body=Здраво, би сакале да дознаеме повеќе за школската лиценца."
              className="w-full text-center py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors text-sm"
            >
              Побарај понуда
            </a>
          </div>
        </div>
      </div>

      {/* ── Feature Comparison Table ── */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">Детална споредба на планови</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 text-slate-500 font-medium w-1/2">Функционалност</th>
                <th className="text-center px-4 py-4 text-slate-700 font-bold w-1/6">Бесплатно</th>
                <th className="text-center px-4 py-4 text-indigo-700 font-black w-1/6 bg-indigo-50">Pro</th>
                <th className="text-center px-4 py-4 text-purple-700 font-bold w-1/6">Школско</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={f.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-5 py-3 text-slate-700">{f.label}</td>
                  <td className="px-4 py-3 text-center"><FeatureCell value={f.free} /></td>
                  <td className="px-4 py-3 text-center bg-indigo-50/40"><FeatureCell value={f.pro} /></td>
                  <td className="px-4 py-3 text-center"><FeatureCell value={f.school} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Trust Badges ── */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield, text: 'ГДПР / ЗЗЛП', sub: 'Податоците се ваши' },
            { icon: Zap, text: 'Активација', sub: 'Веднаш по плаќање' },
            { icon: HeadphonesIcon, text: 'Поддршка', sub: 'bogdanoskiigor@gmail.com' },
            { icon: BarChart3, text: 'Направено во МК', sub: 'За македонски наставници' },
          ].map(({ icon: Icon, text, sub }) => (
            <div key={text} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <Icon className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 text-sm">{text}</p>
              <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">Најчесто поставувани прашања</h2>
        <div className="space-y-3">
          {FAQ.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>
      </div>

      {/* ── Footer CTA ── */}
      <div className="bg-indigo-600 py-16 text-center px-4">
        <h2 className="text-3xl font-black text-white mb-3">Подготвени да почнете?</h2>
        <p className="text-indigo-200 mb-6">Придружете се на наставниците кои веќе ја користат платформата.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isPro && (
            <button
              onClick={startCheckout}
              disabled={loading}
              className="px-8 py-3.5 bg-white text-indigo-700 font-black rounded-xl hover:bg-indigo-50 transition-colors shadow-xl disabled:opacity-60"
            >
              {loading ? 'Се подготвува...' : '💳 Надгради на Pro — 1200 МКД/год.'}
            </button>
          )}
          <Link
            to="/"
            className="px-8 py-3.5 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
          >
            Продолжи бесплатно
          </Link>
        </div>
        {error && <p className="text-red-300 text-sm mt-4">{error}</p>}
      </div>

    </div>
  );
};
