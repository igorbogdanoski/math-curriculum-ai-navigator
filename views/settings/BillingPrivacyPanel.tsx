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
import { useLanguage } from '../../i18n/LanguageContext';

export function BillingPrivacyPanel() {
    const { user, firebaseUser, deleteAccount } = useAuth();
    const { addNotification } = useNotification();
    const { t } = useLanguage();
    const DELETE_CONFIRM_PHRASE = t('settings.billing.deleteConfirmPhrase');

    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);
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
            if (!res.ok) { const msg = data.error || t('settings.billing.genericError'); throw new AppError(msg, ErrorCode.UNKNOWN, msg, false); }
            if (data.url) window.location.href = data.url;
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : t('settings.billing.unknownError'));
        } finally {
            setCheckoutLoading(false);
        }
    };

    // 2026-07-20 (Wave 13.1): Stripe's Billing Portal shows payment history / invoices for
    // any customer that has ever paid, one-time or recurring — so this is useful right now
    // under the current annual one-time-payment model, not just once subscriptions (Wave 13.2)
    // are enabled. Only reachable once a stripeCustomerId exists on the user doc (set by
    // stripe-webhook.ts on first successful checkout), which the API 404s on if missing.
    const handleOpenPortal = async () => {
        if (!firebaseUser) return;
        setPortalLoading(true);
        setPortalError(null);
        try {
            const token = await firebaseUser.getIdToken();
            const res = await fetch('/api/stripe-portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) { const msg = data.error || t('settings.billing.genericError'); throw new AppError(msg, ErrorCode.UNKNOWN, msg, false); }
            if (data.url) window.location.href = data.url;
        } catch (err) {
            setPortalError(err instanceof Error ? err.message : t('settings.billing.unknownError'));
        } finally {
            setPortalLoading(false);
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
                addNotification(t('settings.billing.exportWithWarnings').replace('{n}', String(warnings.length)), 'warning');
            } else {
                addNotification(t('settings.billing.exportSuccess'), 'success');
            }
        } catch (err: unknown) {
            const code = err != null && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
            const message = err instanceof Error ? err.message : '';
            if (code.includes('permission-denied')) {
                addNotification(t('settings.billing.exportPermissionError'), 'error');
            } else if (message) {
                addNotification(t('settings.billing.exportErrorWithMessage').replace('{message}', message), 'error');
            } else {
                addNotification(t('settings.billing.exportError'), 'error');
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
            const msg = err instanceof Error ? err.message : t('settings.billing.unknownError');
            if (msg.includes('requires-recent-login') || msg.includes('recent')) {
                addNotification(t('settings.billing.deleteReauthWarning'), 'warning');
            } else {
                addNotification(t('settings.billing.deleteErrorWithMessage').replace('{msg}', msg), 'error');
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
                    {t('settings.billing.subscriptionTitle')}
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    {t('settings.billing.subscriptionDesc')}{' '}
                    <a href="#/pricing" className="text-indigo-600 hover:underline font-medium">
                        {t('settings.billing.viewAllPlans')}
                    </a>
                </p>

                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-slate-600">{t('settings.billing.currentPlanLabel')}</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isPro ? (
                                <>
                                    <Crown className="w-5 h-5 text-indigo-600" />
                                    <span className="font-bold text-indigo-700 text-lg">{t('settings.billing.proTeacherBadge')}</span>
                                </>
                            ) : (
                                <span className="font-semibold text-slate-700 text-lg">{t('settings.billing.freeBadge')}</span>
                            )}
                        </div>
                        {!isPro && (
                            <p className="text-xs text-slate-400 mt-1">
                                {t('settings.billing.creditsRemainingLabel')}<strong>{user.aiCreditsBalance ?? 0}</strong>
                            </p>
                        )}
                    </div>
                    {isPro ? (
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">{t('settings.billing.activeBadge')}</span>
                            <button
                                type="button"
                                onClick={handleOpenPortal}
                                disabled={portalLoading}
                                className="px-3 py-1.5 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                {portalLoading ? t('settings.billing.preparing') : t('settings.billing.paymentHistoryButton')}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStripeCheckout}
                            disabled={checkoutLoading}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            {checkoutLoading ? t('settings.billing.preparing') : t('settings.billing.upgradeToPro')}
                        </button>
                    )}
                </div>

                {checkoutError && (
                    <p className="text-red-500 text-xs mb-3">{checkoutError}</p>
                )}
                {portalError && (
                    <p className="text-red-500 text-xs mb-3">{portalError}</p>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ExternalLink className="w-4 h-4" />
                    <a href="#/pricing" className="text-indigo-600 hover:underline">
                        {t('settings.billing.fullPlanComparison')}
                    </a>
                </div>
            </Card>

            {/* Referral */}
            {firebaseUser?.uid && (
                <Card className="max-w-2xl border-amber-200 bg-amber-50/40">
                    <h2 className="text-xl font-semibold text-amber-800 mb-2 flex items-center gap-2">
                        <Gift className="w-5 h-5" /> {t('settings.billing.referralTitle')}
                    </h2>
                    <p className="text-sm text-amber-900/80 mb-3">
                        {t('settings.billing.referralDesc')}
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
                                    addNotification(t('settings.billing.linkCopied'), 'success');
                                } catch {
                                    addNotification(t('settings.billing.copyFailed'), 'error');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all flex-shrink-0"
                        >
                            <CopyIcon className="w-3.5 h-3.5" /> {t('settings.billing.copy')}
                        </button>
                    </div>
                    <div className="border border-amber-200 rounded-lg bg-white p-3">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">{t('settings.billing.readyTextLabel')}</p>
                        <p className="text-xs text-gray-700 leading-relaxed select-all">
                            {t('settings.billing.referralShareText').replace('{link}', getReferralLink(firebaseUser.uid))}
                        </p>
                        <button
                            type="button"
                            onClick={async () => {
                                const text = t('settings.billing.referralShareText').replace('{link}', getReferralLink(firebaseUser.uid));
                                try {
                                    await navigator.clipboard.writeText(text);
                                    addNotification(t('settings.billing.textCopiedShare'), 'success');
                                } catch { addNotification(t('settings.billing.copyFailed'), 'error'); }
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            <CopyIcon className="w-3 h-3" /> {t('settings.billing.copyFullText')}
                        </button>
                    </div>
                </Card>
            )}

            {/* Responsible AI links */}
            <Card className="max-w-2xl border-indigo-100 bg-indigo-50/30">
                <h2 className="text-xl font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                    🤖 {t('settings.billing.responsibleAiTitle')}
                </h2>
                <div className="flex flex-wrap gap-3">
                    <a href="#/ai/conduct"
                       className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl text-sm font-medium text-indigo-700 transition-colors shadow-sm">
                        <Shield className="w-4 h-4" /> {t('settings.billing.aiConductLink')}
                    </a>
                    <a href="#/ai/compare"
                       className="flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200 hover:border-purple-400 rounded-xl text-sm font-medium text-purple-700 transition-colors shadow-sm">
                        ⚡🧠 {t('settings.billing.aiCompareLink')}
                    </a>
                    <a href="#/usage"
                       className="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 hover:border-emerald-400 rounded-xl text-sm font-medium text-emerald-700 transition-colors shadow-sm">
                        📊 {t('settings.billing.aiUsageLink')}
                    </a>
                </div>
            </Card>

            {/* GDPR */}
            <Card className="max-w-2xl border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-slate-600" />
                    {t('settings.billing.privacyGdprTitle')}
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    {t('settings.billing.privacyGdprDesc')}{' '}
                    <a href="#/privacy" className="text-indigo-600 hover:underline font-medium">{t('settings.billing.privacyPolicyLink')}</a>
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Download className="w-4 h-4" />
                                {t('settings.billing.downloadMyDataTitle')}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {t('settings.billing.downloadMyDataDesc')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportData}
                            disabled={isExporting}
                            className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? t('settings.billing.exporting') : t('settings.billing.download')}
                        </button>
                    </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 className="font-semibold text-red-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('settings.billing.deleteAccountTitle')}
                    </h3>
                    <p className="text-xs text-red-700 mb-3">
                        {t('settings.billing.deleteAccountWarningPre')}<strong>{t('settings.billing.deleteAccountWarningBold')}</strong>{t('settings.billing.deleteAccountWarningPost')}
                    </p>
                    <p className="text-xs text-slate-600 mb-2">
                        {t('settings.billing.deleteConfirmInstruction').split('{phrase}')[0]}<strong className="font-mono">{DELETE_CONFIRM_PHRASE}</strong>{t('settings.billing.deleteConfirmInstruction').split('{phrase}')[1]}
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
                            {isDeletingAccount ? t('settings.billing.deleting') : t('settings.billing.deleteAccount')}
                        </button>
                    </div>
                </div>
            </Card>
        </>
    );
}
