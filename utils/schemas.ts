
import { z } from 'zod';

// Helper for flexible numbers (sometimes AI returns "5" instead of 5)
const FlexibleNumber = z.union([z.number(), z.string().transform((val) => Number(val))]);

export const LessonPlanSchema = z.object({
    title: z.string().default('Untitled Lesson Plan'),
    objectives: z.array(z.string()).default([]),
    assessmentStandards: z.array(z.string()).default([]),
    scenario: z.object({
        introductory: z.string().default(''),
        main: z.array(z.string()).default([]),
        concluding: z.string().default('')
    }).default({ introductory: '', main: [], concluding: '' }),
    materials: z.array(z.string()).default([]),
    progressMonitoring: z.array(z.string()).default([]),
    differentiation: z.string().default(''),
    reflectionPrompt: z.string().optional(),
    selfAssessmentPrompt: z.string().optional()
});

export const AIGeneratedIdeasSchema = z.object({
    title: z.string(),
    openingActivity: z.string(),
    mainActivity: z.string(),
    differentiation: z.string(),
    assessmentIdea: z.string()
});

const AssessmentQuestionSchema = z.object({
    type: z.string(),
    question: z.string(),
    options: z.array(z.string()).optional(),
    answer: z.string(),
    solution: z.string().optional(), // Step-by-step solution
    cognitiveLevel: z.string().optional(),
    difficulty_level: z.string().optional(),
    alignment_justification: z.string().optional(),
    concept_evaluated: z.string().optional()
});

export const AIGeneratedAssessmentSchema = z.object({
    title: z.string(),
    type: z.enum(['TEST', 'WORKSHEET', 'QUIZ', 'FLASHCARDS']).default('TEST'),
    questions: z.array(AssessmentQuestionSchema),
    selfAssessmentQuestions: z.array(z.string()).optional(),
    alignment_goal: z.string().optional(),
    differentiationLevel: z.string().optional(),
    differentiatedVersions: z.array(z.object({
        profileName: z.string(),
        questions: z.array(AssessmentQuestionSchema)
    })).optional()
});

export const RubricLevelSchema = z.object({
    levelName: z.string(),
    description: z.string(),
    points: z.string()
});

export const RubricCriterionSchema = z.object({
    criterion: z.string(),
    levels: z.array(RubricLevelSchema)
});

export const AIGeneratedRubricSchema = z.object({
    title: z.string(),
    criteria: z.array(RubricCriterionSchema)
});

export const AIGeneratedThematicPlanSchema = z.object({
    thematicUnit: z.string(),
    lessons: z.array(z.object({
        lessonNumber: FlexibleNumber,
        lessonUnit: z.string(),
        learningOutcomes: z.string(),
        keyActivities: z.string(),
        assessment: z.string()
    }))
});

export const CoverageAnalysisSchema = z.object({
    analysis: z.array(z.object({
        gradeLevel: FlexibleNumber,
        coveredStandardIds: z.array(z.string()).default([]),
        partiallyCoveredStandards: z.array(z.object({
            id: z.string(),
            reason: z.string()
        })).default([]),
        uncoveredStandardIds: z.array(z.string()).default([]),
        summary: z.string(),
        totalStandardsInGrade: FlexibleNumber
    }))
});

export const AIRecommendationSchema = z.array(z.object({
    category: z.string(), // Relaxed from strict enum to string to prevent validation errors
    title: z.string(),
    recommendationText: z.string(),
    action: z.object({
        label: z.string(),
        path: z.string(),
        params: z.record(z.string()).optional()
    }).optional()
}));

export const AIGeneratedPracticeMaterialSchema = z.object({
    title: z.string(),
    items: z.array(z.object({
        type: z.string(),
        text: z.string(),
        answer: z.string().optional(),
        solution: z.string().optional() // Step-by-step solution
    })).default([])
});

export const AIGeneratedLearningPathsSchema = z.object({
    title: z.string(),
    paths: z.array(z.object({
        profileName: z.string(),
        steps: z.array(z.object({
            stepNumber: FlexibleNumber,
            activity: z.string(),
            type: z.enum(['Introductory', 'Practice', 'Consolidation', 'Assessment', 'Project'])
        }))
    }))
});

export const AIPedagogicalAnalysisSchema = z.object({
    pedagogicalAnalysis: z.object({
        overallImpression: z.string(),
        alignment: z.object({ status: z.string(), details: z.string() }),
        engagement: z.object({ status: z.string(), details: z.string() }),
        cognitiveLevels: z.object({ status: z.string(), details: z.string() })
    })
});

export const AnnualPlanSchema = z.array(z.object({
    date: z.string(),
    title: z.string(),
    description: z.string()
}));
