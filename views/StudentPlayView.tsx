import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { InteractiveQuizPlayer } from '../components/InteractiveQuizPlayer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ICONS } from '../constants';

export const StudentPlayView = () => {
  const { id } = useParams();
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'cached_ai_materials', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.content && data.content.items) {
             setQuizData(data.content);
          } else {
             setError('Овој материјал не е квиз.');
          }
        } else {
          setError('Квизот не е пронајден. Проверете го линкот.');
        }
      } catch (err) {
        console.error(err);
        setError('Грешка при вчитување. Можеби немате пристап.'); 
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  if (loading) {
    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center text-blue-600">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-xl font-bold">Се подготвува квизот...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
                <div className="text-red-500 mb-4 flex justify-center">
                    <ICONS.warning className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Опс!</h2>
                <p className="text-gray-600">{error}</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 text-center animate-fade-in">
          <div className="inline-block bg-white p-3 rounded-full shadow-sm mb-4">
             <span className="text-4xl">🎓</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-blue-900 mb-2 tracking-tight">
            Математички Предизвик
          </h1>
          <p className="text-blue-600 font-medium">
            Реши ги задачите и освој поени!
          </p>
        </header>
        {quizData && (
          <div className="animate-slide-up">
            <InteractiveQuizPlayer 
                title={quizData.title || "Квиз"}
                questions={quizData.items.map((item: any, index: number) => ({
                    question: item.text,
                    options: item.options || [
                        item.answer, 
                        generateFakeAnswer(item.answer), 
                        generateFakeAnswer(item.answer), 
                        generateFakeAnswer(item.answer)
                    ].sort(() => Math.random() - 0.5),
                    answer: item.answer,
                    explanation: item.solution
                }))}
            />
          </div>
        )}
        <footer className="text-center text-gray-400 text-sm mt-12">
            Powered by Math Curriculum AI
        </footer>
      </div>
    </div>
  );
};

function generateFakeAnswer(correct: string): string {
    const num = parseFloat(correct);
    if (!isNaN(num)) {
        return (num + Math.floor(Math.random() * 10) - 5).toString();
    }
    return correct + " (Неточно)";
}
