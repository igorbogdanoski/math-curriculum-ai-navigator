import React, { useMemo } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { ICONS } from '../../constants';
import type { NationalStandard, Concept } from '../../types';
import { useCurriculum } from '../../hooks/useCurriculum';
import { MathRenderer } from '../common/MathRenderer';
import { useNavigation } from '../../contexts/NavigationContext';

interface NationalStandardDetailsModalProps {
    standard: NationalStandard;
}

export const NationalStandardDetailsModal: React.FC<NationalStandardDetailsModalProps> = ({ standard }) => {
    const { hideModal } = useModal();
    const { getConceptDetails } = useCurriculum();
    const { navigate } = useNavigation();

    const relatedConcepts = useMemo(() => {
        if (!standard.relatedConceptIds) return [];
        return standard.relatedConceptIds
            .map(id => getConceptDetails(id))
            .filter(details => details.concept);
    }, [standard, getConceptDetails]);

    const handleConceptClick = (conceptId: string) => {
        hideModal();
        navigate(`/concept/${conceptId}`);
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={hideModal}>
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white p-6 border-b z-10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-brand-primary">{standard.code}</h2>
                            <p className="text-gray-600">{standard.description}</p>
                        </div>
                        <button onClick={hideModal} className="p-2 rounded-full hover:bg-gray-200">
                            <ICONS.close className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    <h3 className="text-xl font-bold text-brand-secondary">Поврзани поими, стандарди и активности</h3>
                    {relatedConcepts.length > 0 ? (
                        relatedConcepts.map(({ concept, grade, topic }) => concept && (
                            <div key={concept.id} className="p-4 bg-gray-50 rounded-lg border">
                                <a onClick={() => handleConceptClick(concept.id)} className="text-lg font-semibold text-brand-primary hover:underline cursor-pointer">
                                    {concept.title}
                                </a>
                                <p className="text-xs text-gray-500">{grade?.title} - {topic?.title}</p>
                                
                                {concept.assessmentStandards && concept.assessmentStandards.length > 0 && (
                                    <>
                                        <h4 className="text-md font-medium text-gray-700 mt-3 mb-1">Стандарди за оценување (Задачи):</h4>
                                        <ul className="space-y-1 list-disc list-inside">
                                            {concept.assessmentStandards.map((std, i) => (
                                                <li key={i} className="text-sm text-gray-600">
                                                    <MathRenderer text={std} />
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                                
                                {concept.activities && concept.activities.length > 0 && (
                                    <>
                                        <h4 className="text-md font-medium text-gray-700 mt-3 mb-1">Предлог активности:</h4>
                                        <ul className="space-y-1 list-disc list-inside">
                                            {concept.activities.map((activity, i) => (
                                                <li key={i} className="text-sm text-gray-600">
                                                    <MathRenderer text={activity} />
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 italic">Нема дефинирани поврзани поими или активности за овој стандард.</p>
                    )}
                </div>
                 <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={hideModal} className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary">
                        Затвори
                    </button>
                </div>
            </div>
        </div>
    );
};