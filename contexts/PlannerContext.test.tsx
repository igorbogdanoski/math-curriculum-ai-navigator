// This file contains tests for the PlannerContext and usePlanner hook.
// It uses Vitest, Testing Library, and requires a mock for Firebase services.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { PlannerProvider, usePlanner } from './PlannerContext';
import { AuthContext } from './AuthContext';
import { PlannerItemType, type LessonPlan } from '../types';

// Mock Firebase services to avoid real database calls
vi.mock('../firebaseConfig', () => ({
    db: {},
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        collection: vi.fn(),
        onSnapshot: vi.fn((query, callback) => {
            // Immediately invoke callback with empty snapshot
            callback({ docs: [] }); 
            // Return a dummy unsubscribe function
            return () => {};
        }),
        addDoc: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
        doc: vi.fn(),
        setDoc: vi.fn().mockResolvedValue(undefined),
        deleteDoc: vi.fn().mockResolvedValue(undefined),
        updateDoc: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        writeBatch: vi.fn(),
        getDocs: vi.fn().mockResolvedValue({ docs: [] }),
        where: vi.fn(),
        deleteField: vi.fn(),
    };
});

// Minimal mock user for AuthContext
const mockFirebaseUser = { uid: 'test-user-123', emailVerified: true };

const wrapper: React.FC<{children: React.ReactNode}> = ({ children }) => (
    <AuthContext.Provider value={{ firebaseUser: mockFirebaseUser } as any}>
        <PlannerProvider>{children}</PlannerProvider>
    </AuthContext.Provider>
);

describe('usePlanner hook and PlannerContext', () => {

    beforeEach(() => {
       vi.clearAllMocks();
    });

    it('should load initial example community lesson plans', async () => {
        const { result } = renderHook(() => usePlanner(), { wrapper });
    
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.communityLessonPlans.length).toBeGreaterThan(0);
        expect(result.current.communityLessonPlans[0].title).toBe('Вовед во Питагорова теорема');
        expect(result.current.items.length).toBe(0); // User items start empty with mock
        expect(result.current.lessonPlans.length).toBe(0); // User plans start empty with mock
    });
    
    it('should add a new planner item', async () => {
        const { result } = renderHook(() => usePlanner(), { wrapper });
        
        const newItem = {
            type: PlannerItemType.EVENT,
            date: '2024-09-10',
            title: 'New Test Event'
        };
        
        await act(async () => {
            await result.current.addItem(newItem);
        });

        const { addDoc, collection } = await import('firebase/firestore');
        expect(collection).toHaveBeenCalledWith({}, 'users', 'test-user-123', 'plannerItems');
        expect(addDoc).toHaveBeenCalledWith(undefined, newItem);
    });

    it('should add a new lesson plan to user plans', async () => {
        const { result } = renderHook(() => usePlanner(), { wrapper });
        const newPlan: Omit<LessonPlan, 'id'> = {
            title: 'New Test Lesson Plan',
            grade: 9, topicId: 'g9-topic-numbers-ops', conceptIds: [], objectives: [],
            materials: [], subject: 'Математика', theme: '', assessmentStandards: [],
            scenario: { introductory: '', main: [], concluding: '' }, progressMonitoring: [],
        };
        
        let newPlanId = '';
        await act(async () => {
           newPlanId = await result.current.addLessonPlan(newPlan);
        });
        
        const { addDoc, collection } = await import('firebase/firestore');
        expect(collection).toHaveBeenCalledWith({}, 'users', 'test-user-123', 'lessonPlans');
        expect(addDoc).toHaveBeenCalledWith(undefined, newPlan);
        expect(newPlanId).toBe('new-doc-id');
    });

    it('should update an existing user lesson plan', async () => {
        const { result } = renderHook(() => usePlanner(), { wrapper });
        
        const planToUpdate: LessonPlan = { 
            id: 'plan1', title: 'To Be Updated', grade: 8, topicId: '', 
            conceptIds: [], objectives: [], materials: [], subject: '', theme: '', 
            assessmentStandards: [], scenario: { introductory: '', main: [], concluding: '' }, 
            progressMonitoring: [] 
        };

        await act(async () => {
            await result.current.updateLessonPlan(planToUpdate);
        });
        
        const { doc, setDoc } = await import('firebase/firestore');
        const { id, ...data } = planToUpdate;
        expect(doc).toHaveBeenCalledWith({}, 'users', 'test-user-123', 'lessonPlans', 'plan1');
        expect(setDoc).toHaveBeenCalledWith(undefined, data, { merge: true });
    });
});
