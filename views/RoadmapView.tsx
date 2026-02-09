
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { useNavigation } from '../contexts/NavigationContext';
import { SkeletonLoader } from '../components/common/SkeletonLoader';

// Helper function to add working days to a date, skipping weekends
function addWorkingDays(startDate: Date, days: number): Date {
  let date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0=Sunday, 6=Saturday
      added++;
    }
  }
  return date;
}

const months = ['Сеп', 'Окт', 'Ное', 'Дек', 'Јан', 'Фев', 'Мар', 'Апр', 'Мај', 'Јун'];

export const RoadmapView: React.FC = () => {
    const { navigate } = useNavigation();
    const { curriculum, isLoading } = useCurriculum();
    const [selectedGradeId, setSelectedGradeId] = useState<string>('');
    const [hoursPerWeek, setHoursPerWeek] = useState(4);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // Updated for School Year 2025/2026
    const schoolYearStart = useMemo(() => new Date('2025-09-01'), []);
    const schoolYearEnd = useMemo(() => new Date('2026-06-10'), []);

    useEffect(() => {
        if (curriculum && !selectedGradeId) {
            setSelectedGradeId(curriculum.grades[0].id);
        }
    }, [curriculum, selectedGradeId]);

    // Automatic Hours Logic based on Macedonian Education System
    useEffect(() => {
        if (curriculum && selectedGradeId) {
            const grade = curriculum.grades.find(g => g.id === selectedGradeId);
            if (grade) {
                // 6th Grade has 5 hours, others (7, 8, 9) have 4 hours
                if (grade.level === 6) {
                    setHoursPerWeek(5);
                } else {
                    setHoursPerWeek(4);
                }
            }
        }
    }, [selectedGradeId, curriculum]);
    
    useEffect(() => {
        // Scroll to "Today" on mount
        if (scrollContainerRef.current) {
            const today = new Date();
            const totalDays = (schoolYearEnd.getTime() - schoolYearStart.getTime()) / (1000 * 3600 * 24);
            const daysPassed = (today.getTime() - schoolYearStart.getTime()) / (1000 * 3600 * 24);
            
            // Scroll if we are within the school year
            if (daysPassed > 0 && daysPassed < totalDays) {
                const scrollPercent = daysPassed / totalDays;
                // Calculate pixel position: (Total Width * Percent) - (Half Screen Width)
                const scrollPosition = (scrollContainerRef.current.scrollWidth * scrollPercent) - (scrollContainerRef.current.clientWidth / 2);
                scrollContainerRef.current.scrollLeft = Math.max(0, scrollPosition);
            }
        }
    }, [selectedGradeId]); // Run when grade changes

    const selectedGrade = useMemo(() => 
        curriculum?.grades.find(g => g.id === selectedGradeId)
    , [curriculum, selectedGradeId]);

    const topicSchedule = useMemo(() => {
        if (!selectedGrade || hoursPerWeek <= 0) return [];
        
        let currentDate = new Date(schoolYearStart);
        return selectedGrade.topics.map(topic => {
            const teachingWeeks = (topic.suggestedHours || 20) / hoursPerWeek;
            const teachingDays = Math.ceil(teachingWeeks * 5); // 5 working days in a week
            
            const startDate = new Date(currentDate);
            const endDate = addWorkingDays(currentDate, teachingDays);
            
            currentDate = new Date(endDate);
            currentDate.setDate(currentDate.getDate() + 1); // Start next topic on the next day

            return { topic, startDate, endDate };
        });
    }, [selectedGrade, schoolYearStart, hoursPerWeek]);

    const totalSchoolYearDays = useMemo(() => {
        return (schoolYearEnd.getTime() - schoolYearStart.getTime()) / (1000 * 3600 * 24);
    }, [schoolYearStart, schoolYearEnd]);

    const getTopicStyle = (startDate: Date, endDate: Date) => {
        const startOffset = Math.max(0, (startDate.getTime() - schoolYearStart.getTime()) / (1000 * 3600 * 24));
        const endOffset = Math.min(totalSchoolYearDays, (endDate.getTime() - schoolYearStart.getTime()) / (1000 * 3600 * 24));

        const left = (startOffset / totalSchoolYearDays) * 100;
        const width = Math.max(0.5, ((endOffset - startOffset) / totalSchoolYearDays) * 100); // Ensure at least tiny visibility

        return {
            left: `${left}%`,
            width: `${width}%`,
        };
    };
    
    // Calculate Today line position
    const todayPosition = useMemo(() => {
        const today = new Date();
        const daysPassed = (today.getTime() - schoolYearStart.getTime()) / (1000 * 3600 * 24);
        if (daysPassed < 0) return 0;
        if (daysPassed > totalSchoolYearDays) return 100;
        return (daysPassed / totalSchoolYearDays) * 100;
    }, [schoolYearStart, totalSchoolYearDays]);

    if (isLoading || !curriculum) {
        return (
            <div className="p-8">
                <header className="mb-6 animate-pulse">
                    <div className="h-10 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2 mt-2"></div>
                </header>
                <Card><SkeletonLoader type="paragraph" /></Card>
            </div>
        );
    }

    return (
        <div className="p-8 animate-fade-in">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Визуелна Патна Мапа</h1>
                <p className="text-lg text-gray-600 mt-2">Проверете го распоредот на темите и вашата моментална позиција.</p>
            </header>
            
            <Card className="mb-6">
                 <div className="flex flex-wrap items-center gap-6">
                    <div>
                        <label htmlFor="grade-select" className="block text-sm font-medium text-gray-700">Одделение</label>
                        <select
                            id="grade-select"
                            value={selectedGradeId}
                            onChange={(e) => setSelectedGradeId(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                        >
                            {curriculum.grades.map(grade => (
                                <option key={grade.id} value={grade.id}>{grade.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="hours-week" className="block text-sm font-medium text-gray-700">Часови по математика неделно</label>
                        <input
                            type="number"
                            id="hours-week"
                            value={hoursPerWeek}
                            onChange={(e) => setHoursPerWeek(Math.max(1, Number(e.target.value)))}
                            min="1"
                            max="10"
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary bg-gray-50"
                            // Note: We allow manual override, but usually it's fixed per grade
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {selectedGrade?.level === 6 ? 'Стандард: 5 часа' : 'Стандард: 4 часа'}
                        </p>
                    </div>
                </div>
            </Card>

            <Card className="overflow-hidden border border-gray-200 shadow-md p-0">
                <div className="bg-gray-50 p-2 border-b text-center text-xs font-semibold text-gray-500">
                    Учебна Година 2025/2026
                </div>
                
                <div 
                    className="overflow-x-auto pb-6 custom-scrollbar relative" 
                    ref={scrollContainerRef}
                >
                    {/* Container needs explicit large width to allow scrolling */}
                    <div className="min-w-[1200px] relative pt-8 px-4">
                        
                        {/* Today Line Marker */}
                        <div 
                            className="absolute top-0 bottom-0 border-l-2 border-red-500 border-dashed z-20 flex flex-col items-center pointer-events-none"
                            style={{ left: `${todayPosition}%` }}
                        >
                            <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full -mt-3 shadow-sm whitespace-nowrap">
                                ДЕНЕС
                            </div>
                        </div>

                        {/* Month headers */}
                        <div className="grid grid-cols-10 h-8 border-b border-gray-200 mb-4">
                            {months.map(month => (
                                <div key={month} className="text-left pl-2 font-bold text-gray-400 text-xs border-l first:border-l-0 border-gray-200 uppercase">{month}</div>
                            ))}
                        </div>
                        
                        {/* Topic rows */}
                        <div className="space-y-4 pb-4">
                            {topicSchedule.map(({ topic, startDate, endDate }, index) => (
                                <div 
                                    key={topic.id}
                                    className="relative h-12 flex items-center group"
                                >
                                    {/* Horizontal Guide Line */}
                                    <div className="absolute inset-0 border-b border-gray-100 top-1/2 pointer-events-none"></div>
                                    
                                    <div
                                        onClick={() => navigate(`/topic/${topic.id}`)}
                                        style={getTopicStyle(startDate, endDate)}
                                        className={`absolute h-10 rounded-lg flex items-center px-3 cursor-pointer shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 border border-white/20 overflow-hidden z-10
                                            ${['bg-gradient-to-r from-blue-500 to-blue-600', 'bg-gradient-to-r from-teal-500 to-teal-600', 'bg-gradient-to-r from-indigo-500 to-indigo-600', 'bg-gradient-to-r from-purple-500 to-purple-600', 'bg-gradient-to-r from-pink-500 to-pink-600'][index % 5]}
                                        `}
                                        title={`${topic.title}\nПериод: ${startDate.toLocaleDateString('mk-MK')} - ${endDate.toLocaleDateString('mk-MK')}`}
                                    >
                                        <div className="flex flex-col min-w-0 w-full">
                                            <p className="text-white text-xs font-bold truncate drop-shadow-sm">{topic.title}</p>
                                            <div className="flex justify-between text-white/80 text-[9px] mt-0.5 font-medium">
                                                <span>{startDate.getDate()}.{startDate.getMonth()+1}</span>
                                                <span>{endDate.getDate()}.{endDate.getMonth()+1}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {topicSchedule.length === 0 && (
                            <div className="text-center py-10 text-gray-500 italic">
                                Нема теми за прикажување. Проверете го изборот на одделение.
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-gray-50 p-3 text-xs text-gray-500 flex justify-between border-t">
                    <span>* Датумите се автоматски пресметани според фондот на часови.</span>
                    <span className="flex items-center gap-2 font-semibold text-brand-primary"><ICONS.arrowPath className="w-3 h-3" /> Лизгајте хоризонтално за преглед</span>
                </div>
            </Card>
        </div>
    );
};
