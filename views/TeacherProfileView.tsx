/**
 * Н6 — Дигитален Наставнички Профил (CPD Portfolio)
 * /my-profile
 *
 * Serves as evidence of Continuing Professional Development (CPD)
 * for МОН inspectors, school principals, and career advancement.
 */
import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Star, Trophy, Brain, Zap, Award, CheckCircle2,
  BarChart3, BookOpen, Share2, Printer, Copy, Check, Flame,
  UserCircle2, Building, Sparkles, Target, Loader2, TrendingUp,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { useAcademyProgress } from '../contexts/AcademyProgressContext';
import { calcFibonacciLevel, getAvatar } from '../utils/gamification';
import { ACADEMY_CONTENT } from '../data/academy/content';
import { SPECIALIZATIONS } from '../data/academy/specializations';
import { loadCards, isDueToday } from '../utils/sm2';
import { geminiService } from '../services/geminiService';
import { AcademyCertificateButton } from '../components/academy/AcademyCertificate';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TPACK_META = {
  technology: { label: 'Technology', color: 'bg-blue-500',    text: 'text-blue-700',   bg: 'bg-blue-50' },
  pedagogy:   { label: 'Pedagogy',   color: 'bg-purple-500',  text: 'text-purple-700', bg: 'bg-purple-50' },
  content:    { label: 'Content',    color: 'bg-green-500',   text: 'text-green-700',  bg: 'bg-green-50' },
};

function RadarMini({ scores, labels }: { scores: number[]; labels: string[] }) {
  const cx = 80; const cy = 80; const r = 60;
  const angles = [-90, 30, 150];
  const toXY = (a: number, rv: number) => ({
    x: cx + rv * Math.cos((a * Math.PI) / 180),
    y: cy + rv * Math.sin((a * Math.PI) / 180),
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = angles.map((a, i) => toXY(a, r * (scores[i] ?? 0)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
  return (
    <svg viewBox="0 0 160 160" className="w-36 h-36 mx-auto">
      {gridLevels.map(lv => {
        const pts = angles.map(a => toXY(a, r * lv));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
        return <path key={lv} d={path} fill="none" stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {angles.map((a, i) => {
        const end = toXY(a, r);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      <path d={dataPath} fill="#6366f1" fillOpacity="0.2" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="white" strokeWidth="1.5" />)}
      {angles.map((a, i) => {
        const lp = toXY(a, r + 16);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fill="#6b7280" fontWeight="600" className="select-none">
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TeacherProfileView: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const { progress } = useAcademyProgress();
  const { readLessons, appliedLessons, completedQuizzes, xp } = progress;
  const levelInfo = calcFibonacciLevel(xp);
  const avatar = getAvatar(levelInfo.level);

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);

  // Fetch published materials count
  useEffect(() => {
    if (!firebaseUser) return;
    const load = async () => {
      try {
        const { db } = await import('../firebaseConfig');
        const { collection, query, where, getCountFromServer } = await import('firebase/firestore');
        const q = query(collection(db, 'cached_ai_materials'), where('teacherUid', '==', firebaseUser.uid), where('isPublished', '==', true));
        const snap = await getCountFromServer(q);
        setPublishedCount(snap.data().count);
      } catch { setPublishedCount(0); }
    };
    load();
  }, [firebaseUser]);

  // SM-2 stats
  const sm2Cards = loadCards();
  const dueToday = sm2Cards.filter(isDueToday).length;
  const totalCards = sm2Cards.length;

  // Academy stats
  const allLessons = Object.values(ACADEMY_CONTENT);
  const tpackDomains = (['technology', 'pedagogy', 'content'] as const).map(domain => {
    const ids = allLessons.filter(l => l.tpackDomain === domain).map(l => l.id);
    const applied = ids.filter(id => appliedLessons.includes(id)).length;
    return { domain, total: ids.length, applied, pct: ids.length > 0 ? applied / ids.length : 0 };
  });

  const earnedSpecializations = SPECIALIZATIONS.filter(spec => {
    const applied = spec.lessonIds.filter(id => appliedLessons.includes(id)).length;
    const quizzed = spec.lessonIds.filter(id => completedQuizzes.includes(id)).length;
    return applied === spec.lessonIds.length && quizzed === spec.lessonIds.length;
  });

  const inProgressSpecializations = SPECIALIZATIONS
    .filter(spec => !earnedSpecializations.includes(spec))
    .map(spec => {
      const total = spec.lessonIds.length;
      const applied = spec.lessonIds.filter(id => appliedLessons.includes(id)).length;
      const quizzed = spec.lessonIds.filter(id => completedQuizzes.includes(id)).length;
      const pct = Math.round(((applied + quizzed) / (total * 2)) * 100);
      return { spec, applied, quizzed, total, pct };
    })
    .filter(({ pct }) => pct > 0);

  const todayFormatted = new Date().toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });

  const profileUrl = `${window.location.origin}/#/my-profile?uid=${firebaseUser?.uid ?? ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGenerateSummary = async () => {
    setLoadingAI(true);
    setAiSummary(null);
    try {
      const specNames = earnedSpecializations.map(s => s.title).join(', ') || 'сè уште во прогрес';
      const tpackStr = tpackDomains.map(d => `${TPACK_META[d.domain].label}: ${Math.round(d.pct * 100)}%`).join(', ');
      const prompt = `Ти си педагошки ментор. Напиши кратко (3 реченици) CPD резиме за наставник по математика со следниот профил:
- Ниво: ${levelInfo.level} (${avatar.title})
- XP: ${xp} поени
- Прочитани лекции: ${readLessons.length}
- Применети методи: ${appliedLessons.length}
- Завршени квизови: ${completedQuizzes.length}
- TPACK: ${tpackStr}
- Специјализации: ${specNames}
- Публикувани материјали: ${publishedCount ?? 'не е познато'}

Резимето треба да е на македонски, во прво лице, охрабрувачко и погодно за CV / инспекциски извештај.`;

      let text = '';
      for await (const chunk of geminiService.getChatResponseStream([{ role: 'user', text: prompt }])) {
        text += chunk;
        setAiSummary(text);
      }
    } catch {
      setAiSummary('Грешка при генерирање на резимето.');
    } finally {
      setLoadingAI(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 print:p-2 print:space-y-4">

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-black text-gray-900">Math Navigator AI — CPD Портфолио</h1>
        <p className="text-gray-400 text-sm mt-1">Дигитален доказ за континуиран професионален развој</p>
      </div>

      {/* ── Hero Card ── */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl print:bg-none print:border-2 print:border-indigo-200 print:text-gray-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-purple-400 rounded-full blur-2xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl shadow-xl">
              {avatar.emoji}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-black text-yellow-900 shadow">
              {levelInfo.level}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black truncate">{user?.name || 'Наставник'}</h1>
            <p className="text-indigo-200 text-sm mt-0.5 print:text-gray-500">{avatar.title} · Ниво {levelInfo.level}</p>
            {user?.schoolId && (
              <div className="flex items-center gap-1.5 mt-2 text-indigo-100 text-sm print:text-gray-600">
                <Building className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{user.schoolId}</span>
              </div>
            )}
            {/* XP progress */}
            <div className="mt-3 max-w-xs">
              <div className="flex justify-between text-xs text-indigo-300 mb-1 print:text-gray-400">
                <span>{xp} XP</span>
                <span>до ниво {levelInfo.level + 1}: {levelInfo.nextLevelXp} XP</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${levelInfo.progress}%` }} />
              </div>
            </div>
          </div>

          {/* Actions — hidden in print */}
          <div className="flex flex-col gap-2 flex-shrink-0 print:hidden">
            <button type="button" onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Копирано!' : 'Сподели'}
            </button>
            <button type="button" onClick={() => setShowQR(s => !s)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all">
              <Share2 className="w-4 h-4" /> QR Код
            </button>
            <button type="button" onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all">
              <Printer className="w-4 h-4" /> Печати PDF
            </button>
          </div>
        </div>

        {/* QR code popup */}
        {showQR && (
          <div className="relative mt-4 flex justify-center print:hidden">
            <div className="bg-white p-3 rounded-2xl shadow-xl inline-block">
              <QRCode value={profileUrl} size={120} />
              <p className="text-center text-xs text-gray-500 mt-2 font-medium">Скенирај за CPD профил</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, value: readLessons.length, label: 'Прочитани лекции', color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: CheckCircle2, value: appliedLessons.length, label: 'Применети методи', color: 'text-green-600', bg: 'bg-green-50' },
          { icon: Brain, value: completedQuizzes.length, label: 'Завршени квизови', color: 'text-purple-600', bg: 'bg-purple-50' },
          { icon: Trophy, value: earnedSpecializations.length, label: 'Специјализации', color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ icon: Icon, value, label, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 text-center`}>
            <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 font-bold mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── TPACK Radar + Spaced Rep ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* TPACK */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-indigo-500" /> TPACK Компетентносен Профил
          </h2>
          <RadarMini
            scores={tpackDomains.map(d => d.pct)}
            labels={tpackDomains.map(d => TPACK_META[d.domain].label)}
          />
          <div className="mt-3 space-y-2">
            {tpackDomains.map(d => (
              <div key={d.domain} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${TPACK_META[d.domain].color}`} />
                <span className="text-xs text-gray-500 flex-1">{TPACK_META[d.domain].label}</span>
                <div className="w-20 bg-gray-100 rounded-full h-1.5">
                  <div className={`${TPACK_META[d.domain].color} h-1.5 rounded-full`} style={{ width: `${d.pct * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-8 text-right">{Math.round(d.pct * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" /> Активност и Статистики
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-bold text-gray-700">Вкупно XP</span>
              </div>
              <span className="font-black text-amber-600">{xp.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-bold text-gray-700">Публикувани материјали</span>
              </div>
              <span className="font-black text-indigo-600">{publishedCount ?? '…'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-bold text-gray-700">SM-2 картички активни</span>
              </div>
              <span className="font-black text-purple-600">{totalCards}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-rose-500" />
                <span className="text-sm font-bold text-gray-700">За повторување денес</span>
              </div>
              <span className={`font-black ${dueToday > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                {dueToday > 0 ? dueToday : '✓ 0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Earned Specializations + Certificates ── */}
      {earnedSpecializations.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-500" /> Освоени специјализации
            <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {earnedSpecializations.length} сертификат{earnedSpecializations.length !== 1 ? 'и' : ''}
            </span>
          </h2>
          <div className="space-y-3">
            {earnedSpecializations.map(spec => (
              <div key={spec.id} className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border-2 ${spec.borderColor} bg-white`}>
                <span className="text-3xl">{spec.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-sm">{spec.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{spec.certificateLabel}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Завршено · {todayFormatted}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <AcademyCertificateButton
                    userName={user?.name || 'Наставник'}
                    specializationTitle={spec.title}
                    date={todayFormatted}
                    className="!px-3 !py-1.5 !text-xs !rounded-lg"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── In-progress specializations ── */}
      {inProgressSpecializations.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-indigo-400" /> Специјализации во тек
          </h2>
          <div className="space-y-3">
            {inProgressSpecializations.map(({ spec, applied, quizzed, total, pct }) => (
              <div key={spec.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xl">{spec.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-gray-700 text-sm truncate">{spec.title}</p>
                    <span className="text-xs font-black text-indigo-600 flex-shrink-0 ml-2">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {applied}/{total} применети · {quizzed}/{total} квизови
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {earnedSpecializations.length === 0 && inProgressSpecializations.length === 0 && (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
          <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Сè уште нема освоени специјализации</p>
          <p className="text-xs mt-1">Заврши ги сите лекции и квизови во патека за да освоиш сертификат</p>
        </div>
      )}

      {/* ── AI CPD Summary ── */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 print:border print:border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-indigo-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" /> AI Генерирано CPD Резиме
          </h2>
          <button type="button" onClick={handleGenerateSummary} disabled={loadingAI}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all print:hidden">
            {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {aiSummary ? 'Регенерирај' : 'Генерирај резиме'}
          </button>
        </div>
        {aiSummary ? (
          <div className="bg-white rounded-xl p-4 border border-indigo-100">
            <p className="text-sm text-gray-800 leading-relaxed italic">"{aiSummary}"</p>
            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Генерирано со Gemini AI · Math Navigator
            </p>
          </div>
        ) : (
          <div className="bg-white/70 rounded-xl p-4 border border-indigo-100 text-center">
            <p className="text-sm text-indigo-400">
              {loadingAI ? 'AI подготвува ваше CPD резиме...' : 'Кликни „Генерирај резиме" за AI-напишано CPD описание за инспектори.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Print footer ── */}
      <div className="hidden print:block border-t border-gray-200 pt-4 mt-6 text-center">
        <p className="text-xs text-gray-400">Генерирано со Math Curriculum AI Navigator · ai.mismath.net · {new Date().toLocaleDateString('mk-MK')}</p>
      </div>
    </div>
  );
};
