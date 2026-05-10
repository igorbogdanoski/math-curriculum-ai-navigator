import { logger } from '../../utils/logger';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, CheckCircle2, ChevronRight, RotateCcw, Clock, Lightbulb, Loader2, Send } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
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
import { gradeFeynmanAnswer } from '../../utils/duggaFeynmanGrading';
import {
  loadAcademySM2Cards,
  saveAcademySM2Cards,
  mergeAcademySM2Cards,
} from '../../services/firestoreService.spacedRep';

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
  const { firebaseUser } = useAuth();
  const userId = firebaseUser?.uid ?? null;

  // All SM-2 cards kept in state; synced to localStorage + Firestore
  const [cards, setCards] = useState<SM2Card[]>([]);

  // Which due card is currently being rated (lessonId | null)
  const [ratingCard, setRatingCard] = useState<string | null>(null);

  // Set of lessonIds reviewed in this session (so we don't re-show after rating)
  const [reviewedThisSession, setReviewedThisSession] = useState<Set<string>>(new Set());

  // Track whether initial Firestore load is complete (prevent double-writes on init)
  const firestoreLoadedRef = useRef(false);

  // Load cards: localStorage first (instant), then merge with Firestore
  useEffect(() => {
    let localCards = loadCards();

    // Ensure every completed lesson has an SM-2 card (idempotent)
    let changed = false;
    completedQuizzes.forEach((id) => {
      if (!localCards.find((c) => c.lessonId === id)) {
        localCards = upsertCard(localCards, getOrCreateCard(id, localCards));
        changed = true;
      }
    });
    if (changed) saveCards(localCards);

    setCards(localCards);

    // Async: merge with Firestore data
    if (userId) {
      loadAcademySM2Cards(userId).then((remoteCards) => {
        firestoreLoadedRef.current = true;
        if (remoteCards.length === 0) return;
        setCards((prev) => {
          const merged = mergeAcademySM2Cards(prev, remoteCards);
          saveCards(merged);
          return merged;
        });
      }).catch(() => {
        firestoreLoadedRef.current = true;
      });
    } else {
      firestoreLoadedRef.current = true;
    }
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

  // Feynman SRS state
  const [feynmanId, setFeynmanId]     = useState<string | null>(null);
  const [feynmanText, setFeynmanText] = useState('');
  const [feynmanLoading, setFeynmanLoading] = useState(false);
  const [feynmanScore, setFeynmanScore] = useState<number | null>(null);

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
      if (userId) saveAcademySM2Cards(userId, next);
      return next;
    });
    setReviewedThisSession((prev) => new Set(prev).add(lessonId));
    setRatingCard(null);
  }, [userId]);

  const handleDismissRating = useCallback(() => {
    setRatingCard(null);
  }, []);

  const startFeynman = useCallback((lessonId: string) => {
    setFeynmanId(lessonId);
    setFeynmanText('');
    setFeynmanScore(null);
  }, []);

  const submitFeynman = useCallback(async () => {
    if (!feynmanId || feynmanText.trim().length < 15) return;
    setFeynmanLoading(true);
    try {
      const concept = lessonTitles[feynmanId] ?? feynmanId;
      const grade = await gradeFeynmanAnswer(concept, feynmanText, 1);
      setFeynmanScore(grade.total);
      const quality: Quality =
        grade.total >= 85 ? 5 : grade.total >= 70 ? 4 : grade.total >= 55 ? 3 : grade.total >= 40 ? 2 : 1;
      handleRate(feynmanId, quality);
      // Keep panel open to display score — user clicks Затвори to dismiss
    } catch (err) {
      logger.error('Feynman SRS grading failed', err);
      setFeynmanId(null);
      setFeynmanText('');
    } finally {
      setFeynmanLoading(false);
    }
  }, [feynmanId, feynmanText, lessonTitles, handleRate]);

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
        {/* ── Feynman SRS mode ── */}
        {feynmanId && (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <p className="text-sm font-bold text-yellow-900">Феинман повторување</p>
            </div>

            {feynmanScore !== null ? (
              /* ── Result view ── */
              <div className="space-y-2">
                <div className={`rounded-xl px-4 py-3 text-center font-bold text-lg ${
                  feynmanScore >= 70 ? 'bg-green-100 text-green-800' : feynmanScore >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  {feynmanScore >= 85 ? '🌟' : feynmanScore >= 70 ? '✅' : feynmanScore >= 40 ? '🙂' : '📚'}{' '}
                  Феинман оценка: {feynmanScore}/100
                </div>
                <p className="text-xs text-yellow-700 text-center">
                  {feynmanScore >= 85 ? 'Одлично! Го разбираш концептот длабоко.' : feynmanScore >= 70 ? 'Добро! Продолжи со вежбање.' : feynmanScore >= 40 ? 'Во ред. Прочитај ја лекцијата повторно.' : 'Нема проблем — учењето трае.'}
                </p>
                <button
                  type="button"
                  onClick={() => { setFeynmanId(null); setFeynmanText(''); setFeynmanScore(null); }}
                  className="w-full text-xs text-yellow-700 hover:text-yellow-900 py-2 font-medium transition-colors"
                >
                  Затвори
                </button>
              </div>
            ) : (
              /* ── Input view ── */
              <>
                <p className="text-xs text-yellow-800">
                  Објасни <strong>„{lessonTitles[feynmanId] ?? feynmanId}"</strong> со свои зборови — замисли дека зборуваш со дете од 10 години.
                </p>
                <textarea
                  value={feynmanText}
                  onChange={e => setFeynmanText(e.target.value)}
                  placeholder="Пр: Значи, замисли дека имаш кутии со топки..."
                  rows={4}
                  className="w-full rounded-xl border border-yellow-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitFeynman}
                    disabled={feynmanLoading || feynmanText.trim().length < 15}
                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    {feynmanLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI оценува...</>
                      : <><Send className="w-3.5 h-3.5" /> Испрати</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFeynmanId(null); setFeynmanText(''); setFeynmanScore(null); }}
                    className="text-xs text-yellow-700 hover:text-yellow-900 px-3 py-2 font-medium transition-colors"
                  >
                    Откажи
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
                  type="button"
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
              type="button"
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

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startFeynman(card.lessonId)}
                      title="Феинман повторување — објасни со свои зборови"
                      className="flex items-center gap-1 rounded-lg bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 text-yellow-800 text-xs font-semibold px-2.5 py-1.5 transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartReview(card.lessonId)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                    >
                      Започни
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
