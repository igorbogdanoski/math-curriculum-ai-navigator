import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Zap, Brain, ArrowRight, Loader2, Sparkles, Trophy, Target, RefreshCw } from 'lucide-react';
import { callGeminiProxy, sanitizePromptInput } from '../../services/gemini/core';
import { useNavigation } from '../../contexts/NavigationContext';

// ── Types ────────────────────────────────────────────────────────────────────
interface ModuleTopic { id: string; title: string; }
interface ModuleDef {
  id: string;
  title: string;
  topics: ModuleTopic[];
  [key: string]: unknown; // allow extra fields from MODULES (icon, color, borderColor, etc.)
}

interface Props {
  modules: ModuleDef[];
  readLessons: string[];
  appliedLessons: string[];
  completedQuizzes: string[];
}

// ── Streak helpers ────────────────────────────────────────────────────────────
const STREAK_KEY = 'academy_streak_v1';
interface StreakData { dates: string[]; longest: number; }

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakData;
  } catch { /* ignore */ }
  return { dates: [], longest: 0 };
}

function recordActivityToday(): StreakData {
  const data = loadStreak();
  const today = todayStr();
  if (data.dates.includes(today)) return data;
  const updated: StreakData = { ...data, dates: [...data.dates, today] };
  // Keep only last 365 days
  if (updated.dates.length > 365) updated.dates = updated.dates.slice(-365);
  updated.longest = Math.max(updated.longest, calcCurrentStreak(updated.dates));
  localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  return updated;
}

function calcCurrentStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort();
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  const lastDate = sorted[sorted.length - 1];
  if (lastDate !== today && lastDate !== yStr) return 0;

  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const d1 = new Date(sorted[i]);
    const d2 = new Date(sorted[i - 1]);
    const diff = (d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

// ── Daily Challenge cache ─────────────────────────────────────────────────────
const CHALLENGE_KEY_PREFIX = 'academy_challenge_';

function getCachedChallenge(): string | null {
  const today = todayStr();
  return localStorage.getItem(CHALLENGE_KEY_PREFIX + today);
}

function setCachedChallenge(text: string) {
  const today = todayStr();
  // Clear old keys
  Object.keys(localStorage)
    .filter(k => k.startsWith(CHALLENGE_KEY_PREFIX) && k !== CHALLENGE_KEY_PREFIX + today)
    .forEach(k => localStorage.removeItem(k));
  localStorage.setItem(CHALLENGE_KEY_PREFIX + today, text);
}

// ── Radar SVG ─────────────────────────────────────────────────────────────────
interface RadarProps {
  scores: number[]; // 0-1 per module (same order as modules)
  colors: string[];
  labels: string[];
}

const CompetencyRadar: React.FC<RadarProps> = ({ scores, colors, labels }) => {
  const cx = 110;
  const cy = 110;
  const maxR = 85;
  // 4 axes: top, right, bottom, left (diamond)
  const axes = [
    { angle: -90, label: labels[0] },
    { angle: 0,   label: labels[1] },
    { angle: 90,  label: labels[2] },
    { angle: 180, label: labels[3] },
  ];

  const toXY = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Grid lines at 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1];

  // Data polygon
  const dataPoints = axes.map((ax, i) => toXY(ax.angle, maxR * (scores[i] ?? 0)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
      {/* Grid diamonds */}
      {gridLevels.map(level => {
        const pts = axes.map(ax => toXY(ax.angle, maxR * level));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
        return (
          <path key={level} d={path} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        );
      })}

      {/* Axis lines */}
      {axes.map((ax, i) => {
        const end = toXY(ax.angle, maxR);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}

      {/* Data fill */}
      <path d={dataPath} fill="#6366f1" fillOpacity="0.15" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={colors[i] || '#6366f1'} stroke="white" strokeWidth="1.5" />
      ))}

      {/* Labels */}
      {axes.map((ax, i) => {
        const lp = toXY(ax.angle, maxR + 18);
        const score = Math.round((scores[i] ?? 0) * 100);
        return (
          <g key={i}>
            <text
              x={lp.x} y={lp.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="8.5" fill="#6b7280" fontWeight="600"
              className="select-none"
            >
              {labels[i]}
            </text>
            <text
              x={lp.x} y={lp.y + 10}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="8" fill={score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#9ca3af'}
              fontWeight="700"
              className="select-none"
            >
              {score}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const AcademyDailyHub: React.FC<Props> = ({ modules, readLessons, appliedLessons, completedQuizzes }) => {
  const { navigate } = useNavigation();
  const [streak, setStreak] = useState<StreakData>({ dates: [], longest: 0 });
  const [challenge, setChallenge] = useState<string | null>(getCachedChallenge());
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);

  // Record today's activity on mount
  useEffect(() => {
    const updated = recordActivityToday();
    setStreak(updated);
  }, []);

  // ── Module completion scores (0-1) ──
  const moduleScores = modules.map(m => {
    const ids = m.topics.map(t => t.id);
    if (ids.length === 0) return 0;
    const readC = ids.filter(id => readLessons.includes(id)).length;
    const appliedC = ids.filter(id => appliedLessons.includes(id)).length;
    const quizC = ids.filter(id => completedQuizzes.includes(id)).length;
    return (readC + appliedC + quizC) / (ids.length * 3);
  });

  const radarColors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'];
  const radarDotClasses = ['bg-blue-500', 'bg-amber-500', 'bg-violet-500', 'bg-emerald-500'];
  const currentStreak = calcCurrentStreak(streak.dates);

  // ── Smart recommendation ──
  const recommendation = (() => {
    // Find module with most room to grow (lowest score), prefer unread over unquizzed
    let bestModule = modules[0];
    let bestScore = moduleScores[0];
    let bestLesson: ModuleTopic | null = null;

    for (let i = 0; i < modules.length; i++) {
      if (moduleScores[i] < bestScore) {
        bestScore = moduleScores[i];
        bestModule = modules[i];
      }
    }

    // Within the weakest module, find first unread lesson
    for (const topic of bestModule.topics) {
      if (!readLessons.includes(topic.id)) {
        bestLesson = topic;
        break;
      }
    }
    // Fallback: first un-quizzed
    if (!bestLesson) {
      for (const topic of bestModule.topics) {
        if (!completedQuizzes.includes(topic.id)) {
          bestLesson = topic;
          break;
        }
      }
    }
    // Fallback: first unapplied
    if (!bestLesson) {
      for (const topic of bestModule.topics) {
        if (!appliedLessons.includes(topic.id)) {
          bestLesson = topic;
          break;
        }
      }
    }

    return bestLesson ? { module: bestModule, lesson: bestLesson } : null;
  })();

  // ── Generate daily challenge ──
  const generateChallenge = useCallback(async () => {
    setIsChallengeLoading(true);
    try {
      const allTopics = modules.flatMap(m => m.topics.map(t => t.title));
      const randomTopics = sanitizePromptInput(allTopics.sort(() => 0.5 - Math.random()).slice(0, 3).join(', '), 240);
      const prompt = `Ти си педагошки ментор. Генерирај еден краток (3-4 реченици) **дневен предизвик** за наставник по математика.

Предизвикот треба да е практичен сценарио кој поврзува педагошки техники (${randomTopics}) со реален час по математика (VII одделение).

Почни со "🎯 Денешен предизвик:" и заврши со едно конкретно прашање за рефлексија.
Одговори на македонски јазик. Биди инспиративен и конкретен.`;

      const response = await callGeminiProxy({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      if (response?.text) {
        setCachedChallenge(response.text);
        setChallenge(response.text);
      }
    } catch (e) {
      console.error('Daily challenge error:', e);
    } finally {
      setIsChallengeLoading(false);
    }
  }, [modules]);

  useEffect(() => {
    if (!challenge && !isChallengeLoading) {
      generateChallenge();
    }
  }, [challenge, isChallengeLoading, generateChallenge]);

  // ── Streak flame color ──
  const flameColor = currentStreak >= 30 ? 'text-red-500' :
                     currentStreak >= 14 ? 'text-orange-500' :
                     currentStreak >= 7  ? 'text-amber-500' : 'text-amber-400';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

      {/* ── Streak Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Flame className={`w-5 h-5 ${flameColor}`} />
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Низа на активност</h3>
        </div>

        <div className="flex items-end gap-3">
          <span className={`text-6xl font-black ${currentStreak > 0 ? flameColor : 'text-gray-300'}`}>
            {currentStreak}
          </span>
          <div className="mb-2">
            <p className="font-bold text-gray-700 text-lg leading-tight">
              {currentStreak === 1 ? 'ден' : 'дена'}
            </p>
            <p className="text-xs text-gray-400">
              Рекорд: {streak.longest} {streak.longest === 1 ? 'ден' : 'дена'}
            </p>
          </div>
        </div>

        {/* Mini activity grid — last 14 days */}
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 14 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (13 - i));
            const ds = d.toISOString().split('T')[0];
            const active = streak.dates.includes(ds);
            return (
              <div
                key={ds}
                title={ds}
                className={`w-5 h-5 rounded-md transition-colors ${active ? 'bg-amber-400' : 'bg-gray-100'}`}
              />
            );
          })}
        </div>

        {currentStreak === 0 && (
          <p className="text-xs text-gray-400">Посетете ја академијата секој ден за да изградите низа!</p>
        )}
        {currentStreak >= 7 && (
          <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-bold px-3 py-2 rounded-xl">
            <Trophy className="w-3.5 h-3.5" />
            {currentStreak >= 30 ? '🔥 Легенда!' : currentStreak >= 14 ? '⚡ Врвен практичар!' : '🌟 Посветен наставник!'}
          </div>
        )}
      </div>

      {/* ── Daily Challenge ── */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 shadow-sm p-5 flex flex-col gap-4 lg:col-span-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider">Денешен предизвик</h3>
          </div>
          <button
            type="button"
            onClick={() => { setChallenge(null); generateChallenge(); }}
            disabled={isChallengeLoading}
            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
            title="Генерирај нов предизвик"
            aria-label="Генерирај нов предизвик"
          >
            <RefreshCw className={`w-4 h-4 ${isChallengeLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isChallengeLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-indigo-500 font-medium">AI подготвува предизвик...</p>
          </div>
        ) : challenge ? (
          <div className="flex-1">
            <p className="text-sm text-indigo-900 leading-relaxed">{challenge}</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-indigo-400">Предизвикот не е достапен.</p>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Генериран со Gemini 2.5 Flash · Се обновува секој ден
        </div>
      </div>

      {/* ── Competency Radar + Recommendation ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Компетентносен профил</h3>
        </div>

        <CompetencyRadar
          scores={moduleScores}
          colors={radarColors}
          labels={modules.map(m => m.title.split(' ')[0])}
        />

        {/* Legend */}
        <div className="grid grid-cols-2 gap-1.5">
          {modules.map((m, i) => {
            const pct = Math.round(moduleScores[i] * 100);
            return (
              <div key={m.id} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${radarDotClasses[i] ?? 'bg-gray-400'}`} />
                <span className="text-[10px] text-gray-500 truncate">{m.title.split(' ')[0]}</span>
                <span className="text-[10px] font-bold text-gray-700 ml-auto">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Smart recommendation */}
        {recommendation && (
          <button
            type="button"
            onClick={() => navigate('/academy/lesson/' + recommendation.lesson.id)}
            className="w-full mt-auto flex items-center gap-2 p-3 bg-brand-primary/5 hover:bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-left transition-all group"
          >
            <Brain className="w-4 h-4 text-brand-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-0.5">Препорачана следна лекција</p>
              <p className="text-xs font-bold text-gray-800 truncate">{recommendation.lesson.title}</p>
              <p className="text-[10px] text-gray-400">{recommendation.module.title}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-brand-primary flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};
