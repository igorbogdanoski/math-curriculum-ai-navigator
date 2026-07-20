import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { useLanguage } from '../../i18n/LanguageContext';

export function AccessibilityCard() {
    const { t } = useLanguage();
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
                {t('settings.accessibility.title')}
            </h2>
            <p className="text-sm text-teal-600 mb-4">{t('settings.accessibility.subtitle')}</p>
            <div className="space-y-3">
                <div className="flex items-center justify-between bg-white border border-teal-100 rounded-xl px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">{t('settings.accessibility.dyslexicFontLabel')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('settings.accessibility.dyslexicFontDesc')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleDyslexicFont}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dyslexicFont ? 'bg-teal-500' : 'bg-gray-200'}`}
                        aria-label={dyslexicFont ? t('settings.accessibility.dyslexicFontOffAria') : t('settings.accessibility.dyslexicFontOnAria')}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${dyslexicFont ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="flex items-center justify-between bg-white border border-teal-100 rounded-xl px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">{t('settings.accessibility.highContrastLabel')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('settings.accessibility.highContrastDesc')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleHighContrast}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${highContrast ? 'bg-teal-500' : 'bg-gray-200'}`}
                        aria-label={highContrast ? t('settings.accessibility.highContrastOffAria') : t('settings.accessibility.highContrastOnAria')}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
                {t('settings.accessibility.footerNote')}
            </p>
        </Card>
    );
}
