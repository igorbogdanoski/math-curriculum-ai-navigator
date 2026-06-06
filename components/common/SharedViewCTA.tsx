import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const BENEFITS = ['50 бесплатни кредити', 'AI генерирање', 'Матура подготовка'];

export const SharedViewCTA: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] bg-gradient-to-r from-blue-900 via-blue-800 to-violet-900 shadow-2xl">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow">
            <Sparkles className="w-4 h-4 text-blue-900" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Генерирано со MisMath AI</p>
            <p className="text-blue-200 text-xs hidden sm:block">
              {BENEFITS.join(' · ')}
            </p>
          </div>
        </div>
        <a
          href="#/"
          className="flex-shrink-0 flex items-center gap-1.5 bg-white text-blue-900 font-bold text-xs sm:text-sm px-4 py-2 rounded-xl hover:bg-blue-50 active:scale-95 transition-all whitespace-nowrap shadow-md"
        >
          Создај бесплатна сметка
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
