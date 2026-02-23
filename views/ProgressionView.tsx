
import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import type { Concept, Grade, Topic, ThematicProgression, ProgressionByGrade } from '../types';


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


const ChainNode: React.FC<{ label: string; concept: Concept; grade: Grade; topic: Topic; color: string; onClick: () => void }> = ({ label, concept, grade, topic, color, onClick }) => (
    <div className={`border-l-4 ${color} pl-4 py-3 bg-white rounded-r-xl shadow-sm mb-2 cursor-pointer hover:shadow-md transition`} onClick={onClick}>
        <span className={`text-xs font-black uppercase tracking-widest ${color.replace('border-', 'text-')}`}>{label} • {grade.title}</span>
        <p className="font-bold text-gray-800 mt-0.5">{concept.title}</p>
        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{topic.title}</p>
    </div>
);

const ConceptProgressionView: React.FC<{ initialConceptId?: string }> = ({ initialConceptId }) => {
    const { allConcepts, findConceptAcrossGrades, getConceptChain, getConceptDetails, isLoading } = useCurriculum();
    const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>(initialConceptId);

    useEffect(() => {
        if (!isLoading && !selectedConceptId && allConcepts.length > 1) {
            setSelectedConceptId(allConcepts[1].id);
        }
    }, [isLoading, allConcepts, selectedConceptId]);

    const progressionData = useMemo(() => {
        if (!selectedConceptId) return null;
        return findConceptAcrossGrades(selectedConceptId);
    }, [selectedConceptId, findConceptAcrossGrades]);

    const chain = useMemo(() => {
        if (!selectedConceptId) return null;
        return getConceptChain(selectedConceptId);
    }, [selectedConceptId, getConceptChain]);

    const currentEntry = useMemo(() => {
        if (!selectedConceptId) return null;
        return getConceptDetails(selectedConceptId);
    }, [selectedConceptId, getConceptDetails]);

    const uniqueConcepts = useMemo(() => {
        const seen = new Set<string>();
        return allConcepts.filter((c: Concept) => {
            const cleanTitle = c.title.replace(/Вовед во |Операции со |Основи на /i, '');
            if (seen.has(cleanTitle)) return false;
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

    const hasChain = chain && (chain.priors.length > 0 || chain.futures.length > 0);

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

            {selectedConceptId && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Лева колона: Прогресија низ одделенија (title-matching) */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand-secondary inline-block"></span>
                            Истиот поим низ одделенија
                        </h2>
                        {progressionData ? (
                            progressionData.progression.map((item: { grade: number; concept: Concept }, index: number) => (
                                <ProgressionTimelineNode
                                    key={item.grade}
                                    grade={item.grade}
                                    concept={item.concept}
                                    isLast={index === progressionData.progression.length - 1}
                                />
                            ))
                        ) : (
                            <Card><p className="text-sm text-gray-400 italic">Нема пронајдени варијанти на овој поим во другите одделенија.</p></Card>
                        )}
                    </div>

                    {/* Десна колона: Вертикален синџир на предуслови (priorKnowledgeIds) */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                            Вертикален синџир на знаења
                        </h2>
                        {hasChain ? (
                            <div className="space-y-1">
                                {chain.priors.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2">↑ Потребно претходно знаење</p>
                                        {chain.priors.map(({ grade, topic, concept }) => (
                                            <ChainNode key={concept.id} label="Претходен" concept={concept} grade={grade} topic={topic}
                                                color="border-orange-400" onClick={() => setSelectedConceptId(concept.id)} />
                                        ))}
                                    </div>
                                )}

                                {currentEntry?.concept && currentEntry.grade && currentEntry.topic && (
                                    <div className="border-l-4 border-brand-primary pl-4 py-3 bg-brand-primary/5 rounded-r-xl shadow mb-3">
                                        <span className="text-xs font-black text-brand-primary uppercase tracking-widest">◆ Тековен поим • {currentEntry.grade.title}</span>
                                        <p className="font-bold text-brand-primary mt-0.5">{currentEntry.concept.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{currentEntry.topic.title}</p>
                                    </div>
                                )}

                                {chain.futures.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">↓ Овој поим е предуслов за</p>
                                        {chain.futures.map(({ grade, topic, concept }) => (
                                            <ChainNode key={concept.id} label="Следен" concept={concept} grade={grade} topic={topic}
                                                color="border-green-500" onClick={() => setSelectedConceptId(concept.id)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Card>
                                <p className="text-sm text-gray-400 italic">
                                    Овој поим нема дефинирани вертикални врски со <code className="text-xs bg-gray-100 px-1 rounded">priorKnowledgeIds</code>.
                                    Врските можат да се додадат во курикулумските податоци.
                                </p>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {!selectedConceptId && (
                <Card>
                    <p className="text-center text-gray-500">Ве молиме изберете поим за да ја видите неговата прогресија.</p>
                </Card>
            )}
        </div>
    );
};

export const ProgressionView: React.FC<{ concept?: string }> = ({ concept }) => {
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