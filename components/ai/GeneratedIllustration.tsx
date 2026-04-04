import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import type { AIGeneratedIllustration } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreService } from '../../services/firestoreService';

interface GeneratedIllustrationProps {
  material: AIGeneratedIllustration;
}

export const GeneratedIllustration: React.FC<GeneratedIllustrationProps> = ({ material }) => {
    const { firebaseUser } = useAuth();

    const trackFeedback = (context: string) => {
        if (!firebaseUser?.uid) return;
        firestoreService.logAIMaterialFeedbackEvent({
            teacherUid: firebaseUser.uid,
            materialType: 'illustration',
            action: 'accept_saved',
            context,
        }).catch(() => undefined);
    };

    if (material.error) {
        return <p className="text-red-500">{material.error}</p>;
    }

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = material.imageUrl;
        link.download = `${material.prompt.replace(/ /g, '_').slice(0, 30)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        trackFeedback('export:image_download');
    };

    return (
        <Card id="printable-area" className="mt-6 border-l-4 border-teal-500">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-2xl font-bold">AI Генерирана илустрација</h3>
                    <p className="text-sm text-gray-500 mt-1">Промпт: "{material.prompt}"</p>
                </div>
                <div className="no-print flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            trackFeedback('export:print');
                            window.print();
                        }}
                        className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
                        title="Печати/Сними како PDF"
                    >
                        <ICONS.printer className="w-5 h-5 mr-1" />
                        Печати
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
                        title="Сними ја сликата"
                    >
                        <ICONS.download className="w-5 h-5 mr-1" />
                        Сними
                    </button>
                </div>
            </div>
            <div className="flex justify-center items-center bg-gray-100 p-4 rounded-lg">
                <img
                    src={material.imageUrl}
                    alt={material.prompt}
                    className="max-w-full max-h-[500px] object-contain rounded-md shadow-md"
                />
            </div>
        </Card>
    );
};