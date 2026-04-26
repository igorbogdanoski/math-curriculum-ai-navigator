import React from 'react';
import { Loader2 } from 'lucide-react';
import { useStudentLearningLoop } from '../../hooks/useStudentLearningLoop';
import { MisconceptionExplainer } from './MisconceptionExplainer';
import { StudentNextStepCard } from './StudentNextStepCard';
import { VerificationMicroQuiz } from './VerificationMicroQuiz';
import type { QuizResult } from './quizSessionReducer';

interface LearningLoopPanelProps {
  quizResult: QuizResult | null;
  conceptTitle: string;
  gradeLevel: number;
  quizId?: string;
  conceptId?: string;
}

/**
 * Post-quiz learning loop panel — automatically activates when score < 70%.
 * Flow: loading → 3-step MisconceptionExplainer → VerificationMicroQuiz → StudentNextStepCard.
 * Renders nothing for passing scores (handled by existing QuizResultPanel).
 */
export const LearningLoopPanel: React.FC<LearningLoopPanelProps> = ({
  quizResult,
  conceptTitle,
  gradeLevel,
  quizId,
  conceptId,
}) => {
  const {
    phase,
    explanation,
    stepIndex,
    advanceStep,
    verificationQuestions,
    handleVerificationComplete,
  } = useStudentLearningLoop({
    quizResult,
    conceptTitle,
    gradeLevel,
  });

  if (phase === 'idle') return null;

  if (phase === 'loading') {
    return (
      <div className="w-full max-w-4xl mt-4 bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm flex items-center gap-3 animate-fade-in">
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
        <p className="text-white/80 text-sm font-semibold">
          AI подготвува мини-лекција за тебе…
        </p>
      </div>
    );
  }

  if (phase === 'explaining' && explanation) {
    return (
      <MisconceptionExplainer
        explanation={explanation}
        stepIndex={stepIndex}
        onNext={advanceStep}
      />
    );
  }

  if (phase === 'verifying' && verificationQuestions.length > 0) {
    return (
      <VerificationMicroQuiz
        questions={verificationQuestions}
        conceptTitle={conceptTitle}
        onComplete={handleVerificationComplete}
      />
    );
  }

  if (phase === 'next-step') {
    return (
      <StudentNextStepCard
        quizId={quizId}
        conceptId={conceptId}
        conceptTitle={conceptTitle}
      />
    );
  }

  return null;
};
