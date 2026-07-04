import React, { useState, useCallback } from 'react';
import {
  ClipboardList, Sparkles, Eye, EyeOff, Copy, Share2, Loader2, Check,
  Save, Zap, GitFork,
} from 'lucide-react';
import { MathRenderer } from '../components/common/MathRenderer';
import { createDuggaTest, updateDuggaTest, getDuggaTest } from '../services/firestoreService.dugga';
import type {
  DuggaQuestion, DuggaQuestionType, DuggaTestType,
} from '../services/firestoreService.dugga';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import {
  Q_TYPES, TEST_TYPES, DOK_COLORS, newQId, makeBlankQuestion, QuestionEditor, AIGenerateModal,
} from '../components/dugga/DuggaQuestionEditor';

// (Q_TYPES/TEST_TYPES/DOK_COLORS/newQId/newOptId/makeBlankQuestion/QuestionEditor/AIGenerateModal
//  extracted to components/dugga/DuggaQuestionEditor.tsx)

// ─── Main view ────────────────────────────────────────────────────────────────
// S61-D2 — Read seed params from the URL hash query (e.g.
// `#/dugga/build?conceptId=...&conceptLabel=...&grade=8&topic=...`).
// edit=<id>  → load existing test for in-place editing (owner only)
// adapt=<id> → clone an existing test as a new one, tracking provenance
function readBuilderSeed(): {
  conceptId?: string;
  conceptLabel?: string;
  grade?: number;
  topic?: string;
  editId?: string;
  adaptId?: string;
} {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx < 0) return {};
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  const gradeRaw = params.get('grade');
  const grade = gradeRaw && /^\d+$/.test(gradeRaw) ? Number(gradeRaw) : undefined;
  return {
    conceptId: params.get('conceptId') ?? undefined,
    conceptLabel: params.get('conceptLabel') ?? undefined,
    grade,
    topic: params.get('topic') ?? undefined,
    editId: params.get('edit') ?? undefined,
    adaptId: params.get('adapt') ?? undefined,
  };
}

export function DuggaBuilderView() {
  const { user, firebaseUser } = useAuth();
  const { addNotification } = useNotification();

  const seed = readBuilderSeed();

  const [loadingInit, setLoadingInit] = useState(!!(seed.editId || seed.adaptId));
  const [title, setTitle] = useState(
    seed.conceptLabel ? `Дига тест: ${seed.conceptLabel}` : '',
  );
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState(seed.grade ?? 8);
  const [testType, setTestType] = useState<DuggaTestType>('topic');
  const [questions, setQuestions] = useState<DuggaQuestion[]>(() => {
    const blank = makeBlankQuestion();
    if (seed.conceptId) blank.linkedConceptIds = [seed.conceptId];
    return [blank];
  });
  const [isPublic, setIsPublic] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState('');
  const [savedCode, setSavedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [adaptProvenance, setAdaptProvenance] = useState<{
    fromId: string; fromTitle: string; authorName: string; authorUid: string;
  } | null>(null);

  // Load existing test when ?edit=<id> or ?adapt=<id> is in the URL
  React.useEffect(() => {
    const targetId = seed.editId || seed.adaptId;
    if (!targetId) return;
    getDuggaTest(targetId).then(existing => {
      if (!existing) { setLoadingInit(false); return; }
      setTitle(seed.editId ? existing.title : `Адаптирано: ${existing.title}`);
      setDescription(existing.description ?? '');
      setGrade(existing.grade);
      setTestType(existing.testType);
      setIsPublic(seed.editId ? existing.isPublic : false);
      setQuestions(existing.questions.map(q => ({
        ...q,
        id: seed.editId ? q.id : newQId(),
      })));
      if (seed.editId) {
        setSavedId(seed.editId);
        setSavedCode(existing.shareCode);
      } else {
        setAdaptProvenance({
          fromId: targetId,
          fromTitle: existing.title,
          authorName: existing.teacherName,
          authorUid: existing.teacherUid,
        });
      }
      setLoadingInit(false);
    }).catch(() => setLoadingInit(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const estimatedMinutes = Math.max(5, Math.round(totalPoints * 1.5));

  const updateQuestion = useCallback((idx: number, updated: DuggaQuestion) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? updated : q));
  }, []);

  const deleteQuestion = useCallback((idx: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  }, []);

  const moveQuestion = useCallback((idx: number, dir: 'up' | 'down') => {
    setQuestions(qs => {
      const arr = [...qs];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }, []);

  const addQuestion = (type: DuggaQuestionType) => {
    setQuestions(qs => [...qs, makeBlankQuestion(type)]);
  };

  const handleAIGenerated = (newQs: DuggaQuestion[]) => {
    setQuestions(qs => [...qs.filter(q => q.text.trim() !== ''), ...newQs]);
    addNotification(`${newQs.length} прашања генерирани!`, 'success');
  };

  const handleSave = async () => {
    if (!title.trim()) { addNotification('Внеси наслов на тестот.', 'error'); return; }
    if (!firebaseUser?.uid) { addNotification('Мора да си најавен.', 'error'); return; }
    setSaving(true);
    try {
      const testData = {
        title: title.trim(),
        description: description.trim(),
        teacherUid: firebaseUser.uid,
        teacherName: user?.name ?? 'Наставник',
        grade, track: user?.secondaryTrack ?? 'primary',
        topics: [], testType, questions,
        isPublic, totalPoints,
        estimatedMinutes,
        ...(adaptProvenance ? {
          adaptedFromId: adaptProvenance.fromId,
          adaptedFromTitle: adaptProvenance.fromTitle,
          originalAuthorName: adaptProvenance.authorName,
          originalAuthorUid: adaptProvenance.authorUid,
        } : {}),
        ...(savedId ? {
          lastEditedByUid: firebaseUser.uid,
          lastEditedByName: user?.name ?? 'Наставник',
        } : {}),
      };
      if (savedId) {
        await updateDuggaTest(savedId, testData);
        addNotification('Тестот е зачуван!', 'success');
      } else {
        const id = await createDuggaTest(testData);
        setSavedId(id);
        const saved = await getDuggaTest(id);
        if (saved) setSavedCode(saved.shareCode);
        addNotification('Тестот е зачуван!', 'success');
      }
    } catch {
      addNotification('Грешка при зачувување.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(savedCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-violet-500 mx-auto" />
          <p className="text-sm text-gray-500">{seed.editId ? 'Вчитување на тестот за уредување...' : 'Вчитување на тестот за адаптација...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Дига — Градител на тестови</h1>
            <p className="text-xs text-gray-400">{questions.length} прашања · {totalPoints} поени · ~{estimatedMinutes} мин</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowPreview(p => !p)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Уреди' : 'Преглед'}
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зачувај
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Provenance banner (adapt mode) */}
        {adaptProvenance && !savedId && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <GitFork className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Адаптација на туѓ тест</p>
              <p className="text-xs text-amber-600 truncate">
                Оригинал: <span className="font-medium">„{adaptProvenance.fromTitle}"</span>
                {' '}од <span className="font-medium">{adaptProvenance.authorName}</span>
              </p>
            </div>
            <span className="text-xs text-amber-500">Ова ќе се зачува како твој нов тест</span>
          </div>
        )}

        {/* Share code banner */}
        {savedCode && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-4">
            <Share2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Тестот е зачуван! Код за ученици:</p>
              <p className="text-2xl font-black text-emerald-700 tracking-widest mt-0.5">{savedCode}</p>
            </div>
            <button type="button" onClick={copyCode} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors">
              {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {codeCopied ? 'Копирано' : 'Копирај'}
            </button>
          </div>
        )}

        {/* Test metadata */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Наслов на тестот</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="пр. Тест — Квадратни равенки — 8 одд."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Разред</label>
              <select value={grade} onChange={e => setGrade(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}. разред</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Тип</label>
              <select value={testType} onChange={e => setTestType(e.target.value as DuggaTestType)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                {TEST_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Опис (изборно)</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Краток опис за учениците..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsPublic(p => !p)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-violet-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-600">Јавен тест (во библиотека)</span>
          </div>
        </div>

        {/* AI generate bar */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-4 flex items-center gap-4">
          <Zap className="w-6 h-6 text-white flex-shrink-0" />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">AI генерирање</p>
            <p className="text-violet-200 text-xs">Gemini генерира прашања по разред, тема и DoK распределба</p>
          </div>
          <button type="button" onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-violet-700 text-sm font-bold rounded-xl hover:bg-violet-50 transition-colors flex-shrink-0">
            <Sparkles className="w-4 h-4" /> Генерирај
          </button>
        </div>

        {/* Preview mode */}
        {showPreview ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold text-gray-900">{title || '(без наслов)'}</h2>
              {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <span>{grade}. разред</span>
                <span>·</span>
                <span>{questions.length} прашања</span>
                <span>·</span>
                <span>{totalPoints} поени</span>
                <span>·</span>
                <span>~{estimatedMinutes} мин</span>
              </div>
            </div>
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-gray-600 min-w-[28px]">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">
                      {q.type === 'section_header'
                        ? <span className="text-lg font-bold text-violet-700">{q.text}</span>
                        : <MathRenderer text={q.text || '(без текст)'} />
                      }
                    </div>
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((o, oi) => (
                          <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 text-sm">
                            <span className="font-semibold text-gray-400">{String.fromCharCode(65 + oi)})</span>
                            <MathRenderer text={o.text} />
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'true_false' && (
                      <div className="mt-2 flex gap-3">
                        <span className="px-3 py-1 rounded-lg border border-gray-200 text-sm">☐ Точно</span>
                        <span className="px-3 py-1 rounded-lg border border-gray-200 text-sm">☐ Неточно</span>
                      </div>
                    )}
                    {(q.type === 'short_answer' || q.type === 'fill_blanks') && (
                      <div className="mt-2 h-9 border-b-2 border-dashed border-gray-300 w-64" />
                    )}
                    {q.type === 'essay' && (
                      <div className="mt-2 h-24 border border-dashed border-gray-300 rounded-xl" />
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DOK_COLORS[q.dok]}`}>DoK{q.dok}</span>
                    <p className="text-xs text-gray-400 mt-1">{q.points}п</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Edit mode */
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionEditor
                key={q.id} q={q} idx={idx}
                onChange={updated => updateQuestion(idx, updated)}
                onDelete={() => deleteQuestion(idx)}
                onMoveUp={() => moveQuestion(idx, 'up')}
                onMoveDown={() => moveQuestion(idx, 'down')}
                isFirst={idx === 0} isLast={idx === questions.length - 1}
              />
            ))}

            {/* Add question */}
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 mb-3 text-center">Додај прашање</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Q_TYPES.map(t => (
                  <button type="button" key={t.id} onClick={() => addQuestion(t.id)}
                    title={t.desc}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors">
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAIModal && (
        <AIGenerateModal onClose={() => setShowAIModal(false)} onGenerated={handleAIGenerated} />
      )}
    </div>
  );
}

