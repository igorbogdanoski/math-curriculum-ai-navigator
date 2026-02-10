// This file contains tests for the useCurriculum hook.
// It uses Vitest for the test running environment and Testing Library for rendering hooks.
// To run these tests, you would typically use a command like `npm test` or `vitest`.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { CurriculumProvider, useCurriculum } from './useCurriculum';
import { NotificationProvider } from '../contexts/NotificationContext';

// Mock the firestore service to prevent actual network calls and control data
vi.mock('../services/firestoreService', () => ({
    firestoreService: {
        fetchFullCurriculum: vi.fn().mockResolvedValue({}), // Mock returns empty, so local data is used
    },
}));


const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
        NotificationProvider,
        null,
        React.createElement(CurriculumProvider, null, children)
    );
};


describe('useCurriculum hook', () => {
    it('should throw an error if used outside of a CurriculumProvider', () => {
        // Suppress console.error for this specific test
        const originalError = console.error;
        console.error = vi.fn();
        expect(() => renderHook(() => useCurriculum())).toThrow('useCurriculum must be used within a CurriculumProvider');
        console.error = originalError;
    });

    it('should return the full curriculum data from local source', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.curriculum?.grades).toHaveLength(4);
        expect(result.current.curriculum?.grades[0].level).toBe(6);
        expect(result.current.allNationalStandards?.length).toBeGreaterThan(0);
    });

    it('should correctly retrieve a grade by ID', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const grade = result.current.getGrade('grade-7');
        expect(grade).toBeDefined();
        expect(grade?.level).toBe(7);
        expect(grade?.title).toBe('VII Одделение');
    });

    it('should return undefined for a non-existent grade ID', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const grade = result.current.getGrade('non-existent-grade');
        expect(grade).toBeUndefined();
    });

    it('should correctly retrieve a topic and its grade by topic ID', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const { grade, topic } = result.current.getTopic('g8-topic-geometry');
        expect(topic).toBeDefined();
        expect(grade).toBeDefined();
        expect(topic?.title).toBe('ГЕОМЕТРИЈА');
        expect(grade?.level).toBe(8);
    });

    it('should correctly retrieve concept details by concept ID', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const { grade, topic, concept } = result.current.getConceptDetails('g6-concept-sets');
        expect(concept).toBeDefined();
        expect(topic).toBeDefined();
        expect(grade).toBeDefined();
        expect(concept?.title).toBe('Множества');
        expect(topic?.id).toBe('g6-topic-numbers');
        expect(grade?.level).toBe(6);
    });

    it('should retrieve multiple national standards by their IDs', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const ids = ['M-6-III-A.1', 'M-7-III-A.1'];
        const standards = result.current.getStandardsByIds(ids);
        expect(standards).toHaveLength(2);
        expect(standards[0].code).toBe('III-А.1');
        expect(standards[1].gradeLevel).toBe(7);
    });

    it('should find the progression of a concept across all grades by matching base title', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        // Using "Цели броеви" which appears in grade 6 and 7
        const progression = result.current.findConceptAcrossGrades('g6-concept-integers-intro');
        expect(progression).toBeDefined();
        expect(progression?.title).toBe('Цели броеви');
        expect(progression?.progression).toHaveLength(2);
        expect(progression?.progression[0].grade).toBe(6);
        expect(progression?.progression[1].grade).toBe(7);
    });
    
    it('should return all unique concepts with grade level and topic ID', async () => {
        const { result } = renderHook(() => useCurriculum(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const allConcepts = result.current.allConcepts;
        expect(allConcepts.length).toBeGreaterThan(0);
        
        const firstConcept = allConcepts.find((c: any) => c.id === 'g6-concept-sets');
        expect(firstConcept).toBeDefined();
        expect(firstConcept?.gradeLevel).toBe(6);
        expect(firstConcept?.topicId).toBe('g6-topic-numbers');
    });
});