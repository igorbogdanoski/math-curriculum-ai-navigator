import React, { useEffect, useState } from 'react';
import { BarChart3, Copy, CheckCheck, AlertTriangle, Trophy, Flame } from 'lucide-react';
import { shareService, type SharedMaturaRecoveryData } from '../services/shareService';
import { useNavigation } from '../contexts/NavigationContext';

interface SharedMaturaRecoveryViewProps {
  data: string;
}

export const SharedMaturaRecoveryView: React.FC<SharedMaturaRecoveryViewProps> = ({ data }) => {
  const { navigate } = useNavigation();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SharedMaturaRecoveryData | null>(null);
  const [decodeError, setDecodeError] = useState<'invalid' | 'expired' | 'server'>('invalid');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      // New secure format: server-signed token
      if (shareService.isSignedMaturaRecoveryToken(data)) {
        try {
          const res = await fetch(`/api/matura-share-verify?token=${encodeURIComponent(data)}`);
          const payload = await res.json().catch(() => null) as { payload?: SharedMaturaRecoveryData; error?: string } | null;

          if (cancelled) return;

          if (res.ok && payload?.payload) {
            setSummary(payload.payload);
            setLoading(false);
            return;
          }

          if (payload?.error === 'expired' || res.status === 410) {
            setDecodeError('expired');
          } else if (res.status >= 500) {
            setDecodeError('server');
          } else {
            setDecodeError('invalid');
          }
          setSummary(null);
          setLoading(false);
          return;
        } catch {
          if (cancelled) return;
          setDecodeError('server');
          setSummary(null);
          setLoading(false);
          return;
        }
      }

      // Legacy format fallback (client-decoded)
      const decoded = shareService.decodeMaturaRecoveryShareDataWithStatus(data);
      if (cancelled) return;
      setSummary(decoded.data);
      setDecodeError(decoded.error ?? 'invalid');
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [data]);

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-indigo-200 shadow-md p-6 text-center">
          <p className="text-sm text-indigo-700 font-semibold animate-pulse">Се вчитува споделениот recovery извештај…</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-rose-200 shadow-md p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h1 className="text-xl font-black text-rose-900">
            {decodeError === 'expired' ? 'Recovery линкот е истечен' : decodeError === 'server' ? 'Recovery сервисот моментално не е достапен' : 'Невалиден recovery линк'}
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            {decodeError === 'expired'
              ? 'Линкот има поминато рок на важност. Побарај нов извештај од изворот.'
              : decodeError === 'server'
                ? 'Проверете повторно за неколку минути.'
                : 'Линкот е оштетен или невалиден.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
          >
            Почетна
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-indigo-600">Shared Recovery Report</p>
              <h1 className="text-2xl font-black text-indigo-900 mt-1 flex items-center gap-2">
                <BarChart3 className="w-6 h-6" /> Matura Recovery Summary
              </h1>
              <p className="text-xs text-gray-500 mt-1">Generated: {new Date(summary.generatedAt).toLocaleString('mk-MK')}</p>
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition inline-flex items-center gap-1.5"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Копирано' : 'Копирај линк'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-xl border border-gray-200 p-3 text-sm"><span className="font-semibold text-gray-500">Attempts</span><p className="text-xl font-black text-gray-900">{summary.attempts}</p></div>
            <div className="rounded-xl border border-gray-200 p-3 text-sm"><span className="font-semibold text-gray-500">Average</span><p className="text-xl font-black text-gray-900">{summary.avgPct.toFixed(1)}%</p></div>
            <div className="rounded-xl border border-gray-200 p-3 text-sm"><span className="font-semibold text-gray-500">Best</span><p className="text-xl font-black text-gray-900">{summary.bestPct.toFixed(1)}%</p></div>
            <div className="rounded-xl border border-gray-200 p-3 text-sm"><span className="font-semibold text-gray-500">Pass rate</span><p className="text-xl font-black text-gray-900">{summary.passRatePct.toFixed(1)}%</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
          <h2 className="text-lg font-black text-rose-900">Weak Concepts</h2>
          <div className="mt-3 space-y-2">
            {summary.weakConcepts.length === 0 && (
              <p className="text-sm text-gray-600">Нема детектирани слаби концепти.</p>
            )}
            {summary.weakConcepts.map((item) => (
              <div key={`${item.title}-${item.pct}`} className="rounded-xl border border-rose-100 p-3">
                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{item.pct.toFixed(1)}% · {item.questions} прашања</p>
                {item.delta !== undefined && item.delta !== null && (
                  <p className={`text-xs font-black mt-1 ${item.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Recovery: {item.delta >= 0 ? '+' : ''}{item.delta.toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
          <h2 className="text-lg font-black text-indigo-900">Mission Status</h2>
          {summary.mission ? (
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <p><strong>Concept:</strong> {summary.mission.sourceConceptTitle}</p>
              <p><strong>Progress:</strong> {summary.mission.progressCompleted}/{summary.mission.progressTotal}</p>
              <p className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-500" /> <strong>Streak:</strong> {summary.mission.streakCount}</p>
              <p className="inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-500" /> <strong>Badge:</strong> {summary.mission.badgeEarned ? 'Освоена' : 'Во тек'}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">Нема активна mission програма.</p>
          )}
        </div>
      </div>
    </div>
  );
};
