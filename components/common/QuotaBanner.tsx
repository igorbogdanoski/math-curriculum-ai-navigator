import React, { useState, useEffect } from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { isDailyQuotaKnownExhausted, clearDailyQuotaFlag } from '../../services/geminiService';

/** Returns true if US Pacific Daylight Time is currently active (Mar 2nd Sun – Nov 1st Sun) */
function isPDT(): boolean {
    const now = new Date();
    const year = now.getUTCFullYear();
    // 2nd Sunday of March
    const march = new Date(Date.UTC(year, 2, 1));
    const dstStart = new Date(Date.UTC(year, 2, 1 + ((7 - march.getUTCDay()) % 7) + 7, 10)); // 02:00 PST = 10:00 UTC
    // 1st Sunday of November
    const nov = new Date(Date.UTC(year, 10, 1));
    const dstEnd = new Date(Date.UTC(year, 10, 1 + ((7 - nov.getUTCDay()) % 7), 9)); // 02:00 PDT = 09:00 UTC
    return now >= dstStart && now < dstEnd;
}

/** Next midnight Pacific Time expressed as { countdown: "Xч Yм", localTime: "09:00" } */
function getPacificMidnightInfo(): { countdown: string; localTimeStr: string } {
    const now = new Date();
    const pacificOffsetHours = isPDT() ? -7 : -8; // UTC-7 PDT, UTC-8 PST
    // Midnight Pacific = (24 + pacificOffsetHours) UTC hours of current Pacific day
    const utcHourOfMidnightPT = (24 + pacificOffsetHours + 24) % 24; // always positive
    const nextMidnightPT = new Date();
    nextMidnightPT.setUTCHours(utcHourOfMidnightPT, 0, 0, 0);
    if (nextMidnightPT <= now) nextMidnightPT.setUTCDate(nextMidnightPT.getUTCDate() + 1);
    const diffMs = nextMidnightPT.getTime() - now.getTime();
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const localTimeStr = nextMidnightPT.toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' });
    return { countdown: `${h}ч ${m}м`, localTimeStr };
}

export const QuotaBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [countdown, setCountdown] = useState('');
    const [resetAt, setResetAt] = useState('');

    useEffect(() => {
        const check = () => {
            if (isDailyQuotaKnownExhausted()) {
                setVisible(true);
                const { countdown: cd, localTimeStr } = getPacificMidnightInfo();
                setCountdown(cd);
                setResetAt(localTimeStr);
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
                Дневната AI квота е исцрпена. Обновување за <strong>{countdown}</strong> — денес во <strong>{resetAt}</strong> (полноќ Pacific Time).
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
