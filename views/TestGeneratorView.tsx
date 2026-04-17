import React, { useState, useRef } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { geminiService } from '../services/geminiService';
import { GeneratedTest, ProGeneratedTest, DifferentiatedLevel, AssessmentModel } from '../types';
import { useReactToPrint } from 'react-to-print';
import { PrintableTest } from '../components/ai/PrintableTest';
import { MathRenderer } from '../components/common/MathRenderer';
import {
  Sparkles, Loader2, Eye, EyeOff, FileDown, BookOpen, Brain, Target, GraduationCap,
  CheckCircle, ChevronRight, BarChart3, Layers, Cpu, Info, Save, Check
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

// ── Assessment model metadata ──────────────────────────────────────────────

const MODELS: {
  id: AssessmentModel;
  label: string;
  icon: React.ElementType;
  color: string;
  border: string;
  bg: string;
  theory: string;
  source: string;
}[] = [
  {
    id: 'standard',
    label: 'Стандардна А/Б',
    icon: Layers,
    color: 'text-blue-600',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    theory: 'Класичен паралелен тест. Две групи (А и Б) со иста тежина и различни бројки — спречува препишување.',
    source: 'Практика на МОН, ISO 10667',
  },
  {
    id: 'differentiated',
    label: 'Диференцирана',
    icon: BarChart3,
    color: 'text-purple-600',
    border: 'border-purple-300',
    bg: 'bg-purple-50',
    theory: 'Три нивоа по Bloom (паметење → примена → анализа). Секој ученик работи по свое ниво, оценувањето е праведно.',
    source: 'Bloom, 1956; Tomlinson, 1999 — Диференцирана настава',
  },
  {
    id: 'mastery',
    label: 'Мастери (Bloom)',
    icon: Target,
    color: 'text-green-600',
    border: 'border-green-300',
    bg: 'bg-green-50',
    theory: 'Праг 80%+ = совладано. Доказано +2σ ефект (Bloom 2-sigma problem). 60% базично + 30% примена + 10% трансфер.',
    source: "Bloom, 1968 — 'Learning for Mastery'",
  },
  {
    id: 'cbe',
    label: 'CBE / МОН',
    icon: GraduationCap,
    color: 'text-amber-600',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    theory: 'Секоја задача демонстрира конкретна компетенција од МОН рамката. Оценување по компетенции, не само по бодови.',
    source: 'EU Key Competences 2018 + МОН Наставна програма',
  },
];

const BLOOM_LEVELS: DifferentiatedLevel[] = [
  { level: 1, bloomLabel: 'Паметење / Разбирање', pointsPerTask: 4, taskCount: 5 },
  { level: 2, bloomLabel: 'Примена', pointsPerTask: 6, taskCount: 5 },
  { level: 3, bloomLabel: 'Анализа / Синтеза', pointsPerTask: 10, taskCount: 5 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const TestGeneratorView: React.FC = () => {
  const { curriculum } = useCurriculum();
  const { addNotification } = useNotification();
  const { firebaseUser } = useAuth();

  // Params
  const [selectedGradeId, setSelectedGradeId] = useState('grade-6');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [assessmentModel, setAssessmentModel] = useState<AssessmentModel>('differentiated');
  const [levels, setLevels] = useState<DifferentiatedLevel[]>(BLOOM_LEVELS.map(l => ({ ...l })));
  const [qCount, setQCount] = useState(8);
  const [masteryThreshold, setMasteryThreshold] = useState(80);
  const [showAnswers, setShowAnswers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Flow
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<ProGeneratedTest | GeneratedTest | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const printNoAnswersRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `Test_${selectedTopics.join('_')}` });
  const handlePrintNoAnswers = useReactToPrint({ contentRef: printNoAnswersRef, documentTitle: `Test_ucenik` });

  const selectedGradeObj = curriculum?.grades.find(g => g.id === selectedGradeId);
  const topicsForGrade = selectedGradeObj?.topics || [];
  const gradeNum = selectedGradeObj?.level || 6;

  const toggleTopic = (title: string) =>
    setSelectedTopics(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);

  const updateLevel = (idx: number, field: keyof DifferentiatedLevel, value: number) =>
    setLevels(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const totalPoints = assessmentModel === 'differentiated'
    ? levels.reduce((s, l) => s + l.pointsPerTask * l.taskCount, 0)
    : null;

  const canGenerate = selectedTopics.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGeneratedTest(null);
    setSaved(false);
    try {
      let result: ProGeneratedTest | GeneratedTest;
      if (assessmentModel === 'differentiated') {
        result = await geminiService.generateDifferentiatedTest(selectedTopics, gradeNum, levels);
      } else if (assessmentModel === 'mastery') {
        result = await geminiService.generateMasteryTest(selectedTopics, gradeNum, qCount, masteryThreshold);
      } else {
        // standard / cbe — use existing parallel test with first topic
        const topic = selectedTopics.join(', ');
        result = await geminiService.generateParallelTest(topic, gradeNum, qCount, 'medium');
      }
      setGeneratedTest(result);
    } catch (e) {
      logger.error('TestGeneratorView: generation failed', e);
      addNotification('Настана грешка при генерирањето.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedTest || !firebaseUser) return;
    setSaving(true);
    try {
      const { db } = await import('../firebaseConfig');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'saved_tests'), {
        ...generatedTest,
        teacherUid: firebaseUser.uid,
        savedAt: serverTimestamp(),
      });
      setSaved(true);
      addNotification('Тестот е зачуван во библиотеката! ✅', 'success');
    } catch {
      addNotification('Грешка при зачувување.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeModelMeta = MODELS.find(m => m.id === assessmentModel)!;

  return (
    <div className="p-6 max-w-7xl mx-auto pb-32 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-2xl text-brand-primary">
            <Sparkles className="w-7 h-7" />
          </div>
          АИ Креатор на писмени работи
        </h1>
        <p className="text-gray-500 mt-1 ml-14">Креирајте професионални сумативни тестови за неколку секунди</p>
      </div>

      {/* Main Config Card */}
      <Card className="p-6 space-y-6 border-gray-100 shadow-sm">

        {/* Row 1: Assessment model + Grade */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Assessment model selector */}
          <div className="flex-1">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Вид на писмена</p>
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => {
                const Icon = m.icon;
                const active = assessmentModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAssessmentModel(m.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 font-bold text-sm transition-all ${
                      active
                        ? `${m.bg} ${m.border} ${m.color} shadow-sm`
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {m.label}
                  </button>
                );
              })}
            </div>

            {/* Pedagogical info strip */}
            <div className={`mt-3 flex gap-3 items-start p-3 rounded-xl ${activeModelMeta.bg} border ${activeModelMeta.border}`}>
              <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeModelMeta.color}`} />
              <div>
                <p className={`text-xs font-bold ${activeModelMeta.color}`}>{activeModelMeta.theory}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 italic">Извор: {activeModelMeta.source}</p>
              </div>
            </div>
          </div>

          {/* Grade selector */}
          <div className="w-full lg:w-48">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Одделение</p>
            <div className="flex flex-wrap gap-2">
              {curriculum?.grades.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setSelectedGradeId(g.id); setSelectedTopics([]); }}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                    selectedGradeId === g.id
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-brand-primary/40'
                  }`}
                >
                  {g.level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Topic chips */}
        <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
            Избери теми <span className="normal-case font-normal">(може повеќе)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {topicsForGrade.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Изберете одделение за да се прикажат темите</p>
            ) : (
              topicsForGrade.map(t => {
                const active = selectedTopics.includes(t.title);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.title)}
                    className={`px-4 py-2 rounded-2xl border-2 text-sm font-bold transition-all ${
                      active
                        ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-brand-primary/40 hover:bg-brand-primary/5'
                    }`}
                  >
                    {active && <span className="mr-1">✓</span>}{t.title.toUpperCase()}
                  </button>
                );
              })
            )}
          </div>
          {selectedTopics.length > 0 && (
            <p className="text-xs text-brand-primary font-bold mt-2">
              {selectedTopics.length} {selectedTopics.length === 1 ? 'тема избрана' : 'теми избрани'}
            </p>
          )}
        </div>

        {/* Row 3: Model-specific params */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-end">

            {/* Differentiated: level sliders */}
            {assessmentModel === 'differentiated' && (
              <div className="flex-1 space-y-4">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Број на задачи по нивоа
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {levels.map((lvl, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${
                          i === 0 ? 'text-green-600' : i === 1 ? 'text-amber-600' : 'text-purple-600'
                        }`}>
                          Ниво {lvl.level} ({lvl.pointsPerTask}п)
                        </span>
                        <span className="text-sm font-black text-gray-800">{lvl.taskCount} задачи</span>
                      </div>
                      <input
                        type="range" min={1} max={10} value={lvl.taskCount}
                        title={`Ниво ${lvl.level}: број на задачи`}
                        onChange={e => updateLevel(i, 'taskCount', Number(e.target.value))}
                        className={`w-full h-2 rounded-full appearance-none cursor-pointer ${
                          i === 0 ? 'accent-green-500' : i === 1 ? 'accent-amber-500' : 'accent-purple-600'
                        }`}
                      />
                      <p className="text-[10px] text-gray-400">{lvl.bloomLabel}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <BarChart3 className="w-4 h-4 text-brand-primary" />
                  <span>Вкупно: <strong className="text-gray-800">{totalPoints} поени</strong></span>
                </div>
              </div>
            )}

            {/* Mastery: question count + threshold */}
            {assessmentModel === 'mastery' && (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                    Број прашања (по група)
                  </label>
                  <input
                    type="range" min={4} max={16} value={qCount}
                    title="Број на прашања по група"
                    onChange={e => setQCount(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                  <p className="text-sm font-bold text-gray-700 mt-1">{qCount} прашања × 2 групи</p>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                    Праг на мастери
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[70, 75, 80, 85, 90].map(t => (
                      <button key={t} type="button"
                        onClick={() => setMasteryThreshold(t)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${
                          masteryThreshold === t
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-green-300'
                        }`}
                      >
                        {t}%
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 italic">Препорака: 80% (Bloom, 1968)</p>
                </div>
              </div>
            )}

            {/* Standard / CBE: simple count */}
            {(assessmentModel === 'standard' || assessmentModel === 'cbe') && (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                    Број прашања (по група)
                  </label>
                  <input
                    type="range" min={3} max={15} value={qCount}
                    title="Број на прашања по група"
                    onChange={e => setQCount(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-sm font-bold text-gray-700 mt-1">{qCount} прашања × 2 групи = {qCount * 2} вкупно</p>
                </div>
                {assessmentModel === 'cbe' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Секое прашање е врзано за МОН компетенција
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">AI автоматски ги мапира темите кон стандардите</p>
                  </div>
                )}
              </div>
            )}

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-2xl font-black text-base shadow-xl hover:shadow-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 xl:self-end whitespace-nowrap"
            >
              {isGenerating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Генерирам…</>
                : <><Sparkles className="w-5 h-5" /> Генерирај писмена</>}
            </button>
          </div>
        </div>
      </Card>

      {/* AI note */}
      <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
        <Cpu className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-indigo-700">
          <strong>Gemini 2.5 Pro</strong> — најмоќниот модел. Диференцираните и Мастери тестовите автоматски генерираат рубрика за оценување.
        </p>
      </div>

      {/* Generating animation */}
      {isGenerating && (
        <Card className="min-h-[200px] flex flex-col items-center justify-center gap-4 border-brand-primary/20 bg-brand-primary/5">
          <div className="p-4 bg-brand-primary/10 rounded-full">
            <Brain className="w-10 h-10 text-brand-primary animate-pulse" />
          </div>
          <h3 className="text-lg font-black text-brand-primary">Генерирам {activeModelMeta.label} тест…</h3>
          <p className="text-sm text-gray-500">Gemini 2.5 Pro анализира педагошки принципи и креира задачи</p>
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-bounce" />
            <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-bounce delay-150" />
            <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-bounce delay-300" />
          </div>
        </Card>
      )}

      {/* Result */}
      {generatedTest && !isGenerating && (
        <div className="space-y-4">
          {/* Result header */}
          <Card className="bg-green-50 border-green-200 p-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-black text-green-800">{generatedTest.title}</h3>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-green-600 font-bold">{generatedTest.groups.length} групи</span>
                    <span className="text-xs text-green-500">•</span>
                    <span className="text-xs text-green-600 font-bold">{generatedTest.groups[0]?.questions.length ?? 0} прашања/група</span>
                    {'model' in generatedTest && (
                      <>
                        <span className="text-xs text-green-500">•</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeModelMeta.bg} ${activeModelMeta.color}`}>
                          {activeModelMeta.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setShowAnswers(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-300 bg-white text-sm font-bold text-green-700 hover:bg-green-50 transition-colors">
                  {showAnswers ? <><EyeOff className="w-4 h-4" /> Скриј</>  : <><Eye className="w-4 h-4" /> Одговори</>}
                </button>
                <button type="button" onClick={() => handlePrint()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-300 bg-white text-sm font-bold text-green-700 hover:bg-green-50 transition-colors">
                  <FileDown className="w-4 h-4" /> PDF (со одг.)
                </button>
                <button type="button" onClick={() => handlePrintNoAnswers()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-300 bg-white text-sm font-bold text-green-700 hover:bg-green-50 transition-colors">
                  <FileDown className="w-4 h-4" /> PDF (ученик)
                </button>
                <button type="button" onClick={handleSave} disabled={saving || saved}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${
                    saved
                      ? 'bg-green-500 text-white cursor-default'
                      : 'bg-brand-primary text-white hover:bg-brand-secondary'
                  } disabled:opacity-60`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? 'Зачуван' : 'Зачувај'}
                </button>
              </div>
            </div>
          </Card>

          {/* Rubric */}
          {'rubric' in generatedTest && generatedTest.rubric && (
            <Card className="bg-indigo-50 border-indigo-200 p-4">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Рубрика за оценување (AI генерирана)</p>
                  <p className="text-sm text-indigo-800">{generatedTest.rubric}</p>
                  {'masteryThreshold' in generatedTest && generatedTest.masteryThreshold && (
                    <p className="text-xs text-indigo-500 mt-1 font-bold">
                      Праг на мастери: {generatedTest.masteryThreshold}% → Совладано / {generatedTest.masteryThreshold - 1}% и помалку → Во напредок
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Groups */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {generatedTest.groups.map((group, gi) => (
              <Card key={gi} className="p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white ${gi === 0 ? 'bg-blue-500' : 'bg-purple-500'}`}>
                    {group.groupName.replace('Група ', '')}
                  </div>
                  <h4 className="font-black text-gray-800">{group.groupName}</h4>
                  <span className="ml-auto text-xs text-gray-400 font-bold">{group.questions.length} прашања</span>
                </div>
                <div className="space-y-3">
                  {group.questions.map((q, qi) => (
                    <div key={qi} className="flex gap-3 items-start">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white ${gi === 0 ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {qi + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 text-sm text-gray-800">
                            <MathRenderer text={q.text} />
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black ${gi === 0 ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {q.points}п
                          </span>
                        </div>
                        {q.cognitiveLevel && (
                          <span className="text-[10px] text-gray-400 font-bold">{q.cognitiveLevel}</span>
                        )}
                        {q.type === 'multiple-choice' && q.options && (
                          <ul className="mt-1.5 space-y-1">
                            {q.options.map((opt, oi) => (
                              <li key={oi} className={`text-xs px-2 py-1 rounded-lg ${showAnswers && opt === q.correctAnswer ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-600'}`}>
                                {String.fromCharCode(65 + oi)}. <MathRenderer text={opt} />
                              </li>
                            ))}
                          </ul>
                        )}
                        {showAnswers && q.type !== 'multiple-choice' && (
                          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1.5">
                            <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <MathRenderer text={q.correctAnswer} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Print targets (hidden) */}
      <div className="hidden">
        <div ref={printRef}>
          {generatedTest && <PrintableTest test={generatedTest as GeneratedTest} showKeys={true} />}
        </div>
        <div ref={printNoAnswersRef}>
          {generatedTest && <PrintableTest test={generatedTest as GeneratedTest} showKeys={false} />}
        </div>
      </div>
    </div>
  );
};
