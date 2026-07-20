import React from 'react';
import { Zap, BookOpen, Languages, GraduationCap, Star, ArrowRight } from 'lucide-react';

/**
 * Public marketing landing page for logged-out visitors at the bare `/` route.
 * Reuses the same copy/positioning as LoginView's MarketingPanel (desktop-only side
 * panel there) — this is the full-page, mobile-and-desktop equivalent shown to
 * visitors who haven't reached the login screen yet. Static content only, no auth
 * dependency, so it renders instantly without waiting on Firebase Auth state.
 */

const FEATURES = [
  { icon: Zap,           color: 'bg-amber-100 text-amber-700',   text: 'Тест, план или материјал за 60 секунди' },
  { icon: GraduationCap, color: 'bg-violet-100 text-violet-700', text: '378 матурски прашања + AI тутор за подготовка' },
  { icon: BookOpen,      color: 'bg-emerald-100 text-emerald-700', text: 'МОН + БРО стандарди вградени во секој материјал' },
  { icon: Languages,     color: 'bg-sky-100 text-sky-700',       text: '4 јазици во апликацијата: МК · СК · ТР · EN' },
];

const STATS = [
  { value: '500+', label: 'наставници' },
  { value: '10К+', label: 'материјали' },
  { value: '9',    label: 'одделенија' },
];

const MisMathLogo: React.FC = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
      <span className="text-brand-primary font-black leading-none select-none">M</span>
    </div>
    <div>
      <span className="text-2xl font-black leading-none text-white">Mis</span>
      <span className="text-2xl font-black leading-none text-blue-200">Math</span>
      <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded align-middle bg-white/20 text-white">AI</span>
    </div>
  </div>
);

export const LandingView: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary via-blue-800 to-indigo-900 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-blue-400/20 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 md:py-16">
        <header className="flex items-center justify-between mb-12 md:mb-20">
          <MisMathLogo />
          <a
            href="#/login"
            className="flex items-center gap-1.5 bg-white text-brand-primary text-sm font-bold px-4 py-2 rounded-xl shadow-md hover:bg-blue-50 transition-colors"
          >
            Најави се
          </a>
        </header>

        <main id="main-content" className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
            Заштеди{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
              8 часа
            </span>
            {' '}секоја недела.
          </h1>
          <p className="text-blue-100 text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-8">
            AI асистент за наставници по математика. Материјали, тестови, планирања — за минути, не часови.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#/login"
              className="flex items-center gap-2 bg-white text-brand-primary text-base font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-50 transition-colors"
            >
              Најави се бесплатно <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#/pricing"
              className="flex items-center gap-2 text-white/90 hover:text-white text-base font-semibold px-6 py-3 border border-white/30 rounded-xl hover:bg-white/10 transition-colors"
            >
              Погледај ги цените
            </a>
          </div>
        </main>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-16 md:mb-24">
          {FEATURES.map(({ icon: Icon, color, text }) => (
            <div key={text} className="flex items-center gap-3.5 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-white/90 text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        <div className="max-w-lg mx-auto mb-16 md:mb-24">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">М</span>
              </div>
              <div>
                <div className="flex gap-0.5 mb-1.5">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-white/90 text-sm leading-relaxed italic">
                  „MisMath ми врати 2 часа секој ден. Конечно имам кревање за учениците, не за документи."
                </p>
                <p className="text-blue-300 text-xs mt-2 font-medium">Марија К. — наставник по математика, Скопје</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-16 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl md:text-3xl font-black text-white">{value}</div>
              <div className="text-blue-300 text-xs mt-0.5 font-medium">{label}</div>
            </div>
          ))}
        </div>

        <footer className="flex items-center justify-center gap-6 text-xs text-blue-300/80 pb-6">
          <a href="#/privacy" className="hover:text-white transition-colors">Политика за приватност</a>
          <a href="#/terms" className="hover:text-white transition-colors">Услови на користење</a>
        </footer>
      </div>
    </div>
  );
};
