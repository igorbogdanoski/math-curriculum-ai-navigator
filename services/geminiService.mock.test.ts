// Tests for the mock Gemini service.
// Ensures the mock returns data in the expected shape for frontend dev/testing.

import { describe, it, expect } from 'vitest';
import { mockGeminiService } from './geminiService.mock';
import { PlannerItemType, QuestionType } from '../types';
import type { Concept, Topic, Grade, GenerationContext, AIPedagogicalAnalysis } from '../types';

const mockConcept: Concept = {
    id: 'test-concept',
    title: 'Питагорова теорема',
    description: '',
    priorKnowledgeIds: [],
    assessmentStandards: [],
    nationalStandardIds: [],
};
const mockTopic: Topic = { id: 'test-topic', title: 'Геометрија', description: '', concepts: [] };
const mockTopic2: Topic = { id: 'test-topic-2', title: 'Алгебра', description: '', concepts: [] };
// generateAnnualPlan needs at least 2 topics (mock accesses grade.topics[0] and grade.topics[1])
const mockGrade: Grade = {
    id: 'grade-8',
    level: 8,
    title: 'VIII Одделение',
    topics: [mockTopic, mockTopic2],
};
const mockProfile = { name: 'Тест Наставник', style: 'Constructivist', experienceLevel: 'Expert' } as const;

describe('mockGeminiService', () => {
    it('getChatResponse should return a mock string response', async () => {
        const response = await mockGeminiService.getChatResponse([{ role: 'user', text: 'Здраво' }], mockProfile);
        expect(typeof response).toBe('string');
        expect(response).toContain('AI асистент');
    });

    it('generateLessonPlanIdeas should return an AIGeneratedIdeas object', async () => {
        const ideas = await mockGeminiService.generateLessonPlanIdeas([mockConcept], mockTopic, 8, mockProfile);
        expect(ideas).toHaveProperty('title');
        expect(ideas).toHaveProperty('openingActivity');
        expect(ideas).toHaveProperty('mainActivity');
        expect(ideas).toHaveProperty('differentiation');
        expect(ideas).toHaveProperty('assessmentIdea');
        expect(ideas.error).toBeUndefined();
    });

    it('generateAssessment (ASSESSMENT type) should return non-empty questions', async () => {
        const mockContext: GenerationContext = {
            type: 'CONCEPT',
            grade: mockGrade,
            concepts: [mockConcept],
            topic: mockTopic,
        };
        const assessment = await mockGeminiService.generateAssessment(
            'ASSESSMENT', [QuestionType.MULTIPLE_CHOICE], 5, mockContext, mockProfile,
        );
        expect(assessment).toHaveProperty('title');
        expect(assessment.questions).toBeInstanceOf(Array);
        expect(assessment.questions.length).toBeGreaterThan(0);
        expect(assessment.questions[0]).toHaveProperty('type');
        expect(assessment.questions[0]).toHaveProperty('question');
        expect(assessment.questions[0]).toHaveProperty('answer');
        expect(assessment.error).toBeUndefined();
    });

    it('generateAssessment (QUIZ type) should return quiz questions', async () => {
        const mockContext: GenerationContext = {
            type: 'CONCEPT',
            grade: mockGrade,
            concepts: [mockConcept],
            topic: mockTopic,
        };
        const quiz = await mockGeminiService.generateAssessment(
            'QUIZ', [QuestionType.MULTIPLE_CHOICE], 3, mockContext, mockProfile,
        );
        expect(quiz).toHaveProperty('title');
        expect(quiz.questions.length).toBeGreaterThan(0);
        expect(quiz.error).toBeUndefined();
    });

    it('generateProactiveSuggestion should return a string containing the concept title', async () => {
        const suggestion = await mockGeminiService.generateProactiveSuggestion(mockConcept, mockProfile);
        expect(typeof suggestion).toBe('string');
        expect(suggestion).toContain(mockConcept.title);
    });

    it('generateAnnualPlan should return an array of planner items with lesson type', async () => {
        const plan = await mockGeminiService.generateAnnualPlan(
            mockGrade, '2024-09-01', '2025-06-10', '', { start: '', end: '' },
        );
        expect(plan).toBeInstanceOf(Array);
        expect(plan.length).toBeGreaterThan(0);
        expect(plan[0]).toHaveProperty('date');
        expect(plan[0]).toHaveProperty('title');
        expect(plan[0].type).toBe(PlannerItemType.LESSON);
    });

    it('generateDetailedLessonPlan should return a partial LessonPlan object', async () => {
        const mockContext: GenerationContext = {
            type: 'CONCEPT',
            grade: mockGrade,
            topic: mockTopic,
            concepts: [mockConcept],
        };
        const lessonPlan = await mockGeminiService.generateDetailedLessonPlan(mockContext, mockProfile);
        expect(lessonPlan).toHaveProperty('title');
        expect(lessonPlan).toHaveProperty('objectives');
        expect(lessonPlan).toHaveProperty('scenario');
        expect(lessonPlan.objectives).toBeInstanceOf(Array);
    });

    it('generateThematicPlan should return an AIGeneratedThematicPlan object', async () => {
        const plan = await mockGeminiService.generateThematicPlan(mockGrade, mockTopic);
        expect(plan).toHaveProperty('thematicUnit', mockTopic.title);
        expect(plan.lessons).toBeInstanceOf(Array);
        expect(plan.lessons.length).toBeGreaterThan(0);
        expect(plan.lessons[0]).toHaveProperty('lessonNumber');
        expect(plan.lessons[0]).toHaveProperty('lessonUnit');
    });

    it('generateRubric should return an AIGeneratedRubric with criteria', async () => {
        const rubric = await mockGeminiService.generateRubric(8, 'Тест Тема', 'Проект', [], mockProfile);
        expect(rubric).toHaveProperty('title');
        expect(rubric.criteria).toBeInstanceOf(Array);
        expect(rubric.criteria.length).toBeGreaterThan(0);
        expect(rubric.criteria[0]).toHaveProperty('criterion');
        expect(rubric.criteria[0].levels).toBeInstanceOf(Array);
        expect(rubric.error).toBeUndefined();
    });

    it('analyzeLessonPlan should return a pedagogical analysis object', async () => {
        const plan = { title: 'Час за Питагорова теорема' };
        const analysis: AIPedagogicalAnalysis = await mockGeminiService.analyzeLessonPlan(plan);
        expect(typeof analysis).toBe('object');
        expect(analysis).toHaveProperty('pedagogicalAnalysis');
        expect(analysis.pedagogicalAnalysis.overallImpression).toContain('Подготовката е многу добро осмислена');
    });
});
