/**
 * QuizResultPanel — all post-quiz UI panels:
 * result card, AI feedback, peer learning, confidence, metacognitive,
 * adaptive homework, gamification, save progress modal.
 * Extracted from StudentPlayView for single-responsibility.
 */
import React, { useState } from 'react';
import {
  Star, RefreshCw, BookOpen, BarChart2, Sparkles, ExternalLink,
  Trophy, Loader2, MessageSquare, Send, Users, FileText,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ACHIEVEMENTS } from '../../services/firestoreService';
import { geminiService } from '../../services/geminiService';
import { firestoreService } from '../../services/firestoreService';
import { calcFibonacciLevel, getAvatar } from '../../utils/gamification';
import { PrintableHomework } from '../materials/PrintableHomework';
import { SaveProgressModal } from './SaveProgressModal';
import { RecoveryWorksheetView } from '../../views/RecoveryWorksheetView';
import type { Concept, Grade, Topic } from '../../types';
import type { QuizSessionState, QuizSessionAction, QuizPlayData } from './quizSessionReducer';

interface QuizResultPanelProps {
  session: QuizSessionState;
  dispatch: React.Dispatch<QuizSessionAction>;
  studentName: string;
  deviceId: string;
  quizData: QuizPlayData | null;
  studentGoogleUid: string | null;
  setStudentGoogleUid: (uid: string) => void;
  isMountedRef: React.MutableRefObject<boolean>;
  getConceptDetails: (id: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
}

export const QuizResultPanel: React.FC<QuizResultPanelProps> = ({
  session,
  dispatch,
  studentName,
  deviceId,
  quizData,
  studentGoogleUid,
  setStudentGoogleUid,
  isMountedRef,
  getConceptDetails,
}) => {
  const { t } = useLanguage();
  const {
    quizResult, masteryUpdate, gamificationUpdate, remediaQuizId, isGeneratingRemedia,
    quizResultDocId, confidence, aiFeedback, isFeedbackLoading,
    metacognitivePrompt, metacognitiveNote, metacognitiveSaved,
    peerSuggestions, homework, isHomeworkLoading, homeworkError,
  } = session;

  const [showRecovery, setShowRecovery] = useState(false);

  if (!quizResult) return null;

  const passed = quizResult.percentage >= 70;
  const resultCardClass = passed
    ? 'w-full max-w-4xl mt-6 rounded-2xl p-5 border-2 animate-fade-in bg-green-50 border-green-300'
    : 'w-full max-w-4xl mt-6 rounded-2xl p-5 border-2 animate-fade-in bg-amber-50 border-amber-300';

  const justMastered = masteryUpdate?.mastered && masteryUpdate.consecutiveHighScores === 3;
  const consecutive = masteryUpdate?.consecutiveHighScores ?? 0;

  return (
    <>
      {/* Mastery milestone banner */}
      {justMastered && (
        <div className="w-full max-w-4xl mt-4 bg-yellow-400 rounded-2xl p-4 flex items-center gap-3 animate-fade-in shadow-lg">
          <Trophy className="w-8 h-8 text-yellow-900 flex-shrink-0" fill="currentColor" />
          <div>
            <p className="font-black text-yellow-900 text-lg">{t('play.result.mastered')}</p>
            <p className="text-yellow-800 text-sm">{t('play.result.masteredDesc')}</p>
          </div>
        </div>
      )}

      {/* Streak badge */}
      {!justMastered && consecutive > 0 && passed && (
        <div className="w-full max-w-4xl mt-4 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-300" fill="currentColor" />
          <p className="text-white text-sm font-bold">
            {t('play.result.consecutive1')} {consecutive} {t('play.result.consecutive2')}
            {consecutive < 3 ? `${t('play.result.consecutive3')} ${3 - consecutive} ${t('play.result.consecutive4')}` : ''}
          </p>
        </div>
      )}

      {/* Result card */}
      <div className={resultCardClass}>
        {passed ? (
          <div className="flex items-start gap-4">
            <Star className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />
            <div>
              <p className="font-black text-green-800 text-lg">
                {t('play.result.great')} {quizResult.correctCount} / {quizResult.totalQuestions} {t('play.result.correct')}
              </p>
              <p className="text-green-700 text-sm mt-1">
                {t('play.result.bravo')}{studentName ? `, ${studentName}` : ''}{t('play.result.bravoDesc')}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { window.location.hash = '/my-progress'; }}
                  className="flex items-center gap-2 text-xs font-bold bg-green-200 text-green-900 px-4 py-2 rounded-xl hover:bg-green-300 transition"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Погледни го мојот прогрес
                </button>
                {isGeneratingRemedia && (
                  <div className="flex items-center gap-2 text-xs font-bold text-green-700 px-3 py-2">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    AI подготвува предизвик...
                  </div>
                )}
                {remediaQuizId && !isGeneratingRemedia && (
                  <button
                    type="button"
                    onClick={() => { window.location.hash = `/play/${remediaQuizId}`; window.location.reload(); }}
                    className="flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    🚀 Предизвик (напредни прашања)
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <BookOpen className="w-8 h-8 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-800 text-lg">
                Не се откажуј! {quizResult.correctCount} / {quizResult.totalQuestions} точни
              </p>
              <p className="text-amber-700 text-sm mt-1">
                {quizResult.percentage < 60 ? t('play.tryAgin.descLow') : t('play.tryAgin.descMid')}
              </p>
              {isGeneratingRemedia && (
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  AI подготвува следен квиз за тебе...
                </div>
              )}
              {remediaQuizId && !isGeneratingRemedia && (
                <button
                  type="button"
                  onClick={() => { window.location.hash = `/play/${remediaQuizId}`; window.location.reload(); }}
                  className="mt-3 flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {quizResult.percentage < 60 ? t('play.tryAgin.buttonLow') : t('play.tryAgin.buttonMid')}
                </button>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: 'RETRY' })}
                className="mt-2 flex items-center gap-2 text-xs font-bold bg-amber-200 text-amber-900 px-4 py-2 rounded-xl hover:bg-amber-300 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Обиди се повторно
              </button>
              {quizData?._meta.conceptId && !showRecovery && (
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="mt-2 flex items-center gap-2 text-xs font-bold bg-rose-100 text-rose-800 px-4 py-2 rounded-xl hover:bg-rose-200 transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  📄 Генерирај работен лист
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* C3: Recovery Worksheet — shown when score < 70% and user requests it */}
      {showRecovery && quizData?._meta.conceptId && (
        <RecoveryWorksheetView
          studentName={studentName || 'Ученик'}
          deviceId={deviceId || undefined}
          conceptId={quizData._meta.conceptId}
          conceptTitle={
            quizData._meta.conceptId
              ? (getConceptDetails(quizData._meta.conceptId).concept?.title ?? quizData.title ?? quizData._meta.conceptId)
              : (quizData.title ?? 'концептот')
          }
          onClose={() => setShowRecovery(false)}
        />
      )}

      {/* P1: AI personalised feedback */}
      {(isFeedbackLoading || aiFeedback) && (
        <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <p className="text-white font-bold text-sm">Повратна информација</p>
          </div>
          {isFeedbackLoading ? (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI анализира...</span>
            </div>
          ) : (
            <p className="text-white/90 text-sm leading-relaxed">{aiFeedback || 'Продолжи со вежбање — секој обид те прави подобар!'}</p>
          )}
        </div>
      )}

      {/* P5: Peer learning */}
      {peerSuggestions.length > 0 && (
        <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-300" />
            <p className="text-white font-bold text-sm">Побарај помош од другарче</p>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">
            Ова веќе го совладаа: <strong className="text-emerald-300">{peerSuggestions.join(', ')}</strong>. Можеш да ги замолиш да ти помогнат и објаснат.
          </p>
        </div>
      )}

      {/* P26: Confidence self-assessment */}
      <div data-testid="e2e-confidence-prompt" className="w-full max-w-lg mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm text-center">
        <p className="text-white font-bold text-sm mb-3">{t('play.confidence.title')}</p>
        <div className="flex justify-center gap-3">
          {(['😟', '😐', '🙂', '😊', '🤩'] as const).map((emoji, i) => {
            const rating = i + 1;
            const isSelected = confidence === rating;
            return (
              <button
                key={rating}
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_CONFIDENCE', confidence: rating });
                  if (quizResultDocId && !window.__E2E_MODE__) firestoreService.updateQuizConfidence(quizResultDocId, rating);
                }}
                className={`text-2xl w-12 h-12 rounded-xl transition-all ${isSelected ? 'bg-white/30 scale-125 ring-2 ring-white' : 'hover:bg-white/20 hover:scale-110'}`}
                title={`${rating}/5`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        {confidence && (
          <p className="text-white/70 text-xs mt-2">{t('play.confidence.saved')}</p>
        )}
      </div>

      {/* P4: Metacognitive prompt */}
      {metacognitivePrompt && (
        <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-sky-300" />
            <p className="text-white font-bold text-sm">Размисли за своето учење</p>
            <span className="ml-auto text-white/40 text-xs">опционално</span>
          </div>
          <p className="text-white/80 text-sm mb-2 italic">„{metacognitivePrompt}"</p>
          {!metacognitiveSaved ? (
            <div className="flex gap-2">
              <textarea
                value={metacognitiveNote}
                onChange={e => dispatch({ type: 'SET_METACOGNITIVE_NOTE', note: e.target.value })}
                placeholder="Напиши го твојот одговор тука..."
                rows={2}
                maxLength={300}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-white/40"
              />
              <button
                type="button"
                disabled={!metacognitiveNote.trim() || !quizResultDocId}
                onClick={() => {
                  if (!quizResultDocId || !metacognitiveNote.trim()) return;
                  if (!window.__E2E_MODE__) firestoreService.updateQuizMetacognitiveNote(quizResultDocId, metacognitiveNote);
                  dispatch({ type: 'SET_METACOGNITIVE_SAVED' });
                }}
                className="flex items-center justify-center w-10 h-10 mt-auto bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title="Зачувај"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-sky-300 text-xs font-semibold flex items-center gap-1">
              ✓ Зачувано — наставникот ќе ги види твоите размислувања.
            </p>
          )}
        </div>
      )}

      {/* Г1: Adaptive homework */}
      {!homework && (
        <div className="w-full max-w-4xl mt-3 space-y-1">
          <button
            type="button"
            disabled={isHomeworkLoading}
            onClick={async () => {
              if (!quizData) return;
              dispatch({ type: 'HOMEWORK_LOADING' });
              const cid = quizData._meta.conceptId;
              const cTitle = cid
                ? (getConceptDetails(cid).concept?.title ?? quizData.title ?? 'концептот')
                : (quizData.title ?? 'концептот');
              try {
                const result = await geminiService.generateAdaptiveHomework(
                  cTitle,
                  quizData._meta.gradeLevel ?? 6,
                  quizResult.percentage,
                  quizResult.misconceptions,
                );
                if (isMountedRef.current) dispatch({ type: 'HOMEWORK_SUCCESS', homework: result });
              } catch (err) {
                console.warn('[Homework] generateAdaptiveHomework failed:', err);
                if (isMountedRef.current) dispatch({ type: 'HOMEWORK_ERROR' });
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold text-sm py-3 rounded-2xl transition disabled:opacity-50"
          >
            {isHomeworkLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Генерирам домашна задача...</>
            ) : (
              <><BookOpen className="w-4 h-4" /> Генерирај домашна задача (PDF)</>
            )}
          </button>
          {homeworkError && (
            <p className="text-red-300 text-xs text-center">Грешка при генерирање — обиди се повторно.</p>
          )}
        </div>
      )}
      {homework && (
        <PrintableHomework
          homework={homework}
          studentName={studentName || 'Ученик'}
          onClose={() => dispatch({ type: 'CLOSE_HOMEWORK' })}
        />
      )}

      {/* Gamification: XP + Avatar + Streak + Achievements */}
      {gamificationUpdate && (() => {
        const totalXP = gamificationUpdate.gamification.totalXP;
        const newLvl = calcFibonacciLevel(totalXP);
        const oldLvl = calcFibonacciLevel(totalXP - gamificationUpdate.xpGained);
        const leveledUp = newLvl.level > oldLvl.level;
        const avatar = getAvatar(newLvl.level);
        return (
          <div className="w-full max-w-lg mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl select-none">{avatar.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-black text-white text-sm">{avatar.title}</span>
                  <span className="text-white/60 text-xs font-semibold">{t('play.level')}{newLvl.level}</span>
                  {leveledUp && (
                    <span className="text-xs font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full animate-bounce">
                      ⬆️ Level Up!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-xs font-semibold">+{gamificationUpdate.xpGained} XP</span>
                  <span className="text-white/50 text-xs">{totalXP} {t('play.totalXP')}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${newLvl.progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-base">🔥</span>
                <span className="text-white font-bold text-sm">{gamificationUpdate.gamification.currentStreak}</span>
              </div>
            </div>
            {gamificationUpdate.newAchievements.length > 0 && (
              <div className="border-t border-white/20 pt-3">
                <p className="text-white/80 text-xs font-bold mb-2">{t('play.newAchievement')}</p>
                <div className="flex flex-wrap gap-2">
                  {gamificationUpdate.newAchievements.map(id => {
                    const a = ACHIEVEMENTS[id];
                    return a ? (
                      <span key={id} className="flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/40 text-yellow-200 text-xs font-bold px-2.5 py-1 rounded-full">
                        {a.icon} {a.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* С1: Save progress with Google */}
      {!studentGoogleUid && (
        <div className="w-full max-w-lg">
          <SaveProgressModal
            studentName={studentName || 'Ученик'}
            deviceId={deviceId}
            onSaved={(uid) => setStudentGoogleUid(uid)}
          />
        </div>
      )}
    </>
  );
};
