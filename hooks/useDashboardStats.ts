import { useMemo } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { useCurriculum } from './useCurriculum';
import { PlannerItemType } from '../types';
import type { PlannerItem, LessonPlan, Grade, Topic, Concept, NationalStandard } from '../types';

export function useDashboardStats() {
    const { items, lessonPlans, isLoading: isPlannerLoading } = usePlanner();
    const { curriculum, allNationalStandards, isLoading: isCurriculumLoading } = useCurriculum();

    const monthlyActivity = useMemo(() => {
        const monthData: { [key: string]: { label: string; sortKey: number; lessons: number; events: number } } = {};

        items.forEach((item: PlannerItem) => {
            const itemDate = new Date(item.date);
            const year = itemDate.getFullYear();
            const monthIndex = itemDate.getMonth();
            const sortKey = year * 100 + monthIndex;
            const label = itemDate.toLocaleString('mk-MK', { month: 'short', year: '2-digit' });
    
            if (!monthData[sortKey]) {
                monthData[sortKey] = { label, sortKey, lessons: 0, events: 0 };
            }
            if (item.type === PlannerItemType.LESSON) {
                monthData[sortKey].lessons++;
            } else {
                monthData[sortKey].events++;
            }
        });
    
        const sortedData = Object.values(monthData).sort((a, b) => a.sortKey - b.sortKey);
        
        const labels = sortedData.map(d => d.label);
        const lessonsData = sortedData.map(d => d.lessons);
        const eventsData = sortedData.map(d => d.events);

        return {
            labels,
            datasets: [
                { label: 'Часови', data: lessonsData, backgroundColor: '#1976D2' },
                { label: 'Настани/Празници', data: eventsData, backgroundColor: '#90CAF9' },
            ],
        };

    }, [items]);
    
    const topicCoverage = useMemo(() => {
        if (!lessonPlans.length || !curriculum) return { labels: [], datasets: [] };
        
        const topicCounts: { [key: string]: { count: number; title: string } } = {};

        lessonPlans.forEach((plan: LessonPlan) => {
            if (plan.topicId) {
                if (!topicCounts[plan.topicId]) {
                    topicCounts[plan.topicId] = { count: 0, title: 'Непозната Тема' };
                }
                topicCounts[plan.topicId].count++;
            }
        });

        curriculum.grades.forEach((grade: Grade) => {
            grade.topics.forEach((topic: Topic) => {
                if (topicCounts[topic.id]) {
                    topicCounts[topic.id].title = topic.title;
                }
            });
        });
        
        const labels = Object.values(topicCounts).map(t => t.title);
        const data = Object.values(topicCounts).map(t => t.count);

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#0D47A1', '#1976D2', '#42A5F5', '#90CAF9', '#FFC107', '#4CAF50', '#9C27B0', '#F44336'],
            }]
        };

    }, [lessonPlans, curriculum]);

    const overallStats = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        const pastLessons = items.filter((item: PlannerItem) => 
            item.type === PlannerItemType.LESSON && new Date(item.date) < today
        );
        const reflectedLessons = pastLessons.filter((item: PlannerItem) => !!item.reflection).length;
        const reflectionRate = pastLessons.length > 0 ? Math.round((reflectedLessons / pastLessons.length) * 100) : 0;
        
        const coveredStandardIds = new Set<string>();
        const conceptIdsInPlans = new Set(lessonPlans.flatMap((p: LessonPlan) => p.conceptIds));
        
        // Per grade coverage
        const gradeCoverage: { [key: number]: { covered: number; total: number } } = {
            6: { covered: 0, total: 0 },
            7: { covered: 0, total: 0 },
            8: { covered: 0, total: 0 },
            9: { covered: 0, total: 0 }
        };

        const stdToGrade: { [stdId: string]: number } = {};
        allNationalStandards?.forEach((std: NationalStandard) => {
            if (std.gradeLevel != null) {
                stdToGrade[std.id] = std.gradeLevel;
                if (gradeCoverage[std.gradeLevel]) {
                    gradeCoverage[std.gradeLevel].total++;
                }
            }
        });

        curriculum?.grades.forEach((grade: Grade) => {
            grade.topics.forEach((topic: Topic) => {
                topic.concepts.forEach((concept: Concept) => {
                    if (conceptIdsInPlans.has(concept.id)) {
                        concept.nationalStandardIds.forEach((stdId: string) => {
                            if (!coveredStandardIds.has(stdId)) {
                                coveredStandardIds.add(stdId);
                                const gLevel = stdToGrade[stdId];
                                if (gLevel && gradeCoverage[gLevel]) {
                                    gradeCoverage[gLevel].covered++;
                                }
                            }
                        });
                    }
                });
            });
        });
        
        const totalStandards = allNationalStandards?.length || 0;
        const standardsCoverage = totalStandards > 0 ? Math.round((coveredStandardIds.size / totalStandards) * 100) : 0;
        
        // Final grade percentages
        const gradePercentages = Object.entries(gradeCoverage).map(([grade, data]) => ({
            grade: Number(grade),
            percentage: data.total > 0 ? Math.round((data.covered / data.total) * 100) : 0
        }));

        return {
            totalPlans: lessonPlans.length,
            reflectionRate,
            standardsCoverage,
            gradePercentages
        };
    }, [items, lessonPlans, curriculum, allNationalStandards]);

    const isLoading = isCurriculumLoading || isPlannerLoading;

    return { monthlyActivity, topicCoverage, overallStats, isLoading };
}