import { useTour } from '../hooks/useTour';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Target, X } from 'lucide-react';
import { geminiService } from '../services/geminiService';
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
import { PlannerMetaAnalysis } from '../components/planner/PlannerMetaAnalysis';
import { getWeekRange } from '../utils/date';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { plannerTourSteps } from '../tours/tour-steps';



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
  const { t } = useLanguage();
    const { navigate } = useNavigation();
    const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
    const [currentDate, setCurrentDate] = useState(new Date()); // Default to today
    const { items, updateItem, addItem, getLessonPlan, isLoading, lessonPlans } = usePlanner();
    const { showModal } = useModal();
    const { addNotification } = useNotification();
    useTour('planner', plannerTourSteps, !isLoading);
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
    const aiMenuRef = useRef<HTMLDivElement>(null);
    const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string; conceptHint: string }> | null>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);


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
            const itemToMove = items.find((item: PlannerItem) => item.id === active.id);
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
    
    const weekDays = [t('planner.days.mon'), t('planner.days.tue'), t('planner.days.wed'), t('planner.days.thu'), t('planner.days.fri'), t('planner.days.sat'), t('planner.days.sun')];

    const handleSuggestLessons = async () => {
        setIsAiMenuOpen(false);
        if (isSuggesting) return;
        const recentLessons = items
            .filter((i: PlannerItem) => i.type === PlannerItemType.LESSON)
            .slice(-10)
            .map((i: PlannerItem) => ({ title: i.title, date: i.date, description: i.description }));
        if (recentLessons.length === 0) {
            addNotification(t('planner.notifications.noLessons'), 'error');
            return;
        }
        setIsSuggesting(true);
        setSuggestions(null);
        try {
            const result = await geminiService.suggestNextLessons(recentLessons);
            setSuggestions(result.length > 0 ? result : []);
        } catch {
            addNotification(t('planner.notifications.errorGener'), 'error');
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleAddSuggestion = async (s: { title: string; description: string }) => {
        // Get next Monday
        const now = new Date();
        const daysToMonday = (8 - now.getDay()) % 7 || 7;
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + daysToMonday);
        const dateStr = nextMonday.toISOString().split('T')[0];
        await addItem({ type: PlannerItemType.LESSON, title: s.title, description: s.description, date: dateStr });
        addNotification(t('planner.notifications.added').replace('{title}', s.title).replace('{date}', dateStr), 'success');
    };

    const changePeriod = (offset: number) => {
        setCurrentDate((prev: Date) => {
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
        items.forEach((item: PlannerItem) => {
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
            addNotification(t('planner.notifications.errorLink'), 'error');
            return;
        }

        const url = `${window.location.origin}${window.location.pathname}#/share/annual/${encodedData}`;
        navigator.clipboard.writeText(url)
            .then(() => {
                addNotification(t('planner.notifications.linkCopied'), 'success');
            })
            .catch(() => {
                addNotification(t('planner.notifications.errorCopy'), 'error');
            });

    }, [items, getLessonPlan, addNotification]);

    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDayIndex });
    
    const hasItems = items.length > 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    const visibleItems = useMemo(() => {
        if (viewMode === 'month') {
            return items.filter((item: PlannerItem) => {
                const d = new Date(item.date);
                return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
            });
        }
        const { start, end } = getWeekRange(currentDate);
        return items.filter((item: PlannerItem) => {
            const d = new Date(item.date);
            d.setHours(0,0,0,0);
            return d >= start && d <= end;
        });
    }, [items, viewMode, currentDate]);

    // Calculate unscheduled plans
    // Find all plans that are NOT linked to any planner item
    const scheduledPlanIds = new Set(items.map((i: PlannerItem) => i.lessonPlanId).filter(Boolean));
    const unscheduledPlansCount = lessonPlans.filter((p: LessonPlan) => !scheduledPlanIds.has(p.id)).length;

    const renderPeriodHeader = () => {
        if (viewMode === 'month') {
            return currentDate.toLocaleString('mk-MK', { month: 'long', year: 'numeric' });
        }
        const { start, end } = getWeekRange(currentDate);
        return `${t('planner.week')}: ${start.toLocaleDateString('mk-MK')} - ${end.toLocaleDateString('mk-MK')}`;
    };

    const firstItemForTourId = useMemo(() => {
        const itemsInMonth = items
          .filter((item: PlannerItem) => {
            const itemDate = new Date(item.date);
            return itemDate.getFullYear() === currentDate.getFullYear() && itemDate.getMonth() === currentDate.getMonth();
          })
          .sort((a: PlannerItem, b: PlannerItem) => new Date(a.date).getDate() - new Date(b.date).getDate());
        return itemsInMonth.length > 0 ? itemsInMonth[0].id : null;
    }, [items, currentDate]);

    const renderCalendarGrid = () => (
        <div className="overflow-x-auto">
            <div data-tour="planner-calendar" className="grid grid-cols-7 gap-1 min-w-[800px]">
                {weekDays.map(day => <div key={day} className="text-center font-bold text-gray-600 p-2 text-sm uppercase tracking-wide">{day}</div>)}
            
            {emptyDays.map((_, i) => <div key={`empty-${i}`} className="border rounded-md bg-gray-50 min-h-[120px]"></div>)}

            {calendarDays.map(day => {
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dateStr = dayDate.toISOString().split('T')[0];
                const itemsForDay = items.filter((item: PlannerItem) => item.date === dateStr);
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
                            {itemsForDay.map((item: PlannerItem) => {
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
        </div>
    );

    return (
        <DndContext
            sensors={sensors}
            onDragEnd={handleDragEnd}
        >
            <div className="p-6 max-w-7xl mx-auto pb-24">
                <header data-tour="planner-header" className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                    <div>
                         <h1 className="text-4xl font-bold text-brand-primary">{t('planner.title')}</h1>
                         <div className="flex flex-wrap items-center gap-4 mt-4">
                            <div className="flex space-x-2">
                                <TabButton active={viewMode === 'month'} onClick={() => setViewMode('month')}>{t('planner.view.month')}</TabButton>
                                <TabButton active={viewMode === 'agenda'} onClick={() => setViewMode('agenda')}>{t('planner.view.agenda')}</TabButton>
                            </div>
                            {unscheduledPlansCount > 0 && (
                                <div className="flex items-center gap-2 text-sm bg-amber-50 px-4 py-2 rounded-full border border-amber-200 animate-pulse-slow shadow-sm">
                                    <ICONS.lightbulb className="w-4 h-4 text-amber-600" />
                                    <span className="text-amber-900 font-medium">
                                        {t('planner.unscheduled.part1')} <span className="font-bold">{unscheduledPlansCount}</span> {t('planner.unscheduled.part2')}
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
                            type="button"
                            title="Визуализирај часови по месец во DataViz Studio"
                            onClick={() => {
                                const MK_MONTHS = ['Јан', 'Фев', 'Мар', 'Апр', 'Мај', 'Јун', 'Јул', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек'];
                                const counts: Record<string, number> = {};
                                items.filter((i: PlannerItem) => i.type === PlannerItemType.LESSON && i.date)
                                    .forEach((i: PlannerItem) => {
                                        const m = MK_MONTHS[new Date(i.date!).getMonth()];
                                        counts[m] = (counts[m] ?? 0) + 1;
                                    });
                                const rows = MK_MONTHS.filter(m => counts[m]).map(m => [m, counts[m]]);
                                if (rows.length === 0) return;
                                sessionStorage.setItem('dataviz_import', JSON.stringify({
                                    tableData: { headers: ['Месец', 'Часови'], rows },
                                    config: { title: 'Часови по месец', xLabel: 'Месец', yLabel: 'Часови', type: 'bar' },
                                }));
                                navigate('/data-viz');
                            }}
                            className="flex items-center bg-indigo-600 text-white px-3 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors text-sm"
                        >
                            <ICONS.chart className="w-4 h-4 mr-1" />
                            DataViz
                        </button>
                         <button
                            onClick={handleShareAnnualPlan}
                            className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
                        >
                            <ICONS.share className="w-5 h-5 mr-1" />
                            {t('planner.shareAnnual')}
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
                                onClick={() => setIsAiMenuOpen((prev: boolean) => !prev)}
                                className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg shadow hover:bg-purple-700 transition-colors text-sm"
                            >
                                <ICONS.sparkles className="w-5 h-5 mr-1" />
                                <span>{t('planner.aiGenerate')}</span>
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
                                        <button
                                            onClick={handleSuggestLessons}
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                        >
                                            <Target className="w-5 h-5 mr-3 text-teal-500" />
                                            Предложи следна лекција
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* П25 — AI Suggestions Panel */}
                {(isSuggesting || suggestions !== null) && (
                    <div className="mt-4 mb-2 bg-teal-50 border border-teal-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-teal-800 flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                Предлози за следната недела
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSuggestions(null)}
                                className="text-teal-400 hover:text-teal-700 transition"
                                aria-label={t('common.close')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {isSuggesting ? (
                            <div className="flex items-center gap-2 text-sm text-teal-700 py-2">
                                <ICONS.spinner className="w-4 h-4 animate-spin" />
                                Генерирам предлози...
                            </div>
                        ) : suggestions && suggestions.length === 0 ? (
                            <p className="text-sm text-teal-700">{t('planner.notEnoughLessons')}</p>
                        ) : suggestions?.map((s, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 py-2 border-t border-teal-100 first:border-t-0">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800">{i + 1}. {s.title}</p>
                                    <p className="text-xs text-gray-600 mt-0.5">{s.description}</p>
                                    <p className="text-xs text-teal-600 mt-0.5 italic">💡 {s.conceptHint}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleAddSuggestion(s)}
                                    className="flex-shrink-0 text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
                                >
                                    + Додај
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {hasItems ? (
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={() => changePeriod(-1)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" aria-label={t('planner.prevPeriod')}>
                                <ICONS.chevronRight className="w-6 h-6 rotate-180"/>
                            </button>
                            <h2 className="text-2xl font-semibold text-brand-primary capitalize">
                                {renderPeriodHeader()}
                            </h2>
                            <button onClick={() => changePeriod(1)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" aria-label={t('planner.nextPeriod')}>
                                <ICONS.chevronRight className="w-6 h-6"/>
                            </button>
                        </div>

                        <div className="mb-6">
                            <PlannerMetaAnalysis items={visibleItems} lessonPlans={lessonPlans} />
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
                        title={t('planner.empty.title')}
                        message={t('planner.empty.message')}
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
