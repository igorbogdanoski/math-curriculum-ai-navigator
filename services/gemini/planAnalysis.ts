import { logger } from '../../utils/logger';
import { AIGeneratedAnnualPlan } from '../../types';
import { Type, ULTIMATE_MODEL, MAX_RETRIES, generateAndParseJSON, JSON_SYSTEM_INSTRUCTION } from './core';

export interface PlanQualityScore {
    score: number;  // 0–100
    comment: string;
}

export interface PlanQualityReport {
    overallScore: number;
    bloomBalance: PlanQualityScore;
    curriculumCoverage: PlanQualityScore;
    assessmentDistribution: PlanQualityScore;
    verticalProgression: PlanQualityScore;
    suggestions: string[];
    strengths: string[];
}

export async function analyzePlanQuality(plan: AIGeneratedAnnualPlan): Promise<PlanQualityReport> {
    const topicLines = plan.topics.map((t, i) =>
        `${i + 1}. ${t.title} (${t.durationWeeks} нед)\n   Цели: ${t.objectives.join('; ')}\n   Активности: ${t.suggestedActivities.join('; ')}`
    ).join('\n');

    const prompt = `
### УЛОГА
Ти си педагошки советник и стручњак за курикуларен дизајн. Анализирај го следниов годишен план по математика и дај детална квалитетна оцена.

### ГОДИШЕН ПЛАН
- Предмет: ${plan.subject}
- Одделение: ${plan.grade}
- Вкупно недели: ${plan.totalWeeks}

### ТЕМИ
${topicLines}

### КРИТЕРИУМИ ЗА ОЦЕНА (0–100 за секоја димензија)

**bloomBalance** — Блумова рамка:
- Дали целите покриваат повеќе нивоа (знаење, разбирање, примена, анализа, синтеза, вреднување)?
- Дали нема превишок на само ниско-когнитивни цели?

**curriculumCoverage** — Покриеност на curriculum:
- Дали темите ги опфаќаат клучните области за ова одделение (множества, броеви, алгебра, геометрија, статистика)?
- Дали е балансирано по теми?

**assessmentDistribution** — Оценување и проверка:
- Дали активностите вклучуваат различни форми на оценување?
- Дали има формативно и сумативно оценување?

**verticalProgression** — Вертикална прогресија:
- Дали темите следат логичен редослед и градат врз претходното знаење?
- Дали постои јасна скала на комплексност?

Дај 3–5 конкретни ПРЕПОРАКИ за подобрување и 2–3 СИЛНИ СТРАНИ.
Пиши на македонски.
`.trim();

    const schema = {
        type: Type.OBJECT,
        properties: {
            overallScore: { type: Type.NUMBER, description: 'Просечна оценка 0-100' },
            bloomBalance: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    comment: { type: Type.STRING },
                },
                required: ['score', 'comment'],
            },
            curriculumCoverage: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    comment: { type: Type.STRING },
                },
                required: ['score', 'comment'],
            },
            assessmentDistribution: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    comment: { type: Type.STRING },
                },
                required: ['score', 'comment'],
            },
            verticalProgression: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    comment: { type: Type.STRING },
                },
                required: ['score', 'comment'],
            },
            suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3-5 конкретни препораки на македонски',
            },
            strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 силни страни на македонски',
            },
        },
        required: [
            'overallScore', 'bloomBalance', 'curriculumCoverage',
            'assessmentDistribution', 'verticalProgression', 'suggestions', 'strengths',
        ],
    };

    logger.info('[S78-A] analyzePlanQuality → ULTIMATE_MODEL', { grade: plan.grade, topics: plan.topics.length });

    return generateAndParseJSON<PlanQualityReport>(
        [{ text: prompt }],
        schema,
        ULTIMATE_MODEL,
        undefined,
        MAX_RETRIES,
        false,
        JSON_SYSTEM_INSTRUCTION,
    );
}
