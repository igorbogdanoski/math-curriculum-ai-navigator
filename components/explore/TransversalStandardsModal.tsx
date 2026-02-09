import React, { useMemo } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { ICONS } from '../../constants';
import type { NationalStandard } from '../../types';

interface TransversalStandardsModalProps {
    standards: NationalStandard[];
    gradeTitle: string;
}

export const TransversalStandardsModal: React.FC<TransversalStandardsModalProps> = ({ standards, gradeTitle }) => {
    const { hideModal } = useModal();

    const groupedStandards = useMemo(() => {
        return standards.reduce((acc: Record<string, NationalStandard[]>, std) => {
            const category = std.category || 'Останати';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(std);
            return acc;
        }, {} as Record<string, NationalStandard[]>);
    }, [standards]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={hideModal}>
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white p-6 border-b z-10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-brand-primary">Трансверзални компетенции</h2>
                            <p className="text-gray-500">{gradeTitle}</p>
                        </div>
                        <button onClick={hideModal} className="p-2 rounded-full hover:bg-gray-200">
                            <ICONS.close className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {Object.keys(groupedStandards).map((category) => (
                        <div key={category}>
                            <h3 className="text-lg font-semibold text-brand-secondary border-b pb-1 mb-2">{category}</h3>
                            <ul className="space-y-2">
                                {groupedStandards[category].map(std => (
                                    <li key={std.id} className="text-sm p-2 bg-gray-50 rounded-md">
                                        <span className="font-bold text-gray-700">{std.code}:</span>
                                        <span className="text-gray-600 ml-2">{std.description}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
