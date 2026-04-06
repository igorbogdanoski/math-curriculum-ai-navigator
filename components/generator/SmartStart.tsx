import React, { useState } from 'react';
import { Sparkles, Loader2, Check, X, Wand2 } from 'lucide-react';
import { callGeminiProxy, DEFAULT_MODEL, sanitizePromptInput } from '../../services/gemini/core';
import type { MaterialType } from '../../types';

interface IntentResult {
  materialType: MaterialType;
  explanation: string;
  grade: number | null;
  topicHint: string | null;
}

interface SmartStartProps {
  onAccept: (result: IntentResult) => void;
}

const MATERIAL_DISPLAY: Partial<Record<string, { emoji: string; name: string }>> = {
  QUIZ:          { emoji: '❓', name: 'Квиз (интерактивен)' },
  ASSESSMENT:    { emoji: '📄', name: 'Тест / Писмена работа' },
  EXIT_TICKET:   { emoji: '🎟️', name: 'Exit Ticket' },
  SCENARIO:      { emoji: '🎭', name: 'Наставен Сценарио' },
  LEARNING_PATH: { emoji: '🗺️', name: 'Патека на учење' },
  RUBRIC:        { emoji: '📊', name: 'Рубрика за оценување' },
  FLASHCARDS:    { emoji: '🃏', name: 'Флешкартички' },
  ILLUSTRATION:  { emoji: '🖼️', name: 'AI Илустрација' },
  WORKED_EXAMPLE:{ emoji: '✍️', name: 'Работен Пример' },
  PRESENTATION:  { emoji: '📽️', name: 'Презентација' },
  VIDEO_EXTRACTOR: { emoji: '🎬', name: 'Video Extractor (MVP)' },
  IMAGE_EXTRACTOR: { emoji: '📸', name: 'Image Extractor' },
};

const EXAMPLE_PROMPTS = [
  'Брза проверка за разбирање на дропки на крај на час за 5-то одделение',
  'Подготви план за час за множење на двоцифрени броеви',
  'Треба тест за геометрија — триаголници и нивни видови',
  'Картички за учење на пати-таблицата за 3-то одделение',
  'Квиз за тригонометриски функции за II година гимназија',
  'Тест за диференцијално сметање за IV гимназија',
];

export const SmartStart: React.FC<SmartStartProps> = ({ onAccept }) => {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<IntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);

  const handleAnalyze = async () => {
    const trimmed = text.trim();
    if (!trimmed || isAnalyzing) return;
    setIsAnalyzing(true);
    setSuggestion(null);
    setError(null);

    try {
      const safeInput = sanitizePromptInput(trimmed, 500);
      const prompt = `You are an AI assistant for Macedonian math teachers (grades 1-13, covering primary school grades 1-9 and secondary/gymnasium grades 10-13).
Given the teacher's description, choose the single best material type.

Available types and when to use each:
- QUIZ: interactive digital quiz students play on their devices, real-time formative check
- ASSESSMENT: formal printed test or written exam, summative grading
- EXIT_TICKET: 2-3 quick questions for end-of-lesson understanding check (3 minutes)
- SCENARIO: full lesson plan with activities, questions, differentiation (45 minutes)
- LEARNING_PATH: personalized step-by-step learning journey through concepts
- RUBRIC: grading criteria with levels and descriptors, MON-aligned
- FLASHCARDS: memorization cards, question on one side, answer on other
- ILLUSTRATION: AI-generated diagram or visual for a concept
- WORKED_EXAMPLE: step-by-step solved example with explanation per step
- PRESENTATION: slides with content, activities, AI elements (PRO)
- VIDEO_EXTRACTOR: teacher pastes video URL, gets preview + extracted lesson scenario
- IMAGE_EXTRACTOR: teacher uploads image (textbook page, whiteboard photo, handwriting) and AI extracts tasks and generates lesson material

Teacher's request: "${safeInput}"

Respond ONLY with valid JSON, no markdown fences:
{"materialType":"EXIT_TICKET","grade":null,"topicHint":null,"explanation":"Краток опис на македонски зошто (макс 15 зборови)"}`;

      const { text } = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
      });
      const raw = text.trim().replace(/^```json\n?|\n?```$/g, '');
      const parsed = JSON.parse(raw) as IntentResult;
      setSuggestion(parsed);
    } catch {
      setError('AI не можеше да ја анализира барањето. Пробај повторно или избери рачно.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAccept = () => {
    if (!suggestion) return;
    onAccept(suggestion);
    setSuggestion(null);
    setText('');
  };

  const handleExampleClick = () => {
    const next = (exampleIdx + 1) % EXAMPLE_PROMPTS.length;
    setText(EXAMPLE_PROMPTS[next]);
    setSuggestion(null);
    setExampleIdx(next);
  };

  const display = suggestion ? (MATERIAL_DISPLAY[suggestion.materialType] ?? { emoji: '📄', name: suggestion.materialType }) : null;

  return (
    <div className="mb-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-indigo-800">Smart Start</span>
        <span className="text-[10px] font-black bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2 py-0.5 rounded-full tracking-wide">AI</span>
      </div>
      <p className="text-xs text-indigo-500 mb-3 ml-8">Опишете го вашиот наставен момент — AI ќе препорача тип и ќе го пополни формуларот.</p>

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setSuggestion(null); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder='Пр. "Брза проверка за дропки за крај на час…"'
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 placeholder-gray-300 shadow-sm"
        />
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!text.trim() || isAnalyzing}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-sm flex-shrink-0"
        >
          {isAnalyzing
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4" />}
          {isAnalyzing ? 'AI...' : 'Анализирај'}
        </button>
      </div>

      <button
        type="button"
        onClick={handleExampleClick}
        className="mt-1.5 ml-0.5 text-[11px] text-indigo-400 hover:text-indigo-600 transition underline underline-offset-2"
      >
        Пример →
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      {suggestion && display && (
        <div className="mt-3 flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-200 shadow-sm animate-fade-in">
          <div className="text-2xl flex-shrink-0">{display.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">Препорака</p>
            <p className="text-sm font-bold text-gray-800">{display.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{suggestion.explanation}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleAccept}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Прифати
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition rounded-lg hover:bg-gray-100"
              aria-label="Откажи препорака"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
