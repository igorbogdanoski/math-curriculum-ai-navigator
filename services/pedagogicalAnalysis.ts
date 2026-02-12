import { BloomsLevel } from '../types';

export interface LessonActivityLike {
  text: string;
  bloomsLevel?: BloomsLevel;
  durationMinutes?: number;
}

export interface AnalysisResult {
  score: number; // 0-100
  feedback: string[];
  distribution: Record<BloomsLevel, number>;
}

/**
 * Analyzes the balance of a lesson plan based on Bloom's Taxonomy.
 * This is a pure logic service (no AI calls) to save quota.
 */
export const analyzeLessonBalance = (activities: LessonActivityLike[]): AnalysisResult => {
  const feedback: string[] = [];
  let totalMinutes = 0;
  
  const distribution: Record<BloomsLevel, number> = {
    'Remembering': 0,
    'Understanding': 0,
    'Applying': 0,
    'Analyzing': 0,
    'Evaluating': 0,
    'Creating': 0
  };

  // 1. Calculate distribution (assuming default 10 mins if duration is missing)
  activities.forEach(act => {
    const level = act.bloomsLevel || 'Understanding';
    const duration = act.durationMinutes || 10;
    distribution[level] += duration;
    totalMinutes += duration;
  });

  if (totalMinutes === 0) {
    return { score: 0, feedback: ['Додадете активности за да започне анализата.'], distribution };
  }

  // 2. Apply Pedagogical Rules
  
  // Rule 1: Too much passive learning (Remembering + Understanding > 60%)
  const passiveTime = distribution['Remembering'] + distribution['Understanding'];
  const passiveRatio = passiveTime / totalMinutes;
  if (passiveRatio > 0.6) {
    feedback.push("⚠️ Внимание: Над 60% од часот е фокусиран на теорија и разбирање. Додадете активности за примена или анализа.");
  }

  // Rule 2: Lack of Higher Order Thinking Skills (HOTS)
  const hotsTime = distribution['Evaluating'] + distribution['Creating'];
  if (hotsTime === 0 && totalMinutes >= 30) {
    feedback.push("💡 Совет: Обидете се да вклучите активност за евалуација или креирање (HOTS) за подлабоко учење.");
  }

  // Rule 3: Balanced distribution
  const applyingTime = distribution['Applying'];
  if (applyingTime > 0 && applyingTime / totalMinutes > 0.2) {
    feedback.push("✅ Одлично: Имате добра застапеност на практична примена на знаењето.");
  }

  // Rule 4: Analyzing check
  if (distribution['Analyzing'] > 0) {
    feedback.push("🔍 Браво: Вклучена е анализа, што поттикнува критичко размислување.");
  }

  // Rule 5: Activity density
  if (activities.length > 5 && totalMinutes < 40) {
    feedback.push("⚡ Предизвик: Имате многу активности во краток рок. Внимавајте на транзициите помеѓу нив.");
  }

  if (feedback.length === 0 || (feedback.length === 1 && feedback[0].startsWith('✅'))) {
    feedback.push("🌟 Вашата подготовка е педагошки добро избалансирана!");
  }

  // Calculate score
  let score = 100;
  if (passiveRatio > 0.7) score -= 20;
  if (hotsTime === 0) score -= 15;
  if (totalMinutes < 30) score -= 10;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    feedback,
    distribution
  };
};
