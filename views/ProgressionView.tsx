
import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import type { Concept, ThematicProgression, ProgressionByGrade } from '../types';
import { useNavigation } from '../contexts/NavigationContext';

const ProgressionTimelineNode: React.FC<{ grade: number, concept: Concept, isLast: boolean }> = ({ grade, concept, isLast }) => (
    <div className="relative pl-8">
        {!isLast && <div className="absolute top-5 left-[18px] w-0.5 h-full bg-blue-200"></div>}
        <div className="absolute top-5 left-3 w-4 h-4 bg-brand-secondary rounded-full border-2 border-white"></div>
        <Card className="mb-6">
            <span className="text-sm font-semibold text-brand-secondary">{grade}. Одделение</span>
            <h3 className="text-lg font-bold text-brand-primary mt-1">{concept.title}</h3>
            <p className="text-gray-600 mt-2">{concept.description}</p>
             <div className="mt-3 text-sm">
                <h4 className="font-semibold text-gray-700">Стандарди за оценување:</h4>
                <ul className="list-disc list-inside text-gray-600">
                    {concept.assessmentStandards.map((outcome: string, i: number) => <li key={i}>{outcome}</li>)}
                </ul>
            </div>
        </Card>
    </div>
);

const ThematicProgressionView: React.FC = () => {
    const { verticalProgression } = useCurriculum();
    const grades = ["VI", "VII", "VIII", "IX"];

    if (!verticalProgression) return null;

    return (
        <Card>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Тема</th>
                            {grades.map(grade => (
                                <th key={grade} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">{grade} Одделение</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {verticalProgression.tematska_progresija.map((theme: ThematicProgression) => (
                            <tr key={theme.tema}>
                                <td className="px-6 py-4 whitespace-normal align-top border-r">
                                    <div className="text-sm font-semibold text-brand-primary">{theme.tema}</div>
                                </td>
                                {grades.map(grade => {
                                    const gradeData = theme.progresija.find((p: ProgressionByGrade) => p.oddelenie === grade);
                                    return (
                                        <td key={grade} className="px-6 py-4 whitespace-normal align-top border-r text-xs text-gray-700">
                                            {gradeData && gradeData.poimi && gradeData.rezultati_od_ucenje ? (
                                                <div>
                                                    <p className="font-bold mb-1">Поими:</p>
                                                    <p className="mb-2">{gradeData.poimi}</p>
                                                    <p className="font-bold mb-1">Резултати од учење:</p>
                                                    <p>{gradeData.rezultati_od_ucenje}</p>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Не е опфатено</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};


const ConceptProgressionView: React.FC<{ initialConceptId?: string }> = ({ initialConceptId }) => {
    const { allConcepts, findConceptAcrossGrades, isLoading } = useCurriculum();
    const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>(initialConceptId);

    useEffect(() => {
        if (!isLoading && !selectedConceptId && allConcepts.length > 1) {
            // Set a default concept once data is loaded if none is selected
            setSelectedConceptId(allConcepts[1].id);
        }
    }, [isLoading, allConcepts, selectedConceptId]);

    const progressionData = useMemo(() => {
        if (!selectedConceptId) return null;
        return findConceptAcrossGrades(selectedConceptId);
    }, [selectedConceptId, findConceptAcrossGrades]);
    
    const uniqueConcepts = useMemo(() => {
        const seen = new Set<string>();
        return allConcepts.filter((c: Concept) => {
            const cleanTitle = c.title.replace(/Вовед во |Операции со |Основи на /i, '');
            if(seen.has(cleanTitle)) return false;
            seen.add(cleanTitle);
            return true;
        }).sort((a: Concept, b: Concept) => a.title.localeCompare(b.title));
    }, [allConcepts]);

    if (isLoading && !initialConceptId) {
        return (
            <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded w-1/2"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <label htmlFor="concept-select" className="block text-sm font-medium text-gray-700 mb-1">Изберете поим:</label>
                <select 
                    id="concept-select"
                    value={selectedConceptId || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedConceptId(e.target.value)}
                    className="block w-full max-w-md p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                >
                    <option value="" disabled>-- Изберете --</option>
                    {uniqueConcepts.map((c: Concept) => (
                        <option key={c.id} value={c.id}>{c.title.replace(/Вовед во |Операции со |Основи на /i, '')}</option>
                    ))}
                </select>
            </div>

            {progressionData ? (
                <div>
                    <h2 className="text-2xl font-semibold text-brand-primary mb-4">Развој на поимот: <span className="text-brand-secondary">{progressionData.title}</span></h2>
                    <div>
                        {progressionData.progression.map((item: { grade: number; concept: Concept }, index: number) => (
                            <ProgressionTimelineNode 
                                key={item.grade} 
                                grade={item.grade} 
                                concept={item.concept} 
                                isLast={index === progressionData.progression.length - 1}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <Card>
                    <p className="text-center text-gray-500">Ве молиме изберете поим за да ја видите неговата прогресија.</p>
                </Card>
            )}
        </div>
    );
};

export const ProgressionView: React.FC<{ concept?: string }> = ({ concept }) => {
    const { navigate } = useNavigation();
    const [activeTab, setActiveTab] = useState<'thematic' | 'concept'>(concept ? 'concept' : 'thematic');
    const { isLoading } = useCurriculum();

    const TabButton: React.FC<{tabId: 'thematic' | 'concept', label: string}> = ({ tabId, label }) => (
        <button
            id={`tab-${tabId}`}
            role="tab"
            aria-selected={activeTab === tabId}
            aria-controls={`tabpanel-${tabId}`}
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === tabId
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
            {label}
        </button>
    );
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <Card>
                    <div className="animate-pulse h-96 bg-gray-200 rounded"></div>
                </Card>
            );
        }

        return (
            <>
                <div
                    id="tabpanel-thematic"
                    role="tabpanel"
                    aria-labelledby="tab-thematic"
                    hidden={activeTab !== 'thematic'}
                >
                    <ThematicProgressionView />
                </div>
                <div
                    id="tabpanel-concept"
                    role="tabpanel"
                    aria-labelledby="tab-concept"
                    hidden={activeTab !== 'concept'}
                >
                    <ConceptProgressionView initialConceptId={concept} />
                </div>
            </>
        )
    }

    return (
        <div className="p-8 animate-fade-in">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-brand-primary">Вертикална проодност</h1>
                <p className="text-lg text-gray-600 mt-2">Анализирајте како се развиваат темите и поимите низ годините.</p>
            </header>
            
            <div role="tablist" aria-label="Видови на прогресија" className="mb-6 flex space-x-2 border-b">
                <TabButton tabId="thematic" label="Тематска прогресија"/>
                <TabButton tabId="concept" label="Прогресија по поим"/>
            </div>

            {renderContent()}
        </div>
    );
};