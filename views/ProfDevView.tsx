/**
 * Professional Development — AI Literacy for Teachers
 * Route: #/pro-dev
 *
 * Content adapted from AINOW-Society/edu (GPL v3, AINOW Society)
 */
import React, { useMemo, useState } from 'react';
import {
  BookOpen, Wrench, BookMarked, Lightbulb,
  ChevronDown, ChevronUp, Search, Copy, CheckCircle2,
  ExternalLink, Cpu, GraduationCap,
} from 'lucide-react';
import {
  CHAPTERS, AI_TOOLS, GLOSSARY, TEACHER_PROMPTS,
  CHAPTER_CATEGORIES, TOOL_CATEGORIES, GLOSSARY_CATEGORIES,
  PROMPT_SUBJECTS, PROMPT_GRADES,
  type ChapterCategory, type ToolCategory, type GlossaryCategory,
  type PromptSubject, type PromptGrade,
} from '../data/profDev/index';
import { AcademyQuiz } from '../components/academy/AcademyQuiz';

// ── Tab definition ────────────────────────────────────────────────────────────

type Tab = 'guide' | 'tools' | 'glossary' | 'prompts';

const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
  { id: 'guide',    label: 'Водич',     icon: BookOpen,   count: 17 },
  { id: 'tools',    label: 'AI Алатки', icon: Wrench,     count: 47 },
  { id: 'glossary', label: 'Речник',    icon: BookMarked, count: 37 },
  { id: 'prompts',  label: 'Промптови', icon: Lightbulb,  count: 19 },
];

// ── Guide tab ─────────────────────────────────────────────────────────────────

const GuideTab: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const categories: ChapterCategory[] = ['foundations', 'practice', 'reference'];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Cpu className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-indigo-900 text-sm">Содржина адаптирана од AINOW Society</p>
            <p className="text-indigo-700 text-xs mt-0.5">
              17 поглавја за AI писменост, специјализирани за наставници во Македонија.
              Оригинален проект: <span className="font-medium">AINOW-Society/edu</span> (GPL v3)
            </p>
          </div>
        </div>
      </div>

      {categories.map(cat => {
        const meta = CHAPTER_CATEGORIES[cat];
        const chaps = CHAPTERS.filter(c => c.category === cat);
        return (
          <section key={cat}>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border mb-4 ${meta.bg} ${meta.color}`}>
              {meta.label} ({chaps.length} поглавја)
            </div>
            <div className="space-y-2">
              {chaps.map(ch => {
                const isOpen = expanded === ch.id;
                return (
                  <div key={ch.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : ch.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-2xl flex-shrink-0">{ch.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          <span className="text-gray-400 mr-1.5">{ch.order}.</span>
                          {ch.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{ch.subtitle}</p>
                      </div>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        <p className="text-sm text-gray-700">{ch.description}</p>
                        <ul className="space-y-1.5">
                          {ch.keyPoints.map((kp, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-indigo-500 font-bold mt-0.5 flex-shrink-0">›</span>
                              {kp}
                            </li>
                          ))}
                        </ul>
                        <AcademyQuiz item={{ id: ch.id, title: ch.title, contentText: [ch.description, ...ch.keyPoints].join(' ') }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

// ── Tools tab ─────────────────────────────────────────────────────────────────

const ToolsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<ToolCategory | 'all'>('all');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'freemium' | 'paid'>('all');

  const filtered = useMemo(() => AI_TOOLS.filter(t => {
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (pricingFilter !== 'all' && t.pricing !== pricingFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  }), [search, catFilter, pricingFilter]);

  const pricingBadge = (p: string) => {
    if (p === 'free')     return 'bg-emerald-100 text-emerald-700';
    if (p === 'freemium') return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };
  const pricingLabel = (p: string) => p === 'free' ? 'Бесплатно' : p === 'freemium' ? 'Freemium' : 'Платено';

  const catKeys = Object.keys(TOOL_CATEGORIES) as ToolCategory[];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Барај алатка..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
          />
        </div>
        <select
          value={pricingFilter}
          onChange={e => setPricingFilter(e.target.value as typeof pricingFilter)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">Сите цени</option>
          <option value="free">Бесплатно</option>
          <option value="freemium">Freemium</option>
          <option value="paid">Платено</option>
        </select>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${catFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Сите ({AI_TOOLS.length})
        </button>
        {catKeys.map(k => {
          const meta = TOOL_CATEGORIES[k];
          const count = AI_TOOLS.filter(t => t.category === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setCatFilter(catFilter === k ? 'all' : k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${catFilter === k ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">Нема алатки кои одговараат на критериумите.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(tool => (
            <div key={tool.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TOOL_CATEGORIES[tool.category].icon}</span>
                  <p className="font-bold text-gray-900 text-sm">{tool.name}</p>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${pricingBadge(tool.pricing)}`}>
                  {pricingLabel(tool.pricing)}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{tool.description}</p>
              <p className="text-[10px] text-gray-400 mt-2">{TOOL_CATEGORIES[tool.category].label}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-gray-400">
        Прикажани {filtered.length} / {AI_TOOLS.length} алатки ·
        Изворен директориум: AINOW-Society/edu
      </p>
    </div>
  );
};

// ── Glossary tab ──────────────────────────────────────────────────────────────

const GlossaryTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<GlossaryCategory | 'all'>('all');

  const filtered = useMemo(() => GLOSSARY.filter(t => {
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.term.toLowerCase().includes(q) ||
        t.termEn.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.fullForm ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [search, catFilter]);

  const catKeys = Object.keys(GLOSSARY_CATEGORIES) as GlossaryCategory[];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Барај термин (MK, EN)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${catFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Сите ({GLOSSARY.length})
        </button>
        {catKeys.map(k => {
          const meta = GLOSSARY_CATEGORIES[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => setCatFilter(catFilter === k ? 'all' : k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${catFilter === k ? 'bg-indigo-600 text-white' : `${meta.color} hover:opacity-80`}`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">Нема термини кои одговараат.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(term => (
            <div key={term.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <p className="font-bold text-gray-900 text-sm">{term.term}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GLOSSARY_CATEGORIES[term.category].color}`}>
                      {GLOSSARY_CATEGORIES[term.category].label}
                    </span>
                  </div>
                  {term.fullForm && (
                    <p className="text-xs text-indigo-600 font-medium mb-1">{term.fullForm}</p>
                  )}
                  <p className="text-sm text-gray-700">{term.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    <span>EN: {term.termEn}</span>
                    <span>SQ: {term.termSq}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-gray-400">
        {filtered.length} / {GLOSSARY.length} термини · AINOW-Society/edu (адаптирано)
      </p>
    </div>
  );
};

// ── Prompts tab ───────────────────────────────────────────────────────────────

const PromptsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<PromptSubject | 'all'>('all');
  const [gradeFilter, setGradeFilter] = useState<PromptGrade | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => TEACHER_PROMPTS.filter(p => {
    if (subjectFilter !== 'all' && p.subject !== subjectFilter) return false;
    if (gradeFilter !== 'all' && p.grade !== gradeFilter && p.grade !== 'all') return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
    }
    return true;
  }), [search, subjectFilter, gradeFilter]);

  const handleCopy = async (prompt: typeof TEACHER_PROMPTS[0]) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard denied */ }
  };

  const subjectKeys = Object.keys(PROMPT_SUBJECTS) as PromptSubject[];
  const gradeKeys   = Object.keys(PROMPT_GRADES)   as PromptGrade[];

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Совет:</strong> Заменете ги вредностите во [МАЛИ БУКВИ] со вашите конкретни информации пред да го испратите промптот до AI.
        Кликнете <strong>Копирај</strong> за да го поставите директно во ChatGPT, Gemini или Claude.
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Барај промпт..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value as typeof subjectFilter)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">Сите предмети</option>
          {subjectKeys.map(k => <option key={k} value={k}>{PROMPT_SUBJECTS[k]}</option>)}
        </select>
        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value as typeof gradeFilter)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">Сите нивоа</option>
          {gradeKeys.map(k => <option key={k} value={k}>{PROMPT_GRADES[k]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">Нема промптови кои одговараат.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isExpanded = expandedId === p.id;
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                          {PROMPT_GRADES[p.grade]}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {PROMPT_SUBJECTS[p.subject]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                      >
                        {isExpanded ? <><ChevronUp className="w-3 h-3" /> Скриј</> : <><ChevronDown className="w-3 h-3" /> Прикажи</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all"
                      >
                        {copiedId === p.id
                          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Копирано!</>
                          : <><Copy className="w-3.5 h-3.5" /> Копирај</>}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <pre className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                      {p.prompt}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-center text-xs text-gray-400">
        {filtered.length} / {TEACHER_PROMPTS.length} промптови
      </p>
    </div>
  );
};

// ── Main View ─────────────────────────────────────────────────────────────────

export const ProfDevView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('guide');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">AI Писменост за Наставници</h1>
          <p className="text-sm text-gray-600 mt-1">
            Водич, алатки, речник и готови промптови за ефективна употреба на AI во наставата.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count != null && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'guide'    && <GuideTab />}
        {activeTab === 'tools'    && <ToolsTab />}
        {activeTab === 'glossary' && <GlossaryTab />}
        {activeTab === 'prompts'  && <PromptsTab />}
      </div>

      {/* Attribution footer */}
      <div className="border-t border-gray-200 pt-4 text-center">
        <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
          Содржина адаптирана од
          <a
            href="https://github.com/AINOW-Society/edu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5"
          >
            AINOW-Society/edu <ExternalLink className="w-3 h-3" />
          </a>
          · GPL v3 · MisMath AI Navigator 2026
        </p>
      </div>
    </div>
  );
};

export default ProfDevView;
