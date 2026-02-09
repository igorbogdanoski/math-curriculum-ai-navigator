import React from 'react';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { MaterialsGeneratorView } from '../../views/MaterialsGeneratorView';
import { ICONS } from '../../constants';

export const AIGeneratorPanel: React.FC = () => {
    const { isOpen, props, closeGeneratorPanel } = useGeneratorPanel();
    const [isRendered, setIsRendered] = React.useState(isOpen);

    React.useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
        }
    }, [isOpen]);

    const handleAnimationEnd = () => {
        if (!isOpen) {
            setIsRendered(false);
        }
    };
    
    if (!isRendered) {
        return null;
    }

    const animationClass = isOpen ? 'animate-slide-in-from-right' : 'animate-slide-out-right';
    const backdropAnimationClass = isOpen ? 'animate-fade-in' : 'animate-fade-out';

    return (
        <>
            <div 
                className={`fixed inset-0 bg-black bg-opacity-60 z-40 transition-opacity duration-300 ${backdropAnimationClass} no-print`}
                onClick={closeGeneratorPanel}
                aria-hidden="true"
            ></div>
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="ai-generator-panel-title"
                className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-gray-100 shadow-2xl z-50 transform transition-transform duration-300 ${animationClass}`}
                onAnimationEnd={handleAnimationEnd}
            >
                <div className="flex flex-col h-full">
                    <header className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0 no-print">
                        <h2 id="ai-generator-panel-title" className="text-xl font-bold text-brand-primary flex items-center gap-2">
                           <ICONS.generator className="w-6 h-6" /> AI Генератор
                        </h2>
                        <button onClick={closeGeneratorPanel} className="p-2 rounded-full hover:bg-gray-200" aria-label="Затвори го генераторот">
                            <ICONS.close className="w-6 h-6" />
                        </button>
                    </header>
                    <div className="flex-1 overflow-y-auto">
                        {/* The key ensures the view remounts with new props if it's already open */}
                        {props && <MaterialsGeneratorView key={JSON.stringify(props)} {...props} />}
                    </div>
                </div>
            </div>
        </>
    );
};
