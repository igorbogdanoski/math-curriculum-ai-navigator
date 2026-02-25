import React, { useState, useEffect } from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { isDailyQuotaKnownExhausted, clearDailyQuotaFlag } from '../../services/geminiService';

function getMidnightUTCCountdown(): string {
    const now = new Date();
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0); // next midnight UTC
    const diffMs = midnight.getTime() - now.getTime();
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    return `${h}ч ${m}м`;
}

export const QuotaBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const check = () => {
            if (isDailyQuotaKnownExhausted()) {
                setVisible(true);
                setCountdown(getMidnightUTCCountdown());
            } else {
                setVisible(false);
            }
        };
        check();
        const interval = setInterval(check, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, []);

    const handleDismiss = () => {
        // Clear the localStorage flag so a stale/false-positive quota mark
        // does not re-appear every time the app is opened.
        clearDailyQuotaFlag();
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-fade-in-up fixed bottom-0 left-0 right-0 z-50 md:left-64">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
                Дневната AI квота е исцрпена. Генерирањето ќе се обнови за <strong>{countdown}</strong> (полноќ UTC).
            </span>
            <button
                type="button"
                onClick={handleDismiss}
                title="Исчисти ознаката и провери повторно"
                className="ml-2 flex items-center gap-1 underline underline-offset-2 opacity-80 hover:opacity-100 transition text-xs font-semibold flex-shrink-0"
            >
                <RefreshCw className="w-3 h-3" />
                Провери повторно
            </button>
            <button
                type="button"
                onClick={handleDismiss}
                className="ml-auto flex-shrink-0 hover:opacity-75 transition"
                aria-label="Затвори"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
