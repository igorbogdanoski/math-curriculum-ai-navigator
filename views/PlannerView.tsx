import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { usePlanner } from '../contexts/PlannerContext';
import { DraggablePlannerItem } from '../components/planner/DraggablePlannerItem';
import { DroppableDayCell } from '../components/planner/DroppableDayCell';
import type { PlannerItem, LessonPlan, SharedAnnualPlan } from '../types';
import { PlannerItemType, ModalType } from '../types';
import { useModal } from '../contexts/ModalContext';
import { EmptyState } from '../components/common/EmptyState';
import { useNavigation } from '../contexts/NavigationContext';
import { shareService } from '../services/shareService';
import { useNotification } from '../contexts/NotificationContext';
import { PlannerAgendaView } from '../components/planner/PlannerAgendaView';
import { getWeekRange } from '../utils/date';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { plannerTourSteps } from '../tours/tour-steps';

declare var introJs: any;

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            active
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200'
        }`}
    >
        {children}
    </button>
);


export const PlannerView: React.FC = () => {
    const { navigate } = useNavigation();
    const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
    const [currentDate, setCurrentDate] = useState(new Date()); // Default to today
    const { items, updateItem, getLessonPlan, isLoading, lessonPlans } = usePlanner();
    const { showModal } = useModal();
    const { addNotification } = useNotification();
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
    const aiMenuRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
                setIsAiMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        // Only run tour if not seen AND data is fully loaded
        if (toursSeen.planner === true || typeof introJs === 'undefined' || isLoading) return;

        const timer = setTimeout(() => {
            const tour = introJs();
            tour.setOptions({
                steps: plannerTourSteps,
                showProgress: true,
                showBullets: true,
                showStepNumbers: true,
                nextLabel: 'Следно',
                prevLabel: 'Претходно',
                doneLabel: 'Готово',
                tooltipClass: 'custom-tooltip-class',
            });
            tour.oncomplete(() => markTourAsSeen('planner'));
            tour.onexit(() => markTourAsSeen('planner'));
            tour.start();
        }, 500); // Short delay for render

        return () => clearTimeout(timer);
    }, [toursSeen, markTourAsSeen, isLoading]);


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const itemToMove = items.find(item => item.id === active.id);
            const newDate = over.id as string;
            
            if (itemToMove && itemToMove.date !== newDate) {
                updateItem({ ...itemToMove, date: newDate });
            }
        }
    };

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    // Adjust for Monday start (0=Sunday, 1=Monday...) -> Monday=0, Sunday=6
    const startDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
    const weekDays = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед'];

    const changePeriod = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'month') {
                newDate.setMonth(prev.getMonth() + offset, 1);
            } else { // agenda view
                newDate.setDate(prev.getDate() + (offset * 7));
            }
            return newDate;
        });
    };

    const handleOpenModal = (item: Partial<PlannerItem> | null) => {
        showModal(ModalType.PlannerItem, { item });
    };

    const handleOpenReflectionModal = (item: PlannerItem) => {
        showModal(ModalType.LessonReflection, { item });
    };

    const handleItemClick = (item: PlannerItem) => {
        handleOpenModal(item);
    };
    
    const handleShareAnnualPlan = useCallback(() => {
        const lessonPlanIds = new Set<string>();
        items.forEach(item => {
            if (item.lessonPlanId) {
                lessonPlanIds.add(item.lessonPlanId);
            }
        });

        const lessonPlansToShare = Array.from(lessonPlanIds)
            .map(id => getLessonPlan(id))
            .filter((p): p is LessonPlan => p !== undefined);
            
        const dataToShare: SharedAnnualPlan = {
            items,
            lessonPlans: lessonPlansToShare,
        };

        const encodedData = shareService.generateAnnualShareData(dataToShare);
        if (!encodedData) {
            addNotification('Грешка при генерирање на линк.', 'error');
            return;
        }

        const url = `${window.location.origin}${window.location.pathname}#/share/annual/${encodedData}`;
        navigator.clipboard.writeText(url)
            .then(() => {
                addNotification('Линкот за споделување на годишниот план е копиран!', 'success');
            })
            .catch(() => {
                addNotification('Грешка при копирање на линкот.', 'error');
            });

    }, [items, getLessonPlan, addNotification]);

    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDayIndex });
    
    const hasItems = items.length > 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Calculate unscheduled plans
    // Find all plans that are NOT linked to any planner item
    const scheduledPlanIds = new Set(items.map(i => i.lessonPlanId).filter(Boolean));
    const unscheduledPlansCount = lessonPlans.filter(p => !scheduledPlanIds.has(p.id)).length;

    const renderPeriodHeader = () => {
        if (viewMode === 'month') {
            return currentDate.toLocaleString('mk-MK', { month: 'long', year: 'numeric' });
        }
        const { start, end } = getWeekRange(currentDate);
        return `Недела: ${start.toLocaleDateString('mk-MK')} - ${end.toLocaleDateString('mk-MK')}`;
    };

    const firstItemForTourId = useMemo(() => {
        const itemsInMonth = items
          .filter(item => {
            const itemDate = new Date(item.date);
            return itemDate.getFullYear() === currentDate.getFullYear() && itemDate.getMonth() === currentDate.getMonth();
          })
          .sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate());
        return itemsInMonth.length > 0 ? itemsInMonth[0].id : null;
    }, [items, currentDate]);

    const renderCalendarGrid = () => (
        <div data-tour="planner-calendar" className="grid grid-cols-7 gap-1">
            {weekDays.map(day => <div key={day} className="text-center font-bold text-gray-600 p-2 text-sm uppercase tracking-wide">{day}</div>)}
            
            {emptyDays.map((_, i) => <div key={`empty-${i}`} className="border rounded-md bg-gray-50 min-h-[120px]"></div>)}

            {calendarDays.map(day => {
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dateStr = dayDate.toISOString().split('T')[0];
                const itemsForDay = items.filter(item => item.date === dateStr);
                const isToday = dayDate.getTime() === today.getTime();
                const isPast = dayDate < today;

                return (
                    <DroppableDayCell key={day} dateStr={dateStr} onAdd={() => handleOpenModal({ date: dateStr })}>
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-semibold text-sm w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-primary text-white' : 'text-gray-500'}`}>{day}</span>
                            <button
                                onClick={() => handleOpenModal({ date: dateStr })}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-primary hover:bg-blue-100 rounded-full p-1"
                                aria-label={`Add event for ${dateStr}`}
                            >
                                <ICONS.plus className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="space-y-1 min-h-[80px]">
                            {itemsForDay.map((item) => {
                                 const canReflect = item.type === PlannerItemType.LESSON && isPast;
                                 return (
                                    <div key={item.id} data-tour={item.id === firstItemForTourId ? "planner-item" : undefined}>
                                        <DraggablePlannerItem 
                                            item={item} 
                                            onSelect={() => handleItemClick(item)}
                                            hasReflection={!!item.reflection}
                                            onAddReflection={canReflect ? () => handleOpenReflectionModal(item) : undefined}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </DroppableDayCell>
                );
            })}
        </div>
    );

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="p-8 animate-fade-in relative">
                <header data-tour="planner-header" className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                    <div>
                         <h1 className="text-4xl font-bold text-brand-primary">Дигитален планер</h1>
                         <div className="flex flex-wrap items-center gap-4 mt-4">
                            <div className="flex space-x-2">
                                <TabButton active={viewMode === 'month'} onClick={() => setViewMode('month')}>Месечен преглед</TabButton>
                                <TabButton active={viewMode === 'agenda'} onClick={() => setViewMode('agenda')}>Неделен преглед (Агенда)</TabButton>
                            </div>
                            {unscheduledPlansCount > 0 && (
                                <div className="flex items-center gap-2 text-sm bg-amber-50 px-4 py-2 rounded-full border border-amber-200 animate-pulse-slow shadow-sm">
                                    <ICONS.lightbulb className="w-4 h-4 text-amber-600" />
                                    <span className="text-amber-900 font-medium">
                                        Имате <span className="font-bold">{unscheduledPlansCount}</span> нераспоредени подготовки.
                                    </span>
                                    <button 
                                        onClick={() => navigate('/my-lessons')} 
                                        className="text-brand-secondary hover:text-brand-primary font-bold ml-1 underline decoration-dotted"
                                    >
                                        Закажи ги сега
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div data-tour="planner-add-buttons" className="flex items-center space-x-2 flex-wrap gap-2 justify-end">
                         <button 
                            onClick={handleShareAnnualPlan}
                            className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
                        >
                            <ICONS.share className="w-5 h-5 mr-1" />
                            Сподели годишен план
                        </button>
                        <button 
                            onClick={() => navigate('/planner/lesson/new')}
                            className="flex items-center bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition-colors text-sm"
                        >
                            <ICONS.plus className="w-5 h-5 mr-1" />
                            Нова подготовка
                        </button>
                        <button 
                            onClick={() => handleOpenModal({ date: new Date().toISOString().split('T')[0], type: PlannerItemType.EVENT })}
                            className="flex items-center bg-brand-primary text-white px-3 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors text-sm"
                        >
                            <ICONS.plus className="w-5 h-5 mr-1" />
                            Нов настан
                        </button>
                         <div data-tour="planner-ai-button" className="relative" ref={aiMenuRef}>
                            <button
                                onClick={() => setIsAiMenuOpen(prev => !prev)}
                                className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg shadow hover:bg-purple-700 transition-colors text-sm"
                            >
                                <ICONS.sparkles className="w-5 h-5 mr-1" />
                                <span>Генерирај со AI</span>
                                <ICONS.chevronDown className={`w-4 h-4 ml-1 transition-transform ${isAiMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isAiMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                        <button
                                            onClick={() => { showModal(ModalType.AIThematicPlanGenerator); setIsAiMenuOpen(false); }}
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                        >
                                            <ICONS.generator className="w-5 h-5 mr-3 text-indigo-500" />
                                            Тематски план
                                        </button>
                                        <button
                                            onClick={() => { showModal(ModalType.AIAnnualPlanGenerator); setIsAiMenuOpen(false); }}
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                        >
                                            <ICONS.planner className="w-5 h-5 mr-3 text-purple-500" />
                                            Годишен план
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                
                {hasItems ? (
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={() => changePeriod(-1)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" aria-label="Претходен период">
                                <ICONS.chevronRight className="w-6 h-6 rotate-180"/>
                            </button>
                            <h2 className="text-2xl font-semibold text-brand-primary capitalize">
                                {renderPeriodHeader()}
                            </h2>
                            <button onClick={() => changePeriod(1)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" aria-label="Следен период">
                                <ICONS.chevronRight className="w-6 h-6"/>
                            </button>
                        </div>
                        
                        {viewMode === 'month' ? renderCalendarGrid() : (
                            <PlannerAgendaView 
                                currentDate={currentDate}
                                items={items}
                                onOpenModal={handleOpenModal}
                                onItemClick={handleItemClick}
                            />
                        )}
                    </Card>
                ) : (
                    <EmptyState
                        icon={<ICONS.planner className="w-12 h-12" />}
                        title="Планерот е празен"
                        message="Започнете со организација со додавање на ваш прв час, настан или празник."
                    >
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleOpenModal({ date: new Date().toISOString().split('T')[0] })}
                                className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors"
                            >
                                <ICONS.plus className="w-5 h-5 mr-2" />
                                Додади прв настан
                            </button>
                             <button 
                                onClick={() => showModal(ModalType.AIAnnualPlanGenerator)}
                                className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 transition-colors"
                            >
                                <ICONS.sparkles className="w-5 h-5 mr-2" />
                                Генерирај со AI
                            </button>
                        </div>
                    </EmptyState>
                )}
            </div>
        </DndContext>
    );
};