/**
 * ForumCTA — compact "Дискутирај во форум" entry point.
 *
 * Variants:
 *   inline  → small pill button, fits inside a card header/footer
 *   banner  → full-width strip with context text (e.g. after wrong answer)
 *   float   → fixed floating button bottom-right (for long single-page flows)
 *
 * Usage:
 *   <ForumCTA context="Квадратни функции" variant="inline" />
 *   <ForumCTA context={conceptTitle} variant="banner" hint="Имаш прашање за оваа тема?" />
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';

interface ForumCTAProps {
  /** Prefills the forum new-thread form with this context string */
  context?: string;
  variant?: 'inline' | 'banner' | 'float';
  hint?: string;
  className?: string;
}

export const ForumCTA: React.FC<ForumCTAProps> = ({
  context,
  variant = 'inline',
  hint,
  className = '',
}) => {
  const { navigate } = useNavigation();

  const go = () => {
    if (context) {
      // Pass context via sessionStorage so TeacherForumView can pre-fill
      try {
        sessionStorage.setItem('forum_new_context', context);
      } catch { /* ignore */ }
    }
    navigate('/forum');
  };

  if (variant === 'banner') {
    return (
      <div className={`flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 ${className}`}>
        <MessageSquare className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <p className="text-sm text-indigo-800 flex-1">
          {hint ?? 'Имаш прашање или коментар?'}
          {context && <span className="font-semibold"> — {context}</span>}
        </p>
        <button
          type="button"
          onClick={go}
          className="flex-shrink-0 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition"
        >
          Дискутирај →
        </button>
      </div>
    );
  }

  if (variant === 'float') {
    return (
      <button
        type="button"
        onClick={go}
        title={context ? `Дискутирај за ${context}` : 'Отвори форум'}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 ${className}`}
      >
        <MessageSquare className="w-4 h-4" />
        Форум
      </button>
    );
  }

  // inline (default)
  return (
    <button
      type="button"
      onClick={go}
      title={context ? `Дискутирај за ${context}` : 'Отвори форум'}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition border border-transparent hover:border-indigo-100 ${className}`}
    >
      <MessageSquare className="w-3.5 h-3.5" />
      Форум
    </button>
  );
};
