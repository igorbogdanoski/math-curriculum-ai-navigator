import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { isDailyQuotaKnownExhausted } from '../../services/geminiService';

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

    if (!visible) return null;

    return (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-fade-in-up fixed bottom-0 left-0 right-0 z-50 md:left-64">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
                Дневната AI квота е исцрпена. Генерирањето ќе се обнови за <strong>{countdown}</strong> (полноќ UTC).
            </span>
            <button
                onClick={() => setVisible(false)}
                className="ml-auto flex-shrink-0 hover:opacity-75 transition"
                aria-label="Затвори"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
