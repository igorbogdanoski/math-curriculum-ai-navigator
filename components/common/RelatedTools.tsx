import React from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { ICONS } from '../../constants';

// ─── Config ────────────────────────────────────────────────────────────────────

interface RelatedTool {
  label: string;
  path: string;
  icon: keyof typeof ICONS;
  badge?: string;
}

// Contextual tool suggestions per route. Shown as a compact chip strip under breadcrumbs.
const RELATED_TOOLS_MAP: Record<string, RelatedTool[]> = {
  '/dugga/build': [
    { label: 'Библиотека', path: '/dugga', icon: 'analytics' },
    { label: 'Играј тест', path: '/dugga/play', icon: 'play' },
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
  ],
  '/dugga': [
    { label: 'Нов тест', path: '/dugga/build', icon: 'plus', badge: '+' },
    { label: 'Играј со код', path: '/dugga/play', icon: 'play' },
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
  ],
  '/dugga/play': [
    { label: 'Библиотека', path: '/dugga', icon: 'analytics' },
    { label: 'Нов тест', path: '/dugga/build', icon: 'plus' },
    { label: 'Олимписка Архива', path: '/olympiad', icon: 'star' },
  ],
  '/math-editor': [
    { label: 'Дига Тест Градител', path: '/dugga/build', icon: 'assessment' },
    { label: 'Олимписка Архива', path: '/olympiad', icon: 'star' },
    { label: 'AI Асистент', path: '/assistant', icon: 'assistant' },
    { label: 'DataViz', path: '/data-viz', icon: 'chart' },
  ],
  '/olympiad': [
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Матура Библ.', path: '/matura-library', icon: 'education' },
    { label: 'AI Асистент', path: '/assistant', icon: 'assistant' },
  ],
  '/test-generator': [
    { label: 'Дига Тест Градител', path: '/dugga/build', icon: 'assessment', badge: 'AI' },
    { label: 'Дигитален испит', path: '/exam/build', icon: 'assessment' },
    { label: 'Kahoot Maker', path: '/kahoot/make', icon: 'live' },
    { label: 'AI Преглед', path: '/test-review', icon: 'camera' },
  ],
  '/exam/build': [
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
    { label: 'Kahoot Maker', path: '/kahoot/make', icon: 'live' },
    { label: 'Библиотека', path: '/dugga', icon: 'analytics' },
  ],
  '/kahoot/make': [
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Живо Прашање', path: '/live/host', icon: 'live' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
    { label: 'Гама', path: '/gamma', icon: 'play' },
  ],
  '/live/host': [
    { label: 'Kahoot Maker', path: '/kahoot/make', icon: 'live' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Гама', path: '/gamma', icon: 'play' },
  ],
  '/live/join': [
    { label: 'Kahoot Maker', path: '/kahoot/make', icon: 'live' },
    { label: 'Дига — Играј', path: '/dugga/play', icon: 'play' },
  ],
  '/matura-library': [
    { label: 'Олимписка Архива', path: '/olympiad', icon: 'star' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Матура Симул.', path: '/matura', icon: 'education' },
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
  ],
  '/matura': [
    { label: 'Матура Библ.', path: '/matura-library', icon: 'education' },
    { label: 'Олимписка Архива', path: '/olympiad', icon: 'star' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'AI Асистент', path: '/assistant', icon: 'assistant' },
  ],
  '/matura-practice': [
    { label: 'Матура Библ.', path: '/matura-library', icon: 'education' },
    { label: 'Матура Симул.', path: '/matura', icon: 'education' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
  ],
  '/matura-assignments': [
    { label: 'Практика', path: '/matura-practice', icon: 'assessment' },
    { label: 'Матура Библ.', path: '/matura-library', icon: 'education' },
    { label: 'Симулација', path: '/matura', icon: 'education' },
  ],
  '/matura-stats': [
    { label: 'Матура Библ.', path: '/matura-library', icon: 'education' },
    { label: 'Матура Практика', path: '/matura-practice', icon: 'education' },
    { label: 'Аналитика', path: '/analytics', icon: 'analytics' },
  ],
  '/test-review': [
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Библиотека', path: '/dugga', icon: 'analytics' },
  ],
  '/materials': [
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Kahoot Maker', path: '/kahoot/make', icon: 'live' },
    { label: 'Гама', path: '/gamma', icon: 'play' },
  ],
  '/assistant': [
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Олимписка Архива', path: '/olympiad', icon: 'star' },
    { label: 'Форум', path: '/forum', icon: 'messages' },
  ],
  '/gamma': [
    { label: 'Kahoot Maker', path: '/kahoot/make', icon: 'live' },
    { label: 'Живо Прашање', path: '/live/host', icon: 'live' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Материјали', path: '/materials', icon: 'generator' },
  ],
  '/data-viz': [
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'Гама', path: '/gamma', icon: 'play' },
    { label: 'Геометрија 3D', path: '/geometry-3d', icon: 'geometry' },
  ],
  '/forum': [
    { label: 'AI Асистент', path: '/assistant', icon: 'assistant' },
    { label: 'Материјали', path: '/materials', icon: 'generator' },
    { label: 'Академија', path: '/academy', icon: 'education' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
  ],
  '/academy': [
    { label: 'Форум', path: '/forum', icon: 'messages' },
    { label: 'AI Асистент', path: '/assistant', icon: 'assistant' },
    { label: 'Мој Напредок', path: '/my-progress', icon: 'analytics' },
  ],
  '/analytics': [
    { label: 'Дига Библ.', path: '/dugga', icon: 'analytics' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
    { label: 'Аналитика (Матура)', path: '/matura-stats', icon: 'chart' },
  ],
  '/national-library': [
    { label: 'Материјали', path: '/materials', icon: 'generator' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
    { label: 'AI Асистент', path: '/assistant', icon: 'assistant' },
  ],
  '/geometry-3d': [
    { label: 'DataViz', path: '/data-viz', icon: 'chart' },
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
    { label: 'Дига Тест', path: '/dugga/build', icon: 'assessment' },
  ],
  '/geometry-2d': [
    { label: 'DataViz', path: '/data-viz', icon: 'chart' },
    { label: 'Геометрија 3D', path: '/geometry-3d', icon: 'geometry' },
    { label: 'Мат. Уредник', path: '/math-editor', icon: 'sparkles' },
  ],
  '/grade-book': [
    { label: 'Аналитика', path: '/analytics', icon: 'analytics' },
    { label: 'Дига Библ.', path: '/dugga', icon: 'analytics' },
    { label: 'Тест Генератор', path: '/test-generator', icon: 'assessment' },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface RelatedToolsProps {
  path: string;
}

export const RelatedTools: React.FC<RelatedToolsProps> = ({ path }) => {
  const { navigate } = useNavigation();

  // Exact match first, then prefix match (for dynamic routes like /exam/results/:id)
  let tools = RELATED_TOOLS_MAP[path];
  if (!tools) {
    const prefix = Object.keys(RELATED_TOOLS_MAP).find(k => path.startsWith(k) && k !== '/');
    if (prefix) tools = RELATED_TOOLS_MAP[prefix];
  }

  if (!tools?.length) return null;

  // Strip the current path from suggestions
  const filtered = tools.filter(t => t.path !== path);
  if (!filtered.length) return null;

  return (
    <div className="no-print px-4 md:px-8 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-gray-100 bg-white/60">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest shrink-0 mr-0.5">Поврзано</span>
      {filtered.map(tool => {
        const Icon = ICONS[tool.icon as keyof typeof ICONS];
        return (
          <button
            key={tool.path}
            type="button"
            onClick={() => navigate(tool.path)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all whitespace-nowrap shrink-0"
          >
            {Icon && <Icon className="w-3 h-3" />}
            {tool.label}
            {tool.badge && (
              <span className="ml-0.5 text-[9px] px-1 py-0 rounded-full bg-indigo-100 text-indigo-600 font-bold">{tool.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
