/**
 * S50-A — Kahoot Maker
 * Reads extracted tasks from sessionStorage, lets teacher select questions
 * and set a per-question timer, then saves a quiz and launches a live session.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, Gamepad2, Timer, Check, ChevronRight, AlertCircle, Zap, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { firestoreService } from '../services/firestoreService';
import type { EnrichedWebTask } from '../services/gemini/visionContracts';

const SESSION_KEY = 'kahoot_tasks';
const AUTO_LAUNCH_KEY = 'kahoot_auto_launch';

const TIMER_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Без тајмер', value: undefined },
  { label: '10 сек', value: 10 },
  { label: '20 сек', value: 20 },
  { label: '30 сек', value: 30 },
  { label: '45 сек', value: 45 },
  { label: '60 сек', value: 60 },
];

const DIFF_COLORS: Record<string, string> = {
  basic: 'bg-green-100 text-green-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
};

export const KahootMakerView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();

  const [tasks, setTasks] = useState<EnrichedWebTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(20);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed: EnrichedWebTask[] = JSON.parse(raw);
        setTasks(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setTitle(`Kahoot — ${new Date().toLocaleDateString('mk-MK')}`);
      }
    } catch { /* corrupted sessionStorage — ignore */ }
  }, []);

  const toggleTask = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map((_, i) => i)));
  };

  const toggleExpanded = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectedTasks = tasks.filter((_, i) => selected.has(i));

  const handleLaunch = async () => {
    if (!firebaseUser || selectedTasks.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const quizContent = {
        title: title.trim() || 'Kahoot квиз',
        questions: selectedTasks.map(t => ({
          question: t.latexStatement || t.statement,
          type: 'open_short',
          answer: '',
          difficulty_level: t.difficulty,
          dokLevel: t.dokLevel,
        })),
      };
      const quizId = await firestoreService.saveToLibrary(quizContent, {
        title: quizContent.title,
        type: 'quiz',
        teacherUid: firebaseUser.uid,
      });

      const autoLaunch = {
        quizId,
        quizTitle: quizContent.title,
        timerPerQuestion: timerSeconds,
      };
      try { sessionStorage.setItem(AUTO_LAUNCH_KEY, JSON.stringify(autoLaunch)); } catch { /* quota */ }
      navigate('/live/host');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Грешка при зачувување на квизот.');
    } finally {
      setSaving(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 px-8 py-12">
          <Gamepad2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Нема извлечени задачи</h2>
          <p className="text-gray-400 text-sm mb-6">
            Прво извлечи задачи преку Extraction Hub, па кликни „🎮 Kahoot" копчето.
          </p>
          <button
            type="button"
            onClick={() => navigate('/extraction-hub')}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Оди на Extraction Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 rounded-2xl">
          <Gamepad2 className="w-7 h-7 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Kahoot Maker</h1>
          <p className="text-sm text-gray-500">Избери прашања и стартувај live квиз за неколку секунди</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task selection */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-800">Прашања ({selectedTasks.length}/{tasks.length})</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              {selected.size === tasks.length ? 'Одбери ги сите' : 'Избери ги сите'}
            </button>
          </div>
          {tasks.map((task, i) => {
            const isSelected = selected.has(i);
            const isExpanded = expanded.has(i);
            return (
              <div
                key={i}
                className={`rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-100 bg-white hover:border-gray-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTask(i)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${DIFF_COLORS[task.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                          {task.difficulty}
                        </span>
                        {task.topicMk && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{task.topicMk}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{task.title ?? task.statement}</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => toggleExpanded(i, e)}
                      className="ml-1 p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0"
                      title={isExpanded ? 'Скриј детали' : 'Прикажи детали'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-indigo-100 text-xs text-gray-600 space-y-1">
                    {task.statement && (
                      <p className="leading-relaxed">{task.statement}</p>
                    )}
                    {task.latexStatement && task.latexStatement !== task.statement && (
                      <p className="font-mono bg-white border border-gray-100 rounded-lg px-2 py-1 text-gray-700">{task.latexStatement}</p>
                    )}
                    {task.dokLevel && (
                      <p className="text-gray-400">DoK ниво: <strong className="text-gray-600">{task.dokLevel}</strong></p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Config panel */}
        <div className="space-y-4">
          {/* Quiz title */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Наслов на квизот
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Kahoot квиз..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:border-indigo-400 transition"
            />
          </div>

          {/* Timer selector */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Тајмер по прашање</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TIMER_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setTimerSeconds(opt.value)}
                  className={`py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    timerSeconds === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 text-white">
            <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-3">Резиме</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-indigo-200">Прашања</span>
                <span className="font-bold">{selectedTasks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-200">Тајмер</span>
                <span className="font-bold">
                  {timerSeconds != null ? `${timerSeconds}s/прашање` : 'Без'}
                </span>
              </div>
              {timerSeconds != null && selectedTasks.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-indigo-200">Вкупно ~</span>
                  <span className="font-bold">{Math.ceil(selectedTasks.length * timerSeconds / 60)} мин</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-semibold">{error}</p>
            </div>
          )}

          {/* Launch button */}
          <button
            type="button"
            onClick={handleLaunch}
            disabled={saving || selectedTasks.length === 0 || !firebaseUser}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition disabled:opacity-40 text-sm shadow-lg"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Зачувување...</>
              : <><Zap className="w-4 h-4" /> Зачувај и стартувај LIVE<ChevronRight className="w-4 h-4" /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
};
