/**
 * Gamma Student View — joins a live session via PIN, receives real-time slide sync.
 * Route: /gamma/student/:pin?name=StudentName
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Hand, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { MathRenderer } from '../components/common/MathRenderer';
import {
  subscribeGammaSession,
  submitGammaResponse,
  raiseGammaHand,
  lowerGammaHand,
  type GammaLiveSession,
} from '../services/gammaLiveService';

interface Props {
  pin: string;
}

function useStudentId(): string {
  const key = 'gamma_student_id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = `s_${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(key, id);
  return id;
}

export const GammaStudentView: React.FC<Props> = ({ pin }) => {
  const studentId = useStudentId();
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const studentName = params.get('name') || 'Ученик';

  const [session, setSession] = useState<GammaLiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSlideIdxRef = useRef<number>(-1);

  useEffect(() => {
    const unsub = subscribeGammaSession(pin, s => {
      setLoading(false);
      setSession(s);
      if (s && s.slideIdx !== lastSlideIdxRef.current) {
        lastSlideIdxRef.current = s.slideIdx;
        setAnswer('');
        setSubmitted(false);
        setHandRaised(false);
      }
    });
    return unsub;
  }, [pin]);

  const submit = useCallback(async () => {
    if (!answer.trim() || submitted || isSubmitting || !session) return;
    setIsSubmitting(true);
    await submitGammaResponse(pin, studentId, studentName, session.slideIdx, answer.trim());
    setSubmitted(true);
    setIsSubmitting(false);
  }, [answer, submitted, isSubmitting, session, pin, studentId, studentName]);

  const toggleHand = useCallback(async () => {
    if (!session) return;
    if (handRaised) {
      await lowerGammaHand(pin, studentId);
      setHandRaised(false);
    } else {
      await raiseGammaHand(pin, studentId);
      setHandRaised(true);
    }
  }, [handRaised, pin, studentId, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!session || !session.isActive) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-5xl">🏁</div>
        <h2 className="text-xl font-black text-white">Сесијата е завршена</h2>
        <p className="text-slate-400 text-sm">Наставникот ја затворил Gamma Live сесијата.</p>
      </div>
    );
  }

  const slide = session.slides[session.slideIdx];
  if (!slide) return null;

  const isTask = slide.type === 'task' || slide.type === 'example';
  const isFormula = slide.type === 'formula-centered';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Gamma Live</p>
          <p className="text-sm font-bold text-slate-300">{session.topic} · {session.gradeLevel}. одд.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {session.slideIdx + 1}/{session.slides.length}
          </span>
          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-[10px] font-black animate-pulse">
            LIVE
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-slate-800 flex-shrink-0">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${((session.slideIdx + 1) / session.slides.length) * 100}%` }}
        />
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-6 gap-5 max-w-2xl mx-auto w-full">
        {slide.title && (
          <h2 className="text-xl font-black text-white leading-tight">
            <MathRenderer text={slide.title} />
          </h2>
        )}

        {isFormula && (
          <div className="bg-violet-900/30 border border-violet-700/40 rounded-3xl px-8 py-6 text-center">
            <p className="text-2xl font-black text-white">
              <MathRenderer text={slide.content[0] ?? ''} />
            </p>
          </div>
        )}

        {!isFormula && slide.content.map((line, i) => (
          <div key={i} className="flex items-start gap-3">
            {(slide.type === 'task') && i === 0
              ? <span className="text-amber-400 text-sm mt-0.5 shrink-0">📝</span>
              : <span className="text-indigo-400 text-sm mt-0.5 shrink-0">•</span>
            }
            <p className="text-base text-slate-200 leading-relaxed">
              <MathRenderer text={line} />
            </p>
          </div>
        ))}

        {/* Answer input for task/example slides */}
        {isTask && !submitted && (
          <div className="mt-2 space-y-3">
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Твојот одговор…"
              rows={3}
              className="w-full bg-slate-800 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!answer.trim() || isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Испрати одговор
            </button>
          </div>
        )}

        {isTask && submitted && (
          <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-700/30 rounded-2xl px-5 py-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300 font-semibold">Одговорот е испратен!</p>
          </div>
        )}
      </div>

      {/* Raise hand */}
      <div className="flex-shrink-0 border-t border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">{studentName}</span>
        <button
          type="button"
          onClick={toggleHand}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
            handRaised
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
              : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Hand className="w-4 h-4" />
          {handRaised ? 'Рацата е кренатa' : 'Крени рака'}
        </button>
      </div>
    </div>
  );
};
