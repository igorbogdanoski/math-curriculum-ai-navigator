import { useState, useCallback } from 'react';
import { geminiService } from '../../../services/geminiService';
import { QuestionType, AIGeneratedAssessment } from '../../../types';

export interface GammaExitTicketHandlers {
  exitTicket: AIGeneratedAssessment | null;
  isGenerating: boolean;
  generate: (topic: string, gradeLevel: number) => Promise<void>;
  dismiss: () => void;
}

export function useGammaExitTicket(): GammaExitTicketHandlers {
  const [exitTicket, setExitTicket] = useState<AIGeneratedAssessment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (topic: string, gradeLevel: number) => {
    if (isGenerating || exitTicket) return;
    setIsGenerating(true);
    try {
      const result = await geminiService.generateAssessment(
        'QUIZ',
        [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
        3,
        {
          type: 'TOPIC' as const,
          grade: { id: `grade-${gradeLevel}`, level: gradeLevel, title: `${gradeLevel}. одделение`, topics: [] },
          scenario: `Exit Ticket по завршена Gamma Mode презентација за темата "${topic}". Генерирај 3 кратки прашања (2 MC + 1 кратко) кои проверуваат дали учениците го разбраа клучното од часот. Прашањата треба да бидат на DoK 1-2, јасни и директни.`,
        },
        undefined,
        'standard',
        undefined,
        undefined,
        undefined,
        false,
        false,
        2,
      );
      setExitTicket(result);
    } catch {
      // Silently ignore — UI stays clean
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, exitTicket]);

  const dismiss = useCallback(() => setExitTicket(null), []);

  return { exitTicket, isGenerating, generate, dismiss };
}
