/**
 * SLODashboardView — L1 Reliability SLO Dashboard (admin-only).
 *
 * 5 panels:
 *   1. AI Latency          — p50/p95 from shadow log geminiLatencyMs
 *   2. AI Availability     — quota status + error rate from shadow log
 *   3. AI Routing          — intent router lite/standard/advanced split
 *   4. CI Reliability      — GitHub Actions quality-gate pass rate (via /api/slo-summary)
 *   5. Production Health   — Sentry unresolved issues + UNCLASSIFIED ratio (via /api/slo-summary)
 *
 * World-class features:
 *   — RAG indicator per metric (Green / Amber / Red)
 *   — Data freshness timestamp
 *   — Auto-refresh every 60s for client-side panels
 *   — Export to Markdown (for EOD reports)
 *   — Graceful degradation when data unavailable
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, RefreshCw, Download, CheckCircle2, AlertTriangle, XCircle,
  Zap, ShieldCheck, GitMerge, Server, Clock, TrendingUp, Smartphone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { getShadowLog, getShadowCompareReport } from '../services/gemini/vertexShadow';
import { getRouterStats } from '../services/gemini/intentRouter';
import { getQuotaDiagnostics } from '../services/gemini/core';

// ─── Types ────────────────────────────────────────────────────────────────────

type RAGStatus = 'green' | 'amber' | 'red' | 'unknown';

interface SloAPISummary {
  generatedAt: string;
  ci: {
    available: boolean;
    passRate: number | null;
    successCount: number | null;
    totalCount: number | null;
    closeTriggerReached: boolean;
    lastRunAt: string | null;
  };
  sentry: {
    available: boolean;
    unresolvedIssues: number | null;
    totalEvents: number | null;
    unclassifiedRatio: number | null;
    topErrors: { code: string; count: number }[];
    periodDays: number;
  };
}

type WebVitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
type WebVitalDevice = 'mobile' | 'tablet' | 'desktop' | 'unknown';

interface WebVitalSnapshot {
  metric: WebVitalName;
  count: number;
  p50: number;
  p75: number;
  p95: number;
  budget: number;
  overBudget: boolean;
}

interface WebVitalDeviceSnapshot extends WebVitalSnapshot {
  device: WebVitalDevice;
}

interface WebVitalsSplitResponse {
  samples: WebVitalSnapshot[];
  byDevice: WebVitalDeviceSnapshot[];
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const SLO_THRESHOLDS = {
  aiP95LatencyMs:   { green: 3000,  amber: 6000  }, // p95 <3s green, <6s amber
  aiErrorRatePct:   { green: 1,     amber: 3     }, // <=1% green, <=3% amber
  ciPassRatePct:    { green: 95,    amber: 80    }, // ≥95% green, ≥80% amber
  unclassifiedPct:  { green: 15,    amber: 30    }, // <15% green, <30% amber
} as const;

function rag(value: number | null, threshold: { green: number; amber: number }, inverted = false): RAGStatus {
  if (value === null) return 'unknown';
  if (!inverted) {
    // higher = better (e.g. pass rate)
    if (value >= threshold.green) return 'green';
    if (value >= threshold.amber) return 'amber';
    return 'red';
  } else {
    // lower = better (e.g. latency, error rate)
    if (value <= threshold.green) return 'green';
    if (value <= threshold.amber) return 'amber';
    return 'red';
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const RAG_STYLES: Record<RAGStatus, { dot: string; text: string; badge: string; border: string; bg: string }> = {
  green:   { dot: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-800',  border: 'border-green-200',  bg: 'from-green-50 to-emerald-50'   },
  amber:   { dot: 'bg-amber-400',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-800',  border: 'border-amber-200',  bg: 'from-amber-50 to-yellow-50'    },
  red:     { dot: 'bg-red-500',    text: 'text-red-700',    badge: 'bg-red-100 text-red-800',      border: 'border-red-200',    bg: 'from-red-50 to-rose-50'        },
  unknown: { dot: 'bg-gray-300',   text: 'text-gray-500',   badge: 'bg-gray-100 text-gray-600',    border: 'border-gray-200',   bg: 'from-gray-50 to-slate-50'      },
};

const RAGIcon: React.FC<{ status: RAGStatus; size?: string }> = ({ status, size = 'w-4 h-4' }) => {
  if (status === 'green')   return <CheckCircle2 className={`${size} text-green-500`} />;
  if (status === 'amber')   return <AlertTriangle className={`${size} text-amber-500`} />;
  if (status === 'red')     return <XCircle className={`${size} text-red-500`} />;
  return <div className={`${size} rounded-full bg-gray-300`} />;
};

const StatusDot: React.FC<{ status: RAGStatus }> = ({ status }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${status === 'unknown' ? 'bg-gray-300' : RAG_STYLES[status].dot} ${status === 'green' ? 'animate-pulse' : ''}`} />
);

function fmt(n: number | null, decimals = 0, unit = ''): string {
  if (n === null) return '—';
  return `${n.toFixed(decimals)}${unit}`;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'пред < 1мин';
  if (m < 60) return `пред ${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `пред ${h}ч`;
  return `пред ${Math.floor(h / 24)} ден(а)`;
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

const Panel: React.FC<{
  title: string;
  icon: React.ReactNode;
  status: RAGStatus;
  children: React.ReactNode;
  refreshedAt?: string | null;
}> = ({ title, icon, status, children, refreshedAt }) => {
  const s = RAG_STYLES[status];
  return (
    <div className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span className={s.text}>{icon}</span>
        <h3 className={`text-sm font-bold uppercase tracking-widest ${s.text}`}>{title}</h3>
        <div className="flex-1" />
        <RAGIcon status={status} size="w-4 h-4" />
      </div>
      {children}
      {refreshedAt && (
        <p className="text-[10px] text-gray-400 mt-auto">Освежено: {relativeTime(refreshedAt)}</p>
      )}
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  value: string;
  status?: RAGStatus;
  sub?: string;
}> = ({ label, value, status, sub }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-gray-600 font-medium">{label}</span>
    <div className="flex items-center gap-1.5">
      {status && <StatusDot status={status} />}
      <span className={`text-sm font-black ${status ? RAG_STYLES[status].text : 'text-gray-800'}`}>{value}</span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  </div>
);

// ─── Main View ────────────────────────────────────────────────────────────────

export const SLODashboardView: React.FC = () => {
  const { user, firebaseUser, isLoading: authLoading } = useAuth();
  const { navigate } = useNavigation();
  const [apiData, setApiData] = useState<SloAPISummary | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiAuthBlocked, setApiAuthBlocked] = useState(false);
  const [apiServerBlocked, setApiServerBlocked] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string>(new Date().toISOString());
  const [copied, setCopied] = useState(false);
  const [webVitals, setWebVitals] = useState<WebVitalsSplitResponse | null>(null);
  const [webVitalsLoading, setWebVitalsLoading] = useState(true);

  // ── Client-side metrics ──────────────────────────────────────────────────────
  const shadowLog    = getShadowLog();
  const shadowReport = getShadowCompareReport();
  const routerStats  = getRouterStats();
  const quotaDiag    = getQuotaDiagnostics();

  // AI Latency (p50/p95 from shadow log)
  const latencies = shadowLog.map(e => e.geminiLatencyMs).filter(Boolean);
  const aiP50  = percentile(latencies, 50);
  const aiP95  = percentile(latencies, 95);
  const aiP95Status = rag(aiP95, { green: SLO_THRESHOLDS.aiP95LatencyMs.green, amber: SLO_THRESHOLDS.aiP95LatencyMs.amber }, true);

  // AI Error rate
  const aiErrorRatePct = shadowReport.sampleSize > 0 ? shadowReport.vertexErrorRate * 100 : null;
  const aiErrorStatus  = rag(aiErrorRatePct, { green: SLO_THRESHOLDS.aiErrorRatePct.green, amber: SLO_THRESHOLDS.aiErrorRatePct.amber }, true);

  // AI Availability (quota)
  const quotaStatus: RAGStatus = quotaDiag.isCurrentlyExhausted ? 'red' : 'green';

  // Overall AI panel status
  const aiPanelStatus = ([aiP95Status, aiErrorStatus, quotaStatus] as RAGStatus[])
    .reduce((worst, s) => {
      const rank: Record<RAGStatus, number> = { green: 0, unknown: 1, amber: 2, red: 3 };
      return rank[s] > rank[worst] ? s : worst;
    }, 'green' as RAGStatus);

  // Router stats breakdown
  const routerEntries = Object.entries(routerStats);
  const totalRouted   = routerEntries.reduce((s, [, v]) => s + v.count, 0);
  const liteCount     = routerEntries.filter(([, v]) => v.model.includes('lite')).reduce((s, [, v]) => s + v.count, 0);
  const litePct       = totalRouted > 0 ? (liteCount / totalRouted) * 100 : 0;

  // ── Server-side metrics ──────────────────────────────────────────────────────
  const fetchApiData = useCallback(async () => {
    if (!firebaseUser) {
      setApiError('Потребна е најава за operational summary.');
      setApiLoading(false);
      return;
    }

    setApiLoading(true);
    setApiError(null);
    try {
      let token = await firebaseUser.getIdToken();
      let res = await fetch('/api/slo-summary', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Retry once with a forced token refresh if the first request used a stale token.
      if (res.status === 401 || res.status === 403) {
        token = await firebaseUser.getIdToken(true);
        res = await fetch('/api/slo-summary', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!res.ok) {
        const payload = await res.json().catch(async () => {
          const text = await res.text().catch(() => '');
          return text ? { error: text } : null;
        });
        const errMsg = typeof payload?.error === 'string' ? payload.error : `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403) {
          setApiAuthBlocked(true);
        } else if (res.status >= 500) {
          setApiServerBlocked(true);
        }
        throw new Error(errMsg);
      }

      setApiAuthBlocked(false);
      setApiServerBlocked(false);
      const json: SloAPISummary = await res.json();
      setApiData(json);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Грешка при вчитување');
    } finally {
      setApiLoading(false);
    }
  }, [firebaseUser]);

  const fetchWebVitals = useCallback(async () => {
    setWebVitalsLoading(true);
    try {
      const res = await fetch('/api/web-vitals?split=device');
      if (!res.ok) {
        setWebVitals(null);
        return;
      }
      const json = (await res.json()) as WebVitalsSplitResponse;
      setWebVitals(json);
    } catch {
      setWebVitals(null);
    } finally {
      setWebVitalsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role !== 'admin') {
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin') {
      void fetchApiData();
      void fetchWebVitals();
    }
  }, [authLoading, user, fetchApiData, fetchWebVitals]);

  useEffect(() => {
    if (authLoading || user?.role !== 'admin' || apiAuthBlocked || apiServerBlocked) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setRefreshedAt(new Date().toISOString());
        void fetchApiData();
        void fetchWebVitals();
      }
    }, 60000);

    return () => window.clearInterval(interval);
  }, [authLoading, user, fetchApiData, fetchWebVitals, apiAuthBlocked, apiServerBlocked]);

  const refresh = () => {
    setApiAuthBlocked(false);
    setApiServerBlocked(false);
    setRefreshedAt(new Date().toISOString());
    void fetchApiData();
    void fetchWebVitals();
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500">Се проверува operational пристап…</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  // CI Reliability derived
  const ciPassRate   = apiData?.ci.passRate ?? null;
  const ciStatus     = rag(ciPassRate, { green: SLO_THRESHOLDS.ciPassRatePct.green, amber: SLO_THRESHOLDS.ciPassRatePct.amber });

  // Web Vitals device split derived
  const webVitalsByDevice = webVitals?.byDevice ?? [];
  const webVitalsAll = webVitals?.samples ?? [];
  const webVitalsAnyOver = webVitalsAll.some(s => s.overBudget);
  const webVitalsStatus: RAGStatus = webVitalsAll.length === 0
    ? 'unknown'
    : webVitalsAnyOver ? 'amber' : 'green';

  // Sentry health derived
  const unclassifiedPct = apiData?.sentry.unclassifiedRatio != null
    ? apiData.sentry.unclassifiedRatio * 100 : null;
  const sentryStatus = rag(unclassifiedPct, { green: SLO_THRESHOLDS.unclassifiedPct.green, amber: SLO_THRESHOLDS.unclassifiedPct.amber }, true);

  // Operational (server) status excludes client-session shadow metrics.
  const operationalStatuses: RAGStatus[] = [ciStatus, sentryStatus];
  const operationalHasRed = operationalStatuses.includes('red');
  const operationalHasAmber = operationalStatuses.includes('amber');
  const operationalOverall: RAGStatus = operationalHasRed ? 'red' : operationalHasAmber ? 'amber' : 'green';
  const operationalLabel = operationalOverall === 'green'
    ? 'Operational (server) SLO — ОК'
    : operationalOverall === 'amber'
      ? 'Operational (server) SLO — предупредување'
      : 'Operational (server) SLO — критично';

  const aiSessionLabel = aiPanelStatus === 'green'
    ? 'AI session (shadow) — ОК'
    : aiPanelStatus === 'amber'
      ? 'AI session (shadow) — предупредување'
      : aiPanelStatus === 'red'
        ? 'AI session (shadow) — критично'
        : 'AI session (shadow) — недоволно податоци';

  // ── Export to Markdown ───────────────────────────────────────────────────────
  const exportMarkdown = () => {
    const lines: string[] = [
      '# SLO Dashboard — EOD Report',
      `**Датум:** ${new Date().toLocaleString('mk-MK')}`,
      '',
      '## AI Performance',
      `- p50 латенција: ${fmtMs(aiP50)}`,
      `- p95 латенција: ${fmtMs(aiP95)} ${aiP95Status === 'green' ? '✅' : aiP95Status === 'amber' ? '🟡' : '❌'}`,
      `- Error rate: ${fmt(aiErrorRatePct, 1, '%')} ${aiErrorStatus === 'green' ? '✅' : aiErrorStatus === 'amber' ? '🟡' : '❌'}`,
      `- Quota: ${quotaDiag.isCurrentlyExhausted ? '❌ EXHAUSTED' : '✅ OK'}`,
      `- Shadow samples: ${shadowReport.sampleSize}`,
      '',
      '## AI Routing (оваа сесија)',
      `- Вкупно повици: ${totalRouted}`,
      `- Lite model: ${liteCount} (${litePct.toFixed(0)}%)`,
      '',
      '## CI Reliability',
      `- Pass rate: ${fmt(ciPassRate, 1, '%')} (${apiData?.ci.successCount ?? '?'}/${apiData?.ci.totalCount ?? '?'}) ${ciStatus === 'green' ? '✅' : ciStatus === 'amber' ? '🟡' : '❌'}`,
      `- A4 Close trigger: ${apiData?.ci.closeTriggerReached ? '✅ Reached' : '⏳ Pending'}`,
      '',
      '## Production Health (Sentry)',
      `- Unresolved issues: ${apiData?.sentry.unresolvedIssues ?? '—'}`,
      `- Total events (${apiData?.sentry.periodDays ?? 14}d): ${apiData?.sentry.totalEvents ?? '—'}`,
      `- UNCLASSIFIED ratio: ${fmt(unclassifiedPct, 1, '%')} ${sentryStatus === 'green' ? '✅' : sentryStatus === 'amber' ? '🟡' : '❌'}`,
    ];

    if (apiData?.sentry.topErrors.length) {
      lines.push('', '### Top Errors');
      for (const e of apiData.sentry.topErrors) {
        lines.push(`- ${e.code}: ${e.count}`);
      }
    }

    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-6 h-6 text-indigo-600" />
        <div>
          <h1 className="text-xl font-black text-gray-900">SLO Dashboard</h1>
          <p className="text-xs text-gray-500">Reliability Service Level Objectives — Admin only · auto-refresh 60s</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            {copied ? 'Копирано!' : 'EOD Report'}
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${apiLoading ? 'animate-spin' : ''}`} />
            Освежи
          </button>
        </div>
      </div>

      {/* Overall status bars (server vs client session) */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 border ${RAG_STYLES[operationalOverall].border} ${RAG_STYLES[operationalOverall].badge}`}>
        <RAGIcon status={operationalOverall} />
        <span className="text-sm font-bold">{operationalLabel}</span>
        <span className="ml-auto text-xs opacity-60">{apiData?.generatedAt ? relativeTime(apiData.generatedAt) : relativeTime(refreshedAt)}</span>
      </div>

      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl mb-6 border ${RAG_STYLES[aiPanelStatus].border} ${RAG_STYLES[aiPanelStatus].badge}`}>
        <RAGIcon status={aiPanelStatus} />
        <span className="text-xs font-semibold">{aiSessionLabel}</span>
        <span className="text-[11px] opacity-80">(client shadow telemetry)</span>
        <span className="ml-auto text-[11px] opacity-60">{relativeTime(refreshedAt)}</span>
      </div>

      {apiError && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Operational summary degraded: {apiError}
          {apiServerBlocked && (
            <div className="mt-2 text-xs text-amber-900/90">
              Серверска проверка е паузирана. Ако грешката е PERMISSION_DENIED, додади ја <code>roles/datastore.user</code> IAM улогата на service account — или постави ја <code>role: "admin"</code> custom claim во Firebase Auth за admin корисникот.
            </div>
          )}
          {apiAuthBlocked && (
            <button
              onClick={refresh}
              className="ml-3 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Повтори најава / refresh token
            </button>
          )}
          {apiServerBlocked && (
            <button
              onClick={refresh}
              className="ml-3 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Повтори по серверска корекција
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* ── Panel 1: AI Latency ───────────────────────────────────────────── */}
        <Panel title="AI Латенција" icon={<Zap className="w-4 h-4" />} status={aiP95Status} refreshedAt={refreshedAt}>
          <Metric label="p50 латенција" value={fmtMs(aiP50)} />
          <Metric
            label="p95 латенција"
            value={fmtMs(aiP95)}
            status={aiP95Status}
            sub={`SLO: <${SLO_THRESHOLDS.aiP95LatencyMs.green / 1000}s`}
          />
          <Metric label="Gemini avg" value={fmtMs(shadowReport.geminiAvgLatencyMs || null)} />
          {shadowReport.vertexAvgLatencyMs !== null && (
            <Metric label="Vertex avg (shadow)" value={fmtMs(shadowReport.vertexAvgLatencyMs)} />
          )}
          <div className="text-[10px] text-gray-400 mt-1">
            Базирано на {latencies.length} повик{latencies.length !== 1 ? 'и' : ''} (shadow log)
          </div>
        </Panel>

        {/* ── Panel 2: AI Availability ──────────────────────────────────────── */}
        <Panel title="AI Достапност" icon={<ShieldCheck className="w-4 h-4" />} status={aiPanelStatus} refreshedAt={refreshedAt}>
          <Metric
            label="Quota статус"
            value={quotaDiag.isCurrentlyExhausted ? 'ИСЦРПЕНА' : 'ОК'}
            status={quotaStatus}
          />
          {quotaDiag.isCurrentlyExhausted && quotaDiag.nextResetISO && (
            <div className="text-xs text-red-600 font-medium">
              Reset: {new Date(quotaDiag.nextResetISO).toLocaleTimeString('mk-MK')}
            </div>
          )}
          <Metric
            label="Shadow error rate"
            value={fmt(aiErrorRatePct, 1, '%')}
            status={aiErrorStatus}
            sub={`SLO: ≤${SLO_THRESHOLDS.aiErrorRatePct.green}%`}
          />
          <Metric label="Shadow success rate" value={fmt(shadowReport.vertexSuccessRate * 100, 1, '%')} />
          <Metric label="Not configured rate" value={fmt(shadowReport.vertexNotConfiguredRate * 100, 1, '%')} />
          <Metric label="Shadow samples" value={String(shadowReport.sampleSize)} />
        </Panel>

        {/* ── Panel 3: AI Routing ───────────────────────────────────────────── */}
        <Panel title="AI Рутирање" icon={<TrendingUp className="w-4 h-4" />} status={totalRouted > 0 ? 'green' : 'unknown'} refreshedAt={refreshedAt}>
          <Metric label="Вкупно повици (сесија)" value={String(totalRouted)} />
          <Metric label="Lite model" value={`${liteCount} (${litePct.toFixed(0)}%)`} status={litePct >= 20 ? 'green' : 'unknown'} />
          <Metric label="Standard/Advanced" value={`${totalRouted - liteCount} (${(100 - litePct).toFixed(0)}%)`} />
          {totalRouted === 0 && (
            <p className="text-xs text-gray-400">Нема routing статистики за оваа сесија.</p>
          )}
          {routerEntries.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {routerEntries.slice(0, 5).map(([key, val]) => (
                <div key={key} className="flex justify-between text-[10px] text-gray-500">
                  <span className="truncate max-w-[140px]">{key.split(':')[0]}</span>
                  <span className="font-mono">{val.count}×</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Panel 4: CI Reliability ───────────────────────────────────────── */}
        <Panel title="CI Reliability" icon={<GitMerge className="w-4 h-4" />} status={ciStatus} refreshedAt={apiData?.generatedAt ?? null}>
          {apiLoading && <p className="text-xs text-gray-400 animate-pulse">Вчитување…</p>}
          {!apiLoading && !apiData && (
            <p className="text-xs text-amber-600 font-medium">Серверот не е достапен — провери ги конфигурациските параметри.</p>
          )}
          {!apiLoading && apiData && !apiData.ci.available && (
            <p className="text-xs text-gray-400">
              GITHUB_TOKEN не е конфигуриран. Провери во{' '}
              <a href="https://github.com" target="_blank" rel="noopener" className="underline">GitHub Actions</a>.
            </p>
          )}
          {!apiLoading && apiData?.ci.available && (
            <>
              <Metric
                label="Pass rate (last 20)"
                value={fmt(ciPassRate, 1, '%')}
                status={ciStatus}
                sub={`SLO: ≥${SLO_THRESHOLDS.ciPassRatePct.green}%`}
              />
              <Metric
                label="Success / Total"
                value={`${apiData.ci.successCount ?? '?'} / ${apiData.ci.totalCount ?? '?'}`}
              />
              <Metric
                label="A4 close trigger"
                value={apiData.ci.closeTriggerReached ? '✅ Reached' : '⏳ Pending'}
                status={apiData.ci.closeTriggerReached ? 'green' : 'amber'}
              />
              {apiData.ci.lastRunAt && (
                <p className="text-[10px] text-gray-400">Последен run: {relativeTime(apiData.ci.lastRunAt)}</p>
              )}
            </>
          )}
        </Panel>

        {/* ── Panel: Web Vitals × Device (S40-M1) ───────────────────────────── */}
        <Panel title="Web Vitals × Device" icon={<Smartphone className="w-4 h-4" />} status={webVitalsStatus} refreshedAt={refreshedAt}>
          {webVitalsLoading && <p className="text-xs text-gray-400 animate-pulse">Вчитување…</p>}
          {!webVitalsLoading && webVitalsAll.length === 0 && (
            <p className="text-xs text-gray-400">Нема собрани samples (warm container reset).</p>
          )}
          {!webVitalsLoading && webVitalsAll.length > 0 && (
            <>
              <div className="space-y-1">
                {webVitalsAll.map(s => (
                  <Metric
                    key={`all-${s.metric}`}
                    label={`${s.metric} p75 (сите)`}
                    value={s.metric === 'CLS' ? (s.p75 / 1000).toFixed(3) : `${Math.round(s.p75)}ms`}
                    status={s.overBudget ? 'amber' : 'green'}
                    sub={`n=${s.count} · бюџ ${s.metric === 'CLS' ? (s.budget / 1000).toFixed(2) : `${s.budget}ms`}`}
                  />
                ))}
              </div>
              {webVitalsByDevice.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">По уред (p75)</p>
                  <div className="space-y-0.5">
                    {webVitalsByDevice.map(s => (
                      <div key={`${s.metric}-${s.device}`} className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-gray-600">
                          {s.metric}/<span className="text-gray-500">{s.device}</span>
                        </span>
                        <span className={`font-mono font-bold ${s.overBudget ? 'text-amber-700' : 'text-gray-700'}`}>
                          {s.metric === 'CLS' ? (s.p75 / 1000).toFixed(3) : `${Math.round(s.p75)}ms`}
                          <span className="text-gray-400 ml-1">(n={s.count})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>

        {/* ── Panel 5: Production Health (Sentry) ───────────────────────────── */}
        <Panel title="Production Health" icon={<Server className="w-4 h-4" />} status={sentryStatus} refreshedAt={apiData?.generatedAt ?? null}>
          {apiLoading && <p className="text-xs text-gray-400 animate-pulse">Вчитување…</p>}
          {!apiLoading && !apiData && (
            <p className="text-xs text-amber-600 font-medium">Серверот не е достапен — провери ги конфигурациските параметри.</p>
          )}
          {!apiLoading && apiData && !apiData.sentry.available && (
            <p className="text-xs text-gray-400">
              SENTRY_AUTH_TOKEN не е конфигуриран. Провери го{' '}
              <a href="https://sentry.io" target="_blank" rel="noopener" className="underline text-indigo-500">Sentry Dashboard</a>.
            </p>
          )}
          {!apiLoading && apiData?.sentry.available && (
            <>
              <Metric label={`Unresolved issues (${apiData.sentry.periodDays}d)`} value={String(apiData.sentry.unresolvedIssues ?? '—')} />
              <Metric label="Total events" value={String(apiData.sentry.totalEvents ?? '—')} />
              <Metric
                label="UNCLASSIFIED ratio"
                value={fmt(unclassifiedPct, 1, '%')}
                status={sentryStatus}
                sub={`SLO: <${SLO_THRESHOLDS.unclassifiedPct.green}%`}
              />
              {apiData.sentry.topErrors.length > 0 && (
                <div className="mt-1 border-t border-gray-200 pt-2 space-y-0.5">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Top Errors</p>
                  {apiData.sentry.topErrors.map(e => (
                    <div key={e.code} className="flex justify-between text-[10px] text-gray-500">
                      <span className="font-mono">{e.code}</span>
                      <span>{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>

        {/* ── Panel 6: SLO Thresholds Reference ────────────────────────────── */}
        <Panel title="SLO Прагови" icon={<Clock className="w-4 h-4" />} status="unknown">
          <div className="space-y-1.5 text-[11px]">
            {[
              { label: 'AI p95 латенција', green: '<3s', amber: '<6s' },
              { label: 'AI shadow error rate', green: '≤1%', amber: '≤3%' },
              { label: 'CI pass rate',     green: '≥95%', amber: '≥80%' },
              { label: 'UNCLASSIFIED %',   green: '<15%', amber: '<30%' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2">
                <span className="text-gray-600 flex-1">{t.label}</span>
                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono font-bold">{t.green}</span>
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono font-bold">{t.amber}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-400">
            Дефинирано во S16 World-Class Action Plan секција 9.10.1
          </div>
        </Panel>

      </div>
    </div>
  );
};
