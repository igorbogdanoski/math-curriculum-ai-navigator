import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboardStats } from './useDashboardStats';
import { usePlanner } from '../contexts/PlannerContext';
import { useCurriculum } from './useCurriculum';
import { PlannerItemType } from '../types';

// Mock dependencies
vi.mock('../contexts/PlannerContext');
vi.mock('./useCurriculum');

describe('useDashboardStats hook', () => {

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
    });

    it('should calculate monthlyActivity correctly', () => {
        vi.mocked(usePlanner).mockReturnValue({
            items: [
                { id: '1', date: '2024-09-05', type: PlannerItemType.LESSON, title: 'L1' },
                { id: '2', date: '2024-09-15', type: PlannerItemType.EVENT, title: 'E1' },
                { id: '3', date: '2024-10-02', type: PlannerItemType.LESSON, title: 'L2' },
                { id: '4', date: '2024-10-03', type: PlannerItemType.LESSON, title: 'L3' },
            ],
            lessonPlans: [],
        } as any);

        vi.mocked(useCurriculum).mockReturnValue({
            curriculum: null,
            allNationalStandards: [],
        } as any);
        
        const { result } = renderHook(() => useDashboardStats());

        const { labels, datasets } = result.current.monthlyActivity;

        expect(labels).toEqual(['сеп. 24', 'окт. 24']);
        expect(datasets[0].data).toEqual([1, 2]); // lessons
        expect(datasets[1].data).toEqual([1, 0]); // events
    });

    it('should calculate topicCoverage correctly', () => {
        vi.mocked(usePlanner).mockReturnValue({
            items: [],
            lessonPlans: [
                { id: 'lp1', topicId: 'g6-topic-numbers', title: 'Plan 1' },
                { id: 'lp2', topicId: 'g6-topic-numbers', title: 'Plan 2' },
                { id: 'lp3', topicId: 'g6-topic-geometry', title: 'Plan 3' },
            ],
        } as any);

        vi.mocked(useCurriculum).mockReturnValue({
            curriculum: {
                grades: [{
                    level: 6,
                    topics: [
                        { id: 'g6-topic-numbers', title: 'Броеви' },
                        { id: 'g6-topic-geometry', title: 'Геометрија' },
                    ]
                }]
            },
            allNationalStandards: [],
        } as any);

        const { result } = renderHook(() => useDashboardStats());
        const { labels, datasets } = result.current.topicCoverage;

        // Order might not be guaranteed, so check for presence and values
        expect(labels).toContain('Броеви');
        expect(labels).toContain('Геометрија');
        const numbersIndex = labels.indexOf('Броеви');
        const geometryIndex = labels.indexOf('Геометрија');
        expect(datasets[0].data[numbersIndex]).toBe(2);
        expect(datasets[0].data[geometryIndex]).toBe(1);
    });

    it('should calculate overallStats correctly', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);

        vi.mocked(usePlanner).mockReturnValue({
            items: [
                { id: '1', date: yesterday.toISOString().split('T')[0], type: PlannerItemType.LESSON, title: 'L1', reflection: { wentWell: 'Yes', challenges: 'No', nextSteps: '' } },
                { id: '2', date: twoDaysAgo.toISOString().split('T')[0], type: PlannerItemType.LESSON, title: 'L2' },
            ],
            lessonPlans: [
                { id: 'lp1', conceptIds: ['g6-concept-sets'] },
                { id: 'lp2', conceptIds: ['g6-concept-natural-numbers-ext'] },
            ],
        } as any);

        vi.mocked(useCurriculum).mockReturnValue({
            curriculum: {
                grades: [{
                    level: 6,
                    topics: [{
                        id: 'g6-topic-numbers',
                        concepts: [
                            { id: 'g6-concept-sets', nationalStandardIds: ['M-6-A'] },
                            { id: 'g6-concept-natural-numbers-ext', nationalStandardIds: ['M-6-A', 'M-6-B'] },
                            { id: 'g6-concept-roman-numerals', nationalStandardIds: ['M-6-C'] },
                        ]
                    }]
                }]
            },
            allNationalStandards: [
                { id: 'M-6-A' }, { id: 'M-6-B' }, { id: 'M-6-C' }, { id: 'M-6-D' }
            ],
        } as any);

        const { result } = renderHook(() => useDashboardStats());
        const { totalPlans, reflectionRate, standardsCoverage } = result.current.overallStats;

        expect(totalPlans).toBe(2);
        expect(reflectionRate).toBe(50); // 1 out of 2 past lessons has a reflection
        expect(standardsCoverage).toBe(50); // M-6-A and M-6-B are covered, out of 4 total standards. (2/4)
    });

    it('should handle empty data gracefully', () => {
        vi.mocked(usePlanner).mockReturnValue({
            items: [],
            lessonPlans: [],
        } as any);
         vi.mocked(useCurriculum).mockReturnValue({
            curriculum: { grades: [] },
            allNationalStandards: [],
        } as any);
        
        const { result } = renderHook(() => useDashboardStats());

        expect(result.current.monthlyActivity.labels).toEqual([]);
        expect(result.current.topicCoverage.labels).toEqual([]);
        expect(result.current.overallStats.totalPlans).toBe(0);
        expect(result.current.overallStats.reflectionRate).toBe(0);
        expect(result.current.overallStats.standardsCoverage).toBe(0);
    });
});
