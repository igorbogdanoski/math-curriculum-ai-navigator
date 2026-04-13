import React from 'react';
import { BarChart3, CalendarDays, GraduationCap, Timer, Trophy, TrendingUp, BookOpen, Network, Share2, Download, Copy, CheckCheck, Link2, FileText, MapPin, AlertTriangle, CheckCircle2, Route } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/common/Card';
import { useMaturaStats } from '../hooks/useMaturaStats';
import { useMaturaMissions } from '../hooks/useMaturaMissions';
import { MissionPanel } from '../components/matura/MissionPanel';
import { ForumCTA } from '../components/common/ForumCTA';
import { RecoveryWorksheetModal } from '../components/matura/RecoveryWorksheetModal';
import { downloadAsPdf } from '../utils/pdfDownload';
import { shareService } from '../services/shareService';
import { useMaturaReadinessPath } from '../hooks/useMaturaReadinessPath';

function statTone(value: number, good: number, warn: number): 'green' | 'amber' | 'red' {
  if (value >= good) return 'green';
  if (value >= warn) return 'amber';
  return 'red';
}

function toneClass(tone: 'green' | 'amber' | 'red'): string {
  if (tone === 'green') return 'text-emerald-600';
  if (tone === 'amber') return 'text-amber-600';
  return 'text-rose-600';
}

const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  tone?: 'green' | 'amber' | 'red';
  icon: React.ReactNode;
}> = ({ title, value, subtitle, tone = 'green', icon }) => (
  <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        <p className={`text-2xl font-black mt-1 ${toneClass(tone)}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="text-gray-400">{icon}</div>
    </div>
  </Card>
);

const ProgressBar: React.FC<{ value: number; label: string; meta?: string }> = ({ value, label, meta }) => {
  const tone = statTone(value, 75, 55);
  const barClass = tone === 'green' ? 'accent-emerald-500' : tone === 'amber' ? 'accent-amber-500' : 'accent-rose-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`font-bold ${toneClass(tone)}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <progress
          className={`w-full h-full ${barClass}`}
          max={100}
          value={Math.max(0, Math.min(100, value))}
        />
      </div>
      {meta && <p className="text-[11px] text-gray-500">{meta}</p>}
    </div>
  );
};

export const MaturaAnalyticsView: React.FC = () => {
  const { navigate } = useNavigation();
  const { firebaseUser } = useAuth();
  const stats = useMaturaStats();
  const missions = useMaturaMissions();
  const readiness = useMaturaReadinessPath(stats.weakConcepts);
  const [copied, setCopied] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);
  const [showWorksheet, setShowWorksheet] = React.useState(false);
  const pdfExportRef = React.useRef<HTMLDivElement>(null);

  const buildRecoverySharePayload = React.useCallback(() => ({
    generatedAt: new Date().toISOString(),
    attempts: stats.attempts,
    avgPct: stats.avgPct,
    bestPct: stats.bestPct,
    passRatePct: stats.passRatePct,
    weakConcepts: stats.weakConcepts.slice(0, 8).map((item) => ({
      title: item.concept.title,
      pct: item.pct,
      questions: item.questions,
      delta: item.delta && item.delta.pctBefore !== null
        ? item.delta.pctAfter - item.delta.pctBefore
        : null,
    })),
    mission: missions.mission
      ? {
        sourceConceptTitle: missions.mission.sourceConceptTitle,
        progressCompleted: missions.mission.days.filter((d) => d.status === 'completed').length,
        progressTotal: missions.mission.days.length,
        streakCount: missions.mission.streakCount,
        badgeEarned: missions.mission.badgeEarned,
      }
      : null,
  }), [stats, missions.mission]);

  const buildRecoverySummary = React.useCallback((): string => {
    const lines: string[] = [];
    lines.push('Matura Recovery Summary');
    lines.push('=======================');
    lines.push(`Generated: ${new Date().toLocaleString('mk-MK')}`);
    lines.push(`Attempts: ${stats.attempts}`);
    lines.push(`Average score: ${stats.avgPct.toFixed(1)}%`);
    lines.push(`Best score: ${stats.bestPct.toFixed(1)}%`);
    lines.push(`Pass rate: ${stats.passRatePct.toFixed(1)}%`);
    lines.push('');
    lines.push('Weak Concepts (Top 5)');
    lines.push('---------------------');

    if (stats.weakConcepts.length === 0) {
      lines.push('No weak concepts detected.');
    } else {
      for (const item of stats.weakConcepts.slice(0, 5)) {
        const base = `- ${item.concept.title}: ${item.pct.toFixed(1)}% (${item.questions} q)`;
        const delta = item.delta && item.delta.pctBefore !== null
          ? ` | recovery ${item.delta.pctAfter >= item.delta.pctBefore ? '+' : ''}${(item.delta.pctAfter - item.delta.pctBefore).toFixed(1)}%`
          : '';
        lines.push(`${base}${delta}`);
      }
    }

    lines.push('');
    lines.push('Mission Status');
    lines.push('--------------');
    if (missions.mission) {
      const completed = missions.mission.days.filter((d) => d.status === 'completed').length;
      lines.push(`Plan: 7-day mission for ${missions.mission.sourceConceptTitle}`);
      lines.push(`Progress: ${completed}/${missions.mission.days.length}`);
      lines.push(`Streak: ${missions.mission.streakCount}`);
      lines.push(`Badge: ${missions.mission.badgeEarned ? 'earned' : 'not yet'}`);
    } else {
      lines.push('No active mission.');
    }

    lines.push('');
    lines.push('Recommended Next Steps');
    lines.push('----------------------');
    lines.push('1) Daily 5-10 minute targeted recovery session');
    lines.push('2) Focus on the top 1-2 weak concepts first');
    lines.push('3) Re-run one full simulation after 7 days');

    return lines.join('\n');
  }, [stats, missions.mission]);

  const handleCopySummary = React.useCallback(() => {
    const text = buildRecoverySummary();
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [buildRecoverySummary]);

  const handleDownloadSummary = React.useCallback(() => {
    const text = buildRecoverySummary();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `matura-recovery-summary-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [buildRecoverySummary]);

  const handleDownloadPdf = React.useCallback(async () => {
    if (!pdfExportRef.current || isPdfLoading) return;
    setIsPdfLoading(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await downloadAsPdf(pdfExportRef.current, `matura-recovery-summary-${date}`);
    } finally {
      setIsPdfLoading(false);
    }
  }, [isPdfLoading]);

  const handleNativeShare = React.useCallback(() => {
    const text = buildRecoverySummary();
    if (navigator.share) {
      void navigator.share({
        title: 'Matura Recovery Summary',
        text,
      });
      return;
    }
    handleCopySummary();
  }, [buildRecoverySummary, handleCopySummary]);

  const handleCopyPublicLink = React.useCallback(async () => {
    const payload = buildRecoverySharePayload();

    let token = '';

    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/api/matura-share?action=sign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ payload, ttlDays: 30 }),
        });
        if (res.ok) {
          const signed = await res.json() as { token?: string };
          token = signed.token ?? '';
        }
      } catch {
        // Fallback below keeps sharing available even if signing endpoint is unavailable.
      }
    }

    if (!token) {
      token = shareService.generateMaturaRecoveryShareData(payload, { expiresInDays: 30 });
    }
    if (!token) return;

    const link = `${window.location.origin}/#/share/matura/${encodeURIComponent(token)}`;
    void navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }, [buildRecoverySharePayload, firebaseUser]);

  const startRecoverySession = (payload: { topicArea?: string; dokLevel?: number; conceptId: string; conceptTitle: string; pctBefore: number }) => {
    // Snapshot current score so the practice session can compute delta
    try {
      localStorage.setItem(
        `matura_concept_snap_${payload.conceptId}`,
        JSON.stringify({ pctBefore: payload.pctBefore, topicArea: payload.topicArea ?? null, savedAt: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    try {
      sessionStorage.setItem('matura_recovery_prefill', JSON.stringify({
        topicArea: payload.topicArea ?? null,
        dokLevels: payload.dokLevel ? [payload.dokLevel] : [2, 3],
        maxQ: 10,
        sourceConceptId: payload.conceptId,
        sourceConceptTitle: payload.conceptTitle,
      }));
    } catch {
      // ignore storage issues, regular navigation still works
    }
    navigate('/matura-practice');
  };

  if (stats.loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Card className="p-6 animate-pulse">
          <div className="h-7 w-72 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-100 rounded mt-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-28 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!stats.hasAttempts) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Card className="p-6 border-indigo-200 bg-indigo-50/30">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-700 mt-0.5" />
            <div>
              <h1 className="text-2xl font-black text-indigo-900">Matura Analytics (M5)</h1>
              <p className="text-sm text-indigo-800 mt-1">
                Нема завршени симулации за анализа. Започни со симулација или практика за да добиеш topic/DoK и curriculum-connected insights.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/matura')}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Започни симулација
            </button>
            <button
              type="button"
              onClick={() => navigate('/matura-practice')}
              className="px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition"
            >
              Отвори практика
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const avgTone = statTone(stats.avgPct, 75, 55);
  const passTone = statTone(stats.passRatePct, 80, 60);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className="p-6 border-blue-200 bg-blue-50/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-blue-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6" /> Matura Analytics (M5)
            </h1>
            <p className="text-sm text-blue-800 mt-1">
              Cross-exam analytics + curriculum-connected weak points за побрза ремедијација.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/matura')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
          >
            Нова симулација
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
          <StatCard title="Attempts" value={String(stats.attempts)} subtitle={stats.lastAttemptAt ? `Последен: ${new Date(stats.lastAttemptAt).toLocaleString('mk-MK')}` : undefined} tone="green" icon={<GraduationCap className="w-5 h-5" />} />
          <StatCard title="Average Score" value={`${stats.avgPct.toFixed(1)}%`} subtitle="Сите завршени симулации" tone={avgTone} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard title="Best Score" value={`${stats.bestPct.toFixed(1)}%`} subtitle="Најдобар забележан резултат" tone={statTone(stats.bestPct, 80, 60)} icon={<Trophy className="w-5 h-5" />} />
          <StatCard title="Pass Rate" value={`${stats.passRatePct.toFixed(1)}%`} subtitle="Праг: 35/61" tone={passTone} icon={<Timer className="w-5 h-5" />} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition inline-flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Сподели Recovery Summary
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition inline-flex items-center gap-1.5"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Копирано' : 'Копирај текст'}
          </button>
          <button
            type="button"
            onClick={handleDownloadSummary}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Преземи .txt
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={isPdfLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" /> {isPdfLoading ? 'Се генерира PDF…' : 'Преземи PDF'}
          </button>
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition inline-flex items-center gap-1.5"
          >
            {linkCopied ? <CheckCheck className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />} {linkCopied ? 'Линк копиран' : 'Копирај public линк'}
          </button>
        </div>
      </Card>

      {/* Off-screen export template used by html2canvas/jsPDF */}
      <div className="fixed top-0 -left-[9999px] w-[820px] pointer-events-none opacity-0">
        <div ref={pdfExportRef} className="bg-white text-black p-8">
          <h1 className="text-2xl font-black">Matura Recovery Summary</h1>
          <p className="text-xs text-gray-600 mt-1">Generated: {new Date().toLocaleString('mk-MK')}</p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="border border-gray-200 rounded-lg p-3"><strong>Attempts:</strong> {stats.attempts}</div>
            <div className="border border-gray-200 rounded-lg p-3"><strong>Average:</strong> {stats.avgPct.toFixed(1)}%</div>
            <div className="border border-gray-200 rounded-lg p-3"><strong>Best:</strong> {stats.bestPct.toFixed(1)}%</div>
            <div className="border border-gray-200 rounded-lg p-3"><strong>Pass rate:</strong> {stats.passRatePct.toFixed(1)}%</div>
          </div>

          <h2 className="text-lg font-black mt-6">Weak Concepts</h2>
          <ul className="mt-2 text-sm space-y-1">
            {stats.weakConcepts.slice(0, 8).map((item) => (
              <li key={item.concept.id}>
                • {item.concept.title} — {item.pct.toFixed(1)}% ({item.questions} questions)
                {item.delta && item.delta.pctBefore !== null
                  ? ` | recovery ${(item.delta.pctAfter - item.delta.pctBefore >= 0 ? '+' : '')}${(item.delta.pctAfter - item.delta.pctBefore).toFixed(1)}%`
                  : ''}
              </li>
            ))}
            {stats.weakConcepts.length === 0 && <li>• No weak concepts detected.</li>}
          </ul>

          <h2 className="text-lg font-black mt-6">Mission Status</h2>
          {missions.mission ? (
            <div className="text-sm mt-2 space-y-1">
              <p><strong>Plan:</strong> 7-day mission for {missions.mission.sourceConceptTitle}</p>
              <p><strong>Progress:</strong> {missions.mission.days.filter((d) => d.status === 'completed').length}/{missions.mission.days.length}</p>
              <p><strong>Streak:</strong> {missions.mission.streakCount}</p>
              <p><strong>Badge:</strong> {missions.mission.badgeEarned ? 'earned' : 'not yet'}</p>
            </div>
          ) : (
            <p className="text-sm mt-2">No active mission.</p>
          )}

          <h2 className="text-lg font-black mt-6">Recommended Next Steps</h2>
          <ol className="text-sm mt-2 space-y-1 list-decimal pl-5">
            <li>Daily 5-10 minute targeted recovery session</li>
            <li>Focus on the top 1-2 weak concepts first</li>
            <li>Re-run one full simulation after 7 days</li>
          </ol>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-lg font-black text-gray-900 mb-3">Перформанс по дел</h2>
          <div className="space-y-3">
            <ProgressBar value={stats.partStats[1]?.pct ?? 0} label="Дел I (MC)" meta={`${stats.partStats[1]?.questions ?? 0} прашања`} />
            <ProgressBar value={stats.partStats[2]?.pct ?? 0} label="Дел II (отворени)" meta={`${stats.partStats[2]?.questions ?? 0} прашања`} />
            <ProgressBar value={stats.partStats[3]?.pct ?? 0} label="Дел III (отворени)" meta={`${stats.partStats[3]?.questions ?? 0} прашања`} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-black text-gray-900 mb-3">DoK распределба</h2>
          <div className="space-y-3">
            {stats.dokStats.length === 0 && (
              <p className="text-sm text-gray-500">Нема доволно DoK податоци.</p>
            )}
            {stats.dokStats.map((row) => (
              <ProgressBar key={row.level} value={row.pct} label={`DoK ${row.level}`} meta={`${row.questions} прашања`} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-lg font-black text-gray-900 mb-3">Тема перформанс</h2>
          <div className="space-y-2">
            {stats.topicStats.slice(0, 10).map((topic) => (
              <ProgressBar key={topic.key} value={topic.pct} label={topic.label} meta={`${topic.questions} прашања`} />
            ))}
          </div>
        </Card>

        <Card className="p-5 border-rose-200 bg-rose-50/20">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-lg font-black text-rose-900 flex items-center gap-2">
              <Network className="w-5 h-5" /> Слаби концепти
            </h2>
            {stats.weakConcepts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowWorksheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:opacity-90 transition shadow-sm flex-shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Recovery Worksheet
              </button>
            )}
          </div>
          {stats.weakConcepts.length === 0 ? (
            <p className="text-sm text-rose-800">Супер. Нема детектирани слаби концепти од поврзаните refs во оваа сесија.</p>
          ) : (
            <div className="space-y-2">
              {stats.weakConcepts.map((item) => (
                <div key={item.concept.id} className="p-3 rounded-xl border border-rose-200 bg-white">
                  <p className="text-sm font-bold text-gray-900">{item.concept.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {item.concept.gradeTitle ?? `Grade ${item.concept.gradeLevel}`} · {item.concept.topicTitle ?? item.concept.topicId}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-rose-700">{item.pct.toFixed(1)}% · {item.questions} прашања</span>
                      {item.delta && (
                        <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                          item.delta.pctBefore !== null && item.delta.pctAfter >= item.delta.pctBefore
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-600'
                        }`}>
                          {item.delta.pctBefore !== null
                            ? `${item.delta.pctAfter >= item.delta.pctBefore ? '+' : ''}${(item.delta.pctAfter - item.delta.pctBefore).toFixed(1)}% recovery`
                            : `${item.delta.pctAfter.toFixed(1)}% after recovery`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/concept/${item.concept.id}`)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition"
                      >
                        Concept
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/explore')}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                      >
                        Explore
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/graph')}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                      >
                        Graph
                      </button>
                      <button
                        type="button"
                        onClick={() => startRecoverySession({
                          topicArea: item.topicArea,
                          dokLevel: item.dokLevel,
                          conceptId: item.concept.id,
                          conceptTitle: item.concept.title,
                          pctBefore: item.pct,
                        })}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                      >
                        Recovery
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-rose-700/90 flex items-start gap-1.5">
              <BookOpen className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Овие концепти се пресметани преку matura-curriculum alignment foundation layer.
            </div>
            <ForumCTA context="Матура — слаби концепти" variant="inline" />
          </div>
        </Card>
      </div>

      {/* ── Recovery Missions (M5.5) ── */}
      {missions.mission ? (
        <MissionPanel
          mission={missions.mission}
          todayDay={missions.todayDay}
          streakLabel={missions.streakLabel}
          onSkipDay={missions.skipDay}
        />
      ) : !missions.loading && stats.weakConcepts.length > 0 && (
        <Card className="p-5 border-indigo-200 bg-indigo-50/20">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-base font-black text-indigo-900">Започни 7-дневен Recovery Plan</h3>
              <p className="text-sm text-indigo-700 mt-0.5">
                Систематски ги совладај слабите концепти со дневни 5-минутни сесии и освои значка на крајот.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.weakConcepts.slice(0, 3).map((item) => (
                  <button
                    key={item.concept.id}
                    type="button"
                    onClick={() => missions.startMission({
                      sourceConceptId: item.concept.id,
                      sourceConceptTitle: item.concept.title,
                      primaryTopicArea: item.topicArea ?? 'algebra',
                    })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    План за: {item.concept.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── B2-3: Препорачана патека кон матура ── */}
      {stats.hasAttempts && (
        <Card className="p-5 border-violet-200 bg-violet-50/20">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
            <div className="flex-1">
              <h2 className="text-lg font-black text-violet-900 flex items-center gap-2">
                <Route className="w-5 h-5" /> Препорачана патека кон матура
              </h2>
              <p className="text-sm text-violet-700 mt-0.5">
                {readiness.examPassed
                  ? 'Датумот на матурата помина.'
                  : readiness.hasExamDate
                    ? `До матурата имаш уште ${readiness.daysUntilExam} ${readiness.daysUntilExam === 1 ? 'ден' : 'дена'} (${readiness.weeksUntilExam} нед.).`
                    : `Приказ базиран на ~${readiness.daysUntilExam} дена до испит.`}
                {!readiness.examPassed && readiness.steps.length > 0 && (
                  <> &nbsp;Треба уште: <strong>{readiness.steps.length} концепти</strong>. Препорачано: <strong>{readiness.recommendedPerWeek}/нед.</strong></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {readiness.examPassed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Испитот помина
                </span>
              ) : readiness.onTrack ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Во план
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Забрзај
                </span>
              )}
              <label className="flex items-center gap-1.5 text-xs text-violet-700 font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <input
                  type="date"
                  aria-label="Датум на матура"
                  value={readiness.examDate ? readiness.examDate.toISOString().slice(0, 10) : ''}
                  onChange={(e) => readiness.setExamDate(e.target.value)}
                  className="border border-violet-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </label>
            </div>
          </div>

          {readiness.steps.length === 0 ? (
            <p className="text-sm text-emerald-700 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {readiness.examPassed
                ? 'Испитот веќе помина. Промени го датумот за да ги видиш препораките.'
                : 'Одличен напредок — нема концепти под прагот за успех (55%).'}
            </p>
          ) : (
            <div className="space-y-2">
              {readiness.steps.map((step) => (
                <div
                  key={step.conceptId}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    step.status === 'uncovered'
                      ? 'border-rose-200 bg-rose-50/60'
                      : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                    step.status === 'uncovered' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-white'
                  }`}>
                    {step.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{step.conceptTitle}</p>
                    <p className="text-[11px] text-gray-500">
                      {step.status === 'uncovered' ? 'Непокриен' : `${step.pct.toFixed(0)}% — слаб`}
                      {step.topicArea && <> · {step.topicArea}</>}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    Нед. {step.weekNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => startRecoverySession({
                      topicArea: step.topicArea,
                      conceptId: step.conceptId,
                      conceptTitle: step.conceptTitle,
                      pctBefore: step.pct,
                    })}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-600 text-white hover:bg-violet-700 transition"
                  >
                    Вежбај
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── M6 Recovery Worksheet Modal ── */}
      {showWorksheet && (
        <RecoveryWorksheetModal
          weakConcepts={stats.weakConcepts.map(item => ({
            conceptId: item.concept.id,
            conceptTitle: item.concept.title,
            gradeTitle: item.concept.gradeTitle ?? `Grade ${item.concept.gradeLevel}`,
            topicTitle: item.concept.topicTitle ?? item.concept.topicId ?? 'Математика',
            pct: item.pct,
            questions: item.questions,
            topicArea: item.topicArea ?? item.concept.topicTitle ?? 'Математика',
          }))}
          teacherUid={firebaseUser?.uid}
          onClose={() => setShowWorksheet(false)}
        />
      )}
    </div>
  );
};
