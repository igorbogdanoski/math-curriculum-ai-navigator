import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSearchBar } from './GlobalSearchBar';
import { useCurriculum } from '../../hooks/useCurriculum';
import { usePlanner } from '../../contexts/PlannerContext';
import { exampleLessonPlans } from '../../data/examples';
import { NavigationContext } from '../../contexts/NavigationContext';

// Mock the hooks
vi.mock('../../hooks/useCurriculum');
vi.mock('../../contexts/PlannerContext');

// Mock data
const mockConcepts = [
    { id: 'g8-concept-2d-forms-pythagoras', title: 'Питагорова теорема', description: 'Pythagorean theorem concept', gradeLevel: 8, topicId: 'g8-topic-geometry', priorKnowledgeIds: [], assessmentStandards: [], nationalStandardIds: [] },
    { id: 'g6-concept-sets', title: 'Множества', description: 'Sets concept', gradeLevel: 6, topicId: 'g6-topic-numbers', priorKnowledgeIds: [], assessmentStandards: [], nationalStandardIds: [] },
];

const mockTopics = [
    { id: 'g8-topic-geometry', title: 'Геометрија', description: '', concepts: [], gradeLevel: 8 },
];

const mockLessonPlans = exampleLessonPlans;
const mockNationalStandards = [
    { id: 'M-8-III-A.14', code: 'M-8-III-A.14', description: 'Решавање проблеми со Питагорова теорема', gradeLevel: 8 }
];

describe('GlobalSearchBar', () => {
    const navigate = vi.fn();

    const renderComponent = () => {
        return render(
            <NavigationContext.Provider value={{ navigate }}>
                <GlobalSearchBar />
            </NavigationContext.Provider>
        );
    };

    beforeEach(() => {
        vi.mocked(useCurriculum).mockReturnValue({
            allConcepts: mockConcepts as any,
            curriculum: {
                grades: [
                    {
                        id: 'grade-8',
                        level: 8,
                        title: 'VIII Одделение',
                        topics: mockTopics as any,
                    },
                ],
            } as any,
            isLoading: false,
            verticalProgression: null,
            allNationalStandards: mockNationalStandards as any,
            getGrade: vi.fn(),
            getTopic: vi.fn(),
            getConceptDetails: vi.fn(),
            getStandardsByIds: vi.fn(),
            findConceptAcrossGrades: vi.fn(),
        });

        vi.mocked(usePlanner).mockReturnValue({
            lessonPlans: mockLessonPlans,
            communityLessonPlans: [],
            items: [],
            isLoading: false,
            error: null,
            addItem: vi.fn().mockResolvedValue(undefined),
            updateItem: vi.fn().mockResolvedValue(undefined),
            deleteItem: vi.fn().mockResolvedValue(undefined),
            addOrUpdateReflection: vi.fn().mockResolvedValue(undefined),
            getLessonPlan: vi.fn(),
            addLessonPlan: vi.fn().mockResolvedValue('new-plan-id'),
            updateLessonPlan: vi.fn().mockResolvedValue(undefined),
            deleteLessonPlan: vi.fn().mockResolvedValue(undefined),
            publishLessonPlan: vi.fn().mockResolvedValue(undefined),
            importCommunityPlan: vi.fn().mockResolvedValue('imported-plan-id'),
            addRatingToCommunityPlan: vi.fn().mockResolvedValue(undefined),
            addCommentToCommunityPlan: vi.fn().mockResolvedValue(undefined),
            isUserPlan: vi.fn().mockReturnValue(true),
            importAnnualPlan: vi.fn().mockResolvedValue(undefined),
        });
        
        navigate.mockClear();
    });

    it('renders the search input', () => {
        renderComponent();
        expect(screen.getByPlaceholderText(/Пребарај/i)).not.toBeNull();
    });

    it('does not show results for a short query', () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/Пребарај/i);
        fireEvent.change(input, { target: { value: 'а' } });
        expect(screen.queryByRole('listitem')).toBeNull();
    });

    it('shows results when a valid query is typed', async () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/Пребарај/i);
        fireEvent.change(input, { target: { value: 'питагора' } });

        await waitFor(() => {
            expect(screen.getByText('Вовед во Питагорова теорема')).not.toBeNull();
            expect(screen.getByText('Питагорова теорема')).not.toBeNull();
        });
    });

    it('shows "no results" message for a non-matching query', async () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/Пребарај/i);
        fireEvent.change(input, { target: { value: 'xyznonexistent' } });
        
        await waitFor(() => {
            expect(screen.getByText(/Нема резултати за/i)).not.toBeNull();
        });
    });

    it('calls navigate with the correct path when a result is clicked', async () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/Пребарај/i);
        fireEvent.change(input, { target: { value: 'Питагорова' } });

        let resultItem;
        await waitFor(() => {
            resultItem = screen.getByText('Вовед во Питагорова теорема');
            expect(resultItem).not.toBeNull();
        });
        
        fireEvent.click(resultItem!);

        expect(navigate).toHaveBeenCalledWith('/planner/lesson/view/example-lp-1');
    });
    
    it('clears results and input when a result is clicked', async () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/Пребарај/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Питагорова' } });

        let resultItem;
        await waitFor(() => {
            resultItem = screen.getByText('Вовед во Питагорова теорема');
            expect(resultItem).not.toBeNull();
        });

        fireEvent.click(resultItem!);
        
        await waitFor(() => {
             expect(screen.queryByText('Вовед во Питагорова теорема')).toBeNull();
        });
       
        expect(input.value).toBe('');
    });

    it('hides results when clicking outside', async () => {
        render(
            <div>
                 <NavigationContext.Provider value={{ navigate }}>
                    <GlobalSearchBar />
                </NavigationContext.Provider>
                <div data-testid="outside">Outside Element</div>
            </div>
        );
        
        const input = screen.getByPlaceholderText(/Пребарај/i);
        fireEvent.change(input, { target: { value: 'питагора' } });

        await waitFor(() => {
            expect(screen.getByText('Питагорова теорема')).not.toBeNull();
        });

        fireEvent.mouseDown(screen.getByTestId('outside'));

        await waitFor(() => {
            expect(screen.queryByText('Питагорова теорема')).toBeNull();
        });
    });
});