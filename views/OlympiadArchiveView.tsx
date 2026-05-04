import React, { useState, useRef, useCallback } from 'react';
import {
  Trophy, Search, Filter, Star, ChevronDown, ChevronUp,
  Camera, Lightbulb, Eye, EyeOff, RefreshCw, X, Loader2,
  BookOpen, Zap, Award, BarChart2,
} from 'lucide-react';
import {
  OLYMPIAD_PROBLEMS,
  CATEGORY_LABELS,
  COMPETITION_LABELS,
  CATEGORY_COLORS,
  DIFFICULTY_LABELS,
  type OlympiadProblem,
  type OlympiadCategory,
  type OlympiadCompetition,
  type OlympiadDifficulty,
} from '../data/olympiad/problems';
import { MathRenderer } from '../components/common/MathRenderer';
import { olympiadAPI } from '../services/gemini/olympiad';

const GRADES = [6, 7, 8, 9, 10, 11, 12] as const;
const CATEGORIES: OlympiadCategory[] = ['algebra', 'geometry', 'number_theory', 'combinatorics'];
const COMPETITIONS: OlympiadCompetition[] = ['kangaroo', 'numerus', 'national', 'municipal', 'regional'];

function DifficultyStars({ level }: { level: OlympiadDifficulty }) {
  return (
    <span className="flex items-center gap-0.5" title={DIFFICULTY_LABELS[level]}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= level ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </span>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
      <div className="text-violet-500">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function ProblemCard({
  problem,
  onClick,
}: {
  problem: OlympiadProblem;
  onClick: () => void;
}) {
  const categoryColor = CATEGORY_COLORS[problem.category];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all p-5 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColor}`}>
          {CATEGORY_LABELS[problem.category]}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DifficultyStars level={problem.difficulty} />
          <span className="text-xs text-gray-400">Р.{problem.grade}</span>
        </div>
      </div>
      <h3 className="font-semibold text-gray-800 text-sm mb-2 group-hover:text-violet-700 transition-colors line-clamp-2">
        {problem.title}
      </h3>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3">
        {problem.statement.replace(/\$[^$]*\$/g, '□')}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
          {COMPETITION_LABELS[problem.competition]}
        </span>
        <span className="text-xs text-violet-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Отвори →
        </span>
      </div>
    </button>
  );
}

function ProblemDetail({
  problem,
  onClose,
}: {
  problem: OlympiadProblem;
  onClose: () => void;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [aiHint, setAiHint] = useState('');
  const [loadingHint, setLoadingHint] = useState(false);
  const [similarProblem, setSimilarProblem] = useState('');
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [gradeImage, setGradeImage] = useState<File | null>(null);
  const [gradePreview, setGradePreview] = useState('');
  const [gradeResult, setGradeResult] = useState('');
  const [loadingGrade, setLoadingGrade] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGradeImage(file);
    setGradePreview(URL.createObjectURL(file));
    setGradeResult('');
  };

  const handleGrade = useCallback(async () => {
    if (!gradeImage) return;
    setLoadingGrade(true);
    try {
      const arrayBuffer = await gradeImage.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const result = await olympiadAPI.gradeHandwrittenSolution(base64, gradeImage.type, problem);
      setGradeResult(result);
    } catch {
      setGradeResult('Неуспешна оценка. Обиди се повторно.');
    } finally {
      setLoadingGrade(false);
    }
  }, [gradeImage, problem]);

  const handleAiHint = async () => {
    setLoadingHint(true);
    try {
      const level = Math.min((revealedHints + 1) as 1 | 2 | 3, 3) as 1 | 2 | 3;
      const h = await olympiadAPI.generateHint(problem, level);
      setAiHint(h);
      setRevealedHints(r => Math.min(r + 1, 3));
    } catch {
      setAiHint('Не може да се генерира hint.');
    } finally {
      setLoadingHint(false);
    }
  };

  const handleSimilar = async () => {
    setLoadingSimilar(true);
    try {
      const p = await olympiadAPI.generateSimilarProblem(problem);
      setSimilarProblem(p);
    } catch {
      setSimilarProblem('Не може да се генерира задача.');
    } finally {
      setLoadingSimilar(false);
    }
  };

  const categoryColor = CATEGORY_COLORS[problem.category];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColor}`}>
                {CATEGORY_LABELS[problem.category]}
              </span>
              <span className="text-xs text-gray-400">{COMPETITION_LABELS[problem.competition]}</span>
              <span className="text-xs text-gray-400">· Разред {problem.grade}</span>
            </div>
            <h2 className="font-bold text-gray-900 text-lg leading-tight">{problem.title}</h2>
            <div className="mt-1">
              <DifficultyStars level={problem.difficulty} />
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Statement */}
          <div className="bg-violet-50 rounded-2xl p-5 border border-violet-100">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">Поставка</p>
            <div className="text-gray-800 leading-relaxed">
              <MathRenderer text={problem.statement} />
            </div>
          </div>

          {/* Tags */}
          {problem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {problem.tags.map(tag => (
                <span key={tag} className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Hints */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Насоки
            </p>
            <div className="space-y-2">
              {problem.hints.slice(0, revealedHints).map((h, i) => (
                <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-gray-700">
                  <span className="font-semibold text-amber-600 mr-2">Hint {i + 1}:</span>
                  <MathRenderer text={h} />
                </div>
              ))}
              {revealedHints < problem.hints.length && (
                <button
                  onClick={() => setRevealedHints(r => r + 1)}
                  className="w-full text-sm text-amber-600 hover:text-amber-700 font-medium py-2 rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors"
                >
                  Открај Hint {revealedHints + 1}
                </button>
              )}
              {revealedHints >= problem.hints.length && (
                <button
                  onClick={handleAiHint}
                  disabled={loadingHint || revealedHints >= 3}
                  className="w-full text-sm text-violet-600 hover:text-violet-700 font-medium py-2 rounded-xl border border-violet-200 hover:bg-violet-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loadingHint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  AI Hint (Ниво {Math.min(revealedHints + 1, 3)})
                </button>
              )}
              {aiHint && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-gray-700">
                  <span className="font-semibold text-violet-600 mr-2">AI Hint:</span>
                  {aiHint}
                </div>
              )}
            </div>
          </div>

          {/* Solution */}
          <div>
            <button
              onClick={() => setShowSolution(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                {showSolution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSolution ? 'Скриј решение' : 'Прикажи решение'}
              </span>
              {showSolution ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showSolution && (
              <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
                <div className="text-sm text-gray-700">
                  <MathRenderer text={problem.solution} />
                </div>
                <div className="pt-2 border-t border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-600">Одговор: </span>
                  <span className="text-sm font-bold text-emerald-800">
                    <MathRenderer text={problem.answer} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* AI Grading */}
          <div className="border border-gray-100 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-500" />
              Реши и оцени — AI Градер
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Реши ја задачата на лист, фотографирај го решението и добиј AI оценка со детален фидбек.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />

            {!gradeImage ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                Прикачи слика од решение
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <img
                    src={gradePreview}
                    alt="Решение"
                    className="w-full max-h-48 object-contain rounded-xl border border-gray-200"
                  />
                  <button
                    onClick={() => { setGradeImage(null); setGradePreview(''); setGradeResult(''); }}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow border border-gray-200 hover:bg-gray-50"
                  >
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGrade}
                    disabled={loadingGrade}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loadingGrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    {loadingGrade ? 'Оценување...' : 'Оцени го решението'}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {gradeResult && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">AI Оцена</p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{gradeResult}</div>
              </div>
            )}
          </div>

          {/* Similar Problem */}
          <div>
            <button
              onClick={handleSimilar}
              disabled={loadingSimilar}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loadingSimilar ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loadingSimilar ? 'Генерирање...' : 'Генерирај слична задача (AI)'}
            </button>
            {similarProblem && (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Слична задача</p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{similarProblem}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OlympiadArchiveView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<OlympiadCategory | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<OlympiadCompetition | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<OlympiadDifficulty | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<OlympiadProblem | null>(null);

  const filtered = OLYMPIAD_PROBLEMS.filter(p => {
    if (selectedGrade && p.grade !== selectedGrade) return false;
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (selectedCompetition && p.competition !== selectedCompetition) return false;
    if (selectedDifficulty && p.difficulty !== selectedDifficulty) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = `${p.title} ${p.statement} ${p.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setSelectedGrade(null);
    setSelectedCategory(null);
    setSelectedCompetition(null);
    setSelectedDifficulty(null);
    setSearchQuery('');
  };

  const hasFilters = selectedGrade || selectedCategory || selectedCompetition || selectedDifficulty || searchQuery;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Олимписка Архива</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {OLYMPIAD_PROBLEMS.length} задачи · Алгебра · Геометрија · Теорија на броеви · Комбинаторика
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatCard icon={<BookOpen className="w-4 h-4" />} label="Вкупно задачи" value={`${OLYMPIAD_PROBLEMS.length}`} />
            <StatCard icon={<BarChart2 className="w-4 h-4" />} label="Категории" value="4" />
            <StatCard icon={<Award className="w-4 h-4" />} label="Натпревари" value="5" />
            <StatCard icon={<Star className="w-4 h-4" />} label="Разреди" value="6–12" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Пребарај задачи по наслов, поставка или тагови..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Филтри</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-gray-400 hover:text-violet-600 flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Исчисти
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Grade */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Разред</p>
              <div className="flex flex-wrap gap-1.5">
                {GRADES.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(selectedGrade === g ? null : g)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      selectedGrade === g
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700'
                    }`}
                  >
                    Р.{g}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Категорија</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      selectedCategory === cat
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Competition */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Натпревар</p>
              <div className="flex flex-wrap gap-1.5">
                {COMPETITIONS.map(comp => (
                  <button
                    key={comp}
                    onClick={() => setSelectedCompetition(selectedCompetition === comp ? null : comp)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      selectedCompetition === comp
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700'
                    }`}
                  >
                    {COMPETITION_LABELS[comp]}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Тежина</p>
              <div className="flex flex-wrap gap-1.5">
                {([1, 2, 3, 4, 5] as OlympiadDifficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDifficulty(selectedDifficulty === d ? null : d)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
                      selectedDifficulty === d
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-700'
                    }`}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500">
            {filtered.length === OLYMPIAD_PROBLEMS.length
              ? `${filtered.length} задачи`
              : `${filtered.length} / ${OLYMPIAD_PROBLEMS.length} задачи`}
          </p>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Нема задачи за избраните филтри.</p>
            <button onClick={clearFilters} className="mt-2 text-sm text-violet-500 hover:underline">
              Исчисти филтри
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(problem => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                onClick={() => setSelectedProblem(problem)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedProblem && (
        <ProblemDetail
          problem={selectedProblem}
          onClose={() => setSelectedProblem(null)}
        />
      )}
    </div>
  );
}
