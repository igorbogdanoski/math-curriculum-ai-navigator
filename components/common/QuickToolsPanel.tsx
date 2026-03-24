import React, { useState, useEffect } from 'react';
import { Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import type { MaterialType } from '../../types';

interface QuickToolsPanelProps {
  gradeId: string;
  topicId: string;
  conceptIds?: string[];
  gradeName: string;
  topicName: string;
  customInstruction?: string;
}

interface ToolButton {
  emoji: string;
  label: string;
  materialType: MaterialType;
}

const TOOLS: ToolButton[] = [
  { emoji: '❓', label: 'Квиз',        materialType: 'QUIZ'        },
  { emoji: '📄', label: 'Тест',        materialType: 'ASSESSMENT'  },
  { emoji: '🎟️', label: 'Exit Ticket', materialType: 'EXIT_TICKET' },
  { emoji: '🎭', label: 'Сценарио',    materialType: 'SCENARIO'    },
  { emoji: '🃏', label: 'Картички',    materialType: 'FLASHCARDS'  },
];

const STORAGE_KEY = 'quicktools_collapsed';

export const QuickToolsPanel: React.FC<QuickToolsPanelProps> = ({
  gradeId,
  topicId,
  conceptIds = [],
  gradeName,
  topicName,
  customInstruction = '',
}) => {
  const { openGeneratorPanel } = useGeneratorPanel();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch { return false; }
  });

  // Persist preference
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); }
    catch { /* ignore */ }
  }, [collapsed]);

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

  // Trim topic name for display
  const shortTopic = topicName.length > 22 ? topicName.slice(0, 20) + '…' : topicName;
  const shortGrade = gradeName.replace('(', '').replace(')', '').replace('Одделение', 'одд.').replace('година', 'год.').trim();

  return (
    <div
      className="fixed bottom-6 right-6 z-40 w-56 rounded-2xl shadow-2xl border border-indigo-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.18)' }}
    >
      {/* Header */}
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
          {/* Context badge */}
          <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider leading-none mb-0.5">Контекст</p>
            <p className="text-xs text-indigo-800 font-semibold leading-snug truncate">{shortGrade}</p>
            <p className="text-[11px] text-indigo-600 leading-snug truncate">{shortTopic}</p>
          </div>

          {/* Tool buttons */}
          <div className="p-2 grid grid-cols-2 gap-1.5">
            {TOOLS.map(tool => (
              <button
                key={tool.materialType}
                type="button"
                onClick={() => handleTool(tool.materialType)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center hover:shadow-sm active:scale-95
                  ${tool.materialType === 'SCENARIO'
                    ? 'col-span-2 flex-row justify-center gap-2 py-2'
                    : ''}
                  border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 bg-gray-50`}
              >
                <span className={tool.materialType === 'SCENARIO' ? 'text-base' : 'text-lg leading-none'}>{tool.emoji}</span>
                <span className="text-[10px] font-bold text-gray-700 leading-none">{tool.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
