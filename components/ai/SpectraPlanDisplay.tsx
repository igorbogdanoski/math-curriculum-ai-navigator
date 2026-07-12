import React, { useState } from 'react';
import { Copy, CheckCircle, Printer, ChevronDown, ChevronUp, BookOpen, Users, Target, Lightbulb } from 'lucide-react';
import type { AIGeneratedIdeas } from '../../types';

// SPECTRA phase metadata — colors and icons aligned with official framework
const SPECTRA_PHASES: Record<string, {
  key: string;
  label: string;
  labelEn: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  ring: string;
  icon: string;
  competency: string;
  duration: string;
}> = {
  'S': {
    key: 'S', label: 'Барање знаење', labelEn: 'Search for Knowledge',
    description: 'Собирање факти, поими и докази',
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', ring: 'ring-blue-500',
    icon: '🔍', competency: 'Критичко мислење', duration: '7 мин',
  },
  'P': {
    key: 'P', label: 'Перцепција на перспективи', labelEn: 'Perceive Perspectives',
    description: 'Истражување емоции, гледишта, култури и искуства',
    color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', ring: 'ring-red-500',
    icon: '❤️', competency: 'Емпатија и перспектива', duration: '7 мин',
  },
  'E': {
    key: 'E', label: 'Испитување предизвици', labelEn: 'Examine Challenges',
    description: 'Идентификување мисконцепции, ризици и бариери',
    color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-400', ring: 'ring-gray-500',
    icon: '⚠️', competency: 'Решавање проблеми', duration: '7 мин',
  },
  'C': {
    key: 'C', label: 'Разгледување можности', labelEn: 'Consider Possibilities',
    description: 'Идентификување силни страни, можности и потенцијални исходи',
    color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', ring: 'ring-amber-500',
    icon: '💡', competency: 'Креативност и иновација', duration: '5 мин',
  },
  'T': {
    key: 'T', label: 'Трансформирање идеи', labelEn: 'Transform Ideas',
    description: 'Создавање, иновирање, дизајнирање и предлагање решенија',
    color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300', ring: 'ring-green-500',
    icon: '✏️', competency: 'Соработка и комуникација', duration: '8 мин',
  },
  'RA': {
    key: 'RA', label: 'Рефлектирај и дејствувај', labelEn: 'Reflect and Act',
    description: 'Примена на знаења, рефлексија за исходи, план за следни чекори',
    color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', ring: 'ring-purple-500',
    icon: '🎯', competency: 'Одговорна акција и рефлексија', duration: '6 мин',
  },
};

// Detect which SPECTRA phase an activity belongs to from its bloomsLevel tag
function detectPhase(bloomsLevel: string): string | null {
  const upper = bloomsLevel.toUpperCase();
  if (upper.startsWith('RA')) return 'RA';
  if (upper.startsWith('S ') || upper === 'S') return 'S';
  if (upper.startsWith('P ') || upper === 'P') return 'P';
  if (upper.startsWith('E ') || upper === 'E') return 'E';
  if (upper.startsWith('C ') || upper === 'C') return 'C';
  if (upper.startsWith('T ') || upper === 'T') return 'T';
  return null;
}

// Parse differentiation text into 3 levels
function parseDifferentiation(text: string): { support: string; standard: string; advanced: string } | null {
  const lower = text.toLowerCase();
  const hasLevels = lower.includes('поддршка') || lower.includes('support') || lower.includes('стандард');
  if (!hasLevels) return null;

  const supportMatch = text.match(/[Пп]оддршка[:\s]+([^.\n]+)/);
  const standardMatch = text.match(/[Сс]тандард[:\s]+([^.\n]+)/);
  const advancedMatch = text.match(/[Пп]редизвик[:\s]+([^.\n]+)/);

  if (!supportMatch && !standardMatch) return null;
  return {
    support: supportMatch?.[1]?.trim() ?? '',
    standard: standardMatch?.[1]?.trim() ?? '',
    advanced: advancedMatch?.[1]?.trim() ?? '',
  };
}

interface SpectraPhaseSectionProps {
  phaseKey: string;
  text: string;
  isOpening?: boolean;
}

const SpectraPhaseSection: React.FC<SpectraPhaseSectionProps> = ({ phaseKey, text, isOpening }) => {
  const [expanded, setExpanded] = useState(true);
  const phase = SPECTRA_PHASES[phaseKey];
  if (!phase) return null;

  // Strip leading "S-фаза (7 мин): " labels from text
  const cleanText = text.replace(/^[A-Z]{1,2}-фаза\s*\([^)]+\)\s*:\s*/i, '').trim();

  return (
    <div className={`rounded-xl border-2 ${phase.border} overflow-hidden shadow-sm`}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${phase.bg} hover:brightness-95 transition-all`}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-black ${phase.bg} border-2 ${phase.border} shadow-sm flex-shrink-0`}>
          {phase.key}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-black ${phase.color}`}>{phase.icon} {phase.label}</span>
            <span className={`text-xs font-semibold ${phase.color} opacity-60`}>— {phase.labelEn}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${phase.bg} ${phase.border} border ${phase.color}`}>
              {isOpening ? '7 мин' : phase.duration}
            </span>
          </div>
          <p className={`text-xs ${phase.color} opacity-70 mt-0.5`}>{phase.description}</p>
        </div>
        <div className={`${phase.color} opacity-60`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-white">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{cleanText}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Компетенција:</span>
            <span className={`text-xs font-semibold ${phase.color}`}>{phase.competency}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface SpectraPlanDisplayProps {
  material: AIGeneratedIdeas;
  onSaveAsNote?: () => void;
}

export const SpectraPlanDisplay: React.FC<SpectraPlanDisplayProps> = ({ material, onSaveAsNote }) => {
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const handleCopy = async () => {
    const lines: string[] = [
      `SPECTRA ПОДГОТОВКА: ${material.title}`,
      `БРО/МОН усогласена · Вкупно времетраење: 40 мин`,
      '',
      '═══ S — БАРАЊЕ ЗНАЕЊЕ (7 мин) ═══',
      material.openingActivity || '',
      '',
    ];
    for (const act of material.mainActivity || []) {
      const phaseKey = detectPhase(act.bloomsLevel);
      if (phaseKey) {
        const ph = SPECTRA_PHASES[phaseKey];
        lines.push(`═══ ${phaseKey} — ${ph.label.toUpperCase()} (${ph.duration}) ═══`);
        lines.push(act.text.replace(/^[A-Z]{1,2}-фаза\s*\([^)]+\)\s*:\s*/i, '').trim());
        lines.push('');
      }
    }
    if (material.differentiation) {
      lines.push('═══ ДИФЕРЕНЦИЈАЦИЈА ═══');
      lines.push(material.differentiation);
      lines.push('');
    }
    if (material.assessmentIdea) {
      lines.push('═══ ЕВАЛУАЦИЈА (БРО/МОН) ═══');
      lines.push(material.assessmentIdea);
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const diffLevels = material.differentiation ? parseDifferentiation(material.differentiation) : null;
  const totalMinutes = 40;
  const competencies = material.assessmentStandards || [];

  // Determine which activities map to which SPECTRA phases
  const phaseActivities: Record<string, string> = {};
  for (const act of material.mainActivity || []) {
    const key = detectPhase(act.bloomsLevel);
    if (key) phaseActivities[key] = act.text;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-widest text-white/60">SPECTRA Educational Framework™</span>
            </div>
            <h2 className="text-lg font-black leading-tight">{material.title}</h2>
            <p className="text-sm text-white/70 mt-1">A Multi-Perspective Learning Framework · БРО/МОН усогласена · {totalMinutes} мин</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Копирано!' : 'Копирај'}
            </button>
            {onSaveAsNote && (
              <button
                type="button"
                onClick={onSaveAsNote}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Зачувај
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Печати
            </button>
          </div>
        </div>

        {/* SPECTRA wheel mini-indicator */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          {Object.values(SPECTRA_PHASES).map(ph => (
            <div
              key={ph.key}
              title={`${ph.key} — ${ph.label} (${ph.duration})`}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                phaseActivities[ph.key] || ph.key === 'S'
                  ? 'bg-white text-gray-800 border-white/50 shadow'
                  : 'bg-white/10 text-white/40 border-white/20'
              }`}
            >
              <span>{ph.icon}</span>
              <span>{ph.key}</span>
              <span className="opacity-60">{ph.duration}</span>
            </div>
          ))}
          <div className="ml-auto text-xs text-white/50 font-medium">Вкупно: {totalMinutes} мин</div>
        </div>
      </div>

      {/* Think Deeply banner */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-center">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
          "Think Deeply. Learn Meaningfully. Apply Wisely."
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Развива: Критичко мислење · Емпатија · Решавање проблеми · Креативност · Соработка · Рефлексија</p>
      </div>

      {/* BRO/MON Competencies */}
      {competencies.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">БРО/МОН Компетенции</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {competencies.map((c, i) => (
              <span key={i} className="px-2.5 py-1 bg-white border border-indigo-200 rounded-full text-xs font-semibold text-indigo-700 shadow-sm">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SPECTRA Phases */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Секвенца на фази</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* S phase — always from openingActivity */}
        {material.openingActivity && (
          <SpectraPhaseSection phaseKey="S" text={material.openingActivity} isOpening />
        )}

        {/* P, E, C, T, RA from mainActivity */}
        {(material.mainActivity || []).map((act, idx) => {
          const phaseKey = detectPhase(act.bloomsLevel);
          if (!phaseKey || phaseKey === 'S') return null;
          return <SpectraPhaseSection key={idx} phaseKey={phaseKey} text={act.text} />;
        })}
      </div>

      {/* Differentiation */}
      {material.differentiation && (
        <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDiff(d => !d)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-100 transition-all"
          >
            <Users className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="flex-1 text-left text-sm font-black text-violet-800">Диференцијација по нивоа</span>
            <span className="text-xs text-violet-500 font-semibold">Поддршка · Стандард · Предизвик</span>
            {showDiff ? <ChevronUp className="w-4 h-4 text-violet-400" /> : <ChevronDown className="w-4 h-4 text-violet-400" />}
          </button>
          {showDiff && (
            <div className="px-4 pb-4 bg-white border-t border-violet-100">
              {diffLevels ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  {[
                    { label: '🟢 Поддршка', text: diffLevels.support, cls: 'border-green-200 bg-green-50' },
                    { label: '🔵 Стандард', text: diffLevels.standard, cls: 'border-blue-200 bg-blue-50' },
                    { label: '🔴 Предизвик', text: diffLevels.advanced, cls: 'border-red-200 bg-red-50' },
                  ].map(({ label, text, cls }) => (
                    <div key={label} className={`rounded-lg border p-3 ${cls}`}>
                      <p className="text-xs font-black mb-1">{label}</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{text || '—'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed pt-3 whitespace-pre-wrap">{material.differentiation}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Assessment */}
      {material.assessmentIdea && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-black text-teal-700 uppercase tracking-widest">Евалуација (БРО/МОН)</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{material.assessmentIdea}</p>
        </div>
      )}

      {/* Attribution */}
      <p className="text-center text-xs text-gray-400">
        SPECTRA Educational Framework™ by Mona Sawan, M.Ed. · Адаптирано врз основа на de Bono's Six Thinking Hats (1985) · БРО/МОН усогласено
      </p>
    </div>
  );
};
