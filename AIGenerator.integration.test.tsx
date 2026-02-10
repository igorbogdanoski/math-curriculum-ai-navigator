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
        getItem(key: string) { return store[key] || null; },
        setItem(key: string, value: string) { store[key] = value.toString(); },
        clear() { store = {}; },
        removeItem(key: string) { delete store[key]; }
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Integration Test: AI Generator Flow', () => {

    beforeEach(() => {
        vi.clearAllMocks(); // Moved to the top
        localStorageMock.clear();
        window.location.hash = '/'; // Reset hash before each test

        // Mock a successful assessment generation
        const mockAssessment: AIGeneratedAssessment = {
            title: 'AI Генериран Тест за Броеви',
            type: 'TEST',
            questions: [
                { type: QuestionType.SHORT_ANSWER, question: 'Колку е 2+2?', answer: '4', cognitiveLevel: 'Remembering' }
            ]
        };
        vi.mocked(geminiService.generateAssessment).mockResolvedValue(mockAssessment);

        // Add mocks for APIs called on the initial homepage render to prevent a crash
        vi.mocked(geminiService.generateProactiveSuggestion).mockResolvedValue("Mock suggestion text");
        vi.mocked(geminiService.getPersonalizedRecommendations).mockResolvedValue([]);
    });

    it('allows a user to open the generator, generate a test, and see the result', async () => {
        render(<App />);

        // 1. Log in (simplified)
        fireEvent.change(screen.getByLabelText(/лозинка/i), { target: { value: 'password' } });
        fireEvent.click(screen.getByRole('button', { name: /најави се/i }));
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Добредојдовте/i })).not.toBeNull();
        });

        // 2. Open the AI Generator panel via the sidebar
        const generatorButton = screen.getByRole('link', { name: /генератор/i });
        fireEvent.click(generatorButton);

        // 3. Wait for the panel to appear and verify its title
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /ai генератор/i })).not.toBeNull();
        });

        // 4. Interact with the form inside the generator
        // Select 'Тест/Лист' as material type
        const assessmentButton = screen.getByRole('button', { name: /тест\/лист/i });
        fireEvent.click(assessmentButton);

        // We will use the default context (Grade VI, Topic "Броеви"), so no need to change selects.

        // 5. Click the "Generate with AI" button
        const generateButton = screen.getByRole('button', { name: /генерирај со ai/i });
        expect((generateButton as HTMLButtonElement).disabled).toBe(false); // Ensure button is enabled
        fireEvent.click(generateButton);

        // 6. Verify that the loading state appears
        await waitFor(() => {
            expect(screen.getByText(/генерирам.../i)).not.toBeNull();
        });

        // 7. Verify the geminiService was called
        expect(geminiService.generateAssessment).toHaveBeenCalled();

        // 8. Verify the generated assessment is displayed
        await waitFor(() => {
            // Check for the title of the generated assessment
            expect(screen.getByText('AI Генериран Тест за Броеви')).not.toBeNull();
            // Check for a question from the mock response
            expect(screen.getByText(/колку е 2\+2/i)).not.toBeNull();
        }, { timeout: 3000 }); // Increase timeout to allow for mock latency
    });
});