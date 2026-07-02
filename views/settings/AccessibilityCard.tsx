import React, { useState } from 'react';
import { Card } from '../../components/common/Card';

export function AccessibilityCard() {
    const [dyslexicFont, setDyslexicFont] = useState(() =>
        localStorage.getItem('accessibility_dyslexic') === 'true'
    );
    const [highContrast, setHighContrast] = useState(() =>
        localStorage.getItem('accessibility_contrast') === 'true'
    );

    const toggleDyslexicFont = () => {
        const next = !dyslexicFont;
        setDyslexicFont(next);
        localStorage.setItem('accessibility_dyslexic', String(next));
        if (next) {
            if (!document.getElementById('opendyslexic-global')) {
                const link = document.createElement('link');
                link.id = 'opendyslexic-global';
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-all.min.css';
                document.head.appendChild(link);
            }
            document.documentElement.classList.add('dyslexic-font');
        } else {
            document.documentElement.classList.remove('dyslexic-font');
        }
    };

    const toggleHighContrast = () => {
        const next = !highContrast;
        setHighContrast(next);
        localStorage.setItem('accessibility_contrast', String(next));
        document.documentElement.classList.toggle('high-contrast', next);
    };

    return (
        <Card className="max-w-2xl border-teal-200 bg-teal-50/20">
            <h2 className="text-2xl font-semibold text-teal-800 mb-1 flex items-center gap-2">
                👁️ Пристапност
            </h2>
            <p className="text-sm text-teal-600 mb-4">Поставки за читање и визуелни помошници.</p>
            <div className="space-y-3">
                <div className="flex items-center justify-between bg-white border border-teal-100 rounded-xl px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">OpenDyslexic фонт</p>
                        <p className="text-xs text-gray-500 mt-0.5">Глобална замена на фонтот — олеснува читање за ученици со дислексија.</p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleDyslexicFont}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dyslexicFont ? 'bg-teal-500' : 'bg-gray-200'}`}
                        aria-label={dyslexicFont ? 'Исклучи OpenDyslexic фонт' : 'Вклучи OpenDyslexic фонт'}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${dyslexicFont ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="flex items-center justify-between bg-white border border-teal-100 rounded-xl px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Зголемен контраст</p>
                        <p className="text-xs text-gray-500 mt-0.5">Зголемен контраст и заситеност за подобра читливост.</p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleHighContrast}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${highContrast ? 'bg-teal-500' : 'bg-gray-200'}`}
                        aria-label={highContrast ? 'Исклучи зголемен контраст' : 'Вклучи зголемен контраст'}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
                Поставките се зачувуваат локално и се применуваат веднаш низ целата апликација.
            </p>
        </Card>
    );
}
