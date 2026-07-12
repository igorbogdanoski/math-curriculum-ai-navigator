import React from 'react';
import type { QuizResult, ConceptMastery } from '../../services/firestoreService';

const formatDate = (ts: any): string => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface PrintableProgressReportProps {
  studentName: string;
  totalQuizzes: number;
  reportPeriod: 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH';
  periodLabel: string;
  periodQuizzes: QuizResult[];
  periodStats: { total: number; avg: number; passed: number; newlyMastered: number };
  printDate: string;
  masteryRecords: ConceptMastery[];
  prereqGaps: { conceptTitle: string; missing: string[] }[];
  reviewToday: { conceptId: string; conceptTitle?: string; mastered?: boolean }[];
}

/** Hidden on screen (`.printable-root.hidden`), rendered only via `window.print()` —
 *  a full parent/teacher progress report, kept separate from the live-view JSX above
 *  it since it's a genuinely independent rendering concern (print layout classes,
 *  not interactive state). */
export function PrintableProgressReport({
  studentName, totalQuizzes, reportPeriod, periodLabel, periodQuizzes, periodStats,
  printDate, masteryRecords, prereqGaps, reviewToday,
}: PrintableProgressReportProps) {
  if (!(totalQuizzes > 0)) return null;

  return (
    <div className="printable-root hidden" aria-hidden="true">
      {/* Page header */}
      <div className="rpt-header">
        <div className="rpt-header-row">
          <div>
            <h1 className="rpt-title">
              {reportPeriod === 'THIS_MONTH' ? 'Месечен' : 'Неделен'} извештај за напредок
            </h1>
            <p className="rpt-subtitle">Напредок — Math Curriculum AI Navigator</p>
            <p className="rpt-subtitle">Период: <strong>{periodLabel}</strong></p>
          </div>
          <div className="rpt-meta">
            <div>Датум: <strong>{printDate}</strong></div>
            <div className="rpt-meta-date">Системски генериран извештај</div>
          </div>
        </div>
      </div>

      {/* Student info */}
      <div className="rpt-student-box">
        <span className="rpt-student-label">Ученик</span>
        <p className="rpt-student-name">{studentName}</p>
      </div>

      {/* Period stats */}
      <div className="rpt-stats-grid">
        {[
          { label: `Квизови (${periodLabel})`, value: String(periodStats.total) },
          { label: 'Положени (≥70%)', value: String(periodStats.passed) },
          { label: 'Просечен резултат', value: periodStats.total > 0 ? `${periodStats.avg}%` : '—' },
          { label: 'Новосовладани', value: String(periodStats.newlyMastered) },
        ].map(s => (
          <div key={s.label} className="rpt-stat-card">
            <p className="rpt-stat-value">{s.value}</p>
            <p className="rpt-stat-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Period quiz history */}
      <div className="rpt-section">
        <h2 className="rpt-section-title">Резултати од квизови</h2>
        {periodQuizzes.length === 0 ? (
          <p className="rpt-empty-msg">Нема одиграни квизови во овој период.</p>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th className="rpt-th rpt-th-left">Тест</th>
                <th className="rpt-th rpt-th-center">Датум</th>
                <th className="rpt-th rpt-th-center">Резултат</th>
                <th className="rpt-th rpt-th-center">Оценка</th>
              </tr>
            </thead>
            <tbody>
              {periodQuizzes.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'rpt-row-even' : 'rpt-row-odd'}>
                  <td className="rpt-td">{r.quizTitle}</td>
                  <td className="rpt-td rpt-td-center">{formatDate(r.playedAt)}</td>
                  <td className={`rpt-td rpt-td-center rpt-td-bold ${r.percentage >= 70 ? 'rpt-td-green' : 'rpt-td-amber'}`}>
                    {r.percentage}% ({r.correctCount}/{r.totalQuestions})
                  </td>
                  <td className={`rpt-td rpt-td-center rpt-td-bold ${r.percentage >= 70 ? 'rpt-td-green' : 'rpt-td-amber'}`}>
                    {r.percentage >= 70 ? 'Положен' : 'Не положен'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mastery section */}
      {masteryRecords.length > 0 && (
        <div className="rpt-section">
          <h2 className="rpt-section-title">Статус на совладување</h2>
          <table className="rpt-table">
            <thead>
              <tr>
                <th className="rpt-th rpt-th-left">Концепт</th>
                <th className="rpt-th rpt-th-center">Обиди</th>
                <th className="rpt-th rpt-th-center">Последен резултат</th>
                <th className="rpt-th rpt-th-center">Статус</th>
              </tr>
            </thead>
            <tbody>
              {masteryRecords
                .sort((a, b) => (b.mastered ? 1 : 0) - (a.mastered ? 1 : 0))
                .map((m) => (
                  <tr key={m.conceptId}>
                    <td className="rpt-td">{m.conceptTitle || m.conceptId}</td>
                    <td className="rpt-td rpt-td-center">{m.attempts}</td>
                    <td className={`rpt-td rpt-td-center rpt-td-bold ${m.bestScore >= 85 ? 'rpt-td-green' : 'rpt-td-amber'}`}>{m.bestScore}%</td>
                    <td className={`rpt-td rpt-td-center rpt-td-bold ${m.mastered ? 'rpt-td-green' : 'rpt-td-blue'}`}>
                      {m.mastered ? '✓ Совладано' : `${m.consecutiveHighScores}/3 над 85%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      {(prereqGaps.length > 0 || reviewToday.length > 0) && (
        <div className="rpt-section">
          <h2 className="rpt-section-title">Препораки за понатамошно учење</h2>
          {prereqGaps.length > 0 && (
            <>
              <p className="rpt-rec-prereq-heading">
                Недостасуваат предуслови ({prereqGaps.length}):
              </p>
              {prereqGaps.map((gap, i) => (
                <p key={i} className="rpt-rec-item">
                  • <strong>{gap.conceptTitle}</strong> — треба претходно: {gap.missing.join(', ')}
                </p>
              ))}
            </>
          )}
          {reviewToday.length > 0 && (
            <>
              <p className="rpt-rec-review-heading">
                Повтори денес ({reviewToday.length}):
              </p>
              {reviewToday.map((m, i) => (
                <p key={i} className="rpt-rec-item">
                  • {m.conceptTitle || m.conceptId} {m.mastered ? '(совладано — повторување)' : '(не совладано — вежбање)'}
                </p>
              ))}
            </>
          )}
        </div>
      )}

      {/* Print footer */}
      <div className="rpt-footer-bar">
        <span>Math Curriculum AI Navigator — извештај за родители и наставници</span>
        <span>Генерирано автоматски на {printDate}</span>
      </div>

      {/* Signature lines */}
      <div className="rpt-signatures">
        <div>
          <div className="rpt-signature-line" />
          <p className="rpt-signature-label">Потпис на родителот</p>
        </div>
        <div>
          <div className="rpt-signature-line" />
          <p className="rpt-signature-label">Потпис на ученикот / Наставникот</p>
        </div>
      </div>
    </div>
  );
}
