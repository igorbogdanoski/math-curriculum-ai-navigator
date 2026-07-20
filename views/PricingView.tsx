import React, { useId, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { Check, Crown, Users, Zap, Shield, HeadphonesIcon, BookOpen, BarChart3, Sparkles, ChevronDown, ChevronUp, CreditCard, Building2, Copy, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PRO_PRICE_MKD, PRO_PRICE_MONTHLY, BANK_ACCOUNT, BANK_NAME, BANK_RECIPIENT, SUPPORT_EMAIL as CONTACT_EMAIL } from '../data/pricingConstants';

// 2026-07-20 (Wave 13.2): prepared-but-inactive subscription-mode path — Stripe doesn't yet
// support recurring billing payouts in North Macedonia, so this stays off (unset/false) until
// that changes. Mirrors the server-side STRIPE_SUBSCRIPTIONS_ENABLED flag in
// api/stripe-checkout.ts; flipping both on is the entire activation, no code change needed.
const SUBSCRIPTIONS_ENABLED = import.meta.env.VITE_STRIPE_SUBSCRIPTIONS_ENABLED === 'true';

// ── Feature comparison ─────────────────────────────────────────────────────
const FEATURES: Array<{ label: string; free: string | boolean; pro: string | boolean; school: string | boolean }> = [
  { label: 'Почетни AI кредити',           free: '50 (вкупно)',   pro: 'Неограничени',    school: 'Неограничени' },
  { label: 'Квизови и тестови',            free: true,            pro: true,              school: true },
  { label: 'Планови за часови',            free: true,            pro: true,              school: true },
  { label: 'Диференцирани материјали 3×',  free: false,           pro: true,              school: true },
  { label: 'Презентации (Math Gamma)',     free: false,           pro: true,              school: true },
  { label: 'GeoGebra + Desmos',            free: false,           pro: true,              school: true },
  { label: 'Алгебарски плочки (манип.)',   free: true,            pro: true,              school: true },
  { label: 'Годишен план со AI',           free: false,           pro: true,              school: true },
  { label: 'Аналитика за наставниците',   free: 'Основна',       pro: 'Целосна',         school: 'Целосна + Admin' },
  { label: 'Банка на сценаријата',         free: 'Само читање',   pro: 'Читање + Објавување', school: 'Читање + Објавување' },
  { label: 'Родителски портал',            free: true,            pro: true,              school: true },
  { label: 'IEP поддршка',                free: false,           pro: true,              school: true },
  { label: 'Офлајн режим (PWA)',           free: true,            pro: true,              school: true },
  { label: 'Школски администратор',        free: false,           pro: false,             school: true },
  { label: 'Приоритетна поддршка',         free: false,           pro: true,              school: 'Посветен менаџер' },
];

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'Дали могу да го откажам претплатата?',
    a: 'Pro планот е еднократна годишна уплата. Нема автоматско обновување. По истекот на годината, слободно изберете дали ќе продолжите.',
  },
  {
    q: 'Кои методи за плаќање се достапни?',
    a: `Плаќање со банкарски трансфер на ${BANK_NAME}. Сметка: ${BANK_ACCOUNT}, примач: ${BANK_RECIPIENT}. По уплатата испратете потврда на ${CONTACT_EMAIL} и вашиот Pro акаунт ќе биде активиран во рок од 24 часа.`,
  },
  {
    q: 'Колку брзо се активира Pro?',
    a: 'По потврда на уплатата — во рок од 24 часа (обично многу побрзо). Добивате email потврда кога вашиот акаунт е активиран.',
  },
  {
    q: 'Дали постои попуст за повеќе наставници?',
    a: 'Да — за 5+ наставници нудиме школска лиценца со значителен попуст. Контактирајте нè на bogdanoskiigor@gmail.com.',
  },
  {
    q: 'Дали моите материјали се безбедни?',
    a: 'Да. Сите материјали се приватни за вашиот акаунт. Само материјали кои вие изберете да ги објавите се видливи во Банката на сценаријата.',
  },
  {
    q: 'Колку трае Pro планот?',
    a: '12 месеци од денот на активацијата. 30 дена пред истекот добивате потсетник на вашата email адреса.',
  },
];

// ── CopyButton ─────────────────────────────────────────────────────────────
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      title="Копирај"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Копирано' : 'Копирај'}
    </button>
  );
};

// ── BankTransferBox ────────────────────────────────────────────────────────
const BankTransferBox: React.FC<{ price: number }> = ({ price }) => (
  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
    <div className="flex items-center gap-2 text-indigo-800 font-bold text-sm">
      <Building2 className="w-4 h-4" />
      Плаќање со банкарски трансфер
    </div>
    <div className="space-y-2 text-sm">
      {[
        { label: 'Банка', value: BANK_NAME },
        { label: 'Примач', value: BANK_RECIPIENT },
        { label: 'Сметка', value: BANK_ACCOUNT },
        { label: 'Износ', value: `${price} МКД` },
        { label: 'Цел', value: 'MisMath Pro лиценца' },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2 border border-indigo-100">
          <span className="text-indigo-600 font-medium shrink-0">{label}:</span>
          <span className="font-mono text-gray-800 font-semibold text-xs sm:text-sm">{value}</span>
          <CopyButton text={value} />
        </div>
      ))}
    </div>
    <p className="text-xs text-indigo-600 leading-relaxed">
      По уплатата испратете скенирана / фотографирана потврда на{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold underline">{CONTACT_EMAIL}</a>
      {' '}и вашиот акаунт ќе биде активиран во рок од 24 часа.
    </p>
  </div>
);

// ── FeatureCell ────────────────────────────────────────────────────────────
const FeatureCell: React.FC<{ value: string | boolean }> = ({ value }) => {
  if (value === true) return <Check className="w-5 h-5 text-emerald-600 mx-auto" aria-hidden="true" />;
  if (value === false) return <span className="text-slate-500 text-lg mx-auto block text-center">—</span>;
  return <span className="text-sm text-slate-700 text-center block">{value}</span>;
};

// ── FAQ Item ───────────────────────────────────────────────────────────────
const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={answerId}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        {q}
        {open ? <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" /> : <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />}
      </button>
      {open && <div id={answerId} className="px-5 pb-4 text-sm text-slate-700 leading-relaxed">{a}</div>}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export const PricingView: React.FC = () => {
  const { isAuthenticated, user, firebaseUser } = useAuth();
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'School' || user?.tier === 'Unlimited';

  // Success/cancel URL params
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const paymentStatus = params.get('payment');

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
      if (!res.ok) throw new Error(data.error || 'Грешка при плаќање.');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Непозната грешка.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Same portal endpoint as BillingPrivacyPanel — Stripe's Billing Portal shows subscription
  // management (cancel/change plan/update card) whenever the customer actually has a
  // subscription, so this button only needs to exist once subscription-mode checkout (Wave
  // 13.2) is enabled; the endpoint itself is already always-on (Wave 13.1).
  const handleManageSubscription = async () => {
    if (!firebaseUser) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/stripe-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Грешка.');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Непозната грешка.');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Helmet>
        <title>Цени и планови — MisMath AI</title>
        <meta name="description" content="Бесплатен план за наставници, Pro план со неограничени AI генерации (1500 МКД/год) и School план за цели училишта. Започни бесплатно денес." />
        <meta property="og:title" content="Цени — MisMath AI Математичка Платформа" />
        <meta property="og:url" content="https://ai.mismath.net/pricing" />
        <link rel="canonical" href="https://ai.mismath.net/pricing" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "MisMath AI",
          "description": "AI платформа за македонски наставници по математика",
          "url": "https://ai.mismath.net",
          "offers": [
            { "@type": "Offer", "name": "Free план", "price": "0", "priceCurrency": "MKD", "availability": "https://schema.org/InStock", "url": "https://ai.mismath.net/pricing" },
            { "@type": "Offer", "name": "Pro план", "price": "1500", "priceCurrency": "MKD", "availability": "https://schema.org/InStock", "priceValidUntil": "2027-12-31", "url": "https://ai.mismath.net/pricing" }
          ]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": FAQ.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } }))
        })}</script>
      </Helmet>

      {/* Payment status banners */}
      {paymentStatus === 'success' && (
        <div className="bg-emerald-500 text-white text-center py-3 font-semibold text-sm">
          🎉 Уплатата е потврдена! Вашиот Pro акаунт ќе биде активиран во рок од 24 часа.
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
          <span className="text-indigo-700">квалитетна настава.</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto mb-2">
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
                <h2 className="text-lg font-bold text-slate-800">Бесплатно</h2>
              </div>
              <div className="text-4xl font-black text-slate-900 mb-1">0 МКД</div>
              <p className="text-slate-600 text-sm">Засекогаш бесплатно</p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {['50 почетни AI кредити', 'Квизови и тестови', 'Планови за часови', 'Алгебарски плочки', 'Офлајн PWA', 'Родителски портал'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            {isAuthenticated ? (
              <div className="text-center text-sm text-slate-400 py-2">Тековен план</div>
            ) : (
              <a href="#/" className="w-full text-center py-2.5 border border-slate-300 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm">
                Започни бесплатно
              </a>
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
                <h2 className="text-lg font-bold text-white">Pro Наставник</h2>
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black text-white">{PRO_PRICE_MKD}</span>
                <span className="text-indigo-100 text-sm mb-1.5">МКД / год.</span>
              </div>
              <p className="text-indigo-100 text-sm">= {PRO_PRICE_MONTHLY} МКД / месечно · 12 месеци</p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                'Неограничени AI генерации',
                'Диференцирани материјали 3×',
                'Презентации (Math Gamma)',
                'GeoGebra + Desmos + Алг. Плочки',
                'Годишен план со AI',
                'Целосна аналитика',
                'IEP поддршка',
                'Приоритетна поддршка',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-white">
                  <Check className="w-4 h-4 text-emerald-200 shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <div className="space-y-2">
                <div className="w-full text-center py-2.5 bg-white/20 rounded-xl text-white font-semibold text-sm">
                  ✅ Активен план
                </div>
                {SUBSCRIPTIONS_ENABLED && (
                  <button
                    type="button"
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="w-full py-2 border border-white/40 rounded-xl text-white/90 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    Управувај со претплата
                  </button>
                )}
                {portalError && (
                  <p className="text-red-100 bg-red-500/20 rounded-lg py-1.5 text-xs text-center">{portalError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={checkoutLoading}
                  className="w-full py-3 bg-white text-indigo-700 font-black rounded-xl hover:bg-indigo-50 transition-colors shadow-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {checkoutLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Се подготвува...</>
                    : <><CreditCard className="w-4 h-4" /> Активирај Pro — плати со картичка</>}
                </button>
                {checkoutError && (
                  <p className="text-red-100 bg-red-500/20 rounded-lg py-1.5 text-xs text-center">{checkoutError}</p>
                )}
                {!isAuthenticated && (
                  <p className="text-indigo-100 text-xs text-center">
                    <a href="#/" className="underline">Најавете се</a> пред да продолжите со плаќање
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowBankDetails(v => !v)}
                  className="w-full text-indigo-100 text-xs text-center hover:text-white transition-colors underline underline-offset-2"
                >
                  {showBankDetails ? 'Скриј банкарски трансфер' : 'или плати со банкарски трансфер →'}
                </button>
              </div>
            )}
          </div>

          {/* School */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-slate-800">Училишна лиценца</h2>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">По договор</div>
              <p className="text-slate-600 text-sm">За сите наставници преку фактура</p>
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
                  <Check className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Школска лиценца — MisMath AI&body=Здраво,%0D%0A%0D%0AБи сакале да дознаеме повеќе за школската лиценца за нашето училиште.%0D%0A%0D%0АБрој на наставници: %0D%0AУчилиште: `}
              className="w-full text-center py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors text-sm"
            >
              Побарај понуда
            </a>
          </div>
        </div>

        {/* Bank transfer expanded panel */}
        {showBankDetails && (
          <div className="mt-6 max-w-lg mx-auto">
            <BankTransferBox price={PRO_PRICE_MKD} />
          </div>
        )}
      </div>

      {/* ── Feature Comparison Table ── */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">Детална споредба на планови</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <caption className="sr-only">Споредба на функционалности меѓу Бесплатно, Pro и Школско ниво</caption>
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
            { icon: Zap, text: 'Активација 24ч', sub: 'По потврда на уплата' },
            { icon: HeadphonesIcon, text: 'Поддршка', sub: CONTACT_EMAIL },
            { icon: BarChart3, text: 'Направено во МК', sub: 'За македонски наставници' },
          ].map(({ icon: Icon, text, sub }) => (
            <div key={text} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <Icon className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 text-sm">{text}</p>
              <p className="text-slate-600 text-xs mt-0.5">{sub}</p>
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
        <p className="text-indigo-100 mb-6">Придружете се на 250+ наставници кои веќе ја користат платформата.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isPro && (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-8 py-3.5 bg-white text-indigo-700 font-black rounded-xl hover:bg-indigo-50 transition-colors shadow-xl"
            >
              💳 Надгради на Pro — {PRO_PRICE_MKD} МКД/год.
            </button>
          )}
          <a
            href="#/"
            className="px-8 py-3.5 border-2 border-white/70 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
          >
            Продолжи бесплатно
          </a>
        </div>
      </div>

    </div>
  );
};
