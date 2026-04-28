import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { geminiService } from '../services/geminiService';
import { examService } from '../services/firestoreService.exam';
import type { ExamVariantKey, ExamQuestion } from '../services/firestoreService.types';
import type { AIGeneratedAssessment, GenerationContext, Concept } from '../types';
import { Loader2, Wand2, Save, Play, ChevronDown, ChevronUp, Eye, Printer } from 'lucide-react';

const VARIANT_LABELS: ExamVariantKey[] = ['A', 'B', 'V', 'G'];
const VARIANT_COLORS: Record<ExamVariantKey, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-300',
  B: 'bg-green-100 text-green-800 border-green-300',
  V: 'bg-amber-100 text-amber-800 border-amber-300',
  G: 'bg-purple-100 text-purple-800 border-purple-300',
};

function aiQuestionsToExam(questions: AIGeneratedAssessment['questions']): ExamQuestion[] {
  return questions.map((q, i) => ({
    id: `q${i}`,
    type: q.type === 'multiple-choice' || q.type === 'multiple_choice'
      ? 'multiple_choice'
      : q.type === 'essay'
      ? 'essay'
      : q.type === 'calculation'
      ? 'calculation'
      : 'short_answer',
    question: q.question ?? '',
    options: (q as any).options as string[] | undefined,
    answer: q.answer ?? '',
    solution: q.solution,
    points: 5,
    svgDiagram: q.svgDiagram,
  }));
}

export const ExamBuilderView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();
  const { curriculum, isLoading: curriculumLoading } = useCurriculum();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Математика');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [durationMin, setDurationMin] = useState(45);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Record<ExamVariantKey, ExamQuestion[]> | null>(null);
  const [activeTab, setActiveTab] = useState<ExamVariantKey>('A');
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  // Default to grade 8 when curriculum loads
  useEffect(() => {
    if (curriculum && !selectedGradeId) {
      const grade8 = curriculum.grades.find(g => g.level === 8 && !g.secondaryTrack);
      if (grade8) setSelectedGradeId(grade8.id);
    }
  }, [curriculum, selectedGradeId]);

  const selectedGrade = useMemo(
    () => curriculum?.grades.find(g => g.id === selectedGradeId),
    [curriculum, selectedGradeId],
  );
  const availableTopics = selectedGrade?.topics ?? [];
  const selectedTopic = useMemo(
    () => availableTopics.find(t => t.id === selectedTopicId),
    [availableTopics, selectedTopicId],
  );
  const availableConcepts: Concept[] = selectedTopic?.concepts ?? [];

  const handleGradeChange = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    setSelectedTopicId('');
    setSelectedConceptIds([]);
    setVariants(null);
    setSavedSessionId(null);
  };

  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedConceptIds([]);
    setVariants(null);
    setSavedSessionId(null);
  };

  const toggleConcept = (id: string) => {
    setSelectedConceptIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  };

  const handleGenerate = async () => {
    if (!title.trim()) { addNotification('Внесете наслов на испитот.', 'error'); return; }
    if (!selectedGrade)  { addNotification('Изберете одделение.', 'error'); return; }
    if (!selectedTopic)  { addNotification('Изберете тема.', 'error'); return; }

    setGenerating(true);
    setVariants(null);
    try {
      const conceptsToUse = selectedConceptIds.length > 0
        ? availableConcepts.filter(c => selectedConceptIds.includes(c.id))
        : availableConcepts;

      const context: GenerationContext = {
        type: 'CONCEPT',
        grade: selectedGrade,
        topic: selectedTopic,
        concepts: conceptsToUse,
      };

      const result = await (geminiService as any).generateExamVariants(numQuestions, context, user ?? undefined);
      const mapped: Record<ExamVariantKey, ExamQuestion[]> = {
        A: aiQuestionsToExam(result.A.questions),
        B: aiQuestionsToExam(result.B.questions),
        V: aiQuestionsToExam(result.V.questions),
        G: aiQuestionsToExam(result.G.questions),
      };
      setVariants(mapped);
      addNotification('4 варијанти генерирани!', 'success');
    } catch {
      addNotification('Грешка при генерирање. Обидете се повторно.', 'error');
    }
    setGenerating(false);
  };

  const handleSave = async (startNow = false) => {
    if (!variants || !selectedGrade) return;
    if (!firebaseUser) { addNotification('Најавете се за да зачувате.', 'error'); return; }
    setSaving(true);
    try {
      const totalPoints = variants.A.reduce((s, q) => s + q.points, 0);
      const id = await examService.createExamSession(firebaseUser.uid, {
        title: title.trim(),
        subject,
        gradeLevel: selectedGrade.level,
        variants,
        duration: durationMin * 60,
        totalPoints,
      });
      setSavedSessionId(id);
      if (startNow) {
        await examService.updateExamStatus(id, 'waiting');
        navigate(`/exam/presenter/${id}`);
      } else {
        addNotification('Испитот е зачуван! Може да го печатите или отворите за учениците.', 'success');
      }
    } catch {
      addNotification('Грешка при зачувување.', 'error');
    }
    setSaving(false);
  };

  const canGenerate = !!selectedGrade && !!selectedTopic && !!title.trim() && !generating;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <span className="text-2xl">🏛️</span> Нов дигитален испит
        </h1>
        <p className="text-gray-500 text-sm mb-6">4 варијанти А/Б/В/Г — автоматски генерирани со AI</p>

        {/* Settings form */}
        <div className="bg-white rounded-(--radius-card) border border-gray-200 p-(--spacing-card) mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Наслов на испитот</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="пр. Завршен испит — Алгебра"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>

            <div>
              <label htmlFor="eb-subject" className="block text-sm font-medium text-gray-700 mb-1">Предмет</label>
              <input
                id="eb-subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                title="Предмет"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>

            <div>
              <label htmlFor="eb-grade" className="block text-sm font-medium text-gray-700 mb-1">Одделение</label>
              <select
                id="eb-grade"
                value={selectedGradeId}
                onChange={e => handleGradeChange(e.target.value)}
                disabled={curriculumLoading}
                title="Одделение"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white disabled:opacity-60"
              >
                {curriculumLoading
                  ? <option value="">Вчитување...</option>
                  : <>
                      {!selectedGradeId && <option value="">— Избери одделение —</option>}
                      {curriculum?.grades.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </>
                }
              </select>
            </div>

            <div>
              <label htmlFor="eb-topic" className="block text-sm font-medium text-gray-700 mb-1">Тема</label>
              <select
                id="eb-topic"
                value={selectedTopicId}
                onChange={e => handleTopicChange(e.target.value)}
                disabled={!selectedGradeId || availableTopics.length === 0}
                title="Тема"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white disabled:opacity-60"
              >
                <option value="">— Избери тема —</option>
                {availableTopics.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="eb-num-q" className="block text-sm font-medium text-gray-700 mb-1">Број прашања по варијанта</label>
              <input
                id="eb-num-q"
                type="number"
                min={3}
                max={20}
                value={numQuestions}
                onChange={e => setNumQuestions(Number(e.target.value))}
                title="Број прашања по варијанта"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>

            <div>
              <label htmlFor="eb-duration" className="block text-sm font-medium text-gray-700 mb-1">Траење (минути)</label>
              <select
                id="eb-duration"
                value={durationMin}
                onChange={e => setDurationMin(Number(e.target.value))}
                title="Траење во минути"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white"
              >
                {[20, 30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m}>{m} мин</option>
                ))}
              </select>
            </div>
          </div>

          {/* Concept chips — shown once topic is selected */}
          {selectedTopic && availableConcepts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Специфични поими
                <span className="ml-1.5 text-gray-400 font-normal">(опционално — ако нема избор, се покрива целата тема)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableConcepts.map(c => {
                  const active = selectedConceptIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleConcept(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {active && <span className="mr-1">✓</span>}{c.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Curriculum context summary — shown when topic chosen */}
          {selectedTopic && (
            <div className="mt-3 flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 rounded-xl px-3 py-2">
              <span className="font-semibold">Контекст:</span>
              <span>{selectedGrade?.title} · {selectedTopic.title}</span>
              {selectedConceptIds.length > 0 && (
                <span className="text-indigo-500">· {selectedConceptIds.length} поими избрани</span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? 'Генерирам 4 варијанти…' : 'AI Генерирај 4 варијанти (А/Б/В/Г)'}
          </button>
        </div>

        {/* Variant preview */}
        {variants && (
          <div className="bg-white rounded-(--radius-card) border border-gray-200 shadow-sm mb-6 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {VARIANT_LABELS.map(vk => (
                <button
                  key={vk}
                  type="button"
                  onClick={() => { setActiveTab(vk); setExpandedQ(null); }}
                  className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${
                    activeTab === vk
                      ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Варијанта {vk}
                </button>
              ))}
            </div>

            {/* Questions list */}
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {variants[activeTab].map((q, i) => (
                <div key={q.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${VARIANT_COLORS[activeTab]}`}>
                        {activeTab}{i + 1}
                      </span>
                      <span className="text-gray-800 truncate max-w-[10rem] sm:max-w-xs">{q.question}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{q.points} бод.</span>
                      {expandedQ === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedQ === i && (
                    <div className="px-4 pb-3 bg-gray-50 text-xs text-gray-600 space-y-1.5">
                      <p className="font-medium text-gray-700">{q.question}</p>
                      {q.options && (
                        <ul className="list-disc ml-4 space-y-0.5">
                          {q.options.map((opt, oi) => (
                            <li key={oi} className={opt === q.answer ? 'text-green-700 font-semibold' : ''}>
                              {['А', 'Б', 'В', 'Г'][oi]}. {opt}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-green-700"><strong>Точен:</strong> {q.answer}</p>
                      {q.solution && <p className="text-gray-500 italic">{q.solution}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>
                <Eye className="w-4 h-4 inline mr-1" />
                {variants[activeTab].length} прашања · {variants[activeTab].reduce((s, q) => s + q.points, 0)} бодови · {durationMin} мин
              </span>
            </div>
          </div>
        )}

        {/* Save / start actions */}
        {variants && (
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 hover:border-indigo-400 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зачувај нацрт
            </button>
            {savedSessionId && (
              <button
                type="button"
                onClick={() => navigate(`/exam/print/${savedSessionId}`)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 hover:border-purple-400 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Печати испит
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Зачувај и отвори за учениците
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
