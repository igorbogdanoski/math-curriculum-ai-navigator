import React, { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock, Cloud, HardDrive, History, Trophy } from 'lucide-react';
import { Card } from '../common/Card';
import type { MaturaSessionBucket, MaturaSessionSummary } from '../../hooks/useMaturaSessions';

const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра',
  analiza: 'Анализа',
  geometrija: 'Геометрија',
  trigonometrija: 'Тригонометрија',
  'matrici-vektori': 'Матрици/Вектори',
  broevi: 'Броеви',
  statistika: 'Статистика',
  kombinatorika: 'Комбинаторика',
  other: 'Друго',
};

function pctTone(pct: number): string {
  if (pct >= 75) return 'text-emerald-600';
  if (pct >= 55) return 'text-amber-600';
  return 'text-rose-600';
}

function barTone(pct: number): string {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 55) return 'bg-amber-500';
  return 'bg-rose-500';
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}мин ${s.toString().padStart(2, '0')}s`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('mk-MK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const BucketRow: React.FC<{ bucket: MaturaSessionBucket }> = ({ bucket }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="font-semibold text-gray-700">
        {TOPIC_LABELS[bucket.label] ?? bucket.label}
      </span>
      <span className={`font-bold ${pctTone(bucket.pct)}`}>
        {bucket.pct.toFixed(0)}%
        <span className="text-gray-400 font-normal ml-1">
          ({bucket.correct}/{bucket.max} · {bucket.questions} пр.)
        </span>
      </span>
    </div>
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${barTone(bucket.pct)}`}
        style={{ width: `${Math.max(0, Math.min(100, bucket.pct))}%` }}
      />
    </div>
  </div>
);

const SessionCard: React.FC<{
  session: MaturaSessionSummary;
  expanded: boolean;
  onToggle: () => void;
}> = ({ session, expanded, onToggle }) => {
  const passed = session.totalScore >= 35;
  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden"
      data-testid={`matura-session-row-${session.id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition"
      >
        <span className="text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{session.examTitle}</p>
          <p className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
            <CalendarDays className="w-3 h-3" /> {fmtDate(session.completedAt)}
            <span className="text-gray-300">·</span>
            <Clock className="w-3 h-3" /> {fmtDuration(session.durationSeconds)}
            <span className="text-gray-300">·</span>
            <span>{session.questionCount} пр.</span>
            <span className="text-gray-300">·</span>
            {session.source === 'firestore' ? (
              <span className="inline-flex items-center gap-1 text-blue-600"><Cloud className="w-3 h-3" /> Cloud</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700"><HardDrive className="w-3 h-3" /> Local</span>
            )}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`text-lg font-black ${pctTone(session.pct)}`}>
            {session.pct.toFixed(1)}%
          </p>
          <p className="text-[11px] text-gray-500">
            {session.totalScore}/{session.maxScore} {passed && <Trophy className="w-3 h-3 inline text-amber-500 -mt-0.5" />}
          </p>
        </div>
      </button>

      {expanded && (
        <div
          className="border-t border-gray-100 px-4 py-3 bg-gray-50/40 space-y-4"
          data-testid={`matura-session-detail-${session.id}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-gray-500">Резултат</p>
              <p className={`font-bold ${pctTone(session.pct)}`}>
                {session.totalScore}/{session.maxScore} ({session.pct.toFixed(1)}%)
              </p>
            </div>
            <div>
              <p className="text-gray-500">Време</p>
              <p className="font-bold text-gray-800">{fmtDuration(session.durationSeconds)}</p>
            </div>
            <div>
              <p className="text-gray-500">Прашања</p>
              <p className="font-bold text-gray-800">{session.questionCount}</p>
            </div>
            <div>
              <p className="text-gray-500">Време/прашање</p>
              <p className="font-bold text-gray-800">{fmtDuration(session.avgSecPerQuestion)}</p>
            </div>
          </div>

          {session.perTopic.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500">Точност по тема</h4>
              <div className="space-y-2">
                {session.perTopic.map((b) => <BucketRow key={`t-${b.key}`} bucket={b} />)}
              </div>
            </div>
          )}

          {session.perPart.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500">Точност по дел</h4>
              <div className="space-y-2">
                {session.perPart.map((b) => <BucketRow key={`p-${b.key}`} bucket={b} />)}
              </div>
            </div>
          )}

          {session.perDoK.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500">DoK распределба</h4>
              <div className="space-y-2">
                {session.perDoK.map((b) => <BucketRow key={`d-${b.key}`} bucket={b} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface MaturaSessionsListProps {
  sessions: MaturaSessionSummary[];
  loading?: boolean;
}

export const MaturaSessionsList: React.FC<MaturaSessionsListProps> = ({ sessions, loading = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(() => sessions[0]?.id ?? null);

  if (loading) {
    return (
      <div data-testid="matura-sessions-loading">
        <Card className="p-4 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="space-y-2 mt-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div data-testid="matura-sessions-empty">
        <Card className="p-6 text-center">
          <History className="w-6 h-6 text-gray-400 mx-auto" />
          <p className="text-sm font-bold text-gray-700 mt-2">Нема снимени сесии</p>
          <p className="text-xs text-gray-500 mt-1">
            Заврши најмалку една симулација за да видиш drill-down по сесија.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="matura-sessions-list">
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black text-gray-800 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" /> Историја на сесии
        </h2>
        <span className="text-xs text-gray-500">{sessions.length} вкупно</span>
      </div>
      <div className="space-y-2">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
          />
        ))}
      </div>
    </Card>
    </div>
  );
};
