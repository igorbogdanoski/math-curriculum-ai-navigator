import React, { useState, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useCurriculum } from '../../hooks/useCurriculum';
import { usePlanner } from '../../contexts/PlannerContext';
import { useNotification } from '../../contexts/NotificationContext';
import { geminiService } from '../../services/geminiService';
import { ICONS } from '../../constants';
import { PlannerItemType, ModalType } from '../../types';

export const AIAnnualPlanGeneratorModal: React.FC = () => {
    const { hideModal, showModal } = useModal();
    const { curriculum } = useCurriculum();
    const { addItem } = usePlanner();
    const { addNotification } = useNotification();
    
    const [selectedGradeId, setSelectedGradeId] = useState<string>('');
    const [startDate, setStartDate] = useState('2024-09-02');
    const [endDate, setEndDate] = useState('2025-06-10');
    const [holidays, setHolidays] = useState('11 Октомври, 23 Октомври, 1 Мај, 24 Мај');
    const [winterBreakStart, setWinterBreakStart] = useState('2024-12-31');
    const [winterBreakEnd, setWinterBreakEnd] = useState('2025-01-20');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (curriculum?.grades?.[0]) {
            setSelectedGradeId(curriculum.grades[0].id);
        }
    }, [curriculum]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        const selectedGrade = curriculum?.grades.find(g => g.id === selectedGradeId);
        if (!selectedGrade) {
            addNotification('Ве молиме изберете одделение.', 'error');
            setIsLoading(false);
            return;
        }
        
        try {
            const generatedItems = await geminiService.generateAnnualPlan(selectedGrade, startDate, endDate, holidays, {start: winterBreakStart, end: winterBreakEnd});
            
            setIsLoading(false);

            showModal(ModalType.Confirm, {
                title: 'Додади годишен план',
                message: `AI генерираше предлог-план со ${generatedItems.length} теми. Дали сакате да го додадете во вашиот планер? Постоечките настани нема да бидат избришани.`,
                variant: 'info',
                confirmLabel: 'Да, додади',
                onConfirm: async () => {
                    hideModal();
                    try {
                        await Promise.all(generatedItems.map(item =>
                            addItem({
                                ...item,
                                type: PlannerItemType.LESSON,
                            })
                        ));
                        addNotification('Годишниот план е успешно додаден во планерот!', 'success');
                    } catch (addError) {
                        addNotification('Грешка при додавање на планот во планерот.', 'error');
                        console.error("Failed to add annual plan items:", addError);
                    }
                },
                onCancel: hideModal,
            });

        } catch (error) {
            addNotification((error as Error).message, 'error');
            setIsLoading(false);
        }
    };

    // Guard clause to prevent rendering with incomplete data, which could happen if curriculum is null
    if (!curriculum) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={hideModal} role="dialog" aria-modal="true" aria-labelledby="ai-plan-title">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8" onClick={e => e.stopPropagation()}>
                    <p className="text-center text-gray-600">Вчитување на податоците за наставната програма...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={hideModal} role="dialog" aria-modal="true" aria-labelledby="ai-plan-title">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <div className="flex justify-between items-center">
                            <h2 id="ai-plan-title" className="text-2xl font-bold text-brand-primary flex items-center gap-2">
                                <ICONS.sparkles className="w-6 h-6" />
                                AI Генератор на Годишен План
                            </h2>
                            <button type="button" onClick={hideModal} className="p-1 rounded-full hover:bg-gray-200" aria-label="Затвори модал">
                                <ICONS.close className="w-6 h-6 text-gray-600" />
                            </button>
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                            <p className="mt-4 text-gray-600">AI асистентот го анализира наставниот план и го креира вашиот годишен распоред... Ова може да потрае неколку моменти.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <p className="text-sm text-gray-600">Пополнете ги основните параметри за учебната година, а AI асистентот ќе генерира предлог распоред на темите во вашиот планер.</p>
                                <div>
                                    <label htmlFor="grade-select" className="block text-sm font-medium text-gray-700">Одделение</label>
                                    <select id="grade-select" value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                                        {curriculum.grades.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">Почеток на учебна година</label>
                                        <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 rounded-md" />
                                    </div>
                                    <div>
                                        <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">Крај на учебна година</label>
                                        <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 rounded-md" />
                                    </div>
                                </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="winter-start" className="block text-sm font-medium text-gray-700">Почеток на зимски распуст</label>
                                        <input type="date" id="winter-start" value={winterBreakStart} onChange={e => setWinterBreakStart(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 rounded-md" />
                                    </div>
                                    <div>
                                        <label htmlFor="winter-end" className="block text-sm font-medium text-gray-700">Крај на зимски распуст</label>
                                        <input type="date" id="winter-end" value={winterBreakEnd} onChange={e => setWinterBreakEnd(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 rounded-md" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="holidays" className="block text-sm font-medium text-gray-700">Празници и неработни денови (одделени со запирка)</label>
                                    <textarea id="holidays" value={holidays} onChange={e => setHolidays(e.target.value)} rows={2} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="пр. 11 Октомври, 8 Декември..."></textarea>
                                </div>
                            </div>
                            <div className="flex justify-end items-center bg-gray-50 p-4 rounded-b-lg">
                                <button type="button" onClick={hideModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 mr-3">
                                    Откажи
                                </button>
                                <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary">
                                    Генерирај предлог-план
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}