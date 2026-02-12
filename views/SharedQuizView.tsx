import React, { useMemo } from 'react';
import { shareService } from '../services/shareService';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { useNavigation } from '../contexts/NavigationContext';

interface SharedQuizViewProps {
  data: string;
}

export const SharedQuizView: React.FC<SharedQuizViewProps> = ({ data }) => {
  const { navigate } = useNavigation();
  
  const quiz = useMemo(() => shareService.decodeQuizShareData(data), [data]);

  if (!quiz) {
    return (
      <div className="p-8 text-center h-screen flex flex-col items-center justify-center bg-brand-bg">
        <h2 className="text-2xl font-bold text-red-600">Квизот не може да се вчита.</h2>
        <p className="text-gray-600 mt-2">Линкот е невалиден или содржината е оштетена.</p>
        <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary transition-colors">
          Оди на почетна
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-brand-bg">
      <InteractiveQuizPlayer 
        title={quiz.title} 
        questions={quiz.questions} 
        onClose={() => navigate('/')} 
      />
    </div>
  );
};
