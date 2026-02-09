import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { geminiService } from './services/geminiService';
import { AIGeneratedAssessment, QuestionType } from './types';

// Mock services and browser APIs
vi.mock('./services/geminiService');

const localStorageMock = (() => {
    let store: { [key: string]: string } = {};
    return {
        getItem(key: string) {
            return store[key] || null;
        },
        setItem(key: string, value: string) {
            store[key] = value.toString();
        },
        clear() {
            store = {};
        },
        removeItem(key: string) {
            delete store[key];
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});
window.confirm = vi.fn(() => true);

describe('Integration Test: Lesson Plan Creation Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Moved to the top
        localStorageMock.clear();
        
        // Mock the specific API call for this test's flow
        vi.mocked(geminiService.generateDetailedLessonPlan).mockResolvedValue({
            title: 'Mock Plan',
            objectives: [],
            assessmentStandards: [],
            scenario: { introductory: '', main: [], concluding: '' },
            materials: [],
            progressMonitoring: [],
        });

        // Add mocks for APIs called on the initial homepage render to prevent a crash
        vi.mocked(geminiService.generateProactiveSuggestion).mockResolvedValue("Mock suggestion text");
        vi.mocked(geminiService.getPersonalizedRecommendations).mockResolvedValue([]);

        window.location.hash = '/'; // Reset hash before each test
    });

    it('allows a user to navigate to the editor, create, save, and see the new lesson plan in the library', async () => {
        render(<App />);

        // 0. Log in
        fireEvent.change(screen.getByLabelText(/лозинка/i), { target: { value: 'password' } });
        fireEvent.click(screen.getByRole('button', { name: /најави се/i }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Добредојдовте/i })).not.toBeNull();
        });


        // 1. Navigate to "My Preparations"
        fireEvent.click(screen.getByRole('link', { name: /мои подготовки/i }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /мои подготовки/i })).not.toBeNull();
        });

        // 2. Click "Create New Preparation"
        fireEvent.click(screen.getByRole('button', { name: /креирај нова подготовка/i }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /креирај нова подготовка/i })).not.toBeNull();
        });

        // 3. Fill out the form
        const newPlanTitle = 'Интеграциски Тест - Нова Подготовка';
        const titleInput = screen.getByLabelText(/наслов на подготовка/i);
        const objectivesInput = screen.getByLabelText(/наставни цели/i);
        const gradeSelect = screen.getByLabelText(/одделение/i);
        const topicSelect = screen.getByLabelText(/тема/i);
        
        fireEvent.change(titleInput, { target: { value: newPlanTitle } });
        fireEvent.change(objectivesInput, { target: { value: 'Цел 1: Успешен тест' } });

        // Select Grade (wait for options to be available)
        await waitFor(() => {
            expect(screen.queryByText('VI Одделение')).not.toBeNull();
        });
        fireEvent.change(gradeSelect, { target: { value: '8' } }); // Select 8th grade
        
        // Select Topic (wait for options to populate based on grade)
        await waitFor(() => {
             expect(screen.queryByText('ГЕОМЕТРИЈА')).not.toBeNull();
        });
        fireEvent.change(topicSelect, { target: { value: 'g8-topic-geometry' } });

        // 4. Click "Save Preparation"
        fireEvent.click(screen.getByRole('button', { name: /зачувај подготовка/i }));

        // 5. Verify navigation back to the library and that the new plan is visible
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /мои подготовки/i })).not.toBeNull();
        });
        
        expect(screen.queryByText(newPlanTitle)).not.toBeNull();
        
        // 6. Verify success notification
        await waitFor(() => {
            expect(screen.queryByText(/подготовката е успешно креирана/i)).not.toBeNull();
        });
    });
});