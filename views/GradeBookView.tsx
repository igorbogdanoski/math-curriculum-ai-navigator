import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Card } from '../components/common/Card';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useParentSharing } from '../hooks/useParentSharing';
import { GradeModel, GradeEntry } from '../types';
import { MobileGradeEntryModal } from '../components/gradebook/MobileGradeEntryModal';
import { ImportFromResultsModal } from '../components/gradebook/ImportFromResultsModal';
import { BROCoveragePanel } from '../components/gradebook/BROCoveragePanel';
import { MaturaReadinessPanel } from '../components/gradebook/MaturaReadinessPanel';
import { EarlyWarningPanel } from '../components/gradebook/EarlyWarningPanel';
import { NewEntryForm } from '../components/gradebook/NewEntryForm';
import { GradebookPrintShell } from '../components/gradebook/GradebookPrintShell';
import { saveGradeBook } from '../services/firestoreService.gradeBooks';
import {
  BookMarked, BarChart3, Target, GraduationCap, Plus, Trash2, Save,
  Loader2, Brain, TrendingUp, AlertTriangle, CheckCircle2,
  Users, FileDown, Sparkles, Share2, Copy, MessageCircle, Smartphone, Download,
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
  const [showMobileEntry, setShowMobileEntry] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const sharing = useParentSharing(firebaseUser?.uid ?? '');

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const gradebookPrintRef = useRef<HTMLDivElement>(null);
  const handleGradebookPrint = useReactToPrint({
    contentRef: gradebookPrintRef,
    documentTitle: `Тетратка_${className || 'класа'}_${gradeLevel}одд`,
    pageStyle: '@page { size: A4 landscape; margin: 1cm 1.2cm; }',
  });

  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.studentId !== id));

  const handleSave = async () => {
    if (!firebaseUser || !className.trim() || entries.length === 0) return;
    setSaving(true);
    try {
      const id = await saveGradeBook(firebaseUser.uid, className, gradeLevel, activeModel, entries, savedId ?? undefined);
      setSavedId(id);
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

      <EarlyWarningPanel entries={entries} gradeLevel={gradeLevel} className={className} sharing={sharing} />

      {/* Add entry form */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4" /> Додај резултат
          </p>
          {firebaseUser && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Увези од резултати
            </button>
          )}
        </div>
        <NewEntryForm
          activeModel={activeModel}
          gradeLevel={gradeLevel}
          onAdd={entry => setEntries(prev => [...prev, entry])}
        />
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
                        <div className="flex items-center gap-1 relative">
                          <button
                            type="button"
                            onClick={() => sharing.setShareMenuStudent(prev => prev === e.studentName ? null : e.studentName)}
                            title="Сподели со родител"
                            aria-label="Сподели со родител"
                            className="p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {sharing.shareMenuStudent === e.studentName && (
                            <div className="absolute right-6 top-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 min-w-[130px]"
                              onMouseLeave={() => sharing.setShareMenuStudent(null)}>
                              <button type="button"
                                onClick={() => sharing.handleShareWhatsApp(e.studentName)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 rounded-lg font-semibold transition-colors">
                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                              </button>
                              <button type="button"
                                onClick={() => sharing.handleShareViber(e.studentName)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-50 rounded-lg font-semibold transition-colors">
                                <Smartphone className="w-3.5 h-3.5" /> Viber
                              </button>
                              <button type="button"
                                onClick={() => sharing.handleCopyParentLink(e.studentName)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg font-semibold transition-colors">
                                <Copy className="w-3.5 h-3.5" />
                                {sharing.copiedParent === e.studentName ? 'Копирано!' : 'Копирај линк'}
                              </button>
                            </div>
                          )}
                          <button type="button" onClick={() => removeEntry(e.studentId)} title="Избриши" aria-label="Избриши запис"
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          <button type="button" onClick={() => handleGradebookPrint()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">
            <FileDown className="w-4 h-4" /> Печати PDF
          </button>
        </div>
      )}

      <GradebookPrintShell
        ref={gradebookPrintRef}
        entries={entries}
        className={className}
        gradeLevel={gradeLevel}
        avg={avg}
        mastered={mastered}
        atRisk={atRisk}
      />

      {/* S99.1 БРО Coverage Panel — SBG mode only */}
      {activeModel === 'sbg' && entries.length > 0 && (
        <Card className="p-5 bg-purple-50 border-purple-200">
          <p className="text-xs font-black text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> БРО Покриеност по стандарди (III-А)
          </p>
          <BROCoveragePanel entries={entries} gradeLevel={gradeLevel} />
        </Card>
      )}

      {/* S100.3 — Matura Readiness Panel (grades 8–9) */}
      {gradeLevel >= 8 && entries.length > 0 && (
        <Card className="p-5 bg-rose-50 border-rose-200">
          <p className="text-xs font-black text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Matura Readiness Predictor
          </p>
          <MaturaReadinessPanel entries={entries} gradeLevel={gradeLevel} />
        </Card>
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

      {/* Mobile floating quick-entry button */}
      <button
        type="button"
        onClick={() => setShowMobileEntry(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3.5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
      >
        <Plus className="w-5 h-5" />
        Внеси оценка
      </button>

      {/* Mobile grade entry modal */}
      {showMobileEntry && (
        <MobileGradeEntryModal
          existingEntries={entries}
          onAdd={(name, testTitle, raw, max) => {
            const pct = Math.round((raw / max) * 100);
            const entry: GradeEntry = {
              studentId: crypto.randomUUID(),
              studentName: name,
              testId: crypto.randomUUID(),
              testTitle,
              rawScore: raw,
              maxScore: max,
              percentage: pct,
              masteryStatus: percentToMastery(pct),
              gradedAt: new Date().toISOString(),
            };
            setEntries(prev => [...prev, entry]);
            addNotification(`✓ ${name} — ${pct}% внесено!`, 'success');
          }}
          onClose={() => setShowMobileEntry(false)}
        />
      )}

      {/* Import from quiz/exam results modal */}
      {showImportModal && firebaseUser && (
        <ImportFromResultsModal
          teacherUid={firebaseUser.uid}
          onImport={imported => {
            setEntries(prev => [...prev, ...imported]);
            addNotification(`✓ ${imported.length} резултат${imported.length !== 1 ? 'и' : ''} увезени!`, 'success');
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
};
