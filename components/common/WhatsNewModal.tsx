import React, { useEffect, useState } from 'react';
import { X, GraduationCap, Brain, Gift, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getReferralLink } from '../../hooks/useReferral';

const STORAGE_KEY = 'whats_new_s65_seen';

const FEATURES = [
  {
    icon: GraduationCap,
    color: 'text-indigo-600 bg-indigo-50',
    title: 'Ученички портал',
    desc: 'Учениците можат да се најават, да ги следат задачите и да вежбаат за матура на #/student.',
  },
  {
    icon: Brain,
    color: 'text-purple-600 bg-purple-50',
    title: 'SM-2 Повторувања за ученици',
    desc: 'Персонализиран распоред за повторување по кривата на заборавање.',
  },
  {
    icon: Gift,
    color: 'text-amber-600 bg-amber-50',
    title: 'Програма за покани (+10 кредити)',
    desc: 'Покани колега — ти добиваш 10 кредити кога тие ќе се регистрираат преку твојот линк.',
  },
  {
    icon: Zap,
    color: 'text-emerald-600 bg-emerald-50',
    title: 'Побрзо вчитување',
    desc: 'FCP се намали за ~980ms. Chart.js и vis-network се вчитуваат само кога се потребни.',
  },
];

export const WhatsNewModal: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={dismiss}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-0.5">MisMath S65</div>
            <h2 className="text-xl font-bold text-gray-900">Ново во платформата 🎉</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Затвори"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {FEATURES.map(f => (
            <div key={f.title} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>
                <f.icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {firebaseUser?.uid && (
          <div className="mx-5 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-800 mb-2">📤 Сподели со колеги — добиј 10 кредити по регистрација</p>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95"
            >
              {copied ? '✓ Линкот е копиран!' : 'Копирај мој линк за покана'}
            </button>
          </div>
        )}

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2 bg-brand-primary text-white text-sm font-semibold rounded-xl hover:bg-brand-secondary transition-colors"
          >
            Разбрав, да почнеме!
          </button>
        </div>
      </div>
    </div>
  );
};
