import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { exportUserData, downloadUserDataAsJson } from '../../services/firestoreService.gdpr';
import { getReferralLink } from '../../hooks/useReferral';
import { AppError, ErrorCode } from '../../utils/errors';
import { logger } from '../../utils/logger';
import {
    Crown, CreditCard, ExternalLink, Download, Trash2,
    AlertTriangle, Loader2, Gift, Copy as CopyIcon, Shield,
} from 'lucide-react';

const DELETE_CONFIRM_PHRASE = 'ИЗБРИШИ';

export function BillingPrivacyPanel() {
    const { user, firebaseUser, deleteAccount } = useAuth();
    const { addNotification } = useNotification();

    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'School' || user?.tier === 'Unlimited';

    const handleStripeCheckout = async () => {
        if (!firebaseUser) return;
        setCheckoutLoading(true);
        setCheckoutError(null);
        try {
            const token = await firebaseUser.getIdToken();
            const res = await fetch('/api/stripe-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) { const msg = data.error || 'Грешка.'; throw new AppError(msg, ErrorCode.UNKNOWN, msg, false); }
            if (data.url) window.location.href = data.url;
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Непозната грешка.');
        } finally {
            setCheckoutLoading(false);
        }
    };

    const handleExportData = async () => {
        if (!firebaseUser?.uid) return;
        setIsExporting(true);
        try {
            const data = await exportUserData(firebaseUser.uid);
            downloadUserDataAsJson(data, firebaseUser.uid);
            const warnings = Array.isArray(data['exportWarnings']) ? (data['exportWarnings'] as string[]) : [];
            if (warnings.length > 0) {
                addNotification(`Податоците се преземени со ${warnings.length} предупредувања. Проверете го полето "exportWarnings" во JSON.`, 'warning');
            } else {
                addNotification('Вашите податоци се преземени успешно.', 'success');
            }
        } catch (err: unknown) {
            const code = err != null && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
            const message = err instanceof Error ? err.message : '';
            if (code.includes('permission-denied')) {
                addNotification('Грешка при извоз: немате дозвола за дел од податоците. Обидете се повторно по refresh/login.', 'error');
            } else if (message) {
                addNotification(`Грешка при извоз на податоците: ${message}`, 'error');
            } else {
                addNotification('Грешка при извоз на податоците. Обидете се повторно.', 'error');
            }
            logger.error('GDPR export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== DELETE_CONFIRM_PHRASE) return;
        setIsDeletingAccount(true);
        try {
            await deleteAccount();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Непозната грешка.';
            if (msg.includes('requires-recent-login') || msg.includes('recent')) {
                addNotification('За безбедност, прво одјавете се и повторно најавете се, па обидете се повторно.', 'warning');
            } else {
                addNotification(`Грешка при бришење: ${msg}`, 'error');
            }
            setIsDeletingAccount(false);
        }
    };

    if (!user) return null;

    return (
        <>
            {/* Billing */}
            <Card className={`max-w-2xl ${isPro ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200'}`}>
                <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2 text-indigo-800">
                    <Crown className="w-6 h-6" />
                    Претплата
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    Тековен план и управување со претплата.{' '}
                    <a href="#/pricing" className="text-indigo-600 hover:underline font-medium">
                        Погледни ги сите планови
                    </a>
                </p>

                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-slate-600">Тековен план</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isPro ? (
                                <>
                                    <Crown className="w-5 h-5 text-indigo-600" />
                                    <span className="font-bold text-indigo-700 text-lg">Pro Наставник</span>
                                </>
                            ) : (
                                <span className="font-semibold text-slate-700 text-lg">Бесплатно</span>
                            )}
                        </div>
                        {!isPro && (
                            <p className="text-xs text-slate-400 mt-1">
                                Останато кредити: <strong>{user.aiCreditsBalance ?? 0}</strong>
                            </p>
                        )}
                    </div>
                    {isPro ? (
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">✅ Активно</span>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStripeCheckout}
                            disabled={checkoutLoading}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            {checkoutLoading ? 'Се подготвува...' : 'Надгради на Pro'}
                        </button>
                    )}
                </div>

                {checkoutError && (
                    <p className="text-red-500 text-xs mb-3">{checkoutError}</p>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ExternalLink className="w-4 h-4" />
                    <a href="#/pricing" className="text-indigo-600 hover:underline">
                        Целосна споредба на планови →
                    </a>
                </div>
            </Card>

            {/* Referral */}
            {firebaseUser?.uid && (
                <Card className="max-w-2xl border-amber-200 bg-amber-50/40">
                    <h2 className="text-xl font-semibold text-amber-800 mb-2 flex items-center gap-2">
                        <Gift className="w-5 h-5" /> Препорачај колега — добиј +10 AI кредити
                    </h2>
                    <p className="text-sm text-amber-900/80 mb-3">
                        Сподели го твојот личен линк. За секој наставник кој ќе се регистрира преку него,
                        добиваш 10 бесплатни AI генерации.
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                        <input
                            type="text"
                            readOnly
                            value={getReferralLink(firebaseUser.uid)}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 min-w-0 px-3 py-2 text-xs border border-amber-200 rounded-lg bg-white text-gray-700 truncate"
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(getReferralLink(firebaseUser.uid));
                                    addNotification('Линкот е копиран!', 'success');
                                } catch {
                                    addNotification('Не успеа копирањето.', 'error');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all flex-shrink-0"
                        >
                            <CopyIcon className="w-3.5 h-3.5" /> Копирај
                        </button>
                    </div>
                    <div className="border border-amber-200 rounded-lg bg-white p-3">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Готов текст за Facebook / Viber:</p>
                        <p className="text-xs text-gray-700 leading-relaxed select-all">
                            {`Колеги наставници по математика! 📐 Ја користам MisMath — AI платформа за генерирање тестови, квизови и наставни материјали на македонски. Заштедувам со часови на подготовка! Регистрирајте се бесплатно: ${getReferralLink(firebaseUser.uid)}`}
                        </p>
                        <button
                            type="button"
                            onClick={async () => {
                                const text = `Колеги наставници по математика! 📐 Ја користам MisMath — AI платформа за генерирање тестови, квизови и наставни материјали на македонски. Заштедувам со часови на подготовка! Регистрирајте се бесплатно: ${getReferralLink(firebaseUser.uid)}`;
                                try {
                                    await navigator.clipboard.writeText(text);
                                    addNotification('Текстот е копиран — залепи го на Facebook/Viber!', 'success');
                                } catch { addNotification('Не успеа копирањето.', 'error'); }
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            <CopyIcon className="w-3 h-3" /> Копирај целиот текст
                        </button>
                    </div>
                </Card>
            )}

            {/* Responsible AI links */}
            <Card className="max-w-2xl border-indigo-100 bg-indigo-50/30">
                <h2 className="text-xl font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                    🤖 Одговорна употреба на AI
                </h2>
                <div className="flex flex-wrap gap-3">
                    <a href="#/ai/conduct"
                       className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl text-sm font-medium text-indigo-700 transition-colors shadow-sm">
                        <Shield className="w-4 h-4" /> Кодекс за употреба на AI
                    </a>
                    <a href="#/ai/compare"
                       className="flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200 hover:border-purple-400 rounded-xl text-sm font-medium text-purple-700 transition-colors shadow-sm">
                        ⚡🧠 Споредба на AI модели
                    </a>
                    <a href="#/usage"
                       className="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 hover:border-emerald-400 rounded-xl text-sm font-medium text-emerald-700 transition-colors shadow-sm">
                        📊 AI Употреба и кредити
                    </a>
                </div>
            </Card>

            {/* GDPR */}
            <Card className="max-w-2xl border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-slate-600" />
                    Приватност и ГДПР (ЗЗЛП)
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    Во согласност со Законот за заштита на личните податоци, имате право да ги преземете или избришете сите ваши податоци.{' '}
                    <a href="#/privacy" className="text-indigo-600 hover:underline font-medium">Политика за приватност</a>
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Download className="w-4 h-4" />
                                Преземи ги моите податоци
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Квизови, материјали, планови, чет сесии — сè во JSON формат.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportData}
                            disabled={isExporting}
                            className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? 'Извезувам...' : 'Преземи'}
                        </button>
                    </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 className="font-semibold text-red-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Избриши акаунт
                    </h3>
                    <p className="text-xs text-red-700 mb-3">
                        Ова е <strong>неповратна акција</strong>. Сите ваши податоци, материјали, квизови и резултати ќе бидат трајно избришани.
                    </p>
                    <p className="text-xs text-slate-600 mb-2">
                        За потврда напишете <strong className="font-mono">{DELETE_CONFIRM_PHRASE}</strong> подолу:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                            placeholder={DELETE_CONFIRM_PHRASE}
                            className="flex-1 px-3 py-2 border border-red-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount || deleteConfirmText !== DELETE_CONFIRM_PHRASE}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center gap-2 flex-shrink-0"
                        >
                            {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {isDeletingAccount ? 'Бришам...' : 'Избриши акаунт'}
                        </button>
                    </div>
                </div>
            </Card>
        </>
    );
}
