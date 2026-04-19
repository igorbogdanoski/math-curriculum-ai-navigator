/**
 * EmbedQuizView — LTI 1.3 basic: iframe-embeddable quiz widget.
 * Route: /#/embed/quiz/:data
 * Used by: Google Classroom, Microsoft Teams, Moodle via iframe.
 */
import React, { useMemo } from 'react';
import { shareService } from '../services/shareService';

const InteractiveQuizPlayer = React.lazy(() =>
  import('../components/ai/InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer }))
);

interface Props {
  data: string;
}

export const EmbedQuizView: React.FC<Props> = ({ data }) => {
  const quiz = useMemo(() => shareService.decodeQuizShareData(data), [data]);

  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-white">
        <p className="text-gray-400 text-sm">Квизот не може да се вчита.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-screen bg-brand-bg">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <InteractiveQuizPlayer
          title={quiz.title}
          questions={quiz.questions}
          onClose={() => {/* no-op in embed mode */}}
        />
      </React.Suspense>
    </div>
  );
};
