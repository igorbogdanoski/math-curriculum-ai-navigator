import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { firestoreService } from '../services/firestoreService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ICONS } from '../constants';
import { Loader2, AlertCircle, Home, Star, RefreshCw, BookOpen } from 'lucide-react';

type QuizResult = { percentage: number; correctCount: number; totalQuestions: number };

export const StudentPlayView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

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
        {quizData && (
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
              });
              setQuizResult({ percentage, correctCount, totalQuestions });
            }}
            onClose={() => { window.location.hash = '/'; }}
          />
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
                  Браво! Ги совладавте прашањата одлично. Кажи му на твојот наставник за резултатот.
                </p>
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
                  Оваа тема бара малку повеќе вежба. Твојот наставник може да ти приготви
                  дополнителни материјали со поедноставени задачи.
                </p>
                <button
                  type="button"
                  onClick={() => { setQuizResult(null); }}
                  className="mt-3 flex items-center gap-2 text-xs font-bold bg-amber-200 text-amber-900 px-4 py-2 rounded-xl hover:bg-amber-300 transition"
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
