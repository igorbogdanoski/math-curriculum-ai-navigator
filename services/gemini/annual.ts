import { AIGeneratedAnnualPlan, TeachingProfile } from '../../types';
import {
    Type, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, sanitizePromptInput,
    getSecondaryTrackContext,
} from './core';

const MIN_ANNUAL_PLAN_TOPICS = 8;
const ANNUAL_PLAN_FALLBACK_TOPICS = [
  'Вовед и дијагностика',
  'Рационални броеви и операции',
  'Пропорции и проценти',
  'Алгебарски изрази и равенки',
  'Геометрија и конструкции',
  'Мерење и примени',
  'Статистика и веројатност',
  'Систематизација и проектни задачи',
];

function normalizeTopicWeeks(plan: AIGeneratedAnnualPlan): AIGeneratedAnnualPlan {
  const topics = (plan.topics ?? []).map((topic) => ({
    ...topic,
    durationWeeks: Math.max(1, Math.round(Number(topic.durationWeeks ?? 1))),
    objectives: Array.isArray(topic.objectives) && topic.objectives.length > 0
      ? topic.objectives
      : ['Совладување на клучните поими за темата.'],
    suggestedActivities: Array.isArray(topic.suggestedActivities) && topic.suggestedActivities.length > 0
      ? topic.suggestedActivities
      : ['Кратка наставна активност со проверка на разбирање.'],
  }));

  let sum = topics.reduce((acc, t) => acc + t.durationWeeks, 0);
  const baseWeeks = plan.totalWeeks ?? sum ?? 1;
  const targetWeeks = Math.max(1, Math.round(Number(baseWeeks)));

  if (topics.length === 0) {
    return {
      ...plan,
      totalWeeks: targetWeeks,
      topics: [{ title: 'Годишна рамка', durationWeeks: targetWeeks, objectives: ['Покривање на годишните цели според наставната програма.'], suggestedActivities: ['Насочено планирање, вежбање и формативна евалуација.'] }],
    };
  }

  let cursor = 0;
  while (sum < targetWeeks) { topics[cursor % topics.length].durationWeeks += 1; sum += 1; cursor += 1; }
  while (sum > targetWeeks) {
    const idx = cursor % topics.length;
    if (topics[idx].durationWeeks > 1) { topics[idx].durationWeeks -= 1; sum -= 1; }
    cursor += 1;
  }
  return { ...plan, totalWeeks: targetWeeks, topics };
}

function enforceAnnualPlanQuality(plan: AIGeneratedAnnualPlan): AIGeneratedAnnualPlan {
  const topics = [...(plan.topics ?? [])];
  const existingTitles = new Set(topics.map((topic) => (topic.title ?? '').toLowerCase()));
  for (const title of ANNUAL_PLAN_FALLBACK_TOPICS) {
    if (topics.length >= MIN_ANNUAL_PLAN_TOPICS) break;
    if (existingTitles.has(title.toLowerCase())) continue;
    topics.push({ title, durationWeeks: 1, objectives: ['Развивање на математички компетенции и примена во контекст.'], suggestedActivities: ['Наставна активност со вежби, дискусија и кратка проверка.'] });
  }
  return normalizeTopicWeeks({ ...plan, topics });
}

export const annualAPI = {

async generateAnnualPlan(
    grade: string,
    subject: string,
    totalWeeks: number,
    curriculumContext: string,
    profile?: TeachingProfile,
    customInstruction?: string
  ): Promise<AIGeneratedAnnualPlan> {
    const safeCustomInstruction = sanitizePromptInput(customInstruction, 600);
    const weeklyHoursForTrack = profile?.secondaryTrack
      ? ({ gymnasium: 4, gymnasium_elective: 3, vocational4: 3, vocational3: 2, vocational2: 2 } as const)[profile.secondaryTrack] ?? 4
      : 4;
    const secondaryContextBlock = getSecondaryTrackContext(profile?.secondaryTrack);
    const prompt = `
Вие сте врвен експерт за планирање на наставата по ${subject} за ${grade} во македонскиот образовен систем.
Ваша задача е да креирате детална, практична и изводлива предлог-годишна програма.
${secondaryContextBlock}

ПАРАМЕТРИ:
- Вкупно недели на располагање: ${totalWeeks}.

ОФИЦИЈАЛНА ПРОГРАМА (МОРА да се придржувате до овие теми и нивните специфики):
${curriculumContext}

УПАТСТВА:
1. Строго базирајте го вашиот план на официалните теми дадени погоре.
2. Распределете ги темите низ неделите така што сумата од сите недели да биде ТОЧНО ${totalWeeks}.
3. Вклучи најмалку ${MIN_ANNUAL_PLAN_TOPICS} одделни теми во полето "topics".
4. Конвертирајте ги "Препорачани часови" во реални недели (претпоставувајќи точно ${weeklyHoursForTrack} часа неделно).
5. За секоја тема, извлечете ги примарните цели и предложете 2-3 креативни, модерни активности.
6. КАЛЕНДАРСКИ ИНТЕЛИГЕНТНО ПЛАНИРАЊЕ: Земете ги предвид македонските државни празници (8 Септември, 11 Октомври, 23 Октомври, 8 Декември, 1 Мај, 24 Мај) и зимски распусти.
${safeCustomInstruction ? `\nДОПОЛНИТЕЛНИ ИНСТРУКЦИИ ОД НАСТАВНИКОТ: ${safeCustomInstruction}` : ''}

Вратете ВАЛИДЕН JSON според шемата, без дополнителен текст.
    `.trim();

    const schema = {
      type: Type.OBJECT,
      properties: {
        grade: { type: Type.STRING }, subject: { type: Type.STRING }, totalWeeks: { type: Type.NUMBER },
        topics: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, durationWeeks: { type: Type.NUMBER }, objectives: { type: Type.ARRAY, items: { type: Type.STRING } }, suggestedActivities: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['title', 'durationWeeks', 'objectives', 'suggestedActivities'] } },
      },
      required: ['grade', 'subject', 'totalWeeks', 'topics'],
    };

    const generatedPlan = await generateAndParseJSON<AIGeneratedAnnualPlan>(
      [{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier, { temperature: 0.2, topP: 0.9 }
    );
    return enforceAnnualPlanQuality(generatedPlan);
  },

};
