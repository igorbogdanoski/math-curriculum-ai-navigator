import React from 'react';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { ICONS } from '../../constants';
import { ConfirmDialog } from '../common/ConfirmDialog';

const MaterialsGeneratorView = React.lazy(() =>
  import('../../views/MaterialsGeneratorView').then(m => ({ default: m.MaterialsGeneratorView }))
);

export const AIGeneratorPanel: React.FC = () => {
    const { isOpen, props, closeGeneratorPanel } = useGeneratorPanel();
    const [isRendered, setIsRendered] = React.useState(isOpen);
    const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
    const openedAtRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            openedAtRef.current = Date.now();
        } else {
            openedAtRef.current = null;
        }
    }, [isOpen]);

    const handleClose = React.useCallback(() => {
        const openMs = openedAtRef.current ? Date.now() - openedAtRef.current : 0;
        if (openMs > 15_000) {
            setShowCloseConfirm(true);
            return;
        }
        closeGeneratorPanel();
    }, [closeGeneratorPanel]);

    const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
        // Only handle the dialog's OWN animation end, not child animations that bubble up
        if (e.target !== e.currentTarget) return;
        if (!isOpen) {
            setIsRendered(false);
        }
    };
    
    if (!isRendered) {
        return null;
    }

    const animationClass = isOpen ? 'animate-fade-in' : 'animate-fade-out opacity-0 translate-y-4';
    const backdropAnimationClass = isOpen ? 'animate-fade-in' : 'animate-fade-out opacity-0';

    return (
        <>
            <div
                className={`fixed inset-0 bg-gray-900/40 z-40 transition-opacity duration-300 ${backdropAnimationClass} no-print backdrop-blur-sm`}
                onClick={handleClose}
                aria-hidden="true"
            ></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ai-generator-panel-title"
                className={`fixed inset-0 w-full h-full bg-gray-50 z-50 transform transition-all duration-300 ${animationClass}`}
                onAnimationEnd={handleAnimationEnd}
            >
                <div className="flex flex-col h-full w-full">
                    <header className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0 shadow-sm no-print">
                        <h2 id="ai-generator-panel-title" className="text-2xl font-bold text-brand-primary flex items-center gap-2">
                           <ICONS.generator className="w-7 h-7" /> AI Генератор
                        </h2>
                        <button type="button" onClick={handleClose} className="p-2.5 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors" aria-label="Затвори го генераторот">
                            <ICONS.close className="w-6 h-6" />
                        </button>
                    </header>
                    <div className="flex-1 overflow-hidden">
                        {/* Removed key to prevent unnecessary unmounting/loops if props change slightly */}
                        <React.Suspense fallback={
                            <div className="flex items-center justify-center h-32">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                            </div>
                        }>
                            {props && <MaterialsGeneratorView {...props} />}
                        </React.Suspense>
                    </div>
                </div>
            </div>
            {showCloseConfirm && (
                <ConfirmDialog
                    title="Затвори генератор?"
                    message="Дали сте сигурни? Незачуваните генерирани материјали ќе се изгубат."
                    variant="warning"
                    confirmLabel="Да, затвори"
                    onConfirm={() => { setShowCloseConfirm(false); closeGeneratorPanel(); }}
                    onCancel={() => setShowCloseConfirm(false)}
                />
            )}
        </>
    );
};
