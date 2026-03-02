import { describe, it, expect } from 'vitest';
import {
    BloomsLevelSchema,
    LessonPlanSchema,
    AIGeneratedAssessmentSchema,
    AIGeneratedRubricSchema,
    AIRecommendationSchema,
    AIPedagogicalAnalysisSchema,
    AIGeneratedThematicPlanSchema,
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
