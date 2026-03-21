import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { useCurriculum } from '../../hooks/useCurriculum';
import { ICONS } from '../../constants';
import {
  Home, BookOpen, Calendar, BarChart3, BookMarked, GraduationCap,
  Library, Settings, UserCircle2, Radio, FileText, ClipboardList,
  Sparkles, Wand2, PenTool, HelpCircle, Network, Search,
  Command, CornerDownLeft, ArrowUp, ArrowDown,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: 'nav' | 'ai' | 'concept' | 'recent';
  color: string;
  action: () => void;
  keywords?: string;
}

const RECENT_KEY = 'cmd_palette_recent_v1';
const MAX_RECENT = 5;

function saveRecent(item: { label: string; path: string; icon: string }) {
  try {
    const prev: typeof item[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    const filtered = prev.filter(r => r.path !== item.path);
    localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...filtered].slice(0, MAX_RECENT)));
  } catch { /* noop */ }
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { curriculum } = useCurriculum();

  // ── Close helper — restores focus to the element that opened the palette ─
  const close = () => {
    setOpen(false);
    setTimeout(() => (triggerRef.current as HTMLElement | null)?.focus(), 50);
  };

  // ── Open / close via Ctrl+K / Ctrl+G ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) triggerRef.current = document.activeElement;
        setOpen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setOpen(false);
        openGeneratorPanel({});
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openGeneratorPanel]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Navigate helper ──────────────────────────────────────────────────────
  const go = (path: string, label: string, iconKey: string) => {
    saveRecent({ label, path, icon: iconKey });
    navigate(path);
    close();
  };

  // ── Nav commands ─────────────────────────────────────────────────────────
  const navItems = useMemo<CommandItem[]>(() => [
    { id: 'home', label: 'Почетна', description: 'Ваш работен простор', icon: Home, group: 'nav', color: 'text-blue-500', keywords: 'home dashboard', action: () => go('/', 'Почетна', 'home') },
    { id: 'explore', label: 'Истражи курикулум', description: 'Национален МОН курикулум 1–9', icon: BookOpen, group: 'nav', color: 'text-emerald-500', keywords: 'explore curriculum mk national', action: () => go('/explore', 'Истражи', 'explore') },
    { id: 'planner', label: 'Планер за часови', description: 'Мои планови и библиотека', icon: Calendar, group: 'nav', color: 'text-violet-500', keywords: 'lesson plan planner', action: () => go('/planner', 'Планер', 'planner') },
    { id: 'new-lesson', label: 'Нов план за час', description: 'Создади нов план за час', icon: PenTool, group: 'nav', color: 'text-violet-500', keywords: 'new lesson plan create', action: () => go('/planner/lesson/new', 'Нов план', 'planner') },
    { id: 'annual', label: 'Годишна програма', description: 'AI генератор за годишни планови', icon: ClipboardList, group: 'nav', color: 'text-blue-500', keywords: 'annual plan year curriculum', action: () => go('/annual-planner', 'Годишна', 'planner') },
    { id: 'gallery', label: 'Галерија на планови', description: 'Заедница — форк и инспирација', icon: Library, group: 'nav', color: 'text-blue-500', keywords: 'gallery community fork', action: () => go('/annual-gallery', 'Галерија', 'database') },
    { id: 'gradebook', label: 'Дневник', description: 'Оценки и евиденција', icon: BookMarked, group: 'nav', color: 'text-amber-500', keywords: 'grades book record students', action: () => go('/grade-book', 'Дневник', 'gradeBook') },
    { id: 'analytics', label: 'Аналитика', description: '15 таба со напредни извештаи', icon: BarChart3, group: 'nav', color: 'text-rose-500', keywords: 'analytics reports statistics data', action: () => go('/analytics', 'Аналитика', 'analytics') },
    { id: 'academy', label: 'Академија', description: 'Личен CPD и педагошки модули', icon: GraduationCap, group: 'nav', color: 'text-indigo-500', keywords: 'academy CPD training pedagogy', action: () => go('/academy', 'Академија', 'education') },
    { id: 'library', label: 'Национална библиотека', description: 'Заеднички ресурси на наставниците', icon: Library, group: 'nav', color: 'text-teal-500', keywords: 'national library resources shared quiz', action: () => go('/library', 'Библиотека', 'database') },
    { id: 'test-review', label: 'AI Прегледувач', description: 'Прегледај рачно напишани тестови', icon: FileText, group: 'nav', color: 'text-orange-500', keywords: 'test review AI vision grade', action: () => go('/test-review', 'Прегледувач', 'assessment') },
    { id: 'live', label: 'Час во живо', description: 'Поврзи ученици за реал-тајм квиз', icon: Radio, group: 'nav', color: 'text-red-500', keywords: 'live session class quiz real time', action: () => go('/live/host', 'Час во живо', 'live') },
    { id: 'profile', label: 'Мој профил (CPD)', description: 'Портфолио за МОН инспекција', icon: UserCircle2, group: 'nav', color: 'text-pink-500', keywords: 'profile CPD portfolio MON', action: () => go('/my-profile', 'Профил', 'profile') },
    { id: 'settings', label: 'Поставки', description: 'Јазик, профил, претплата', icon: Settings, group: 'nav', color: 'text-gray-500', keywords: 'settings language profile subscription', action: () => go('/settings', 'Поставки', 'settings') },
    { id: 'mind-map', label: 'Ум Карта', description: 'Визуелна мрежа на концепти', icon: Network, group: 'nav', color: 'text-purple-500', keywords: 'mind map visual concepts', action: () => go('/mind-map', 'Ум Карта', 'mindmap') },
    { id: 'assistant', label: 'AI Асистент', description: 'Разговор со AI педагошки асистент', icon: HelpCircle, group: 'nav', color: 'text-cyan-500', keywords: 'AI assistant chat help', action: () => go('/assistant', 'Асистент', 'assistant') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  // ── AI action commands ───────────────────────────────────────────────────
  const aiItems = useMemo<CommandItem[]>(() => [
    {
      id: 'gen-quiz', label: 'Генерирај квиз', description: 'AI квиз прашања за ваше одделение',
      icon: Sparkles, group: 'ai', color: 'text-violet-600', keywords: 'generate quiz AI questions',
      action: () => { openGeneratorPanel({ materialType: 'QUIZ' }); close(); },
    },
    {
      id: 'gen-lesson', label: 'Генерирај план за час', description: 'Структуриран AI план за час',
      icon: Wand2, group: 'ai', color: 'text-violet-600', keywords: 'generate lesson plan AI',
      action: () => { navigate('/planner/lesson/new'); close(); },
    },
    {
      id: 'gen-materials', label: 'Генерирај материјали', description: 'Работни листови, тестови, задачи',
      icon: Sparkles, group: 'ai', color: 'text-violet-600', keywords: 'generate materials worksheets tests',
      action: () => { openGeneratorPanel({}); close(); },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, openGeneratorPanel]);

  // ── Concept search (from curriculum) ────────────────────────────────────
  const conceptItems = useMemo<CommandItem[]>(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const results: CommandItem[] = [];
    curriculum?.grades.forEach(grade => {
      grade.topics.forEach(topic => {
        topic.concepts.forEach(concept => {
          if (
            concept.title.toLowerCase().includes(q) ||
            concept.description?.toLowerCase().includes(q)
          ) {
            results.push({
              id: `concept-${concept.id}`,
              label: concept.title,
              description: `${grade.title} · ${topic.title}`,
              icon: BookOpen,
              group: 'concept',
              color: 'text-emerald-600',
              keywords: concept.description ?? '',
              action: () => go(`/concept/${concept.id}`, concept.title, 'curriculum'),
            });
          }
        });
      });
    });
    return results.slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, curriculum]);

  // ── Recent items ─────────────────────────────────────────────────────────
  const recentItems = useMemo<CommandItem[]>(() => {
    if (query.trim()) return [];
    try {
      const stored: { label: string; path: string }[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      return stored.map(r => ({
        id: `recent-${r.path}`,
        label: r.label,
        description: r.path,
        icon: ICONS.arrowRight,
        group: 'recent' as const,
        color: 'text-gray-400',
        action: () => go(r.path, r.label, 'home'),
      }));
    } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── Fuzzy filter ─────────────────────────────────────────────────────────
  const filtered = useMemo<CommandItem[]>(() => {
    if (!query.trim()) {
      return [...recentItems, ...navItems.slice(0, 8), ...aiItems];
    }
    const q = query.toLowerCase();
    const match = (item: CommandItem) =>
      item.label.toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q) ||
      (item.keywords ?? '').toLowerCase().includes(q);
    return [
      ...conceptItems,
      ...navItems.filter(match),
      ...aiItems.filter(match),
    ];
  }, [query, navItems, aiItems, conceptItems, recentItems]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      filtered[selectedIdx].action();
    }
  };

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  // ── Group labels ─────────────────────────────────────────────────────────
  const groupLabel: Record<string, string> = {
    recent: 'Последно посетено',
    nav: 'Навигација',
    ai: 'AI Акции',
    concept: 'Концепти од курикулум',
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Palette panel */}
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Пребарај команди, концепти, страници..."
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none text-base"
            aria-label="Command palette search"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 rounded border border-gray-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              Нема резултати за „{query}"
            </div>
          )}
          {filtered.map((item, idx) => {
            const showGroupHeader = item.group !== lastGroup;
            if (showGroupHeader) lastGroup = item.group;
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {groupLabel[item.group]}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  data-idx={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                    idx === selectedIdx
                      ? 'bg-brand-primary/8 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    idx === selectedIdx ? 'bg-brand-primary/10' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-sm truncate">{item.label}</span>
                    {item.description && (
                      <span className="block text-xs text-gray-400 truncate">{item.description}</span>
                    )}
                  </span>
                  {idx === selectedIdx && (
                    <kbd className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
                      <CornerDownLeft className="w-3 h-3" />
                    </kbd>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> Навигација</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> Избор</span>
            <span>ESC Затвори</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Command className="w-3 h-3" /><span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
};
