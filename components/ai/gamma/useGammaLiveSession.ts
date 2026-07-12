import { useState, useCallback, useEffect, useRef } from 'react';
import { generatePollOptions } from '../../../services/gemini/plans';
import {
  startGammaLive,
  broadcastGammaSlide,
  endGammaLive,
  subscribeGammaSession,
  subscribeGammaResponses,
  setGammaPollOptions,
  revealGammaPollResults,
  setGammaPacingMode,
  type GammaLiveResponse,
} from '../../../services/gammaLiveService';
import type { PresentationSlide } from '../../../types';

interface UseGammaLiveSessionParams {
  firebaseUid: string | undefined;
  topic: string;
  gradeLevel: number;
  slides: PresentationSlide[];
  currentSlideIdx: number;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Called when a live session ends, so the caller can also reset its own exit-ticket-sent flag. */
  onLiveSessionEnd?: () => void;
}

/**
 * Bundles all Gamma Live session state (PIN, responses, hands-raised, pacing mode) and
 * live-poll state/logic (draft editor, AI-suggested options, start/stop/reveal) — a
 * single cohesive feature domain, extracted out of GammaModeModal's otherwise-1200-line
 * render function.
 */
export function useGammaLiveSession({
  firebaseUid, topic, gradeLevel, slides, currentSlideIdx, addNotification, onLiveSessionEnd,
}: UseGammaLiveSessionParams) {
  const [gammaLivePin, setGammaLivePin] = useState<string | null>(null);
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [liveResponses, setLiveResponses] = useState<GammaLiveResponse[]>([]);
  const [liveHandsCount, setLiveHandsCount] = useState(0);
  const [showResponsesPanel, setShowResponsesPanel] = useState(false);
  const [activePollOptions, setActivePollOptions] = useState<string[] | null>(null);
  const [activePollCorrectIndex, setActivePollCorrectIndex] = useState<number | null>(null);
  const [activePollRevealed, setActivePollRevealed] = useState(false);
  const [showPollEditor, setShowPollEditor] = useState(false);
  const [pollDraft, setPollDraft] = useState<string[]>(['', '']);
  const [pollCorrectDraft, setPollCorrectDraft] = useState<number | null>(null);
  const [isGeneratingPoll, setIsGeneratingPoll] = useState(false);
  const [pacingMode, setPacingModeDisplay] = useState<'locked' | 'free'>('locked');

  const liveUnsubRef = useRef<(() => void) | null>(null);
  const liveSessionUnsubRef = useRef<(() => void) | null>(null);

  const startLiveSession = useCallback(async () => {
    if (!firebaseUid || isStartingLive || gammaLivePin) return;
    setIsStartingLive(true);
    try {
      const pin = await startGammaLive(firebaseUid, topic, gradeLevel, slides);
      setGammaLivePin(pin);
      liveUnsubRef.current = subscribeGammaResponses(pin, responses => {
        setLiveResponses(responses);
      });
      liveSessionUnsubRef.current = subscribeGammaSession(pin, session => {
        setLiveHandsCount(session?.handsUids?.length ?? 0);
        setActivePollOptions(session?.pollOptions ?? null);
        setActivePollCorrectIndex(session?.pollCorrectIndex ?? null);
        setActivePollRevealed(session?.pollRevealed ?? false);
        setPacingModeDisplay(session?.pacingMode ?? 'locked');
      });
    } catch {
      addNotification('Gamma Live: грешка при старт', 'error');
    } finally {
      setIsStartingLive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUid, isStartingLive, gammaLivePin, topic, gradeLevel, slides, addNotification]);

  const endLiveSession = useCallback(async () => {
    if (!gammaLivePin) return;
    await endGammaLive(gammaLivePin);
    liveUnsubRef.current?.();
    liveUnsubRef.current = null;
    liveSessionUnsubRef.current?.();
    liveSessionUnsubRef.current = null;
    setGammaLivePin(null);
    setLiveResponses([]);
    setLiveHandsCount(0);
    setShowResponsesPanel(false);
    setActivePollOptions(null);
    setActivePollCorrectIndex(null);
    setActivePollRevealed(false);
    setShowPollEditor(false);
    setPollDraft(['', '']);
    setPollCorrectDraft(null);
    setPacingModeDisplay('locked');
    onLiveSessionEnd?.();
  }, [gammaLivePin, onLiveSessionEnd]);

  const togglePacingMode = useCallback(async () => {
    if (!gammaLivePin) return;
    await setGammaPacingMode(gammaLivePin, pacingMode === 'free' ? 'locked' : 'free');
  }, [gammaLivePin, pacingMode]);

  const startPoll = useCallback(async () => {
    if (!gammaLivePin) return;
    const trimmed = pollDraft.map(o => o.trim());
    const options = trimmed.filter(Boolean);
    if (options.length < 2) return;
    // Remap the marked-correct index to its position after blanks are filtered out —
    // otherwise a blank option before it would silently shift which option gets marked correct.
    const correctIndex = pollCorrectDraft !== null && trimmed[pollCorrectDraft]
      ? trimmed.slice(0, pollCorrectDraft).filter(Boolean).length
      : null;
    await setGammaPollOptions(gammaLivePin, options, correctIndex);
    setShowPollEditor(false);
  }, [gammaLivePin, pollDraft, pollCorrectDraft]);

  const stopPoll = useCallback(async () => {
    if (!gammaLivePin) return;
    await setGammaPollOptions(gammaLivePin, null);
    setPollDraft(['', '']);
    setPollCorrectDraft(null);
  }, [gammaLivePin]);

  const revealPoll = useCallback(async () => {
    if (!gammaLivePin) return;
    await revealGammaPollResults(gammaLivePin);
  }, [gammaLivePin]);

  const generateAiPollOptions = useCallback(async (slide: PresentationSlide) => {
    if (isGeneratingPoll) return;
    setIsGeneratingPoll(true);
    try {
      const { options, correctIndex } = await generatePollOptions(slide.title, slide.content, gradeLevel);
      if (options.length >= 2) {
        setPollDraft(options);
        setPollCorrectDraft(correctIndex);
      } else {
        addNotification('Не успеа генерирањето — внеси рачно.', 'error');
      }
    } catch {
      addNotification('Не успеа генерирањето — внеси рачно.', 'error');
    } finally {
      setIsGeneratingPoll(false);
    }
  }, [isGeneratingPoll, gradeLevel, addNotification]);

  // Broadcast slide to students when live
  useEffect(() => {
    if (!gammaLivePin) return;
    broadcastGammaSlide(gammaLivePin, currentSlideIdx);
  }, [gammaLivePin, currentSlideIdx]);

  // Reset poll editor state on slide change
  useEffect(() => {
    setShowResponsesPanel(false);
    setShowPollEditor(false);
    setPollDraft(['', '']);
    setPollCorrectDraft(null);
  }, [currentSlideIdx]);

  // Cleanup live subscriptions on unmount
  useEffect(() => () => { liveUnsubRef.current?.(); liveSessionUnsubRef.current?.(); }, []);

  return {
    gammaLivePin, isStartingLive, liveResponses, liveHandsCount,
    showResponsesPanel, setShowResponsesPanel,
    activePollOptions, activePollCorrectIndex, activePollRevealed,
    showPollEditor, setShowPollEditor,
    pollDraft, setPollDraft, pollCorrectDraft, setPollCorrectDraft,
    isGeneratingPoll, pacingMode,
    startLiveSession, endLiveSession, togglePacingMode,
    startPoll, stopPoll, revealPoll, generateAiPollOptions,
  };
}
