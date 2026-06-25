import React, { useState, useMemo } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { AcademyLesson } from '../../data/academy/content';
import {
  SM2Card,
  Quality,
  sm2Update,
  getOrCreateCard,
  daysUntilDue,
  loadConceptCards,
  saveConceptCards,
  conceptCardId,
  upsertCard,
} from '../../utils/sm2';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function conceptFront(theory: string): string {
  const dot = theory.indexOf('.');
  const cut = dot > 20 && dot < 120 ? dot + 1 : 100;
  return theory.slice(0, cut) + (theory.length > cut ? '…' : '');
}

interface ConceptCardState extends SM2Card {
  index: number;
  front: string;
  back: string;
}

function buildCards(lesson: AcademyLesson, sm2Cards: SM2Card[]): ConceptCardState[] {
  return lesson.theory.map((t, i) => {
    const id = conceptCardId(lesson.id, i);
    const sm2 = getOrCreateCard(id, sm2Cards);
    return { ...sm2, index: i, front: conceptFront(t), back: t };
  });
}

const QUALITY_BUTTONS: { label: string; q: Quality; cls: string }[] = [
  { label: 'Пак',    q: 1, cls: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
  { label: 'Тешко',  q: 2, cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
  { label: 'Добро',  q: 4, cls: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' },
  { label: 'Лесно',  q: 5, cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
];

export const ConceptFlashcards: React.FC<{ lesson: AcademyLesson }> = ({ lesson }) => {
  const [sm2Cards, setSm2Cards] = useState<SM2Card[]>(() => loadConceptCards());
  const [flipped, setFlipped] = useState(false);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);

  const allCards = useMemo(() => buildCards(lesson, sm2Cards), [lesson, sm2Cards]);

  const dueCards = useMemo(
    () => allCards.filter(c => daysUntilDue(c) <= 0),
    [allCards],
  );

  const sessionQueue = useMemo(
    () => (dueCards.length > 0 ? dueCards : allCards),
    [dueCards, allCards],
  );

  const currentCard = sessionQueue[sessionIdx];

  const handleRate = (quality: Quality) => {
    if (!currentCard) return;
    const updated = sm2Update(currentCard, quality);
    const newSm2 = upsertCard(sm2Cards, updated);
    saveConceptCards(newSm2);
    setSm2Cards(newSm2);
    setFlipped(false);

    if (sessionIdx + 1 >= sessionQueue.length) {
      setSessionDone(true);
    } else {
      setSessionIdx(i => i + 1);
    }
  };

  const restart = () => {
    setSessionIdx(0);
    setSessionDone(false);
    setFlipped(false);
  };

  if (lesson.theory.length === 0) return null;

  const dueCount = allCards.filter(c => daysUntilDue(c) <= 0).length;

  if (sessionDone) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h4 className="text-lg font-black text-emerald-900 mb-1">Сесијата е завршена!</h4>
        <p className="text-sm text-emerald-700 mb-4">
          Прегледавте {sessionQueue.length} концепт{sessionQueue.length !== 1 ? 'и' : ''}.
          Следна ревизија е закажана автоматски.
        </p>
        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-2 mx-auto text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition"
        >
          <RotateCcw className="w-4 h-4" /> Повтори ја сесијата
        </button>
      </div>
    );
  }

  if (!currentCard) return null;

  const progress = sessionIdx / sessionQueue.length;
  const isFullSession = dueCards.length === 0;

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-black text-indigo-900">Концептни картички</p>
            <p className="text-[10px] text-indigo-500">
              {isFullSession
                ? `Сите ${allCards.length} концепти`
                : `${dueCount} достасани денес`}
            </p>
          </div>
        </div>
        <span className="text-xs text-indigo-400 font-semibold">
          {sessionIdx + 1} / {sessionQueue.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Card */}
      <div
        className="min-h-[120px] bg-white rounded-xl border border-indigo-200 p-5 cursor-pointer select-none transition-all duration-200 hover:shadow-md active:scale-[0.99]"
        onClick={() => setFlipped(f => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFlipped(f => !f); }}
        aria-label={flipped ? 'Предна страна' : 'Задна страна'}
      >
        {!flipped ? (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-widest">
              Прашање {currentCard.index + 1}
            </span>
            <p className="text-base font-semibold text-gray-800 leading-snug">
              {currentCard.front}
            </p>
            <p className="text-[10px] text-gray-400 mt-3">Притисни за да го видиш одговорот →</p>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase text-green-500 tracking-widest">
              Одговор
            </span>
            <p className="text-sm text-gray-700 leading-relaxed">
              {currentCard.back}
            </p>
          </div>
        )}
      </div>

      {/* Rating buttons — only shown after flip */}
      {flipped ? (
        <div className="space-y-2">
          <p className="text-[10px] text-center text-gray-400 font-semibold uppercase tracking-widest">
            Колку добро го знаеше?
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QUALITY_BUTTONS.map(({ label, q, cls }) => (
              <button
                key={q}
                type="button"
                onClick={() => handleRate(q)}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${cls}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] text-indigo-400">
          <span>← {sessionIdx > 0 ? 'Нема назад' : 'Прв концепт'}</span>
          <span>Следен концепт →</span>
        </div>
      )}
    </div>
  );
};
