import React, { useMemo } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
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

    const categoryIcons: Record<string, any> = {
        'Конструкции и Визуелизација': ICONS.edit,
        'Останати': ICONS.bookOpen,
        'Броеви и Операции': ICONS.plus,
        'Алгебра и Функции': ICONS.sparkles,
        'Мерење и Геометрија': ICONS.generator,
        'Податоци и Веројатност': ICONS.chartBar,
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={hideModal}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="bg-white p-6 border-b flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-primary text-white rounded-lg">
                                <ICONS.target className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-brand-primary">Трансверзални компетенции</h2>
                                <p className="text-gray-500 font-medium">{gradeTitle}</p>
                            </div>
                        </div>
                        <button onClick={hideModal} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                            <ICONS.close className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {Object.keys(groupedStandards).sort().map((category) => {
                        const Icon = categoryIcons[category] || ICONS.bookOpen;
                        return (
                            <div key={category} className="animate-fade-in">
                                <h3 className="text-lg font-bold text-brand-secondary flex items-center gap-2 mb-3">
                                    <Icon className="w-5 h-5" />
                                    {category} 
                                    <span className="text-xs font-normal text-gray-400 ml-1">({groupedStandards[category].length})</span>
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {groupedStandards[category].map(std => (
                                        <div key={std.id} className="group flex items-start gap-3 p-3 bg-gray-50 hover:bg-white hover:shadow-md border border-transparent hover:border-blue-100 rounded-xl transition-all">
                                            <div className="mt-1">
                                                <ICONS.check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{std.code}</span>
                                                </div>
                                                <div className="text-gray-700 leading-relaxed">
                                                    <MathRenderer text={std.description} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end flex-shrink-0">
                    <button onClick={hideModal} className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-secondary transition-colors">
                        Затвори
                    </button>
                </div>
            </div>
        </div>
    );
};
