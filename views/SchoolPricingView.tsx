import React, { useState } from 'react';
import { Building2, Users, CheckCircle2, Send, Shield, Headphones, BarChart3, Crown } from 'lucide-react';
import { schoolService } from '../services/firestoreService.school';

const SCHOOL_FEATURES = [
  { icon: Users,      label: 'Неограничени наставници',      desc: 'Цело училиште под еден план' },
  { icon: BarChart3,  label: 'Admin аналитика',              desc: 'Статистики по наставник, одделение, предмет' },
  { icon: Shield,     label: 'Централизирано управување',     desc: 'Bulk license + единечен billing' },
  { icon: Headphones, label: 'Посветен менаџер на успех',    desc: 'Onboarding, обука и приоритетна поддршка' },
  { icon: Crown,      label: 'Сите Pro функции',             desc: 'Неограничени AI генерации за секој наставник' },
];

export const SchoolPricingView: React.FC = () => {
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    schoolName: '',
    city: '',
    teacherCount: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactName || !form.contactEmail || !form.schoolName) return;
    setStatus('sending');
    try {
      await schoolService.submitSchoolInquiry({
        contactName:  form.contactName,
        contactEmail: form.contactEmail,
        schoolName:   form.schoolName,
        city:         form.city,
        teacherCount: Number(form.teacherCount) || 0,
        message:      form.message || undefined,
      });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white py-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            <Building2 className="w-4 h-4" /> Школски план
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 leading-tight">
            MisMath за цело училиште
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Дајте им на сите наставници пристап до AI алатките за настава. Еден план, сите наставници, значителен попуст.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-start">

          {/* Features */}
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Что добивате со школски план</h2>
            {SCHOOL_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{f.label}</p>
                    <p className="text-sm text-slate-500">{f.desc}</p>
                  </div>
                </div>
              );
            })}

            <div className="mt-8 p-5 bg-indigo-600 text-white rounded-2xl">
              <p className="font-bold text-lg mb-1">Попуст за булк лиценца</p>
              <p className="text-indigo-100 text-sm">
                5–10 наставници → 20% попуст<br />
                11–30 наставници → 35% попуст<br />
                30+ наставници → по договор
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            {status === 'sent' ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Барањето е примено!</h3>
                <p className="text-slate-600 text-sm">
                  Ќе ве контактираме на <strong>{form.contactEmail}</strong> во рок од 24 часа со персонализирана понуда.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 mb-5">Побарајте понуда</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Ваше име *</label>
                    <input
                      type="text"
                      required
                      value={form.contactName}
                      onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      placeholder="Марија Петровска"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Е-маил *</label>
                    <input
                      type="email"
                      required
                      value={form.contactEmail}
                      onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      placeholder="marija@uciliste.edu.mk"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Назив на училиштето *</label>
                  <input
                    type="text"
                    required
                    value={form.schoolName}
                    onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                    placeholder="СОУ Гимназија Скопје"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Град</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      placeholder="Скопје"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Број на наставници</label>
                    <input
                      type="number"
                      min="2"
                      value={form.teacherCount}
                      onChange={e => setForm(f => ({ ...f, teacherCount: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      placeholder="15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Порака (опционално)</label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none resize-none"
                    placeholder="Дополнителни барања или прашања..."
                  />
                </div>

                {status === 'error' && (
                  <p className="text-red-500 text-xs">Грешка при испраќање. Обидете се повторно или пишете на contact@mismath.net</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {status === 'sending' ? 'Се испраќа...' : 'Побарај понуда'}
                </button>

                <p className="text-xs text-center text-slate-400">
                  Или директно на{' '}
                  <a href="mailto:contact@mismath.net" className="text-indigo-600 hover:underline font-medium">
                    contact@mismath.net
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
