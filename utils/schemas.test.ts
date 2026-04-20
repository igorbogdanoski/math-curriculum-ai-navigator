import { describe, it, expect } from 'vitest';
import {
    BloomsLevelSchema,
    LessonPlanSchema,
    AIGeneratedAssessmentSchema,
    AIGeneratedRubricSchema,
    AIRecommendationSchema,
    AIPedagogicalAnalysisSchema,
    AIGeneratedThematicPlanSchema,
    DailyBriefSchema,
    WorkedExampleSchema,
    ReflectionSummarySchema,
} from './schemas';

// ─── BloomsLevelSchema ────────────────────────────────────────────────────────

describe('BloomsLevelSchema', () => {
    const validLevels = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];

    it.each(validLevels)('accepts valid level: %s', (level) => {
        expect(BloomsLevelSchema.safeParse(level).success).toBe(true);
    });

    it('rejects an unknown level', () => {
        expect(BloomsLevelSchema.safeParse('Memorizing').success).toBe(false);
    });

    it('rejects lowercase levels (case-sensitive)', () => {
        expect(BloomsLevelSchema.safeParse('remembering').success).toBe(false);
    });

    it('rejects empty string', () => {
        expect(BloomsLevelSchema.safeParse('').success).toBe(false);
    });
});

// ─── LessonPlanSchema ─────────────────────────────────────────────────────────

describe('LessonPlanSchema', () => {
    it('applies defaults for missing optional fields', () => {
        const result = LessonPlanSchema.safeParse({});
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.title).toBe('Untitled Lesson Plan');
        expect(result.data.objectives).toEqual([]);
        expect(result.data.materials).toEqual([]);
        expect(result.data.differentiation).toBe('');
    });

    it('parses a valid lesson plan', () => {
        const plan = {
            title: 'Питагорова теорема',
            objectives: [{ text: 'Да ја разбере теоремата', bloomsLevel: 'Understanding' }],
            assessmentStandards: ['M-8-III-A.1'],
            scenario: {
                introductory: { text: 'Вовед' },
                main: [{ text: 'Активност', bloomsLevel: 'Applying' }],
                concluding: { text: 'Заклучок' },
            },
            materials: ['Линијар', 'Пергар'],
        };
        const result = LessonPlanSchema.safeParse(plan);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.title).toBe('Питагорова теорема');
            expect(result.data.objectives).toHaveLength(1);
        }
    });
});

// ─── AIGeneratedAssessmentSchema ──────────────────────────────────────────────

describe('AIGeneratedAssessmentSchema', () => {
    const minimalAssessment = {
        title: 'Тест за Питагорова теорема',
        questions: [
            { type: 'MULTIPLE_CHOICE', question: 'Прашање?', answer: 'Одговор' },
        ],
    };

    it('parses a minimal valid assessment', () => {
        const result = AIGeneratedAssessmentSchema.safeParse(minimalAssessment);
        expect(result.success).toBe(true);
    });

    it('defaults type to TEST when omitted', () => {
        const result = AIGeneratedAssessmentSchema.safeParse(minimalAssessment);
        if (result.success) {
            expect(result.data.type).toBe('TEST');
        }
    });

    it('accepts valid type enum values', () => {
        for (const type of ['TEST', 'WORKSHEET', 'QUIZ', 'FLASHCARDS']) {
            const result = AIGeneratedAssessmentSchema.safeParse({ ...minimalAssessment, type });
            expect(result.success).toBe(true);
        }
    });

    it('rejects an invalid type enum', () => {
        const result = AIGeneratedAssessmentSchema.safeParse({ ...minimalAssessment, type: 'INVALID' });
        expect(result.success).toBe(false);
    });

    it('requires title field', () => {
        const { title: _t, ...noTitle } = minimalAssessment;
        expect(AIGeneratedAssessmentSchema.safeParse(noTitle).success).toBe(false);
    });

    it('requires questions array', () => {
        const { questions: _q, ...noQuestions } = minimalAssessment;
        expect(AIGeneratedAssessmentSchema.safeParse(noQuestions).success).toBe(false);
    });
});

// ─── AIGeneratedRubricSchema ──────────────────────────────────────────────────

describe('AIGeneratedRubricSchema', () => {
    const validRubric = {
        title: 'Рубрика за проект',
        criteria: [
            {
                criterion: 'Точност',
                levels: [
                    { levelName: 'Одличен', description: 'Сè е точно', points: '4' },
                ],
            },
        ],
    };

    it('parses a valid rubric', () => {
        expect(AIGeneratedRubricSchema.safeParse(validRubric).success).toBe(true);
    });

    it('rejects rubric without criteria', () => {
        const { criteria: _c, ...noCriteria } = validRubric;
        expect(AIGeneratedRubricSchema.safeParse(noCriteria).success).toBe(false);
    });

    it('rejects criteria item without levels', () => {
        const bad = { title: 'R', criteria: [{ criterion: 'X' }] };
        expect(AIGeneratedRubricSchema.safeParse(bad).success).toBe(false);
    });
});

// ─── AIRecommendationSchema ───────────────────────────────────────────────────

describe('AIRecommendationSchema', () => {
    const validRec = [
        {
            category: 'Нова Активност',
            title: 'Интерактивна лекција',
            recommendationText: 'Препораката за наставникот.',
        },
    ];

    it('parses a valid recommendation array', () => {
        expect(AIRecommendationSchema.safeParse(validRec).success).toBe(true);
    });

    it('parses recommendation with optional action field', () => {
        const withAction = [
            {
                ...validRec[0],
                action: { label: 'Отвори', path: '/generator' },
            },
        ];
        expect(AIRecommendationSchema.safeParse(withAction).success).toBe(true);
    });

    it('parses empty array', () => {
        expect(AIRecommendationSchema.safeParse([]).success).toBe(true);
    });

    it('rejects item missing required fields', () => {
        expect(AIRecommendationSchema.safeParse([{ category: 'X' }]).success).toBe(false);
    });
});

// ─── AIPedagogicalAnalysisSchema ──────────────────────────────────────────────

describe('AIPedagogicalAnalysisSchema', () => {
    const validAnalysis = {
        pedagogicalAnalysis: {
            overallImpression: 'Добра подготовка',
            alignment: { status: 'Good', details: 'Добро усогласена со стандарди' },
            engagement: { status: 'Excellent', details: 'Висока ангажираност' },
            cognitiveLevels: { status: 'Good', details: 'Покрива повеќе нивоа' },
        },
    };

    it('parses a valid pedagogical analysis', () => {
        expect(AIPedagogicalAnalysisSchema.safeParse(validAnalysis).success).toBe(true);
    });

    it('rejects analysis missing nested fields', () => {
        expect(AIPedagogicalAnalysisSchema.safeParse({ pedagogicalAnalysis: {} }).success).toBe(false);
    });
});

// ─── AIGeneratedThematicPlanSchema ────────────────────────────────────────────

describe('AIGeneratedThematicPlanSchema', () => {
    const validPlan = {
        thematicUnit: 'Геометрија',
        lessons: [
            {
                lessonNumber: 1,
                lessonUnit: 'Правоаголник',
                learningOutcomes: 'Да го пресмета периметарот',
                keyActivities: 'Мерење',
                assessment: 'Квиз',
            },
        ],
    };

    it('parses a valid thematic plan', () => {
        expect(AIGeneratedThematicPlanSchema.safeParse(validPlan).success).toBe(true);
    });

    it('coerces lessonNumber from string to number (FlexibleNumber)', () => {
        const withStringNum = {
            ...validPlan,
            lessons: [{ ...validPlan.lessons[0], lessonNumber: '2' }],
        };
        const result = AIGeneratedThematicPlanSchema.safeParse(withStringNum);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(typeof result.data.lessons[0].lessonNumber).toBe('number');
            expect(result.data.lessons[0].lessonNumber).toBe(2);
        }
    });

    it('rejects plan without thematicUnit', () => {
        const { thematicUnit: _t, ...noUnit } = validPlan;
        expect(AIGeneratedThematicPlanSchema.safeParse(noUnit).success).toBe(false);
    });
});

// ─── DailyBriefSchema ─────────────────────────────────────────────────────────

describe('DailyBriefSchema', () => {
    const validBrief = {
        summary: 'Денес имате 3 ученика со слаби резултати на квизот.',
        priority: 'high' as const,
    };

    it('parses a valid brief without primaryAction', () => {
        expect(DailyBriefSchema.safeParse(validBrief).success).toBe(true);
    });

    it('parses a valid brief with full primaryAction', () => {
        const withAction = {
            ...validBrief,
            primaryAction: { label: 'Провери', conceptId: 'c1', conceptTitle: 'Разломки' },
        };
        expect(DailyBriefSchema.safeParse(withAction).success).toBe(true);
    });

    it('parses a brief with partial primaryAction (only label)', () => {
        const withPartial = { ...validBrief, primaryAction: { label: 'Провери' } };
        expect(DailyBriefSchema.safeParse(withPartial).success).toBe(true);
    });

    it.each(['high', 'medium', 'low'])('accepts priority: %s', (priority) => {
        expect(DailyBriefSchema.safeParse({ ...validBrief, priority }).success).toBe(true);
    });

    it('rejects invalid priority value', () => {
        expect(DailyBriefSchema.safeParse({ ...validBrief, priority: 'critical' }).success).toBe(false);
    });

    it('rejects brief without summary', () => {
        const { summary: _s, ...noSummary } = validBrief;
        expect(DailyBriefSchema.safeParse(noSummary).success).toBe(false);
    });

    it('rejects brief without priority', () => {
        const { priority: _p, ...noPriority } = validBrief;
        expect(DailyBriefSchema.safeParse(noPriority).success).toBe(false);
    });

    it('rejects primaryAction missing label', () => {
        const bad = { ...validBrief, primaryAction: { conceptId: 'c1' } };
        expect(DailyBriefSchema.safeParse(bad).success).toBe(false);
    });
});

// ─── WorkedExampleSchema ──────────────────────────────────────────────────────
// Reflects AIGeneratedWorkedExample + WorkedExampleStep from types.ts

describe('WorkedExampleSchema', () => {
    const validExample = {
        concept: 'Питагорова теорема',
        gradeLevel: 8,
        steps: [
            { phase: 'solved', title: 'Погледни — решено заедно', problem: 'Дадени a=3, b=4. Најди c.', solution: ['c² = a² + b²', 'c² = 9+16 = 25', 'c = 5'] },
            { phase: 'partial', title: 'Заврши го ти', problem: 'Дадени a=5, b=12. Најди c.', solution: ['c² = a² + b²'], partialPlaceholder: 'Твој ред — заврши го решението' },
            { phase: 'quiz', title: 'Самостојно!', problem: 'Дадени a=6, b=8. Најди c.' },
        ],
    };

    it('parses a complete 3-phase worked example', () => {
        expect(WorkedExampleSchema.safeParse(validExample).success).toBe(true);
    });

    it('parses a single-step example (min 1 step)', () => {
        const single = { ...validExample, steps: [validExample.steps[0]] };
        expect(WorkedExampleSchema.safeParse(single).success).toBe(true);
    });

    it('allows quiz step without solution (optional)', () => {
        expect(WorkedExampleSchema.safeParse(validExample).success).toBe(true);
    });

    it('rejects example without concept', () => {
        const { concept: _c, ...noConcept } = validExample;
        expect(WorkedExampleSchema.safeParse(noConcept).success).toBe(false);
    });

    it('rejects example without gradeLevel', () => {
        const { gradeLevel: _g, ...noGrade } = validExample;
        expect(WorkedExampleSchema.safeParse(noGrade).success).toBe(false);
    });

    it('rejects example without steps', () => {
        const { steps: _s, ...noSteps } = validExample;
        expect(WorkedExampleSchema.safeParse(noSteps).success).toBe(false);
    });

    it('rejects empty steps array', () => {
        expect(WorkedExampleSchema.safeParse({ ...validExample, steps: [] }).success).toBe(false);
    });

    it('rejects step with invalid phase', () => {
        const bad = { ...validExample, steps: [{ phase: 'unknown', title: 'T', problem: 'P' }] };
        expect(WorkedExampleSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects step without title', () => {
        const bad = { ...validExample, steps: [{ phase: 'solved', problem: 'P' }] };
        expect(WorkedExampleSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects step without problem', () => {
        const bad = { ...validExample, steps: [{ phase: 'solved', title: 'T' }] };
        expect(WorkedExampleSchema.safeParse(bad).success).toBe(false);
    });
});

// ─── ReflectionSummarySchema ──────────────────────────────────────────────────

describe('ReflectionSummarySchema', () => {
    const validReflection = {
        wentWell: 'Учениците беа многу ангажирани во групната работа.',
        challenges: 'Некои ученици имаа потешкотии со отворен тип прашања.',
        nextSteps: 'Подготви диференцирани работни листови за следниот час.',
    };

    it('parses a valid reflection', () => {
        expect(ReflectionSummarySchema.safeParse(validReflection).success).toBe(true);
    });

    it('rejects reflection without wentWell', () => {
        const { wentWell: _w, ...noWentWell } = validReflection;
        expect(ReflectionSummarySchema.safeParse(noWentWell).success).toBe(false);
    });

    it('rejects reflection without challenges', () => {
        const { challenges: _c, ...noChallenges } = validReflection;
        expect(ReflectionSummarySchema.safeParse(noChallenges).success).toBe(false);
    });

    it('rejects reflection without nextSteps', () => {
        const { nextSteps: _n, ...noNextSteps } = validReflection;
        expect(ReflectionSummarySchema.safeParse(noNextSteps).success).toBe(false);
    });

    it('rejects empty object', () => {
        expect(ReflectionSummarySchema.safeParse({}).success).toBe(false);
    });

    it('rejects reflection with non-string fields', () => {
        expect(ReflectionSummarySchema.safeParse({ wentWell: 1, challenges: 2, nextSteps: 3 }).success).toBe(false);
    });
});
