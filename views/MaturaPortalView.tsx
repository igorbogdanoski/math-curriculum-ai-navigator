import React, { useState, useEffect } from 'react';
import {
  BookOpen, BarChart3, Dumbbell, FlaskConical, GraduationCap,
  ArrowRight, Star, Target, TrendingUp, LogIn, LogOut,
  User, CheckCircle2, Loader2, School, Briefcase,
  ChevronDown, ChevronUp, CalendarDays, AlertCircle, Pencil,
} from 'lucide-react';
import { signInWithPopup, signOut, type User as FBUser } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { useNavigation } from '../contexts/NavigationContext';
import { Card } from '../components/common/Card';
import { MaturaCountdown } from '../components/matura/MaturaCountdown';
import { useMaturaStats } from '../hooks/useMaturaStats';
import { useMaturaReadinessPath } from '../hooks/useMaturaReadinessPath';
import { MissionPanel } from '../components/matura/MissionPanel';
import { useMaturaMissions } from '../hooks/useMaturaMissions';
import { MaturaTutorChat } from '../components/matura/MaturaTutorChat';
import {
  getStudentMaturaProfile,
  createStudentMaturaProfile,
} from '../services/firestoreService.matura';
import type { StudentMaturaProfile, MaturaTrack } from '../types';

const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
  trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори',
  broevi: 'Броеви', statistika: 'Статистика', kombinatorika: 'Комбинаторика',
};

const TOPIC_COLORS: Record<string, string> = {
  algebra: 'bg-blue-100 text-blue-800 border-blue-200',
  analiza: 'bg-purple-100 text-purple-800 border-purple-200',
  geometrija: 'bg-green-100 text-green-800 border-green-200',
  trigonometrija: 'bg-orange-100 text-orange-800 border-orange-200',
  'matrici-vektori': 'bg-teal-100 text-teal-800 border-teal-200',
  broevi: 'bg-gray-100 text-gray-700 border-gray-200',
  statistika: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  kombinatorika: 'bg-pink-100 text-pink-800 border-pink-200',
};

const QuickLink: React.FC<{
  label: string;
  desc: string;
  icon: React.ReactNode;
  path: string;
  accent: string;
}> = ({ label, desc, icon, path, accent }) => {
  const { navigate } = useNavigation();
  return (
    <button
      onClick={() => navigate(path)}
      className={`flex items-start gap-3 p-4 rounded-xl border-2 ${accent} hover:opacity-90 transition-opacity text-left w-full`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs opacity-75 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
    </button>
  );
};

type TrackPickPhase = 'idle' | 'picking';

export const MaturaPortalView: React.FC = () => {
  const { navigate } = useNavigation();
  const stats = useMaturaStats();
  const { mission, loading: missionLoading, todayDay, skipDay, streakLabel } = useMaturaMissions();

  const [fbUser, setFbUser]             = useState<FBUser | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [profile, setProfile]           = useState<StudentMaturaProfile | null>(null);
  const [trackPhase, setTrackPhase]     = useState<TrackPickPhase>('idle');
  const [savingTrack, setSavingTrack]   = useState(false);
  const [signInError, setSignInError]   = useState('');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setFbUser(user);
      if (user) {
        const prof = await getStudentMaturaProfile(user.uid);
        setProfile(prof);
        if (!prof) setTrackPhase('picking');
      } else {
        setProfile(null);
        setTrackPhase('idle');
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setSignInError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setSignInError('Најавувањето не успеа. Обиди се повторно.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setProfile(null);
    setTrackPhase('idle');
  };

  const handlePickTrack = async (track: MaturaTrack) => {
    if (!fbUser) return;
    setSavingTrack(true);
    try {
      const prof = await createStudentMaturaProfile(
        fbUser.uid,
        fbUser.displayName ?? fbUser.email ?? 'Ученик',
        fbUser.email ?? undefined,
        fbUser.photoURL ?? undefined,
        track,
      );
      setProfile(prof);
      setTrackPhase('idle');
    } catch {
      // non-fatal — allow continue
      setTrackPhase('idle');
    } finally {
      setSavingTrack(false);
    }
  };

  const topTopics = React.useMemo(() => {
    if (!stats.topicStats.length) return [];
    return [...stats.topicStats].sort((a, b) => a.pct - b.pct).slice(0, 4);
  }, [stats.topicStats]);

  const readiness = useMaturaReadinessPath(stats.weakConcepts);
  const [planExpanded, setPlanExpanded] = useState(false);

  // Group readiness steps by week for the 12-week plan panel
  const planByWeek = React.useMemo(() => {
    const map = new Map<number, typeof readiness.steps>();
    for (const step of readiness.steps) {
      const list = map.get(step.weekNumber) ?? [];
      list.push(step);
      map.set(step.weekNumber, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [readiness.steps]);

  // ── Track picker overlay ──────────────────────────────────────────────────
  if (trackPhase === 'picking') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <GraduationCap className="w-12 h-12 text-indigo-600 mx-auto" />
        <div>
          <h1 className="text-2xl font-black text-gray-900">Добредојде!</h1>
          <p className="text-sm text-gray-500 mt-2">
            Избери го видот на твојата матура за да ги видиш соодветните прашања и планови.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handlePickTrack('gymnasium')}
            disabled={savingTrack}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-60"
          >
            <School className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="font-black text-indigo-800">Гимназиска матура</p>
              <p className="text-xs text-indigo-600 mt-0.5">4-годишно гимназиско образование</p>
            </div>
            {savingTrack ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : null}
          </button>
          <button
            onClick={() => handlePickTrack('vocational4')}
            disabled={savingTrack}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-60"
          >
            <Briefcase className="w-8 h-8 text-amber-600" />
            <div>
              <p className="font-black text-amber-800">Стручна матура</p>
              <p className="text-xs text-amber-600 mt-0.5">Средно стручно образование</p>
            </div>
          </button>
        </div>
        <button
          onClick={() => setTrackPhase('idle')}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Прескокни засега
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-indigo-600" />
            Матурски портал
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Сè на едно место за подготовка за Државната матура по математика
          </p>
        </div>

        {/* Auth section */}
        {authLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1 shrink-0" />
        ) : fbUser ? (
          <div className="flex items-center gap-2 shrink-0">
            {fbUser.photoURL
              ? <img src={fbUser.photoURL} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
              : <User className="w-8 h-8 p-1.5 rounded-full bg-indigo-100 text-indigo-600" />
            }
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-gray-700 leading-tight">{fbUser.displayName ?? fbUser.email}</p>
              {profile && (
                <p className="text-xs text-indigo-500">
                  {profile.track === 'gymnasium' ? '🎓 Гимназиска' : '💼 Стручна'}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              title="Одјави се"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="shrink-0 space-y-1">
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Влези со Google
            </button>
            {signInError && <p className="text-xs text-red-500">{signInError}</p>}
            <p className="text-xs text-gray-400 text-center">за зачување на напредок</p>
          </div>
        )}
      </div>

      {/* Track banner (when logged in but track not set) */}
      {fbUser && !profile && !authLoading && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">Избери ја твојата матурска патека за персонализиран план</p>
          <button
            onClick={() => setTrackPhase('picking')}
            className="text-xs font-bold text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition"
          >
            Избери
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column: countdown + quick links */}
        <div className="lg:col-span-1 space-y-4">
          <MaturaCountdown examDate={readiness.examDate} />

          {/* S28-К2: Exam date input */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
            <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <label className="text-xs font-semibold text-gray-500 shrink-0">Датум на матура:</label>
            <input
              type="date"
              value={readiness.examDate ? readiness.examDate.toISOString().split('T')[0] : ''}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => readiness.setExamDate(e.target.value)}
              title="Датум на матура"
              aria-label="Датум на матура"
              className="flex-1 text-xs text-gray-700 border-none outline-none bg-transparent min-w-0"
            />
          </div>

          {/* Track badge */}
          {profile && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
              profile.track === 'gymnasium'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {profile.track === 'gymnasium'
                ? <School className="w-4 h-4 shrink-0" />
                : <Briefcase className="w-4 h-4 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">
                  {profile.track === 'gymnasium' ? 'Гимназиска матура' : 'Стручна матура'}
                </p>
                <p className="text-xs opacity-70">6 јуни 2026</p>
              </div>
              <button
                onClick={() => setTrackPhase('picking')}
                className="text-xs opacity-60 hover:opacity-100 underline shrink-0"
              >
                Промени
              </button>
            </div>
          )}

          <Card className="p-4 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Брз пристап</p>
            <QuickLink
              label="Библиотека прашања"
              desc="Прелистај и реши прашања по тема"
              icon={<BookOpen className="w-5 h-5 text-blue-600" />}
              path="/matura-library"
              accent="border-blue-200 bg-blue-50 text-blue-900"
            />
            <QuickLink
              label="Вежбај по тема"
              desc="Фокусирана пракса по слаби теми"
              icon={<Dumbbell className="w-5 h-5 text-violet-600" />}
              path="/matura-practice"
              accent="border-violet-200 bg-violet-50 text-violet-900"
            />
            <QuickLink
              label="Симулација на матура"
              desc="Полни тест во услови на испит"
              icon={<FlaskConical className="w-5 h-5 text-emerald-600" />}
              path="/matura"
              accent="border-emerald-200 bg-emerald-50 text-emerald-900"
            />
            <QuickLink
              label="Аналитика и напредок"
              desc="Детален преглед на резултатите"
              icon={<BarChart3 className="w-5 h-5 text-amber-600" />}
              path="/matura-stats"
              accent="border-amber-200 bg-amber-50 text-amber-900"
            />
          </Card>
        </div>

        {/* Right column: stats + topics + mission */}
        <div className="lg:col-span-2 space-y-4">

          {/* Stats summary */}
          {stats.hasAttempts ? (
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Просек</p>
                <p className={`text-xl font-black mt-1 ${stats.avgPct >= 70 ? 'text-emerald-600' : stats.avgPct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {stats.avgPct.toFixed(0)}%
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Најдобар</p>
                <p className="text-xl font-black text-indigo-600 mt-1">{stats.bestPct.toFixed(0)}%</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Симулации</p>
                <p className="text-xl font-black text-gray-700 mt-1">{stats.attempts}</p>
              </Card>
            </div>
          ) : (
            <Card className="p-4 flex items-center gap-4 border-dashed border-2 border-gray-200">
              <Target className="w-8 h-8 text-gray-300 shrink-0" />
              <div>
                <p className="font-bold text-gray-600 text-sm">Уште нема резултати</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Реши симулација за да го видиш твојот напредок
                </p>
              </div>
              <button
                onClick={() => navigate('/matura')}
                className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
              >
                Почни
              </button>
            </Card>
          )}

          {/* Weak topics — S27-B1: readiness priority badge per topic */}
          {topTopics.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-rose-500" />
                  Теми за подобрување
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/matura-practice')}
                  className="text-xs text-indigo-600 hover:underline font-semibold"
                >
                  Вежбај →
                </button>
              </div>
              <div className="space-y-2.5">
                {topTopics.map(t => {
                  const step = readiness.steps.find(s => s.topicArea === t.key);
                  return (
                    <div key={t.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`px-2 py-0.5 rounded-full font-semibold border text-xs shrink-0 ${TOPIC_COLORS[t.key] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {TOPIC_LABELS[t.key] ?? t.key}
                          </span>
                          {step && (
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              Нед. {step.weekNumber} · #{step.rank}
                            </span>
                          )}
                          {step?.status === 'uncovered' && (
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" title="Неопфатена тема" />
                          )}
                        </div>
                        <span className={`font-bold tabular-nums ${t.pct >= 70 ? 'text-emerald-600' : t.pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {t.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${t.pct >= 70 ? 'bg-emerald-400' : t.pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                          style={{ width: `${Math.max(3, t.pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Mission plan */}
          {mission && (
            <MissionPanel
              mission={mission}
              todayDay={todayDay}
              streakLabel={streakLabel}
              onSkipDay={skipDay}
            />
          )}

          {!mission && !missionLoading && (
            <Card className="p-4 flex items-center gap-4 border-dashed border-2 border-indigo-200">
              <Star className="w-8 h-8 text-indigo-300 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-gray-700 text-sm">Персонализиран план</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Одговори на симулација и генерирај AI план за подготовка
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/matura-stats')}
                className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
              >
                Генерирај
              </button>
            </Card>
          )}

          {/* S27-B2: Collapsible 12-week readiness prep plan */}
          {planByWeek.length > 0 && (
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setPlanExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-bold text-gray-700">
                    {readiness.weeksUntilExam}-недели план за подготовка
                  </span>
                  <span className="text-xs text-gray-400 font-normal">
                    · {readiness.steps.length} концепт{readiness.steps.length === 1 ? '' : 'и'} · {readiness.recommendedPerWeek}/нед.
                  </span>
                </div>
                {planExpanded
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>

              {planExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
                  {!readiness.onTrack && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800">
                        Темпото е интензивно — обиди се да вежбаш секојдневно за да го следиш планот.
                      </p>
                    </div>
                  )}
                  {planByWeek.map(([week, steps]) => (
                    <div key={week}>
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-wide mb-2">
                        Недела {week}
                      </p>
                      <div className="space-y-1.5">
                        {steps.map(step => (
                          <div
                            key={step.conceptId}
                            className="flex items-center gap-2 text-xs"
                          >
                            {step.status === 'uncovered'
                              ? <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              : <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0" />
                            }
                            <span className="flex-1 text-gray-700 truncate">{step.conceptTitle}</span>
                            <span className={`tabular-nums font-bold ${step.pct === 0 ? 'text-rose-500' : 'text-amber-600'}`}>
                              {step.pct === 0 ? 'Ново' : `${step.pct}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* М2: AI Matura Tutor */}
          <MaturaTutorChat
            profile={profile}
            weakTopics={topTopics.map(t => t.key)}
          />

          {/* Not signed in CTA */}
          {!fbUser && !authLoading && (
            <Card className="p-4 flex items-center gap-4 border-2 border-indigo-100 bg-indigo-50">
              <CheckCircle2 className="w-8 h-8 text-indigo-400 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-indigo-700 text-sm">Зачувај го напредокот</p>
                <p className="text-xs text-indigo-500 mt-0.5">
                  Влези со Google за да се зачуваат резултатите на сите твои уреди
                </p>
              </div>
              <button
                onClick={handleGoogleSignIn}
                className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Влези
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
