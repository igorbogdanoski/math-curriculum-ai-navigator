import React from 'react';
import { Sparkles } from 'lucide-react';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { useLocation } from 'react-router-dom';

export const ContextualFAB = (_props: any) => {
  const { openGeneratorPanel } = useGeneratorPanel();
  const location = useLocation();

  // Не го прикажувај копчето на страната за најава или во квизот за ученици
  if (location.pathname === '/login' || location.pathname.startsWith('/play')) {
    return null;
  }

  return (
    <button
      onClick={() => openGeneratorPanel()}
      className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all hover:scale-110 z-40 flex items-center gap-2 border-2 border-white/20"
      aria-label="AI Assistant"
    >
      <Sparkles className="w-6 h-6" />
      <span className="font-bold hidden md:inline pr-1">AI Асистент</span>
    </button>
  );
};
