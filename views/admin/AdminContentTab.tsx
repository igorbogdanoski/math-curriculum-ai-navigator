import React from 'react';
import { Card } from '../../components/common/Card';
import { DatabaseZap, Zap, RefreshCw } from 'lucide-react';
import type { RagStats } from '../../services/ragService';
import { getEffectiveSimilarityThreshold } from '../../services/ragService';
import { useLanguage } from '../../i18n/LanguageContext';

interface AdminContentTabProps {
    ragIndexStatus: Record<number, 'idle' | 'running' | 'done' | 'error'>;
    ragIndexLog: string[];
    ragStats: RagStats | null;
    ragEnabled: boolean;
    handleIndexGrade: (grade: number) => void;
    handleRefreshRagStats: () => void;
    handleToggleRag: (enabled: boolean) => void;
}

export function AdminContentTab({
    ragIndexStatus, ragIndexLog, ragStats, ragEnabled,
    handleIndexGrade, handleRefreshRagStats, handleToggleRag,
}: AdminContentTabProps) {
    const { t } = useLanguage();
    return (
        <div className="space-y-4">
            <Card className="p-5 border-2 border-dashed border-emerald-200 bg-emerald-50">
                <div className="flex items-start gap-3">
                    <DatabaseZap className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-emerald-800 mb-0.5">
                            {t('admin.content.ragIndexTitle')}
                        </h2>
                        <p className="text-xs text-emerald-700 mb-3">
                            {t('admin.content.ragIndexDescPre')}<code className="bg-emerald-100 px-1 rounded">concept_embeddings</code>{t('admin.content.ragIndexDescMid')}<strong>{t('admin.content.ragIndexDescBold')}</strong>{t('admin.content.ragIndexDescPost')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {([6, 7, 8] as const).map(grade => {
                                const status = ragIndexStatus[grade];
                                const label = grade === 6 ? 'VI' : grade === 7 ? 'VII' : 'VIII';
                                return (
                                    <button
                                        key={grade}
                                        type="button"
                                        disabled={status === 'running'}
                                        onClick={() => handleIndexGrade(grade)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                            status === 'running'
                                                ? 'bg-emerald-200 text-emerald-500 cursor-not-allowed'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        }`}
                                    >
                                        <DatabaseZap className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-pulse' : ''}`} />
                                        {status === 'running' ? t('admin.content.indexing') : status === 'done' ? t('admin.content.indexedGrade').replace('{label}', label) : t('admin.content.indexGrade').replace('{label}', label)}
                                    </button>
                                );
                            })}
                        </div>
                        {ragIndexLog.length > 0 && (
                            <div className="mt-3 bg-white/70 rounded-lg border border-emerald-200 p-3 max-h-40 overflow-y-auto">
                                {ragIndexLog.map((line, i) => (
                                    <p key={i} className="text-[11px] font-mono text-gray-700 leading-relaxed">{line}</p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card className="p-5 border border-violet-200 bg-violet-50">
                <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <h2 className="text-sm font-bold text-violet-800">{t('admin.content.ragStatsTitle')}</h2>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={ragEnabled}
                                        onChange={e => handleToggleRag(e.target.checked)}
                                        className="rounded"
                                    />
                                    {t('admin.content.enabled')}
                                </label>
                                <button
                                    type="button"
                                    onClick={handleRefreshRagStats}
                                    className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 underline"
                                >
                                    <RefreshCw className="w-3 h-3" /> {t('admin.users.refresh')}
                                </button>
                            </div>
                        </div>
                        {!ragEnabled && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                                {t('admin.content.ragDisabledWarning')}
                            </p>
                        )}
                        {ragStats && ragStats.count > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                                {[
                                    { label: t('admin.content.statSearches'), value: ragStats.count },
                                    { label: t('admin.content.statAvgHits'), value: ragStats.avgHits.toFixed(1) },
                                    { label: 'Embed P50', value: `${ragStats.embedP50.toFixed(0)}ms` },
                                    { label: 'Embed P95', value: `${ragStats.embedP95.toFixed(0)}ms` },
                                    { label: 'Fetch P50', value: `${ragStats.fetchP50.toFixed(0)}ms` },
                                    { label: 'Fetch P95', value: `${ragStats.fetchP95.toFixed(0)}ms` },
                                    { label: 'Total P50', value: `${ragStats.totalP50.toFixed(0)}ms` },
                                    { label: t('admin.content.statThreshold'), value: getEffectiveSimilarityThreshold().toFixed(2) },
                                ].map(s => (
                                    <div key={s.label} className="bg-white/80 rounded-lg px-3 py-2 text-center border border-violet-100">
                                        <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide">{s.label}</p>
                                        <p className="text-sm font-bold text-violet-800">{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-violet-600 mt-1">
                                {t('admin.content.noStatsYet')}
                            </p>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
