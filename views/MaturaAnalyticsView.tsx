import React from 'react';
import { BarChart3, CalendarDays, GraduationCap, Timer, Trophy, TrendingUp, BookOpen, Network } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { Card } from '../components/common/Card';
import { useMaturaStats } from '../hooks/useMaturaStats';
import { useMaturaMissions } from '../hooks/useMaturaMissions';
import { MissionPanel } from '../components/matura/MissionPanel';

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
  const barClass = tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500';

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
  const stats = useMaturaStats();
  const missions = useMaturaMissions();

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
      </Card>

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
          <h2 className="text-lg font-black text-rose-900 mb-3 flex items-center gap-2">
            <Network className="w-5 h-5" /> Weak curriculum concepts
          </h2>
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
          <div className="mt-3 text-xs text-rose-700/90 flex items-start gap-1.5">
            <BookOpen className="w-3.5 h-3.5 mt-0.5" />
            Овие концепти се пресметани преку matura-curriculum alignment foundation layer.
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
    </div>
  );
};
