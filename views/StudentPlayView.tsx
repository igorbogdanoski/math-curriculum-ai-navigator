import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { firestoreService } from '../services/firestoreService';
import { geminiService } from '../services/geminiService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ICONS } from '../constants';
import { useCurriculum } from '../hooks/useCurriculum';
import {
  Loader2, AlertCircle, Home, Star, RefreshCw, BookOpen,
  User, ArrowRight, BarChart2, Sparkles, ExternalLink,
} from 'lucide-react';
import { QuestionType } from '../types';

type QuizResult = { percentage: number; correctCount: number; totalQuestions: number };

export const StudentPlayView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getConceptDetails } = useCurriculum();

  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Adaptive remediation state
  const [remediaQuizId, setRemediaQuizId] = useState<string | null>(null);
  const [isGeneratingRemedia, setIsGeneratingRemedia] = useState(false);

  // Student name — persisted in localStorage so they don't re-enter every time
  const [studentName, setStudentName] = useState<string>(
    () => localStorage.getItem('studentName') || ''
  );
  const [nameConfirmed, setNameConfirmed] = useState<boolean>(
    () => !!localStorage.getItem('studentName')
  );
  const [nameInput, setNameInput] = useState<string>(
    () => localStorage.getItem('studentName') || ''
  );

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!id) {
        setError('Невалиден линк за квиз.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const quizDoc = await getDoc(doc(db, 'cached_ai_materials', id));
        if (quizDoc.exists()) {
          const data = quizDoc.data();
          setQuizData({
            ...(data.content || data),
            _meta: { conceptId: data.conceptId, topicId: data.topicId, gradeLevel: data.gradeLevel },
          });
        } else {
          setError('Квизот не е пронајден. Проверете го линкот со вашиот наставник.');
        }
      } catch (err) {
        console.error('Грешка при вчитување на квизот:', err);
        setError('Проблем со поврзувањето. Проверете ја интернет конекцијата.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  const handleConfirmName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem('studentName', trimmed);
    setStudentName(trimmed);
    setNameConfirmed(true);
  };

  const generateRemediaQuiz = async (meta: { conceptId?: string; topicId?: string; gradeLevel?: number }) => {
    if (!meta.conceptId) return;
    setIsGeneratingRemedia(true);
    try {
      const { grade, topic, concept } = getConceptDetails(meta.conceptId);
      if (!grade || !concept) return;

      const context = {
        type: 'CONCEPT' as const,
        grade,
        topic,
        concepts: [concept],
      };

      const result = await geminiService.generateAssessment(
        'QUIZ',
        [QuestionType.MULTIPLE_CHOICE],
        6,
        context,
        undefined,
        'support',
        undefined,
        undefined,
        'РЕМЕДИЈАЛНА ВЕЖБА: Прашањата мора да бидат поедноставени, со детални упатства, помал вокабулар и чекор-по-чекор примери. Ученикот не ги положи стандардните прашања.',
      );

      const newId = await firestoreService.saveRemediaQuiz(result, {
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        sourceQuizId: id,
      });
      if (newId) setRemediaQuizId(newId);
    } catch (err) {
      console.error('Грешка при генерирање ремедијален квиз:', err);
    } finally {
      setIsGeneratingRemedia(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold animate-pulse">Се подготвува квизот...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Грешка!</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => { window.location.hash = '/'; }}
            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold mx-auto hover:bg-black transition"
          >
            <Home className="w-5 h-5" /> Назад кон почетна
          </button>
        </div>
      </div>
    );
  }

  const passed = quizResult && quizResult.percentage >= 70;
  const resultCardClass = passed
    ? 'w-full max-w-4xl mt-6 rounded-2xl p-5 border-2 animate-fade-in bg-green-50 border-green-300'
    : 'w-full max-w-4xl mt-6 rounded-2xl p-5 border-2 animate-fade-in bg-amber-50 border-amber-300';

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-black text-xl tracking-tighter uppercase">Ученички Портал</h1>
        </div>
        <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          МАТЕМАТИЧКИ ПРЕДИЗВИК
        </div>
      </div>

      <main className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white/20 relative min-h-[500px]">
        {/* Name entry splash — shown only if name not yet confirmed */}
        {!nameConfirmed && (
          <div className="flex flex-col items-center justify-center min-h-[500px] p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
              <User className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Добредојде!</h2>
            <p className="text-slate-500 mb-8 max-w-sm">
              Внеси го твоето ime за да го зачуваме твојот резултат и прогрес.
            </p>
            <div className="w-full max-w-sm">
              <input
                type="text"
                placeholder="Твоето ime и презиме..."
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmName(); }}
                className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4"
                autoFocus
              />
              <button
                type="button"
                onClick={handleConfirmName}
                disabled={!nameInput.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Почни Квизот <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Quiz — shown only once name is confirmed */}
        {nameConfirmed && quizData && (
          <>
            {/* Student name badge */}
            <div className="flex items-center gap-2 px-6 pt-5 pb-0">
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-700">{studentName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameConfirmed(false);
                  setNameInput(studentName);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition"
              >
                Промени
              </button>
            </div>
            <InteractiveQuizPlayer
              title={quizData.title || 'Квиз'}
              questions={(quizData.items || quizData.questions || []).map((item: any) => ({
                question: item.text || item.question,
                options: item.options || [item.answer, 'Грешка 1', 'Грешка 2', 'Грешка 3'].sort(() => Math.random() - 0.5),
                answer: item.answer,
                explanation: item.solution || item.explanation,
              }))}
              onComplete={({ score, correctCount, totalQuestions }) => {
                const percentage = Math.round((correctCount / totalQuestions) * 100);
                firestoreService.saveQuizResult({
                  quizId: id || 'unknown',
                  quizTitle: quizData.title || 'Квиз',
                  score,
                  correctCount,
                  totalQuestions,
                  percentage,
                  conceptId: quizData._meta?.conceptId,
                  topicId: quizData._meta?.topicId,
                  gradeLevel: quizData._meta?.gradeLevel,
                  studentName: studentName || undefined,
                });
                setQuizResult({ percentage, correctCount, totalQuestions });
                // Adaptive Remediation Engine — auto-generate support quiz on failure
                if (percentage < 70) {
                  generateRemediaQuiz(quizData._meta || {});
                }
              }}
              onClose={() => { window.location.hash = '/'; }}
            />
          </>
        )}
      </main>

      {quizResult && (
        <div className={resultCardClass}>
          {passed ? (
            <div className="flex items-start gap-4">
              <Star className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />
              <div>
                <p className="font-black text-green-800 text-lg">
                  Одличен резултат! {quizResult.correctCount} / {quizResult.totalQuestions} точни
                </p>
                <p className="text-green-700 text-sm mt-1">
                  Браво{studentName ? `, ${studentName}` : ''}! Ги совладавте прашањата одлично. Кажи му на твојот наставник за резултатот.
                </p>
                <button
                  type="button"
                  onClick={() => { window.location.hash = '/my-progress'; }}
                  className="mt-3 flex items-center gap-2 text-xs font-bold bg-green-200 text-green-900 px-4 py-2 rounded-xl hover:bg-green-300 transition"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Погледни го мојот прогрес
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <BookOpen className="w-8 h-8 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-amber-800 text-lg">
                  Не се откажуј! {quizResult.correctCount} / {quizResult.totalQuestions} точни
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  Оваа тема бара малку повеќе вежба. Подготвуваме полесни прашања специјално за тебе...
                </p>

                {/* Adaptive Remediation Engine — CTA */}
                {isGeneratingRemedia && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    AI подготвува полесен квиз за тебе...
                  </div>
                )}
                {remediaQuizId && !isGeneratingRemedia && (
                  <button
                    type="button"
                    onClick={() => { window.location.hash = `/play/${remediaQuizId}`; window.location.reload(); }}
                    className="mt-3 flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Вежбај со полесни прашања
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setQuizResult(null); setRemediaQuizId(null); }}
                  className="mt-2 flex items-center gap-2 text-xs font-bold bg-amber-200 text-amber-900 px-4 py-2 rounded-xl hover:bg-amber-300 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Обиди се повторно
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="mt-8 text-white/50 text-xs font-bold uppercase tracking-widest">
        Powered by Math Curriculum AI Navigator
      </footer>
    </div>
  );
};
