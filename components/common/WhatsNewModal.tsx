import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sigma, ClipboardCheck, Languages, CalendarClock, CreditCard, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getReferralLink } from '../../hooks/useReferral';
import { isStudentShellRoute } from '../../utils/studentShellRoutes';
import { useLanguage } from '../../i18n/LanguageContext';

// 2026-07-20 (Wave 14, drifting-snuggling-wave.md): bump this string every time FEATURES
// below changes, so a teacher who already dismissed an older list sees the refreshed one
// once. The old "whats_new_s65_seen" content (student portal / SM-2 / referral / perf) was
// months stale — this key change alone is what makes the refresh actually show up for
// returning users, not just the new copy.
const STORAGE_KEY = 'whats_new_2026_07_wave14_seen';

interface Feature {
  icon: React.ElementType;
  color: string;
  titleKey: string;
  descKey: string;
  /** Hash route (with query) to deep-link into when "Try it" is clicked — closes the modal too. */
  deepLink?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Sigma,
    color: 'text-violet-600 bg-violet-50',
    titleKey: 'whatsNew.feature.labs.title',
    descKey: 'whatsNew.feature.labs.desc',
    deepLink: '/data-viz?tab=trig',
  },
  {
    icon: ClipboardCheck,
    color: 'text-indigo-600 bg-indigo-50',
    titleKey: 'whatsNew.feature.dugga.title',
    descKey: 'whatsNew.feature.dugga.desc',
    deepLink: '/dugga',
  },
  {
    icon: Languages,
    color: 'text-sky-600 bg-sky-50',
    titleKey: 'whatsNew.feature.i18n.title',
    descKey: 'whatsNew.feature.i18n.desc',
    deepLink: '/settings',
  },
  {
    icon: CalendarClock,
    color: 'text-emerald-600 bg-emerald-50',
    titleKey: 'whatsNew.feature.copyYear.title',
    descKey: 'whatsNew.feature.copyYear.desc',
    deepLink: '/annual-planner',
  },
  {
    icon: CreditCard,
    color: 'text-amber-600 bg-amber-50',
    titleKey: 'whatsNew.feature.pricing.title',
    descKey: 'whatsNew.feature.pricing.desc',
    deepLink: '/pricing',
  },
];

export const WhatsNewModal: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // Teacher-only feature announcement (referral program, teacher-facing feature
    // list) — must not pop up over public/student-facing routes like /play/:id,
    // where its full-screen backdrop would also block the page underneath.
    if (isStudentShellRoute(window.location.hash)) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch { /* incognito */ }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* incognito */ }
  };

  const handleCopy = async () => {
    const link = getReferralLink(firebaseUser?.uid ?? '');
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* blocked */ }
  };

  const handleTryIt = (deepLink: string) => {
    // WhatsNewModal is mounted above AuthenticatedApp's NavigationContext.Provider (see
    // App.tsx's AppProviders), so useNavigation() isn't reachable here — a plain hash
    // assignment is what LandingView.tsx and other top-level components use for the same
    // reason, and App.tsx's AppCore + useRouter are both hash-reactive (Wave 12 fix), so
    // this correctly re-renders into the target view.
    window.location.hash = `#${deepLink}`;
    dismiss();
  };

  if (!open) return null;

  const current = FEATURES[slide];
  const goPrev = () => setSlide(s => (s - 1 + FEATURES.length) % FEATURES.length);
  const goNext = () => setSlide(s => (s + 1) % FEATURES.length);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={dismiss}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-0.5">{t('whatsNew.badge')}</div>
            <h2 className="text-xl font-bold text-gray-900">{t('whatsNew.title')}</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('whatsNew.close')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Carousel: one feature per screen ── */}
        <div className="p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('whatsNew.prev')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 disabled:opacity-30"
              disabled={FEATURES.length <= 1}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3 ${current.color}`}>
                <current.icon className="w-6 h-6" />
              </div>
              <p className="font-bold text-gray-900 text-base mb-1">{t(current.titleKey)}</p>
              <p className="text-sm text-gray-500 leading-relaxed min-h-[3.5em]">{t(current.descKey)}</p>
              {current.deepLink && (
                <button
                  type="button"
                  onClick={() => handleTryIt(current.deepLink!)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:text-brand-secondary transition-colors"
                >
                  {t('whatsNew.tryIt')} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={goNext}
              aria-label={t('whatsNew.next')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 disabled:opacity-30"
              disabled={FEATURES.length <= 1}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-4" role="tablist" aria-label={t('whatsNew.title')}>
            {FEATURES.map((f, i) => (
              <button
                key={f.titleKey}
                type="button"
                role="tab"
                aria-selected={i === slide}
                aria-label={t('whatsNew.slideOf').replace('{current}', String(i + 1)).replace('{total}', String(FEATURES.length))}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-brand-primary' : 'w-1.5 bg-gray-200 hover:bg-gray-300'}`}
              />
            ))}
          </div>
        </div>

        {firebaseUser?.uid && (
          <div className="mx-5 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-800 mb-2">{t('whatsNew.referralPrompt')}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95"
            >
              {copied ? t('whatsNew.linkCopied') : t('whatsNew.copyLink')}
            </button>
          </div>
        )}

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2 bg-brand-primary text-white text-sm font-semibold rounded-xl hover:bg-brand-secondary transition-colors"
          >
            {t('whatsNew.dismissCta')}
          </button>
        </div>
      </div>
    </div>
  );
};
