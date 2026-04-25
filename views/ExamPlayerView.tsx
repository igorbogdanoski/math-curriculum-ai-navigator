import React, { useState, useEffect, useCallback, useRef } from 'react';
import { examService } from '../services/firestoreService.exam';
import type { ExamSession, ExamVariantKey } from '../services/firestoreService.types';
import { ExamTimer } from '../components/exam/ExamTimer';
import { ExamVariantPlayer } from '../components/exam/ExamVariantPlayer';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const LS_KEY = (sessionId: string, deviceId: string) => `exam_backup_${sessionId}_${deviceId}`;

function getDeviceId(): string {
  let id = localStorage.getItem('exam_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('exam_device_id', id);
  }
  return id;
}

type Phase = 'join' | 'waiting' | 'solving' | 'submitted';

export const ExamPlayerView: React.FC = () => {
  const deviceId = useRef(getDeviceId()).current;

  const [phase, setPhase] = useState<Phase>('join');
  const [joinCode, setJoinCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [session, setSession] = useState<ExamSession | null>(null);
  const [responseDocId, setResponseDocId] = useState<string | null>(null);
  const [variantKey, setVariantKey] = useState<ExamVariantKey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Load backup from localStorage
  useEffect(() => {
    if (responseDocId && session) {
      const backup = localStorage.getItem(LS_KEY(session.id, deviceId));
      if (backup) {
        try { setAnswers(JSON.parse(backup)); } catch { /* ignore */ }
      }
    }
  }, [responseDocId, session, deviceId]);

  // Auto-save to localStorage on every answer change
  useEffect(() => {
    if (session && responseDocId) {
      localStorage.setItem(LS_KEY(session.id, deviceId), JSON.stringify(answers));
    }
  }, [answers, session, responseDocId, deviceId]);

  // beforeunload warning while solving
  useEffect(() => {
    if (phase !== 'solving') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // Subscribe to session status changes (waiting → active)
  useEffect(() => {
    if (!session || phase !== 'waiting') return;
    return examService.subscribeExamSession(session.id, updated => {
      if (updated?.status === 'active') setPhase('solving');
      if (updated?.status === 'ended') setPhase('submitted');
    });
  }, [session, phase]);

  const handleJoin = async () => {
    if (!joinCode.trim() || !studentName.trim()) {
      setJoinError('Внесете го кодот и вашето име.');
      return;
    }
    setJoining(true);
    setJoinError('');
    const found = await examService.getExamSessionByCode(joinCode.trim().toUpperCase());
    if (!found) {
      setJoinError('Невалиден код или испитот не е отворен.');
      setJoining(false);
      return;
    }
    const vk = await examService.joinExamSession(found.id, studentName.trim(), deviceId);
    // Find the response doc id — list and find matching deviceId
    const responses = await examService.getExamResponses(found.id);
    const myResponse = responses.find(r => (r as any).id === deviceId || r.studentName === studentName.trim());
    setSession(found);
    setVariantKey(vk);
    setResponseDocId(myResponse?.id ?? deviceId);
    setPhase(found.status === 'active' ? 'solving' : 'waiting');
    setJoining(false);
  };

  const handleAnswer = useCallback(async (questionIndex: number, value: string) => {
    setAnswers(prev => ({ ...prev, [`q${questionIndex}`]: value }));
    if (session && responseDocId) {
      await examService.saveExamAnswer(session.id, responseDocId, questionIndex, value);
    }
  }, [session, responseDocId]);

  const handleSubmit = useCallback(async () => {
    if (!session || !responseDocId || submitting) return;
    setSubmitting(true);
    await examService.submitExamFinal(session.id, responseDocId, timeRemaining);
    if (session) localStorage.removeItem(LS_KEY(session.id, deviceId));
    setPhase('submitted');
    setSubmitting(false);
  }, [session, responseDocId, submitting, timeRemaining, deviceId]);

  const endsAt = session?.endsAt
    ? (session.endsAt as unknown as { toDate: () => Date }).toDate?.() ?? new Date(session.endsAt as unknown as number)
    : null;

  // ─── Phase: join ──────────────────────────────────────────────────────────
  if (phase === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📝</div>
            <h1 className="text-2xl font-bold text-gray-900">Приклучи се на испит</h1>
            <p className="text-gray-500 text-sm mt-1">Внесете го кодот на испитот</p>
          </div>
          <div className="space-y-4">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Код (6 цифри)"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-center text-2xl font-mono tracking-widest"
            />
            <input
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="Твое ime и презиме"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-sm"
            />
            {joinError && (
              <p className="text-red-600 text-sm text-center flex items-center justify-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {joinError}
              </p>
            )}
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {joining ? 'Се приклучувам…' : 'Приклучи се'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Phase: waiting ───────────────────────────────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-md w-full">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Чекај го наставникот…</h2>
          <p className="text-gray-500 text-sm">
            Варијанта: <strong className="text-indigo-600">{variantKey}</strong>
          </p>
          <p className="text-gray-400 text-xs mt-2">Испитот ќе почне автоматски кога наставникот ќе го стартува.</p>
        </div>
      </div>
    );
  }

  // ─── Phase: submitted ─────────────────────────────────────────────────────
  if (phase === 'submitted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-md w-full">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Испитот е предаден!</h2>
          <p className="text-gray-500 text-sm">Резултатите ќе бидат достапни откако наставникот ќе ги оцени одговорите.</p>
        </div>
      </div>
    );
  }

  // ─── Phase: solving ───────────────────────────────────────────────────────
  const questions = variantKey && session?.variants ? session.variants[variantKey] ?? [] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[180px]">
            {session?.title}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
            Вар. {variantKey}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {endsAt && (
            <ExamTimer
              endsAt={endsAt}
              onAutoSubmit={handleSubmit}
            />
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Предај
          </button>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <p className="text-sm text-gray-500 mb-4">
          {studentName} · {questions.length} прашања
        </p>
        <ExamVariantPlayer
          questions={questions}
          answers={answers}
          onAnswer={handleAnswer}
        />
        {/* Bottom submit */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-base font-bold transition-colors shadow-lg"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Предај го испитот
          </button>
        </div>
      </div>
    </div>
  );
};
