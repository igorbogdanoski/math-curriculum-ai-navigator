import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useCurriculum } from '../../hooks/useCurriculum';
import { ICONS } from '../../constants';
import { useModal } from '../../contexts/ModalContext';
import { ModalType } from '../../types';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';

interface Action {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    disabled?: boolean;
}

interface ContextualFABProps {
    path: string;
    params: Record<string, string | undefined>;
}

export const ContextualFAB: React.FC<ContextualFABProps> = ({ path, params }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { navigate } = useNavigation();
    const { showModal } = useModal();
    const { getConceptDetails, getTopic } = useCurriculum();
    const { openGeneratorPanel } = useGeneratorPanel();
    const { isOnline } = useNetworkStatus();
    const fabRef = useRef<HTMLDivElement>(null);

    const actions: Action[] = useMemo(() => {
        const cleanPath = path.split('?')[0];
        const pathParts = cleanPath.split('/').filter(Boolean);

        if (pathParts[0] === 'concept' && params.id) {
            const { grade, topic } = getConceptDetails(params.id);
            const props = {
                grade: String(grade?.level || ''),
                topicId: topic?.id || '',
                conceptId: params.id,
                contextType: 'CONCEPT' as const
            };
            return [
                { label: 'Креирај работен лист', icon: ICONS.generator, onClick: () => openGeneratorPanel({ ...props, materialType: 'ASSESSMENT' }), disabled: !isOnline },
                { label: 'Генерирај квиз прашања', icon: ICONS.quiz, onClick: () => openGeneratorPanel({ ...props, materialType: 'QUIZ' }), disabled: !isOnline },
                { label: 'Предложи идеи за час', icon: ICONS.lightbulb, onClick: () => openGeneratorPanel({ ...props, materialType: 'SCENARIO' }), disabled: !isOnline }
            ];
        }
        
        if (pathParts[0] === 'topic' && params.id) {
             const { grade } = getTopic(params.id);
             const props = {
                grade: String(grade?.level || ''),
                topicId: params.id,
                contextType: 'TOPIC' as const
            };
            return [
                 { label: 'Генерирај тематски тест', icon: ICONS.generator, onClick: () => openGeneratorPanel({ ...props, materialType: 'ASSESSMENT' }), disabled: !isOnline },
                 { label: 'Предложи проектна активност', icon: ICONS.lightbulb, onClick: () => openGeneratorPanel({ ...props, materialType: 'SCENARIO' }), disabled: !isOnline },
            ];
        }

        if (cleanPath === '/planner') {
             return [
                { label: 'Креирај нова подготовка со AI', icon: ICONS.plus, onClick: () => navigate(`/planner/lesson/new`), disabled: !isOnline },
                { label: 'Генерирај тематски план', icon: ICONS.generator, onClick: () => showModal(ModalType.AIThematicPlanGenerator), disabled: !isOnline },
                { label: 'Генерирај годишен план', icon: ICONS.sparkles, onClick: () => showModal(ModalType.AIAnnualPlanGenerator), disabled: !isOnline },
             ];
        }

        // Default actions
        return [
            { label: 'Генерирај идеја/текст', icon: ICONS.generator, onClick: () => openGeneratorPanel({ contextType: 'SCENARIO' }), disabled: !isOnline },
            { label: 'Генерирај илустрација', icon: ICONS.gallery, onClick: () => openGeneratorPanel({ materialType: 'ILLUSTRATION' }), disabled: !isOnline },
            { label: 'Разговарај со AI Асистент', icon: ICONS.assistant, onClick: () => navigate('/assistant'), disabled: !isOnline },
        ];

    }, [path, params, navigate, showModal, getConceptDetails, getTopic, openGeneratorPanel, isOnline]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleMenu = () => setIsOpen((prev: boolean) => !prev);
    
    return (
        <div ref={fabRef} className="fixed bottom-8 right-8 z-40 no-print">
            {isOpen && (
                <div className="absolute bottom-full right-0 mb-4 w-64 bg-white rounded-lg shadow-2xl overflow-hidden animate-fade-in-up origin-bottom-right">
                    <ul>
                        {actions.map((action, index) => (
                            <li key={index}>
                                <button 
                                    onClick={() => { action.onClick(); setIsOpen(false); }} 
                                    disabled={action.disabled}
                                    className={`w-full flex items-center px-4 py-3 text-sm transition-colors ${action.disabled ? 'text-gray-400 cursor-not-allowed bg-gray-50' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                    <action.icon className={`w-5 h-5 mr-3 ${action.disabled ? 'text-gray-300' : 'text-brand-secondary'}`}/>
                                    <span className="text-left">{action.label} {action.disabled && '(Офлајн)'}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            <button
                onClick={toggleMenu}
                className="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-lg hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-transform transform hover:scale-110"
                aria-label="Отвори AI акции"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <ICONS.sparkles className="w-8 h-8"/>
            </button>
        </div>
    );
};