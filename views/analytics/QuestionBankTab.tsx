import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Search, BookOpen, CheckSquare, Square, PlusSquare, ShieldCheck, Shield } from 'lucide-react';
import { firestoreService } from '../../services/firestoreService';
import type { SavedQuestion } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../firebaseConfig';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface QuestionBankTabProps {
  teacherUid: string;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'Повеќе избори',
  SHORT_ANSWER: 'Краток одговор',
  TRUE_FALSE: 'Точно/Неточно',
  ESSAY: 'Есеј',
  FILL_IN_THE_BLANK: 'Пополни',
};

export const QuestionBankTab: React.FC<QuestionBankTabProps> = ({ teacherUid }) => {
  const { addNotification } = useNotification();
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);

  useEffect(() => {
    if (!teacherUid) return;
    setLoading(true);
    firestoreService.fetchSavedQuestions(teacherUid)
      .then(qs => setQuestions(qs))
      .finally(() => setLoading(false));
  }, [teacherUid]);

  const allTypes = useMemo(() => {
    const types = new Set(questions.map(q => q.type));
    return Array.from(types).sort();
  }, [questions]);

  const allGrades = useMemo(() => {
    const grades = new Set(questions.map(q => q.gradeLevel).filter(Boolean));
    return Array.from(grades as Set<number>).sort((a, b) => a - b);
  }, [questions]);

  const verifiedCount = useMemo(() => questions.filter(q => q.isVerified).length, [questions]);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (searchText && !q.question.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (filterType && q.type !== filterType) return false;
      if (filterGrade && String(q.gradeLevel) !== filterGrade) return false;
      if (onlyVerified && !q.isVerified) return false;
      return true;
    });
  }, [questions, searchText, filterType, filterGrade, onlyVerified]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(q => q.id)));
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleVerify = async (questionId: string, current: boolean) => {
    try {
      await firestoreService.verifyQuestion(questionId, !current);
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, isVerified: !current } : q));
    } catch {
      addNotification('Грешка при верификација.', 'error');
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Да се избрише ова прашање?')) return;
    try {
      await firestoreService.deleteQuestion(questionId);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      setSelected(prev => { const n = new Set(prev); n.delete(questionId); return n; });
      addNotification('Прашањето е избришано.', 'success');
    } catch {
      addNotification('Грешка при бришење.', 'error');
    }
  };

  const handleCreateQuiz = async () => {
    if (selected.size === 0) {
      addNotification('Означи барем едно прашање.', 'error');
      return;
    }
    const selectedQs = questions.filter(q => selected.has(q.id));
    const gradeLevel = selectedQs[0]?.gradeLevel;

    setCreatingQuiz(true);
    try {
      const ref = await addDoc(collection(db, 'cached_ai_materials'), {
        type: 'quiz',
        teacherUid,
        gradeLevel: gradeLevel ?? null,
        content: {
          title: 'Мој квиз од банката',
          type: 'QUIZ',
          questions: selectedQs.map(q => ({
            type: q.type,
            question: q.question,
            options: q.options ?? [],
            answer: q.answer,
            solution: q.solution ?? '',
            cognitiveLevel: q.cognitiveLevel ?? 'Remembering',
            difficulty_level: q.difficulty_level ?? 'Medium',
          })),
        },
        createdAt: serverTimestamp(),
        expiresAt: null,
      });
      const quizUrl = `${window.location.origin}/#/student/${ref.id}`;
      addNotification(`Квизот е создаден! Линк: ${quizUrl}`, 'success');
      setSelected(new Set());
    } catch (err) {
      console.error('Error creating quiz from bank:', err);
      addNotification('Грешка при создавање квиз.', 'error');
    } finally {
      setCreatingQuiz(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Банка на прашања
          <span className="text-sm font-normal text-gray-500 ml-1">({questions.length} прашања)</span>
          {verifiedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />{verifiedCount} верификувани
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handleCreateQuiz}
          disabled={selected.size === 0 || creatingQuiz}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          <PlusSquare className="w-4 h-4" />
          {creatingQuiz ? 'Создавам...' : `Создај квиз (${selected.size} избрани)`}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пребарај прашања..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Сите типови</option>
          {allTypes.map(t => (
            <option key={t} value={t}>{QUESTION_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          value={filterGrade}
          onChange={e => setFilterGrade(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Сите одделенија</option>
          {allGrades.map(g => (
            <option key={g} value={String(g)}>{g}. одделение</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyVerified(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${onlyVerified ? 'bg-green-100 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-green-50'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          Само верификувани
        </button>
      </div>

      {/* Select all + count */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button type="button" onClick={toggleAll} className="flex items-center gap-1 hover:text-indigo-600 transition">
            {selected.size === filtered.length
              ? <CheckSquare className="w-4 h-4 text-indigo-600" />
              : <Square className="w-4 h-4" />}
            {selected.size === filtered.length ? 'Откажи ги сите' : 'Избери ги сите'}
          </button>
          {selected.size > 0 && (
            <span className="ml-2 text-indigo-600 font-semibold">{selected.size} означени</span>
          )}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Вчитувам...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {questions.length === 0
            ? 'Нема зачувани прашања. Генерирај квиз или тест и клини 📌 за да зачуваш прашања.'
            : 'Нема прашања за избраните филтри.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => (
            <div
              key={q.id}
              className={`border rounded-xl p-4 transition ${q.isVerified ? 'border-green-300 bg-green-50/30' : selected.has(q.id) ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button type="button" onClick={() => toggleSelect(q.id)} className="mt-0.5 flex-shrink-0">
                  {selected.has(q.id)
                    ? <CheckSquare className="w-5 h-5 text-indigo-600" />
                    : <Square className="w-5 h-5 text-gray-400" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{q.question}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                    </span>
                    {q.gradeLevel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {q.gradeLevel}. одд.
                      </span>
                    )}
                    {q.conceptTitle && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {q.conceptTitle}
                      </span>
                    )}
                    {q.cognitiveLevel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {q.cognitiveLevel}
                      </span>
                    )}
                    {q.isVerified && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-600 text-white font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Верификувана
                      </span>
                    )}
                  </div>

                  {/* Revealed answer */}
                  {revealedAnswers.has(q.id) && (
                    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700">
                      <span className="font-semibold">Одговор:</span> {q.answer}
                      {q.options && q.options.length > 0 && (
                        <ul className="mt-1 list-disc list-inside space-y-0.5">
                          {q.options.map((opt, i) => (
                            <li key={i} className={opt === q.answer ? 'font-semibold text-green-700' : ''}>{opt}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleReveal(q.id)}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                  >
                    {revealedAnswers.has(q.id) ? 'Скриј' : 'Одговор'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify(q.id, !!q.isVerified)}
                    title={q.isVerified ? 'Откажи верификација' : 'Верификувај прашање'}
                    className={`p-1.5 transition ${q.isVerified ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-green-600'}`}
                  >
                    {q.isVerified ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    title="Избриши"
                    className="p-1.5 text-gray-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 bg-white border border-indigo-200 rounded-xl shadow-lg p-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-700">{selected.size} прашања означени</span>
          <button
            type="button"
            onClick={handleCreateQuiz}
            disabled={creatingQuiz}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            <PlusSquare className="w-4 h-4" />
            {creatingQuiz ? 'Создавам...' : 'Создај квиз од избрани'}
          </button>
        </div>
      )}
    </div>
  );
};
