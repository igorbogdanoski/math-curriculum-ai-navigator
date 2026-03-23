import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { GradeModel, GradeEntry } from '../types';
import {
  BookMarked, BarChart3, Target, GraduationCap, Plus, Trash2, Save,
  Loader2, Brain, TrendingUp, AlertTriangle, CheckCircle2,
  Users, FileDown, Sparkles, Zap, X, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Model metadata ────────────────────────────────────────────────────────────

const GRADE_MODELS: { id: GradeModel; label: string; icon: React.ElementType; color: string; bg: string; border: string; theory: string; source: string }[] = [
  {
    id: 'traditional',
    label: 'Традиционален',
    icon: BarChart3,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    theory: 'Класично оценување по проценти. Норматив: 50–64% = 2, 65–74% = 3, 75–84% = 4, 85%+ = 5.',
    source: 'МОН Правилник за оценување',
  },
  {
    id: 'mastery',
    label: 'Мастери (Bloom)',
    icon: Target,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    theory: '80%+ = Совладано ✓ | 60–79% = Во напредок ◐ | <60% = Не совладано ✗. Акцент на ремедијација, не казнување.',
    source: "Bloom, 1968 — 'Learning for Mastery'",
  },
  {
    id: 'sbg',
    label: 'SBG по стандарди',
    icon: GraduationCap,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    theory: 'Скала 1–4 по стандард: 4=Одличен, 3=Задоволителен, 2=Во напредок, 1=Под очекувањата. Јасно покажува КОИ стандарди треба повторување.',
    source: 'Marzano & Heflebower, 2011 — Grades That Show What Students Know',
  },
];

function percentToGrade(p: number): string {
  if (p >= 85) return '5';
  if (p >= 75) return '4';
  if (p >= 65) return '3';
  if (p >= 50) return '2';
  return '1';
}

function percentToMastery(p: number): GradeEntry['masteryStatus'] {
  if (p >= 80) return 'mastered';
  if (p >= 60) return 'approaching';
  return 'not_yet';
}

const MASTERY_LABELS: Record<NonNullable<GradeEntry['masteryStatus']>, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  mastered:    { label: 'Совладано',   color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle2 },
  approaching: { label: 'Во напредок', color: 'text-amber-700',  bg: 'bg-amber-100',  icon: TrendingUp },
  not_yet:     { label: 'Не совладано',color: 'text-red-700',    bg: 'bg-red-100',    icon: AlertTriangle },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const GradeBookView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();

  const [activeModel, setActiveModel] = useState<GradeModel>('traditional');
  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState(6);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  // Early Warning
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);
  const [warningIntervention, setWarningIntervention] = useState<Record<string, string>>({});
  const [loadingIntervention, setLoadingIntervention] = useState<string | null>(null);
  const [expandedWarning, setExpandedWarning] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  // New entry form
  const [newName, setNewName] = useState('');
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newRaw, setNewRaw] = useState('');
  const [newMax, setNewMax] = useState('100');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const addEntry = () => {
    const errors: Record<string, string> = {};
    if (!newName.trim()) errors.name = 'Внесете го името на ученикот.';
    if (!newTestTitle.trim()) errors.testTitle = 'Внесете наслов на тестот.';
    const raw = Number(newRaw);
    const max = Number(newMax);
    if (!newRaw) errors.raw = 'Внесете освоени поени.';
    else if (raw < 0) errors.raw = 'Поените не можат да бидат негативни.';
    else if (raw > max) errors.raw = 'Не може да надмине максимумот.';
    if (!newMax || max <= 0) errors.max = 'Максимумот мора да биде > 0.';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    const pct = Math.round((raw / max) * 100);
    const entry: GradeEntry = {
      studentId: crypto.randomUUID(),
      studentName: newName.trim(),
      testId: crypto.randomUUID(),
      testTitle: newTestTitle.trim(),
      rawScore: raw,
      maxScore: max,
      percentage: pct,
      masteryStatus: percentToMastery(pct),
      gradedAt: new Date().toISOString(),
    };
    setEntries(prev => [...prev, entry]);
    setNewName('');
    setNewRaw('');
  };

  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.studentId !== id));

  const handleSave = async () => {
    if (!firebaseUser || !className.trim() || entries.length === 0) return;
    setSaving(true);
    try {
      const { db } = await import('../firebaseConfig');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'grade_books'), {
        teacherUid: firebaseUser.uid,
        className,
        gradeLevel,
        model: activeModel,
        entries,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addNotification('Тетратката е зачувана! ✅', 'success');
    } catch {
      addNotification('Грешка при зачувување.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAIInsights = async () => {
    if (entries.length < 2) {
      addNotification('Додај барем 2 ученика за AI анализа.', 'error');
      return;
    }
    setLoadingAI(true);
    setAiInsights(null);
    setShowInsights(true);
    try {
      const { geminiService } = await import('../services/geminiService');
      const summary = entries.map(e =>
        `${e.studentName}: ${e.percentage}% (${e.testTitle})`
      ).join(', ');
      const prompt = `Анализирај ги следниве резултати од тест за одделение ${gradeLevel} (${className || 'класа'}) по модел ${activeModel}:\n${summary}\n\nДај кратка (5-7 реченици) педагошка анализа на македонски. Посочи: просек, процент на совладано, ученици со ризик, препораки за наставникот.`;
      let text = '';
      for await (const chunk of geminiService.getChatResponseStream([{ role: 'user', text: prompt }])) {
        text += chunk;
        if (isMounted.current) setAiInsights(text);
      }
    } catch {
      if (isMounted.current) setAiInsights('Грешка при AI анализа.');
    } finally {
      if (isMounted.current) setLoadingAI(false);
    }
  };

  // Stats
  const avg = entries.length ? Math.round(entries.reduce((s, e) => s + e.percentage, 0) / entries.length) : 0;
  const mastered = entries.filter(e => e.percentage >= 80).length;
  const atRisk = entries.filter(e => e.percentage < 60).length;

  // ── Early Warning: students with ≥3 results below 50% ──
  const studentGroups = entries.reduce<Record<string, GradeEntry[]>>((acc, e) => {
    if (!acc[e.studentName]) acc[e.studentName] = [];
    acc[e.studentName].push(e);
    return acc;
  }, {});

  const earlyWarningStudents = Object.entries(studentGroups)
    .filter(([, se]) => se.filter(e => e.percentage < 50).length >= 3)
    .map(([name, se]) => ({
      name,
      lowCount: se.filter(e => e.percentage < 50).length,
      avgPct: Math.round(se.reduce((sum, e) => sum + e.percentage, 0) / se.length),
      tests: se.map(e => `${e.testTitle}: ${e.percentage}%`),
    }))
    .filter(s => !dismissedWarnings.includes(s.name));

  const handleIntervention = async (studentName: string, tests: string[]) => {
    setLoadingIntervention(studentName);
    setExpandedWarning(studentName);
    try {
      const { geminiService } = await import('../services/geminiService');
      const prompt = `Наставник по математика, одделение ${gradeLevel} (${className || 'класа'}), пријавува ученик "${studentName}" со следниве резултати: ${tests.join(', ')}.

Ученикот има ≥3 резултати под 50%. Генерирај конкретен план за интервенција (4-5 точки) на македонски јазик. Вклучи:
1. Можни причини за слабиот успех
2. Диференцирани стратегии за поддршка
3. Препорака за родителска средба
4. Конкретна активност за следниот час

Биди практичен и охрабрувачки.`;

      let text = '';
      for await (const chunk of geminiService.getChatResponseStream([{ role: 'user', text: prompt }])) {
        text += chunk;
        if (isMounted.current) setWarningIntervention(prev => ({ ...prev, [studentName]: text }));
      }
    } catch {
      if (isMounted.current) setWarningIntervention(prev => ({ ...prev, [studentName]: 'Грешка при генерирање на планот.' }));
    } finally {
      if (isMounted.current) setLoadingIntervention(null);
    }
  };

  const modelMeta = GRADE_MODELS.find(m => m.id === activeModel)!;

  return (
    <div className="p-6 max-w-7xl mx-auto pb-32 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-2xl text-brand-primary">
            <BookMarked className="w-7 h-7" />
          </div>
          Тетратка за оценки
        </h1>
        <p className="text-gray-500 mt-1 ml-14">Три модели на сумативно оценување со научна педагошка основа</p>
      </div>

      {/* Model selector */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Модел на оценување</p>
            <div className="flex flex-wrap gap-2">
              {GRADE_MODELS.map(m => {
                const Icon = m.icon;
                const active = activeModel === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setActiveModel(m.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 font-bold text-sm transition-all ${
                      active ? `${m.bg} ${m.border} ${m.color} shadow-sm` : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Icon className="w-4 h-4" /> {m.label}
                  </button>
                );
              })}
            </div>
            <div className={`mt-3 p-3 rounded-xl ${modelMeta.bg} border ${modelMeta.border}`}>
              <p className={`text-xs font-bold ${modelMeta.color}`}>{modelMeta.theory}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 italic">Извор: {modelMeta.source}</p>
            </div>
          </div>

          {/* Class info */}
          <div className="flex flex-col gap-3 w-full lg:w-64">
            <div>
              <label htmlFor="gb-class-name" className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1">Назив на класа</label>
              <input id="gb-class-name" type="text" value={className} onChange={e => setClassName(e.target.value)}
                placeholder="Пр. VI-3 Математика"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label htmlFor="gb-grade-level" className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1">Одделение</label>
              <select id="gb-grade-level" value={gradeLevel} onChange={e => setGradeLevel(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary">
                {[6, 7, 8, 9].map(g => <option key={g} value={g}>{g}. одделение</option>)}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats bar */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <p className="text-3xl font-black text-gray-900">{entries.length}</p>
            <p className="text-xs text-gray-500 font-bold mt-1 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Ученици</p>
          </Card>
          <Card className="p-4 text-center">
            <p className={`text-3xl font-black ${avg >= 80 ? 'text-green-600' : avg >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{avg}%</p>
            <p className="text-xs text-gray-500 font-bold mt-1">Просек</p>
          </Card>
          <Card className="p-4 text-center bg-green-50 border-green-100">
            <p className="text-3xl font-black text-green-600">{mastered}</p>
            <p className="text-xs text-green-600 font-bold mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Совладано (80%+)</p>
          </Card>
          <Card className="p-4 text-center bg-red-50 border-red-100">
            <p className="text-3xl font-black text-red-600">{atRisk}</p>
            <p className="text-xs text-red-600 font-bold mt-1 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Со ризик (&lt;60%)</p>
          </Card>
        </div>
      )}

      {/* ── Early Warning Panel ── */}
      {earlyWarningStudents.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-red-100 bg-red-100/50">
            <div className="w-9 h-9 bg-red-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-red-900 flex items-center gap-2">
                Рано предупредување — {earlyWarningStudents.length} {earlyWarningStudents.length === 1 ? 'ученик' : 'ученици'} во ризик
              </h3>
              <p className="text-xs text-red-700 mt-0.5">≥3 резултати под 50% · препорачана педагошка интервенција</p>
            </div>
            <span className="text-[10px] bg-red-200 text-red-800 font-bold px-2 py-1 rounded-full uppercase tracking-wider flex-shrink-0">
              AI Early Warning
            </span>
          </div>

          <div className="p-4 space-y-3">
            {earlyWarningStudents.map(student => {
              const isExpanded = expandedWarning === student.name;
              const intervention = warningIntervention[student.name];
              const loading = loadingIntervention === student.name;
              return (
                <div key={student.name} className="bg-white rounded-xl border border-red-100 overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-500">
                        {student.lowCount} резултати под 50% · Просек: <span className="font-bold text-red-600">{student.avgPct}%</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleIntervention(student.name, student.tests)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-all"
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                        Интервенција
                      </button>
                      {intervention && (
                        <button
                          type="button"
                          title={isExpanded ? 'Сокриј' : 'Прикажи'}
                          aria-label={isExpanded ? 'Сокриј план за интервенција' : 'Прикажи план за интервенција'}
                          onClick={() => setExpandedWarning(isExpanded ? null : student.name)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        title="Отфрли предупредување"
                        aria-label="Отфрли предупредување за ученик"
                        onClick={() => setDismissedWarnings(prev => [...prev, student.name])}
                        className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Intervention plan */}
                  {(loading || intervention) && isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                        {loading && !intervention ? (
                          <div className="flex items-center gap-2 text-red-600 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            AI подготвува план за интервенција…
                          </div>
                        ) : (
                          <>
                            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" /> AI План за педагошка интервенција
                            </p>
                            <p className="text-sm text-red-900 leading-relaxed whitespace-pre-wrap">{intervention}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Test breakdown */}
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {student.tests.map((t) => (
                      <span key={t} className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add entry form */}
      <Card className="p-5 space-y-3">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Plus className="w-4 h-4" /> Додај резултат
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 space-y-1">
            <input type="text" value={newName} onChange={e => { setNewName(e.target.value); setFormErrors(p => ({ ...p, name: '' })); }}
              placeholder="Име на ученик" aria-label="Име на ученик"
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
            {formErrors.name && <p className="text-[11px] text-red-500 px-1">{formErrors.name}</p>}
          </div>
          <div className="space-y-1">
            <input type="text" value={newTestTitle} onChange={e => { setNewTestTitle(e.target.value); setFormErrors(p => ({ ...p, testTitle: '' })); }}
              placeholder="Наслов на тест" aria-label="Наслов на тест"
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.testTitle ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
            {formErrors.testTitle && <p className="text-[11px] text-red-500 px-1">{formErrors.testTitle}</p>}
          </div>
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="flex-1">
                <input type="number" value={newRaw} onChange={e => { setNewRaw(e.target.value); setFormErrors(p => ({ ...p, raw: '' })); }}
                  placeholder="Поени" aria-label="Освоени поени" min={0}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.raw ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
              </div>
              <span className="self-center text-gray-400 font-bold">/</span>
              <div className="flex-1">
                <input type="number" value={newMax} onChange={e => { setNewMax(e.target.value); setFormErrors(p => ({ ...p, max: '' })); }}
                  placeholder="Макс" aria-label="Максимум поени" min={1}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.max ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
              </div>
            </div>
            {(formErrors.raw || formErrors.max) && <p className="text-[11px] text-red-500 px-1">{formErrors.raw || formErrors.max}</p>}
          </div>
          <button type="button" onClick={addEntry}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-secondary transition-all">
            <Plus className="w-4 h-4" /> Додај
          </button>
        </div>
      </Card>

      {/* Entries table */}
      {entries.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">Ученик</th>
                  <th className="text-left px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">Тест</th>
                  <th className="text-center px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">Поени</th>
                  <th className="text-center px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">%</th>
                  {activeModel === 'traditional' && (
                    <th className="text-center px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">Оценка</th>
                  )}
                  {activeModel === 'mastery' && (
                    <th className="text-center px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">Статус</th>
                  )}
                  {activeModel === 'sbg' && (
                    <th className="text-center px-4 py-3 font-black text-gray-500 text-xs uppercase tracking-wider">Ниво (1–4)</th>
                  )}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const masteryInfo = e.masteryStatus ? MASTERY_LABELS[e.masteryStatus] : null;
                  const sbgLevel = e.percentage >= 85 ? 4 : e.percentage >= 70 ? 3 : e.percentage >= 55 ? 2 : 1;
                  return (
                    <tr key={e.studentId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{e.studentName}</td>
                      <td className="px-4 py-3 text-gray-500">{e.testTitle}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{e.rawScore}/{e.maxScore}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-lg font-black text-xs ${
                          e.percentage >= 80 ? 'bg-green-100 text-green-700' :
                          e.percentage >= 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{e.percentage}%</span>
                      </td>
                      {activeModel === 'traditional' && (
                        <td className="px-4 py-3 text-center">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm mx-auto ${
                            e.percentage >= 85 ? 'bg-green-100 text-green-700' :
                            e.percentage >= 75 ? 'bg-blue-100 text-blue-700' :
                            e.percentage >= 65 ? 'bg-amber-100 text-amber-700' :
                            e.percentage >= 50 ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>{percentToGrade(e.percentage)}</span>
                        </td>
                      )}
                      {activeModel === 'mastery' && masteryInfo && (
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold text-xs ${masteryInfo.bg} ${masteryInfo.color}`}>
                            <masteryInfo.icon className="w-3 h-3" /> {masteryInfo.label}
                          </span>
                        </td>
                      )}
                      {activeModel === 'sbg' && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {[1, 2, 3, 4].map(l => (
                              <div key={l} className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                                l <= sbgLevel
                                  ? sbgLevel === 4 ? 'bg-green-500 text-white'
                                  : sbgLevel === 3 ? 'bg-blue-500 text-white'
                                  : sbgLevel === 2 ? 'bg-amber-500 text-white'
                                  : 'bg-red-400 text-white'
                                  : 'bg-gray-100 text-gray-300'
                              }`}>{l}</div>
                            ))}
                          </div>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => removeEntry(e.studentId)} title="Избриши" aria-label="Избриши запис"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Actions */}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleAIInsights} disabled={loadingAI}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-md hover:shadow-indigo-300 disabled:opacity-50 transition-all">
            {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Анализа на класата
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !className.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold shadow-md hover:bg-brand-secondary disabled:opacity-50 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Зачувај тетратка
          </button>
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">
            <FileDown className="w-4 h-4" /> Печати PDF
          </button>
        </div>
      )}

      {/* AI Insights panel */}
      {showInsights && (
        <Card className="p-5 bg-indigo-50 border-indigo-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-indigo-800">AI Педагошка анализа</h3>
            </div>
            <button type="button" onClick={() => setShowInsights(false)}
              className="text-xs text-indigo-400 hover:text-indigo-600 font-bold">Затвори</button>
          </div>
          {loadingAI && !aiInsights && (
            <div className="flex items-center gap-2 text-indigo-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Анализирам резултати…</span>
            </div>
          )}
          {aiInsights && (
            <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{aiInsights}</p>
          )}
        </Card>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <Card className="py-16 flex flex-col items-center gap-4 text-center border-dashed border-gray-200">
          <div className="p-5 bg-gray-50 rounded-full">
            <Users className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="font-black text-gray-500">Нема внесени резултати</h3>
          <p className="text-sm text-gray-400 max-w-xs">Додај ги резултатите на учениците горе за да го активираш моделот на оценување.</p>
        </Card>
      )}
    </div>
  );
};
