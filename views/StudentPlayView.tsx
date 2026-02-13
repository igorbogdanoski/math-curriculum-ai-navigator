import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ICONS } from '../constants';
import { Loader2, AlertCircle, Home } from 'lucide-react';

export const StudentPlayView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // Helper for hash-based routing if needed, but we'll try to stick to the project's navigate
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!id) {
        setError('Невалиден линк за квиз.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Квизовите се зачувани во cached_ai_materials
        const quizDoc = await getDoc(doc(db, "cached_ai_materials", id));
        
        if (quizDoc.exists()) {
          const data = quizDoc.data();
          // Support both direct content or nested content
          setQuizData(data.content || data);
        } else {
          setError('Квизот не е пронајден. Проверете го линкот со вашиот наставник.');
        }
      } catch (err) {
        console.error("Грешка при вчитување на квизот:", err);
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
            onClick={() => window.location.hash = '/'}
            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold mx-auto hover:bg-black transition"
          >
            <Home className="w-5 h-5" /> Назад кон почетна
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      {/* Мини Header за ученици */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-black text-xl tracking-tighter uppercase">Ученички Портал</h1>
        </div>
        <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          МАТЕМАТИЧКИ ПРЕДИЗВИК 🏆
        </div>
      </div>

      <main className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white/20 relative min-h-[500px]">
        {quizData && (
          <InteractiveQuizPlayer 
            title={quizData.title || 'Квиз'}
            questions={(quizData.items || quizData.questions || []).map((item: any) => ({
              question: item.text || item.question,
              options: item.options || [item.answer, "Грешка 1", "Грешка 2", "Грешка 3"].sort(() => Math.random() - 0.5),
              answer: item.answer,
              explanation: item.solution || item.explanation
            }))}
            onClose={() => window.location.hash = '/'}
          />
        )}
      </main>

      <footer className="mt-8 text-white/50 text-[10px] font-bold uppercase tracking-widest">
        Powered by Math Curriculum AI Navigator • ООУ „Блаже Конески“ - Прилеп
      </footer>
    </div>
  );
};
