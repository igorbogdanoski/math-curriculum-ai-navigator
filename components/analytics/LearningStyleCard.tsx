/**
 * LearningStyleCard — Ж1.5
 *
 * Displays a student's (or class aggregate's) mathematical learning style
 * profile derived from quiz history via useLearningStyleProfile.
 *
 * Modes:
 *  - studentName provided → single-student profile
 *  - no studentName       → class heatmap (how many students per style)
 *
 * Педагошка основа: VARK (Fleming), Gardner's Multiple Intelligences,
 * Differentiated Instruction (Tomlinson)
 */

import React, { useMemo } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import { Card } from '../common/Card';
import {
  useLearningStyleProfile,
  getLearningStyleMeta,
  type LearningStyle,
} from '../../hooks/useLearningStyleProfile';
import type { QuizResult } from '../../services/firestoreService.types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  results: QuizResult[];
  /** If provided, shows single-student profile. Otherwise shows class summary. */
  studentName?: string;
}

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONFIDENCE_META = {
  high:   { label: 'Висока сигурност', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: 'Средна сигурност', cls: 'bg-amber-100   text-amber-700   border-amber-200'   },
  low:    { label: 'Ниска сигурност',  cls: 'bg-gray-100    text-gray-600    border-gray-200'    },
};

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, count, isTop }: { label: string; score: number; count: number; isTop: boolean }) {
  const barColor = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-20 flex-shrink-0 truncate ${isTop ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs w-8 text-right ${isTop ? 'font-bold text-gray-700' : 'text-gray-400'}`}>{score}%</span>
      <span className="text-[10px] text-gray-400 w-8 text-right">{count}×</span>
    </div>
  );
}

// ── Single-student profile ────────────────────────────────────────────────────

function StudentProfile({ results, studentName }: { results: QuizResult[]; studentName: string }) {
  const profile = useLearningStyleProfile(results, studentName);

  if (!profile) {
    const count = results.filter(r => r.studentName === studentName).length;
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        {count < 5
          ? `Потребни се уште ${5 - count} квиз(а) за детекција на стил`
          : 'Нема доволно категоризирани резултати'}
      </div>
    );
  }

  const meta = getLearningStyleMeta(profile.style);
  const conf = CONFIDENCE_META[profile.confidence];

  return (
    <div className="space-y-4">
      {/* Style headline */}
      <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
        <span className="text-3xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-indigo-900 text-sm">{meta.label}</p>
          <p className="text-xs text-indigo-600 line-clamp-2 leading-snug mt-0.5">{profile.description}</p>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${conf.cls}`}>
          {conf.label}
        </span>
      </div>

      {/* Strand averages */}
      {profile.strandStats.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Просечни резултати по подрачје</p>
          {profile.strandStats.map((s, i) => (
            <ScoreBar key={s.strandId} label={s.label} score={s.avgScore} count={s.count} isTop={i === 0} />
          ))}
        </div>
      )}

      {/* Teaching suggestions */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2">Педагошки совети</p>
        <ul className="space-y-1">
          {meta.suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-amber-900">
              <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[10px] text-gray-300 text-right">Базирано на {profile.dataPoints} квиз резултати · Ж1.5</p>
    </div>
  );
}

// ── Class summary (no studentName) ────────────────────────────────────────────

function ClassSummary({ results }: { results: QuizResult[] }) {
  const studentNames = useMemo(() => [...new Set(results.map(r => r.studentName).filter(Boolean) as string[])], [results]);

  // Compute style for each student (inline, no hook call in loop — computed in useMemo)
  const styleMap = useMemo(() => {
    const counts: Partial<Record<LearningStyle, string[]>> = {};

    for (const name of studentNames) {
      const studentResults = results.filter(r => r.studentName === name);
      if (studentResults.length < 5) continue;

      // Inline strand detection (mirror hook logic without calling the hook)
      const STRAND_KEYWORDS: Record<string, string[]> = {
        geo:  ['геометр', 'форм', 'агол', 'триаголник', 'плоштин', 'круг'],
        num:  ['број', 'операц', 'дропк', 'собир', 'множ', 'дел', 'природн', 'децимал'],
        alg:  ['алгебр', 'функц', 'равенк', 'израз', 'полином'],
        meas: ['мерењ', 'врем', 'должин', 'маса', 'единиц'],
        data: ['податоц', 'веројатн', 'дијаграм', 'статистик'],
      };
      const STYLE_MAP: Record<string, LearningStyle> = { geo: 'visual', num: 'procedural', alg: 'abstract', meas: 'applied', data: 'analytical' };

      const sums: Record<string, number> = {};
      const cnts: Record<string, number> = {};
      for (const r of studentResults) {
        const text = (((r as any).quizTitle ?? '') + ' ' + ((r as any).conceptTitle ?? '')).toLowerCase();
        for (const [sid, kws] of Object.entries(STRAND_KEYWORDS)) {
          if (kws.some(k => text.includes(k))) {
            sums[sid] = (sums[sid] ?? 0) + r.percentage;
            cnts[sid] = (cnts[sid] ?? 0) + 1;
          }
        }
      }
      const strandStats = Object.keys(sums).map(id => ({ id, avg: Math.round(sums[id] / cnts[id]) })).sort((a, b) => b.avg - a.avg);
      if (strandStats.length === 0) continue;
      const top = strandStats[0];
      const second = strandStats[1];
      const gap = second ? top.avg - second.avg : 100;
      const style: LearningStyle = gap < 5 ? 'balanced' : (STYLE_MAP[top.id] ?? 'balanced');
      if (!counts[style]) counts[style] = [];
      counts[style]!.push(name);
    }
    return counts;
  }, [results, studentNames]);

  const styles = Object.entries(styleMap).sort((a, b) => b[1].length - a[1].length);

  if (styles.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        Нема доволно квизови за анализа (минимум 5 по ученик)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Стилови на учење во класот</p>
      {styles.map(([style, names]) => {
        const meta = getLearningStyleMeta(style as LearningStyle);
        const pct = Math.round((names.length / studentNames.length) * 100);
        return (
          <div key={style} className="flex items-center gap-3">
            <span className="text-xl w-7 flex-shrink-0">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                <span className="text-xs text-gray-500">{names.length} уч. ({pct}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-gray-300 text-right pt-1">Ж1.5 · {studentNames.length} ученика анализирани</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const LearningStyleCard: React.FC<Props> = ({ results, studentName }) => {
  if (results.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-indigo-400">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-gray-800 text-sm">
            {studentName ? `Стил на учење — ${studentName}` : 'Стилови на учење во класот'}
          </h3>
          <p className="text-xs text-gray-500">
            Детектиран доминантен математички стил врз основа на квиз историјата
          </p>
        </div>
      </div>

      {studentName
        ? <StudentProfile results={results} studentName={studentName} />
        : <ClassSummary results={results} />
      }
    </Card>
  );
};
