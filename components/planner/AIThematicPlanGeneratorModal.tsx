import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../contexts/PlannerContext';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useNotification } from '../../contexts/NotificationContext';
import { geminiService } from '../../services/geminiService';
import type { Grade, Topic, ThematicPlanLesson, AIGeneratedThematicPlan } from '../../types';
import { ICONS } from '../../constants';
import { OfficialThematicPlanTable } from './OfficialThematicPlanTable';

interface AIThematicPlanGeneratorModalProps {
    hideModal: () => void;
}

export const AIThematicPlanGeneratorModal: React.FC<AIThematicPlanGeneratorModalProps> = ({ hideModal }) => {
    const { curriculum } = useCurriculum();
    const { addNotification } = useNotification();
    
    const [selectedGradeId, setSelectedGradeId] = useState<string>(curriculum?.grades[0]?.id || '');
    const [selectedTopicId, setSelectedTopicId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<AIGeneratedThematicPlan | null>(null);
    const [viewMode, setViewMode] = useState<'preview' | 'official'>('official');

    const selectedGradeObj = useMemo(() => 
        curriculum?.grades.find(g => g.id === selectedGradeId), 
    [curriculum, selectedGradeId]);

    const topicsForGrade = useMemo(() => selectedGradeObj?.topics || [], [selectedGradeObj]);

    const selectedTopicObj = useMemo(() => 
        topicsForGrade.find(t => t.id === selectedTopicId), 
    [topicsForGrade, selectedTopicId]);

    const handleGradeChange = (gradeId: string) => {
        setSelectedGradeId(gradeId);
        const grade = curriculum?.grades.find(g => g.id === gradeId);
        if (grade && grade.topics.length > 0) {
            setSelectedTopicId(grade.topics[0].id);
        } else {
            setSelectedTopicId('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGradeObj || !selectedTopicObj) {
            addNotification('Ве молиме изберете валидно одделение и тема.', 'error');
            return;
        }
        
        setIsLoading(true);
        try {
            const plan = await geminiService.generateThematicPlan(selectedGradeObj, selectedTopicObj);
            setGeneratedPlan(plan);
        } catch (error) {
            addNotification((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        if (isLoading) {
             return (
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">AI асистентот ја анализира темата и ги креира наставните единици... Ова може да потрае неколку моменти.</p>
                </div>
            );
        }

        if (generatedPlan) {
            if (viewMode === 'official') {
                return (
                    <div className="p-4 max-h-[70vh] overflow-y-auto bg-gray-100">
                        <OfficialThematicPlanTable 
                            data={generatedPlan} 
                            grade={selectedGradeObj} 
                            topic={selectedTopicObj} 
                        />
                    </div>
                );
            }

            return (
                 <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4 text-brand-primary">{generatedPlan.thematicUnit}</h3>
                    <div className="max-h-[60vh] overflow-y-auto overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Час</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наставна единица</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цели</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Активности</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Оценување</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {Array.isArray(generatedPlan.lessons) && generatedPlan.lessons.map((lesson: ThematicPlanLesson) => (
                                    <tr key={lesson.lessonNumber}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{lesson.lessonNumber}</td>
                                        <td className="px-4 py-2 whitespace-normal text-sm text-gray-800 font-semibold">{lesson.lessonUnit}</td>
                                        <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.learningOutcomes}</td>
                                        <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.keyActivities}</td>
                                        <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.assessment}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>
            );
        }

        return (
            <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">Изберете одделение и тема, а AI асистентот ќе ви генерира предлог-план со наставни единици, цели и активности за целата тема.</p>
                    <div>
                        <label htmlFor="grade-select" className="block text-sm font-medium text-gray-700">Одделение</label>
                        <select id="grade-select" value={selectedGradeId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleGradeChange(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                            {curriculum?.grades.map((g: Grade) => <option key={g.id} value={g.id}>{g.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700">Тематска целина</label>
                        <select id="topic-select" value={selectedTopicId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTopicId(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md" disabled={topicsForGrade.length === 0}>
                             <option value="">-- Избери тема --</option>
                             {topicsForGrade.map((t: Topic) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="flex justify-end items-center bg-gray-50 p-4 rounded-b-lg">
                    <button type="button" onClick={hideModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 mr-3">
                        Откажи
                    </button>
                    <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary" disabled={!selectedTopicId || isLoading}>
                        {isLoading ? 'Генерирам...' : 'Генерирај тематски план'}
                    </button>
                </div>
            </form>
        );
    };

    const renderFooter = () => {
         if (isLoading || !generatedPlan) return null;

         return (
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-b-lg">
                 <div className="flex gap-2">
                     <button type="button" onClick={() => setGeneratedPlan(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                         Назад
                     </button>
                     <button 
                         type="button" 
                         onClick={() => setViewMode(viewMode === 'official' ? 'preview' : 'official')} 
                         className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                     >
                         <ICONS.eye className="w-4 h-4" />
                         {viewMode === 'official' ? 'Поедноставен приказ' : 'Официјален формат'}
                     </button>
                 </div>
                 <div className="flex gap-2">
                     <button 
                         type="button" 
                         onClick={() => window.print()} 
                         className="px-4 py-2 bg-brand-accent text-white rounded-lg shadow hover:bg-opacity-90 flex items-center gap-2"
                     >
                         <ICONS.printer className="w-4 h-4" />
                         Испечати
                     </button>
                     <button type="button" onClick={hideModal} className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary">
                         Затвори
                     </button>
                 </div>
             </div>
         );
    };

    if (!curriculum) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={hideModal} role="dialog" aria-modal="true" aria-labelledby="ai-thematic-plan-title">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full overflow-hidden" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <div className="flex justify-between items-center">
                        <h2 id="ai-thematic-plan-title" className="text-2xl font-bold text-brand-primary flex items-center gap-2">
                            <ICONS.sparkles className="w-6 h-6" />
                            AI Генератор на Тематски План
                        </h2>
                        <button type="button" onClick={hideModal} className="p-1 rounded-full hover:bg-gray-200" aria-label="Затвори модал">
                            <ICONS.close className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto max-h-[85vh]">
                    {renderContent()}
                    {renderFooter()}
                </div>
            </div>
        </div>
    );
};