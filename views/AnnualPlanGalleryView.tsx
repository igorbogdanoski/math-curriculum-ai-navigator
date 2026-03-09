import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, updateDoc, doc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Card } from '../components/common/Card';

import { ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { AIGeneratedAnnualPlan } from '../types';

interface SavedPlan {
    id: string;
    userId: string;
    authorName?: string;
    createdAt: any;
    grade: string;
    subject: string;
    planData: AIGeneratedAnnualPlan;
    likes?: number;
    forks?: number;
}

export const AnnualPlanGalleryView: React.FC = () => {
    const [plans, setPlans] = useState<SavedPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const q = query(
                collection(db, 'academic_annual_plans'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const loadedPlans = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SavedPlan));
            setPlans(loadedPlans);
        } catch (error) {
            console.error("Грешка при вчитување планови:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLike = async (planId: string) => {
        if (!user) return alert("Мора да сте најавени за да лајкнете.");
        try {
            const planRef = doc(db, 'academic_annual_plans', planId);
            await updateDoc(planRef, {
                likes: increment(1)
            });
            // Update local UI immediately
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, likes: (p.likes || 0) + 1 } : p));
        } catch (error) {
            console.error("Failed to like:", error);
        }
    };

    const handleFork = async (plan: SavedPlan) => {
        if (!user) return alert("Мора да сте најавени за да клонирате план.");
        
        const confirmFork = window.confirm(`Дали сакате да го копирате планот за ${plan.subject} (${plan.grade}) во вашиот работен простор?`);
        if (!confirmFork) return;

        try {
            // Unlink original IDs and set as clone
            const newPlanData = { ...plan.planData };
            
            // 1. Add to user's personalized DB
            await addDoc(collection(db, 'academic_annual_plans'), {
                userId: user.uid,
                createdAt: serverTimestamp(),
                planData: newPlanData,
                grade: plan.grade,
                subject: plan.subject,
                isForked: true,
                originalPlanId: plan.id
            });

            // 2. Increment fork count on original
            const planRef = doc(db, 'academic_annual_plans', plan.id);
            await updateDoc(planRef, {
                forks: increment(1)
            });

            alert("Планот е успешно клониран! Сега можете да го најдете во вашите планови и да го уредувате.");
            fetchPlans(); // Refresh to show updated fork count

        } catch (error) {
            console.error("Failed to fork:", error);
            alert("Настана грешка при клонирањето.");
        }
    };

    const filteredPlans = plans.filter(p => 
        p.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.grade.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ICONS.database className="w-8 h-8 text-brand-primary" />
                        Галерија на Годишни Планови
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Инспирирајте се од заедницата на наставници. Откријте, лајкнете и "форкувајте" (копирајте) туѓи планови.
                    </p>
                </div>
                
                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ICONS.search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                        placeholder="Пребарај по предмет или одделение..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <ICONS.spinner className="w-10 h-10 animate-spin text-brand-primary" />
                </div>
            ) : filteredPlans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map(plan => (
                        <Card key={plan.id} className="relative group overflow-hidden hover:shadow-lg transition-shadow">
                            {plan.userId === user?.uid && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                    ВАШ ПЛАН
                                </div>
                            )}
                            <div className="p-1 border-b border-gray-100 flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900">{plan.subject}</h3>
                                    <span className="text-sm font-medium text-brand-primary bg-blue-50 px-2 py-0.5 rounded">
                                        {plan.grade}
                                    </span>
                                </div>
                                <div className="text-xl text-gray-300">
                                    <ICONS.calendar className="w-8 h-8 opacity-20" />
                                </div>
                            </div>
                            
                            <div className="text-sm text-gray-600 mb-4 line-clamp-3 h-16">
                                {plan.planData.topics.slice(0, 3).map((t, i) => (
                                    <div key={i} className="truncate">• {t.title} ({t.durationWeeks} нед.)</div>
                                ))}
                                {plan.planData.topics.length > 3 && <div className="text-xs text-gray-400 mt-1 italic">И уште {plan.planData.topics.length - 3} теми...</div>}
                            </div>
                            
                            <div className="bg-gray-50 p-2 rounded-lg flex justify-between items-center text-xs font-semibold text-gray-500 mb-4">
                                <span>Вкупно: {plan.planData.totalWeeks} недели</span>
                                <span>{plan.planData.topics.length} Теми</span>
                            </div>

                            <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => handleLike(plan.id)}
                                        className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors"
                                    >
                                        <ICONS.starSolid className="w-4 h-4" /> 
                                        {plan.likes || 0}
                                    </button>
                                    <button 
                                        title="Fork/Clone овој план"
                                        onClick={() => handleFork(plan)}
                                        className="flex items-center gap-1.5 text-gray-500 hover:text-blue-500 transition-colors"
                                    >
                                        <ICONS.gitBranch className="w-4 h-4" /> 
                                        {plan.forks || 0}
                                    </button>
                                </div>
                                
                                <button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => alert('Опцијата за детален преглед е во изработка.')}
                                >
                                    Преглед
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <ICONS.database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Нема пронајдено планови</h3>
                    <p className="text-gray-500">Бидете првиот што ќе изгенерира и зачува план.</p>
                </div>
            )}
        </div>
    );
};