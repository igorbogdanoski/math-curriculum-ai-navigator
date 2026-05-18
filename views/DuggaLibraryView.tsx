import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Globe, Lock, Copy, Trash2, BarChart2,
  Users, Clock, BookOpen, Award,
  ChevronDown, ChevronUp, Loader2,
  ClipboardList, X, Pencil, GitFork,
} from 'lucide-react';
import { MathRenderer } from '../components/common/MathRenderer';
import {
  subscribeMyDuggaTests, subscribePublicDuggaTests,
  deleteDuggaTest, updateDuggaTest, getTestSubmissions,
} from '../services/firestoreService.dugga';
import type { DuggaTest, DuggaSubmission } from '../services/firestoreService.dugga';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type LibraryTab = 'my' | 'public';
const TEST_TYPE_LABELS: Record<string, string> = {
  topic: 'Тематски', midterm: 'Полугодишен', annual: 'Годишен', exam: 'Матура', custom: 'Прилагоден',
};
const DOK_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700', 2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700', 4: 'bg-red-100 text-red-700',
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      {icon}
      <span className="font-medium text-gray-700">{value}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Test Card ────────────────────────────────────────────────────────────────

function TestCard({
  test, isOwner, onDelete, onTogglePublic, onViewResults, onCopyCode, onPlay, onEdit, onAdapt,
}: {
  test: DuggaTest;
  isOwner: boolean;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
  onViewResults: (test: DuggaTest) => void;
  onCopyCode: (code: string) => void;
  onPlay: () => void;
  onEdit: (id: string) => void;
  onAdapt: (id: string) => void;
}) {
  const dokDist = test.questions.reduce<Record<number, number>>((acc, q) => {
    if (q.type !== 'section_header') acc[q.dok] = (acc[q.dok] ?? 0) + 1;
    return acc;
  }, {});

  const questionCount = test.questions.filter(q => q.type !== 'section_header').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
              {TEST_TYPE_LABELS[test.testType] ?? test.testType}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {test.grade}. разред
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${test.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {test.isPublic ? <><Globe className="w-3 h-3" />Јавен</> : <><Lock className="w-3 h-3" />Приватен</>}
            </span>
          </div>
          <h3 className="font-bold text-gray-900 text-base leading-snug">{test.title}</h3>
          {test.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{test.description}</p>
          )}
          {test.adaptedFromId && (
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
              <GitFork className="w-2.5 h-2.5" />
              Адаптирано од: <span className="font-medium">{test.originalAuthorName ?? 'непознат'}</span>
              {test.adaptedFromTitle && ` — „${test.adaptedFromTitle}"`}
            </p>
          )}
        </div>
        {/* Share code */}
        <button type="button" onClick={() => onCopyCode(test.shareCode)}
          className="shrink-0 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors group"
          title="Копирај код">
          <div className="text-center">
            <div className="font-mono font-black text-indigo-700 text-sm tracking-widest">{test.shareCode}</div>
            <div className="text-[10px] text-indigo-500 group-hover:text-indigo-700 flex items-center gap-0.5 justify-center">
              <Copy className="w-2.5 h-2.5" />копирај
            </div>
          </div>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4">
        <StatPill icon={<ClipboardList className="w-3.5 h-3.5" />} label="прашања" value={questionCount} />
        <StatPill icon={<Award className="w-3.5 h-3.5" />} label="поени" value={test.totalPoints} />
        <StatPill icon={<Clock className="w-3.5 h-3.5" />} label="мин" value={test.estimatedMinutes} />
        {test.topics.length > 0 && (
          <div className="text-xs text-gray-500 flex-1 min-w-0">
            <span className="font-medium text-gray-600">Теми: </span>
            <span className="truncate">{test.topics.join(', ')}</span>
          </div>
        )}
      </div>

      {/* DoK distribution */}
      {Object.keys(dokDist).length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {([1, 2, 3, 4] as const).map(d => dokDist[d] ? (
            <span key={d} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOK_COLORS[d]}`}>
              DoK{d}: {dokDist[d]}
            </span>
          ) : null)}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
        <button type="button" onClick={onPlay}
          className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          Играј
        </button>
        <button type="button" onClick={() => onViewResults(test)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors">
          <BarChart2 className="w-3.5 h-3.5" />
          Резултати
        </button>
        {isOwner ? (
          <>
            <button type="button" onClick={() => onEdit(test.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
              title="Уреди тест">
              <Pencil className="w-3.5 h-3.5" />
              Уреди
            </button>
            <button type="button" onClick={() => onTogglePublic(test.id, !test.isPublic)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
              title={test.isPublic ? 'Направи приватен' : 'Сподели јавно'}>
              {test.isPublic ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={() => onDelete(test.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onAdapt(test.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
            title="Клонирај и адаптирај за твоите ученици">
            <GitFork className="w-3.5 h-3.5" />
            Адаптирај
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────

function ResultsPanel({ test, onClose }: { test: DuggaTest; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<DuggaSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTestSubmissions(test.id).then(s => {
      setSubmissions(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [test.id]);

  const avgPct = submissions.length > 0
    ? Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length)
    : 0;
  const pass = submissions.filter(s => s.percentage >= 50).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">{test.title}</h2>
            <p className="text-xs text-gray-500">{submissions.length} поднесувања</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Summary stats */}
        {submissions.length > 0 && (
          <div className="p-4 grid grid-cols-3 gap-3 border-b border-gray-100">
            <div className="text-center p-3 bg-indigo-50 rounded-xl">
              <div className="text-2xl font-black text-indigo-700">{submissions.length}</div>
              <div className="text-xs text-indigo-600 mt-0.5">Ученици</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <div className="text-2xl font-black text-green-700">{avgPct}%</div>
              <div className="text-xs text-green-600 mt-0.5">Просек</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <div className="text-2xl font-black text-amber-700">{pass}/{submissions.length}</div>
              <div className="text-xs text-amber-600 mt-0.5">Положиле (≥50%)</div>
            </div>
          </div>
        )}

        {/* Submissions list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          )}
          {!loading && submissions.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Нема поднесувања за овој тест.</p>
              <p className="text-xs mt-1">Сподели го кодот <span className="font-mono font-bold text-indigo-600">{test.shareCode}</span> со учениците.</p>
            </div>
          )}
          {submissions.map(sub => (
            <div key={sub.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">{sub.studentName}</p>
                <p className="text-xs text-gray-400">{sub.submittedAt?.toDate?.()?.toLocaleDateString('mk-MK') ?? '—'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{sub.score}/{sub.totalPoints}</div>
                  <div className="text-xs text-gray-500">{sub.percentage}%</div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${sub.percentage >= 90 ? 'bg-green-100 text-green-700' : sub.percentage >= 60 ? 'bg-blue-100 text-blue-700' : sub.percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {sub.percentage >= 90 ? '5' : sub.percentage >= 75 ? '4' : sub.percentage >= 60 ? '3' : sub.percentage >= 50 ? '2' : '1'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DuggaLibraryView() {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();

  const [tab, setTab] = useState<LibraryTab>('my');
  const [myTests, setMyTests] = useState<DuggaTest[]>([]);
  const [publicTests, setPublicTests] = useState<DuggaTest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');
  const [onlyFinalExam, setOnlyFinalExam] = useState(false);
  const [selectedTest, setSelectedTest] = useState<DuggaTest | null>(null);
  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(false);

  // Subscribe to my tests
  useEffect(() => {
    if (!firebaseUser?.uid) { setLoadingMy(false); return; }
    setLoadingMy(true);
    const unsub = subscribeMyDuggaTests(firebaseUser.uid, tests => {
      setMyTests(tests);
      setLoadingMy(false);
    });
    return unsub;
  }, [firebaseUser?.uid]);

  // Subscribe to public tests (lazy — only when tab switches)
  useEffect(() => {
    if (tab !== 'public') return;
    setLoadingPublic(true);
    const unsub = subscribePublicDuggaTests(tests => {
      setPublicTests(tests);
      setLoadingPublic(false);
    });
    return unsub;
  }, [tab]);

  const handleEdit = useCallback((id: string) => {
    navigate(`/dugga/build?edit=${id}`);
  }, [navigate]);

  const handleAdapt = useCallback((id: string) => {
    navigate(`/dugga/build?adapt=${id}`);
  }, [navigate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Избриши го тестот? Ова не може да се врати.')) return;
    await deleteDuggaTest(id);
    addNotification('Тестот е избришан.', 'success');
  }, [addNotification]);

  const handleTogglePublic = useCallback(async (id: string, isPublic: boolean) => {
    await updateDuggaTest(id, { isPublic });
    addNotification(isPublic ? 'Тестот е јавно споделен.' : 'Тестот е направен приватен.', 'success');
  }, [addNotification]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      addNotification(`Код ${code} е копиран!`, 'success');
    });
  }, [addNotification]);

  const sourceTests = tab === 'my' ? myTests : publicTests;

  // Build the dynamic track list from the visible source.
  const availableTracks = Array.from(
    new Set(sourceTests.map(t => (t.track ?? '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'mk'));

  const activeTests = sourceTests.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.topics.some(tp => tp.toLowerCase().includes(q)) || t.shareCode.toLowerCase().includes(q);
    const matchGrade = filterGrade === 'all' || t.grade === filterGrade;
    const matchTrack = filterTrack === 'all' || (t.track ?? '') === filterTrack;
    const matchType = filterTestType === 'all' || t.testType === filterTestType;
    const matchExam = !onlyFinalExam || t.finalExamMode === true;
    return matchSearch && matchGrade && matchTrack && matchType && matchExam;
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Дига Библиотека</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управувај со тестовите и следи ги резултатите</p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => navigate('/dugga/play')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:border-indigo-300 hover:text-indigo-700 transition-colors">
            <BookOpen className="w-4 h-4" />
            Играј со Код
          </button>
          <button type="button"
            onClick={() => navigate('/dugga/build')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            Нов Тест
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {([['my', 'Мои тестови'], ['public', 'Јавна библиотека']] as const).map(([t, label]) => (
          <button type="button" key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
            {t === 'my' && myTests.length > 0 && (
              <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{myTests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Пребарај по наслов, тема, код..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
        </div>
        <select value={filterGrade === 'all' ? 'all' : String(filterGrade)}
          onChange={e => setFilterGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label="Филтер по разред"
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="all">Сите разреди</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
            <option key={g} value={g}>{g}. разред</option>
          ))}
        </select>
        <select value={filterTrack}
          onChange={e => setFilterTrack(e.target.value)}
          aria-label="Филтер по насока"
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="all">Сите насоки</option>
          {availableTracks.map(tr => (
            <option key={tr} value={tr}>{tr}</option>
          ))}
        </select>
        <select value={filterTestType}
          onChange={e => setFilterTestType(e.target.value)}
          aria-label="Филтер по тип на тест"
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="all">Сите типови</option>
          <option value="topic">Тематски</option>
          <option value="midterm">Полугодишен</option>
          <option value="annual">Годишен</option>
          <option value="exam">Завршен испит</option>
          <option value="custom">Прилагоден</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white cursor-pointer">
          <input type="checkbox" checked={onlyFinalExam}
            onChange={e => setOnlyFinalExam(e.target.checked)}
            className="accent-indigo-600" />
          Само завршни испити
        </label>
      </div>

      {/* Content */}
      {(tab === 'my' ? loadingMy : loadingPublic) ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : activeTests.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
            <ClipboardList className="w-8 h-8 text-gray-300" />
          </div>
          {tab === 'my' ? (
            <>
              <p className="text-gray-500 font-medium">Немаш зачувани тестови</p>
              <button type="button" onClick={() => navigate('/dugga/build')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                <Plus className="w-4 h-4" />
                Направи прв тест
              </button>
            </>
          ) : (
            <p className="text-gray-500">Нема јавни тестови кои одговараат на пребарувањето.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeTests.map(t => (
            <TestCard
              key={t.id}
              test={t}
              isOwner={t.teacherUid === firebaseUser?.uid}
              onDelete={handleDelete}
              onTogglePublic={handleTogglePublic}
              onViewResults={setSelectedTest}
              onCopyCode={handleCopyCode}
              onEdit={handleEdit}
              onAdapt={handleAdapt}
              onPlay={() => navigate(`/dugga/play?code=${t.shareCode}`)}
            />
          ))}
        </div>
      )}

      {/* Results panel modal */}
      {selectedTest && (
        <ResultsPanel test={selectedTest} onClose={() => setSelectedTest(null)} />
      )}
    </div>
  );
}
