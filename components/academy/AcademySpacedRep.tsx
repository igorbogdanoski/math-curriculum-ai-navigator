import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, ChevronRight, RotateCcw, Clock } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  SM2Card,
  Quality,
  loadCards,
  saveCards,
  getOrCreateCard,
  sm2Update,
  isDueToday,
  isDueWithin,
  daysUntilDue,
  upsertCard,
} from '../../utils/sm2';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  allLessonIds: string[];
  lessonTitles: Record<string, string>;
  completedQuizzes: string[];
}

// ── Rating config ─────────────────────────────────────────────────────────────

interface RatingOption {
  quality: Quality;
  emoji: string;
  label: string;
  color: string;
  hoverColor: string;
}

const RATING_OPTIONS: RatingOption[] = [
  { quality: 1, emoji: '😰', label: 'Целосно заборавено', color: 'bg-red-100 text-red-700 border-red-200',    hoverColor: 'hover:bg-red-200' },
  { quality: 2, emoji: '😕', label: 'Тешко',              color: 'bg-orange-100 text-orange-700 border-orange-200', hoverColor: 'hover:bg-orange-200' },
  { quality: 3, emoji: '🙂', label: 'Точно',              color: 'bg-yellow-100 text-yellow-700 border-yellow-200', hoverColor: 'hover:bg-yellow-200' },
  { quality: 4, emoji: '😊', label: 'Лесно',              color: 'bg-green-100 text-green-700 border-green-200',  hoverColor: 'hover:bg-green-200' },
  { quality: 5, emoji: '🌟', label: 'Совршено',           color: 'bg-indigo-100 text-indigo-700 border-indigo-200', hoverColor: 'hover:bg-indigo-200' },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function pluralDays(n: number): string {
  if (n === 1) return '1 ден';
  return `${n} дена`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcademySpacedRep({ allLessonIds, lessonTitles, completedQuizzes }: Props) {
  const { navigate } = useNavigation();

  // All SM-2 cards kept in state; synced to localStorage
  const [cards, setCards] = useState<SM2Card[]>([]);

  // Which due card is currently being rated (lessonId | null)
  const [ratingCard, setRatingCard] = useState<string | null>(null);

  // Set of lessonIds reviewed in this session (so we don't re-show after rating)
  const [reviewedThisSession, setReviewedThisSession] = useState<Set<string>>(new Set());

  // Load cards from localStorage on mount; ensure every completedQuiz has a card
  useEffect(() => {
    let loaded = loadCards();

    // Ensure every completed lesson has an SM-2 card (idempotent)
    let changed = false;
    completedQuizzes.forEach((id) => {
      if (!loaded.find((c) => c.lessonId === id)) {
        loaded = upsertCard(loaded, getOrCreateCard(id, loaded));
        changed = true;
      }
    });
    if (changed) saveCards(loaded);

    setCards(loaded);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: lessons eligible for review = completed + have a card
  const eligibleIds = completedQuizzes.filter((id) => allLessonIds.includes(id));

  const dueCards: SM2Card[] = eligibleIds
    .map((id) => getOrCreateCard(id, cards))
    .filter((c) => isDueToday(c) && !reviewedThisSession.has(c.lessonId));

  const upcomingCards: SM2Card[] = eligibleIds
    .map((id) => getOrCreateCard(id, cards))
    .filter((c) => isDueWithin(c, 3) && !reviewedThisSession.has(c.lessonId))
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    .slice(0, 6);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartReview = useCallback((lessonId: string) => {
    navigate(`/academy/lesson/${lessonId}`);
    setRatingCard(lessonId);
  }, [navigate]);

  const handleRate = useCallback((lessonId: string, quality: Quality) => {
    setCards((prev) => {
      const card = getOrCreateCard(lessonId, prev);
      const updated = sm2Update(card, quality);
      const next = upsertCard(prev, updated);
      saveCards(next);
      return next;
    });
    setReviewedThisSession((prev) => new Set(prev).add(lessonId));
    setRatingCard(null);
  }, []);

  const handleDismissRating = useCallback(() => {
    setRatingCard(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100">
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Денес за повторување</h2>
          {dueCards.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
              {dueCards.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-indigo-500">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>SM-2</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* ── Rating modal overlay ── */}
        {ratingCard && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <p className="text-sm font-medium text-indigo-800">
              Колку добро го знаеш ова?
            </p>
            <p className="text-xs text-indigo-600 font-medium truncate">
              {lessonTitles[ratingCard] ?? ratingCard}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.quality}
                  onClick={() => handleRate(ratingCard, opt.quality)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs font-medium transition-colors ${opt.color} ${opt.hoverColor}`}
                  title={opt.label}
                >
                  <span className="text-lg leading-none">{opt.emoji}</span>
                  <span className="leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleDismissRating}
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              Прескокни оцена
            </button>
          </div>
        )}

        {/* ── Due cards list ── */}
        {dueCards.length === 0 && !ratingCard ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              Нема повторување денес — одличен ритам!
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {dueCards.map((card) => {
              const title = lessonTitles[card.lessonId] ?? card.lessonId;
              const isRating = ratingCard === card.lessonId;
              const days = daysUntilDue(card);
              const overdue = days < 0;

              return (
                <li
                  key={card.lessonId}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    isRating
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-100 bg-gray-50 hover:border-indigo-200 hover:bg-indigo-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                      {overdue ? (
                        <p className="text-xs text-red-500">Задоцнето за {pluralDays(Math.abs(days))}</p>
                      ) : (
                        <p className="text-xs text-indigo-400">Денес</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartReview(card.lessonId)}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                  >
                    Започни
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Upcoming strip ── */}
        {upcomingCards.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Наскоро</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingCards.map((card) => {
                const title = lessonTitles[card.lessonId] ?? card.lessonId;
                const days = daysUntilDue(card);
                return (
                  <span
                    key={card.lessonId}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs px-2.5 py-1"
                    title={title}
                  >
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="font-medium">за {pluralDays(days)}:</span>
                    <span className="truncate max-w-[120px]">{title}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
