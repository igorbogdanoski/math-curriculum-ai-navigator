import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { firestoreService } from '../../services/firestoreService';
import { requestNotificationPermission } from '../../services/pushService';
import { isFeedbackTaxonomyRolloutEnabled, setFeedbackTaxonomyRolloutEnabled } from '../../services/feedbackTaxonomyRollout';
import { getGlobalDefault, setGlobalDefault, type GlobalFlagKey } from '../../services/featureFlags/globalConfig';
import {
    clearDailyQuotaFlag, scheduleQuotaNotification, getQuotaDiagnostics,
    isMacedonianContextEnabled, setMacedonianContextEnabled,
    isRecoveryWorksheetEnabled, setRecoveryWorksheetEnabled,
    isIntentRouterEnabled, setIntentRouterEnabled,
    isVertexShadowEnabled, setVertexShadowEnabled,
    getShadowCompareReport, clearShadowLog,
} from '../../services/geminiService';
import { DEFAULT_MODEL } from '../../services/gemini/core';
import type { ShadowCompareReport } from '../../services/geminiService';
import { ICONS } from '../../constants';
import { logger } from '../../utils/logger';
import { useLanguage } from '../../i18n/LanguageContext';

export function SettingsDevPanel() {
    const { user, firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const { t } = useLanguage();

    // Feature flag state — all localStorage/service-based
    const [autoAiEnabled, setAutoAiEnabled] = useState(() =>
        localStorage.getItem('auto_ai_suggestions') !== 'false'
    );
    const [mkContextEnabled, setMkContextEnabled] = useState(() => isMacedonianContextEnabled());
    const [recoveryWorksheetEnabled, setRecoveryWorksheetState] = useState(() => isRecoveryWorksheetEnabled());
    const [intentRouterEnabled, setIntentRouterState] = useState(() => isIntentRouterEnabled());
    const [feedbackTaxonomyEnabled, setFeedbackTaxonomyState] = useState(() => isFeedbackTaxonomyRolloutEnabled());
    const [vertexShadowEnabled, setVertexShadowState] = useState(() => isVertexShadowEnabled());
    const [shadowReport, setShadowReport] = useState<ShadowCompareReport | null>(null);
    const [isMentorEnabled, setIsMentorEnabled] = useState(user?.isMentor ?? false);

    // Global (admin-controlled) fleet-wide defaults — a separate layer from the per-user toggles above.
    const [globalFlags, setGlobalFlags] = useState<Record<GlobalFlagKey, boolean>>(() => ({
        mk_local_context_enabled: getGlobalDefault('mk_local_context_enabled') ?? true,
        recovery_worksheet_enabled: getGlobalDefault('recovery_worksheet_enabled') ?? false,
        intent_router_enabled: getGlobalDefault('intent_router_enabled') ?? true,
        vertex_ai_shadow_enabled: getGlobalDefault('vertex_ai_shadow_enabled') ?? false,
        feedback_taxonomy_rollout_enabled: getGlobalDefault('feedback_taxonomy_rollout_enabled') ?? false,
    }));
    const [isSavingGlobalFlag, setIsSavingGlobalFlag] = useState<GlobalFlagKey | null>(null);

    // Quota dashboard state
    const [quotaStatus, setQuotaStatus] = useState<{ exhausted: boolean; resetTime: string; resetDate: string; source: string }>({ exhausted: false, resetTime: '', resetDate: '', source: '' });
    const [isTesting, setIsTesting] = useState(false);
    const [apiTestResult, setApiTestResult] = useState<string | null>(null);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    // Admin migration state
    const [isMigrating, setIsMigrating] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{
        message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void;
    } | null>(null);

    useEffect(() => { setIsMentorEnabled(user?.isMentor ?? false); }, [user?.isMentor]);

    useEffect(() => {
        const update = () => {
            const diag = getQuotaDiagnostics();
            if (!diag.isCurrentlyExhausted) {
                setQuotaStatus({ exhausted: false, resetTime: '', resetDate: '', source: diag.source });
                return;
            }
            const resetDate = diag.nextResetMs
                ? new Date(diag.nextResetMs).toLocaleDateString('mk-MK', { weekday: 'short', day: 'numeric', month: 'short' })
                : '';
            const resetTime = diag.nextResetMs
                ? new Date(diag.nextResetMs).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })
                : '09:00';
            setQuotaStatus({ exhausted: true, resetTime, resetDate, source: diag.source });
        };
        update();
        const id = setInterval(update, 60_000);
        return () => clearInterval(id);
    }, []);

    const toggleAutoAi = () => {
        const next = !autoAiEnabled;
        setAutoAiEnabled(next);
        localStorage.setItem('auto_ai_suggestions', String(next));
    };
    const toggleMkContext = () => {
        const next = !mkContextEnabled;
        setMkContextEnabled(next);
        setMacedonianContextEnabled(next);
    };
    const toggleRecoveryWorksheet = () => {
        const next = !recoveryWorksheetEnabled;
        setRecoveryWorksheetState(next);
        setRecoveryWorksheetEnabled(next);
    };
    const toggleIntentRouter = () => {
        const next = !intentRouterEnabled;
        setIntentRouterState(next);
        setIntentRouterEnabled(next);
    };
    const toggleFeedbackTaxonomy = () => {
        const next = !feedbackTaxonomyEnabled;
        setFeedbackTaxonomyState(next);
        setFeedbackTaxonomyRolloutEnabled(next);
    };
    const toggleVertexShadow = () => {
        const next = !vertexShadowEnabled;
        setVertexShadowState(next);
        setVertexShadowEnabled(next);
    };
    const loadShadowReport = () => { setShadowReport(getShadowCompareReport()); };
    const handleClearShadowLog = () => {
        clearShadowLog();
        setShadowReport(null);
        addNotification(t('settings.dev.shadowLogCleared'), 'success');
    };

    const toggleMentor = async () => {
        if (!firebaseUser?.uid) return;
        const next = !isMentorEnabled;
        setIsMentorEnabled(next);
        try {
            await firestoreService.toggleMentorStatus(firebaseUser.uid, next);
            addNotification(next ? t('settings.dev.mentorOnSuccess') : t('settings.dev.mentorOffSuccess'), 'success');
        } catch {
            setIsMentorEnabled(!next);
            addNotification(t('settings.dev.mentorToggleError'), 'error');
        }
    };

    const toggleGlobalFlag = async (key: GlobalFlagKey) => {
        const next = !globalFlags[key];
        setGlobalFlags(prev => ({ ...prev, [key]: next }));
        setIsSavingGlobalFlag(key);
        try {
            await setGlobalDefault(key, next);
            addNotification(t('settings.dev.globalFlagSaveSuccess'), 'success');
        } catch {
            setGlobalFlags(prev => ({ ...prev, [key]: !next }));
            addNotification(t('settings.dev.globalFlagSaveError'), 'error');
        } finally {
            setIsSavingGlobalFlag(null);
        }
    };

    const handleClearQuotaFlag = () => {
        clearDailyQuotaFlag();
        setQuotaStatus({ exhausted: false, resetTime: '', resetDate: '', source: '' });
        setApiTestResult(null);
        addNotification(t('settings.dev.quotaFlagCleared'), 'success');
    };

    const handleTestApi = async () => {
        setIsTesting(true);
        setApiTestResult(null);
        try {
            if (!firebaseUser) {
                setApiTestResult(t('settings.dev.testApiNotLoggedIn'));
                return;
            }
            const token = await firebaseUser.getIdToken();
            const resp = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    contents: [{ role: 'user', parts: [{ text: 'Кажи „тест".' }] }],
                    config: { maxOutputTokens: 10 },
                }),
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                setApiTestResult(t('settings.dev.testApiSuccess').replace('{text}', (data.text || '').slice(0, 60)));
            } else {
                const qType = data.quotaType ? ` [quotaType: ${data.quotaType}]` : '';
                const errMsg = (data.error || JSON.stringify(data)).slice(0, 200);
                setApiTestResult(`❌ HTTP ${resp.status}${qType}: ${errMsg}`);
            }
        } catch (e) {
            setApiTestResult(t('settings.dev.testApiNetworkError').replace('{message}', e instanceof Error ? e.message : String(e)));
        } finally {
            setIsTesting(false);
        }
    };

    const handleEnableNotifications = async () => {
        if (typeof Notification === 'undefined') {
            addNotification(t('settings.dev.notifUnsupported'), 'error');
            return;
        }
        if (!firebaseUser?.uid) {
            addNotification(t('settings.dev.notifNeedsLogin'), 'error');
            return;
        }
        try {
            const token = await requestNotificationPermission(firebaseUser.uid);
            const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
            setNotifPermission(permission);
            if (permission !== 'granted') {
                addNotification(t('settings.dev.notifDenied'), 'warning');
                return;
            }
            if (token) {
                addNotification(t('settings.dev.notifEnabledRegistered'), 'success');
            } else {
                addNotification(t('settings.dev.notifGrantedNoToken'), 'warning');
            }
            try {
                const stored = localStorage.getItem('ai_daily_quota_exhausted');
                const { nextResetMs } = stored ? JSON.parse(stored) : {};
                if (nextResetMs) scheduleQuotaNotification(nextResetMs);
            } catch { /* ignore */ }
        } catch {
            setNotifPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
            addNotification(t('settings.dev.notifRegisterError'), 'error');
        }
    };

    const handleMigrateCurriculum = () => {
        setConfirmDialog({
            message: t('settings.dev.migrationConfirm'),
            variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsMigrating(true);
                try {
                    const { fullCurriculumData } = await import('../../data/curriculum');
                    await firestoreService.saveFullCurriculum(fullCurriculumData);
                    addNotification(t('settings.dev.migrationSuccess'), 'success');
                } catch (error) {
                    addNotification(t('settings.dev.migrationError'), 'error');
                    logger.error('Migration failed:', error);
                } finally {
                    setIsMigrating(false);
                }
            },
        });
    };

    function ToggleRow({ label, sub, on, onToggle, color = 'brand-primary' }: {
        label: string; sub: string; on: boolean; onToggle: () => void; color?: string;
    }) {
        const bgOn = color === 'brand-primary' ? 'bg-brand-primary'
            : color === 'violet' ? 'bg-violet-600'
            : color === 'emerald' ? 'bg-emerald-600'
            : color === 'indigo' ? 'bg-indigo-600'
            : color === 'blue' ? 'bg-blue-600'
            : color === 'amber' ? 'bg-amber-500'
            : 'bg-brand-primary';
        return (
            <div className="flex items-center justify-between py-3 border-t">
                <div>
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    title={on ? t('settings.dev.toggleOffAria').replace('{label}', label) : t('settings.dev.toggleOnAria').replace('{label}', label)}
                    aria-label={on ? t('settings.dev.toggleOffAria').replace('{label}', label) : t('settings.dev.toggleOnAria').replace('{label}', label)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? bgOn : 'bg-gray-300'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Feature flags card */}
            <Card className="max-w-2xl">
                <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('settings.dev.title')}</h2>
                <div className="space-y-0">
                    <ToggleRow label={t('settings.dev.autoAiLabel')} sub={t('settings.dev.autoAiSub')} on={autoAiEnabled} onToggle={toggleAutoAi} />
                    <ToggleRow label={t('settings.dev.mkContextLabel')} sub={t('settings.dev.mkContextSub')} on={mkContextEnabled} onToggle={toggleMkContext} />
                    <ToggleRow label={t('settings.dev.intentRouterLabel')} sub={t('settings.dev.intentRouterSub')} on={intentRouterEnabled} onToggle={toggleIntentRouter} color="violet" />
                    <ToggleRow label={t('settings.dev.recoveryWorksheetLabel')} sub={t('settings.dev.recoveryWorksheetSub')} on={recoveryWorksheetEnabled} onToggle={toggleRecoveryWorksheet} color="emerald" />
                    <ToggleRow label={t('settings.dev.feedbackTaxonomyLabel')} sub={t('settings.dev.feedbackTaxonomySub')} on={feedbackTaxonomyEnabled} onToggle={toggleFeedbackTaxonomy} color="indigo" />
                    <ToggleRow label={t('settings.dev.vertexShadowLabel')} sub={t('settings.dev.vertexShadowSub')} on={vertexShadowEnabled} onToggle={toggleVertexShadow} color="blue" />
                </div>

                {vertexShadowEnabled && (
                    <div className="py-3 border-t space-y-2">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">E4 Compare Report</p>
                        <div className="flex gap-2">
                            <button type="button" onClick={loadShadowReport} className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                                {t('settings.dev.showReport')}
                            </button>
                            <button type="button" onClick={handleClearShadowLog} className="text-xs px-3 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                                {t('settings.dev.clearLog')}
                            </button>
                        </div>
                        {shadowReport && (
                            <div className="mt-2 overflow-x-auto rounded border border-blue-100 bg-blue-50 text-xs">
                                {shadowReport.sampleSize === 0 ? (
                                    <p className="p-3 text-gray-500">{t('settings.dev.noLogsYet')}</p>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-blue-200">
                                                <th className="px-3 py-2 font-semibold text-blue-800">{t('settings.dev.metricCol')}</th>
                                                <th className="px-3 py-2 font-semibold text-blue-800">Gemini (prod)</th>
                                                <th className="px-3 py-2 font-semibold text-blue-800">Vertex (shadow)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-100">
                                            <tr><td className="px-3 py-2 text-gray-600">{t('settings.dev.sampleSizeRow')}</td><td className="px-3 py-2">{shadowReport.sampleSize}</td><td className="px-3 py-2">{shadowReport.sampleSize}</td></tr>
                                            <tr><td className="px-3 py-2 text-gray-600">{t('settings.dev.avgLatencyRow')}</td><td className="px-3 py-2">{shadowReport.geminiAvgLatencyMs} ms</td><td className="px-3 py-2">{shadowReport.vertexAvgLatencyMs !== null ? `${shadowReport.vertexAvgLatencyMs} ms` : '—'}</td></tr>
                                            <tr><td className="px-3 py-2 text-gray-600">{t('settings.dev.successRateRow')}</td><td className="px-3 py-2">100%</td><td className="px-3 py-2">{(shadowReport.vertexSuccessRate * 100).toFixed(0)}%</td></tr>
                                            <tr><td className="px-3 py-2 text-gray-600">{t('settings.dev.errorsRow')}</td><td className="px-3 py-2">—</td><td className="px-3 py-2">{(shadowReport.vertexErrorRate * 100).toFixed(0)}%</td></tr>
                                            <tr><td className="px-3 py-2 text-gray-600">Not configured</td><td className="px-3 py-2">—</td><td className="px-3 py-2">{(shadowReport.vertexNotConfiguredRate * 100).toFixed(0)}%</td></tr>
                                            <tr><td className="px-3 py-2 text-gray-600">{t('settings.dev.relativeCostRow')}</td><td className="px-3 py-2">1.00×</td><td className="px-3 py-2">{shadowReport.vertexRelativeCost !== null ? `~${shadowReport.vertexRelativeCost.toFixed(2)}×` : '—'}</td></tr>
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <ToggleRow label={t('settings.dev.mentorLabel')} sub={t('settings.dev.mentorSub')} on={isMentorEnabled} onToggle={toggleMentor} color="amber" />
            </Card>

            {/* Admin migration */}
            {user?.role === 'admin' && (
                <Card className="max-w-2xl border-orange-200 bg-orange-50/30">
                    <h2 className="text-2xl font-semibold text-orange-800 mb-4 flex items-center gap-2">
                        <ICONS.settings className="w-6 h-6" />
                        {t('settings.dev.adminDataTitle')}
                    </h2>
                    <p className="text-sm text-orange-700 mb-6">
                        {t('settings.dev.adminDataDesc')}
                    </p>
                    <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-gray-900">{t('settings.dev.curriculumMigrationTitle')}</h3>
                                <p className="text-xs text-gray-500 mt-1">{t('settings.dev.curriculumVersion')}</p>
                            </div>
                            <button
                                onClick={handleMigrateCurriculum}
                                disabled={isMigrating}
                                className="bg-orange-600 text-white px-6 py-2.5 rounded-xl shadow-lg hover:bg-orange-700 transition-all flex items-center gap-2 disabled:bg-gray-400 font-bold"
                            >
                                {isMigrating ? (
                                    <><ICONS.spinner className="w-5 h-5 animate-spin" />{t('settings.dev.syncing')}</>
                                ) : (
                                    <><ICONS.zap className="w-5 h-5" />{t('settings.dev.syncWithFirestore')}</>
                                )}
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Global (admin-controlled) feature-flag defaults */}
            {user?.role === 'admin' && (
                <Card className="max-w-2xl border-purple-200 bg-purple-50/30">
                    <h2 className="text-xl font-semibold text-purple-800 mb-2">{t('settings.dev.globalSettingsTitle')}</h2>
                    <p className="text-sm text-purple-700 mb-2">
                        {t('settings.dev.globalSettingsDesc')}
                    </p>
                    <div className="space-y-0">
                        <ToggleRow label={t('settings.dev.mkContextGlobalLabel')} sub={t('settings.dev.globalDefaultSub')} on={globalFlags.mk_local_context_enabled} onToggle={() => toggleGlobalFlag('mk_local_context_enabled')} color="indigo" />
                        <ToggleRow label={t('settings.dev.recoveryWorksheetGlobalLabel')} sub={t('settings.dev.globalDefaultSub')} on={globalFlags.recovery_worksheet_enabled} onToggle={() => toggleGlobalFlag('recovery_worksheet_enabled')} color="emerald" />
                        <ToggleRow label={t('settings.dev.intentRouterGlobalLabel')} sub={t('settings.dev.globalDefaultSub')} on={globalFlags.intent_router_enabled} onToggle={() => toggleGlobalFlag('intent_router_enabled')} color="violet" />
                        <ToggleRow label={t('settings.dev.vertexShadowGlobalLabel')} sub={t('settings.dev.globalDefaultSub')} on={globalFlags.vertex_ai_shadow_enabled} onToggle={() => toggleGlobalFlag('vertex_ai_shadow_enabled')} color="blue" />
                        <ToggleRow label={t('settings.dev.feedbackTaxonomyGlobalLabel')} sub={t('settings.dev.globalDefaultSub')} on={globalFlags.feedback_taxonomy_rollout_enabled} onToggle={() => toggleGlobalFlag('feedback_taxonomy_rollout_enabled')} color="indigo" />
                    </div>
                    {isSavingGlobalFlag && <p className="text-xs text-purple-600 mt-2">{t('settings.dev.savingEllipsis')}</p>}
                </Card>
            )}

            {/* AI Quota Dashboard */}
            <Card className={`max-w-2xl ${quotaStatus.exhausted ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}>
                <h2 className={`text-2xl font-semibold mb-4 flex items-center gap-2 ${quotaStatus.exhausted ? 'text-red-800' : 'text-green-800'}`}>
                    <ICONS.zap className="w-6 h-6" />
                    {t('settings.dev.quotaStatusTitle')}
                </h2>
                <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">{t('settings.dev.geminiApiStatus')}</span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${quotaStatus.exhausted ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {quotaStatus.exhausted ? t('settings.dev.quotaExhausted') : t('settings.dev.quotaActive')}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('settings.dev.geminiResetDaily')}</span>
                        <span className="font-semibold text-gray-700">{t('settings.dev.resetTimeNote')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                        <span className="text-gray-500">{t('settings.dev.notifOnRefresh')}</span>
                        {notifPermission === 'granted' ? (
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">{t('settings.dev.notifEnabledBadge')}</span>
                        ) : notifPermission === 'denied' ? (
                            <span className="text-xs font-semibold text-red-500">{t('settings.dev.notifDeniedBadge')}</span>
                        ) : (
                            <button type="button" onClick={handleEnableNotifications} className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition">
                                {t('settings.dev.enableNotifications')}
                            </button>
                        )}
                    </div>
                    {quotaStatus.exhausted && (
                        <>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">{t('settings.dev.resetsOn')}</span>
                                <span className="font-bold text-red-600">{t('settings.dev.resetAtTemplate').replace('{date}', quotaStatus.resetDate).replace('{time}', quotaStatus.resetTime)}</span>
                            </div>
                            {quotaStatus.source && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">{t('settings.dev.flagStoredIn')}</span>
                                    <span className="font-mono text-gray-500">{quotaStatus.source}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                        <p className="text-xs text-gray-400">
                            {t('settings.dev.quotaButtonsHint')}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={handleClearQuotaFlag} className="text-xs font-bold px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition">
                                {t('settings.dev.clearFlag')}
                            </button>
                            <button type="button" onClick={handleTestApi} disabled={isTesting} className="text-xs font-bold px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition disabled:opacity-50">
                                {isTesting ? t('settings.dev.testing') : t('settings.dev.testApiConnection')}
                            </button>
                        </div>
                        {apiTestResult && (
                            <div className={`text-xs font-mono p-2 rounded-lg break-all ${apiTestResult.startsWith('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                {apiTestResult}
                            </div>
                        )}
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                    {t('settings.dev.quotaFooterNote')}
                </p>
            </Card>

            {confirmDialog && (
                <ConfirmDialog
                    message={confirmDialog.message}
                    title={confirmDialog.title}
                    variant={confirmDialog.variant ?? 'warning'}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </>
    );
}
