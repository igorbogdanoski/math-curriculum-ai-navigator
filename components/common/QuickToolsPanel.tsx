import React, { useState, useEffect } from 'react';
import { Wand2, ChevronDown, ChevronUp, Sparkles, Loader2, Check, X, MonitorPlay, CalendarDays } from 'lucide-react';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { callGeminiProxy, DEFAULT_MODEL, sanitizePromptInput } from '../../services/gemini/core';
import type { MaterialType } from '../../types';

interface QuickToolsPanelProps {
  gradeId: string;
  topicId: string;
  conceptIds?: string[];
  gradeName: string;
  topicName: string;
  customInstruction?: string;
  /** If provided, shows the Gamma Presentation button */
  onGamma?: () => void;
  /** True while Gamma is loading — shows spinner on button */
  gammaLoading?: boolean;
}

interface AISuggestion {
  materialType: MaterialType;
  explanation: string;
}

const TOOLS: { emoji: string; label: string; materialType: MaterialType }[] = [
  { emoji: '❓', label: 'Квиз',        materialType: 'QUIZ'        },
  { emoji: '📄', label: 'Тест',        materialType: 'ASSESSMENT'  },
  { emoji: '🎟️', label: 'Exit Ticket', materialType: 'EXIT_TICKET' },
  { emoji: '🎭', label: 'Сценарио',    materialType: 'SCENARIO'    },
  { emoji: '🃏', label: 'Картички',    materialType: 'FLASHCARDS'  },
];

const MATERIAL_EMOJI: Partial<Record<string, string>> = {
  QUIZ: '❓', ASSESSMENT: '📄', EXIT_TICKET: '🎟️',
  SCENARIO: '🎭', LEARNING_PATH: '🗺️', RUBRIC: '📊',
  FLASHCARDS: '🃏', ILLUSTRATION: '🖼️', WORKED_EXAMPLE: '✍️', PRESENTATION: '📽️',
};

const STORAGE_KEY = 'quicktools_collapsed';

export const QuickToolsPanel: React.FC<QuickToolsPanelProps> = ({
  gradeId,
  topicId,
  conceptIds = [],
  gradeName,
  topicName,
  customInstruction = '',
  onGamma,
  gammaLoading = false,
}) => {
  const { openGeneratorPanel } = useGeneratorPanel();
  const { navigate } = useNavigation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch { return false; }
  });

  // ── SmartStart state ───────────────────────────────────────────────────────
  const [aiText, setAiText]           = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiError, setAiError]         = useState(false);

  // Pre-fill AI input when context changes
  useEffect(() => {
    setAiText('');
    setAiSuggestion(null);
    setAiError(false);
  }, [gradeId, topicId]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); }
    catch { /* ignore */ }
  }, [collapsed]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTool = (materialType: MaterialType) => {
    openGeneratorPanel({
      selectedGrade: gradeId,
      selectedTopic: topicId,
      selectedConcepts: conceptIds,
      materialType,
      contextType: conceptIds.length > 0 ? 'CONCEPT' : 'ACTIVITY',
      customInstruction,
    });
  };

  const handleAIAnalyze = async () => {
    const trimmed = aiText.trim();
    if (!trimmed || aiLoading) return;
    setAiLoading(true);
    setAiSuggestion(null);
    setAiError(false);

    try {
      const safeInput = sanitizePromptInput(trimmed, 400);
      const prompt = `You are an AI assistant for Macedonian math teachers (grades 1-13).
Context: Grade="${gradeName}", Topic="${topicName}".
Teacher's request: "${safeInput}"

Choose the single best material type from: QUIZ, ASSESSMENT, EXIT_TICKET, SCENARIO, LEARNING_PATH, RUBRIC, FLASHCARDS, ILLUSTRATION, WORKED_EXAMPLE, PRESENTATION.

Respond ONLY with valid JSON (no markdown):
{"materialType":"EXIT_TICKET","explanation":"Краток опис зошто (макс 10 зборови)"}`;

      const { text } = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
      });
      const raw = text.trim().replace(/^```json\n?|\n?```$/g, '');
      setAiSuggestion(JSON.parse(raw) as AISuggestion);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIAccept = () => {
    if (!aiSuggestion) return;
    openGeneratorPanel({
      selectedGrade: gradeId,
      selectedTopic: topicId,
      selectedConcepts: conceptIds,
      materialType: aiSuggestion.materialType,
      contextType: conceptIds.length > 0 ? 'CONCEPT' : 'ACTIVITY',
      customInstruction: aiText.trim() ? `${customInstruction}\n\nНаставник: ${aiText.trim()}`.trim() : customInstruction,
    });
    setAiText('');
    setAiSuggestion(null);
  };

  const shortTopic = topicName.length > 22 ? topicName.slice(0, 20) + '…' : topicName;
  const shortGrade = gradeName
    .replace('(', '').replace(')', '')
    .replace('Одделение', 'одд.')
    .replace('година', 'год.')
    .trim();

  return (
    <div
      className="fixed bottom-6 right-6 z-40 w-60 rounded-2xl shadow-2xl border border-indigo-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.18)' }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all"
      >
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-3 h-3" />
        </div>
        <span className="flex-1 text-left text-xs font-bold leading-tight">Алатки за темата</span>
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
          : <ChevronUp className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />}
      </button>

      {!collapsed && (
        <>
          {/* ── Context badge ── */}
          <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider leading-none mb-0.5">Контекст</p>
            <p className="text-xs text-indigo-800 font-semibold leading-snug truncate">{shortGrade}</p>
            <p className="text-[11px] text-indigo-600 leading-snug truncate">{shortTopic}</p>
          </div>

          {/* ── Gamma + Annual Planner quick actions ── */}
          <div className="px-2 pt-2 flex gap-1.5">
            {onGamma && (
              <button
                type="button"
                onClick={onGamma}
                disabled={gammaLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {gammaLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <MonitorPlay className="w-3 h-3" />}
                Gamma
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/annual-planner')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold hover:bg-amber-100 active:scale-95 transition-all"
            >
              <CalendarDays className="w-3 h-3" />
              Год. план
            </button>
          </div>

          {/* ── Quick tool buttons ── */}
          <div className="p-2 grid grid-cols-2 gap-1.5">
            {TOOLS.map(tool => (
              <button
                key={tool.materialType}
                type="button"
                onClick={() => handleTool(tool.materialType)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center hover:shadow-sm active:scale-95
                  ${tool.materialType === 'SCENARIO' ? 'col-span-2 flex-row justify-center gap-2 py-2' : ''}
                  border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 bg-gray-50`}
              >
                <span className={tool.materialType === 'SCENARIO' ? 'text-base' : 'text-lg leading-none'}>{tool.emoji}</span>
                <span className="text-[10px] font-bold text-gray-700 leading-none">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* ── AI SmartStart ── */}
          <div className="border-t border-indigo-100 px-2 pb-2 pt-2 bg-gradient-to-b from-indigo-50/40 to-white">
            <div className="flex items-center gap-1 mb-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Smart AI</span>
            </div>

            <div className="flex gap-1">
              <input
                type="text"
                value={aiText}
                onChange={e => { setAiText(e.target.value); setAiSuggestion(null); setAiError(false); }}
                onKeyDown={e => e.key === 'Enter' && handleAIAnalyze()}
                placeholder={`Пр. "квиз за ${shortTopic}…"`}
                className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 text-gray-700 placeholder-gray-300"
              />
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={!aiText.trim() || aiLoading}
                className="flex-shrink-0 p-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg disabled:opacity-40 hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-95"
                title="AI анализирај"
              >
                {aiLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
              </button>
            </div>

            {aiError && (
              <p className="mt-1 text-[10px] text-red-400">AI не одговори. Пробај повторно.</p>
            )}

            {aiSuggestion && (
              <div className="mt-1.5 p-1.5 bg-white rounded-xl border border-indigo-200 shadow-sm">
                <div className="flex items-start gap-1.5">
                  <span className="text-base flex-shrink-0 leading-none mt-0.5">
                    {MATERIAL_EMOJI[aiSuggestion.materialType] ?? '📄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-700 leading-snug">{aiSuggestion.materialType}</p>
                    <p className="text-[9px] text-gray-400 leading-snug line-clamp-2">{aiSuggestion.explanation}</p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button type="button" onClick={handleAIAccept}
                      className="p-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition active:scale-95"
                      title="Прифати">
                      <Check className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => setAiSuggestion(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                      title="Откажи">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
