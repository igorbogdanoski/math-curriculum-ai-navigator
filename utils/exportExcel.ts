/**
 * Excel (.xlsx) export utility for Teacher Analytics.
 * Produces a workbook with 3 sheets: raw results, per-student summary, per-concept summary.
 */
// xlsx is loaded lazily (dynamic import) so it doesn't bloat the initial bundle.
// The ~300 KB chunk is only fetched when the teacher clicks "Excel (.xlsx)".
import type * as XLSXType from 'xlsx';
import type { QuizResult, ConceptMastery } from '../services/firestoreService';

type XLSX = typeof XLSXType;

// ── Grade calculation (Macedonian 1–5 scale) ─────────────────────────────────
function pctToGrade(pct: number): number {
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 60) return 3;
  if (pct >= 50) return 2;
  return 1;
}

/** Apply bold + blue fill to the header row of a sheet */
function styleHeader(XLSX: XLSX, ws: XLSXType.WorkSheet, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1565C0' }, patternType: 'solid' },
      alignment: { horizontal: 'center' },
    };
  }
}

/** Set column widths based on header text length */
function autoWidths(headers: string[]): XLSXType.ColInfo[] {
  return headers.map(h => ({ wch: Math.max(h.length + 4, 12) }));
}

// ── Sheet 1: Raw quiz results ─────────────────────────────────────────────────
function buildResultsSheet(XLSX: XLSX, results: QuizResult[]): XLSXType.WorkSheet {
  const headers = ['Ученик', 'Квиз / Тема', 'Точни', 'Вкупно', 'Проценти %', 'Оценка (1–5)', 'Концепт ID', 'Датум'];
  const rows = results.map(r => {
    const pct = Math.round(r.percentage);
    return [
      r.studentName || 'Анонимен',
      r.quizTitle,
      r.correctCount,
      r.totalQuestions,
      pct,
      pctToGrade(pct),
      r.conceptId || '',
      r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || '',
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(XLSX, ws, headers.length);
  ws['!cols'] = autoWidths(headers);
  return ws;
}

// ── Sheet 2: Per-student summary ──────────────────────────────────────────────
function buildStudentSheet(XLSX: XLSX, results: QuizResult[]): XLSXType.WorkSheet {
  const map: Record<string, { total: number; sum: number; quizzes: number }> = {};
  for (const r of results) {
    const name = r.studentName || 'Анонимен';
    if (!map[name]) map[name] = { total: 0, sum: 0, quizzes: 0 };
    map[name].sum += r.percentage;
    map[name].total += r.totalQuestions;
    map[name].quizzes++;
  }
  const headers = ['Ученик', 'Број квизови', 'Просечен %', 'Просечна оценка (1–5)', 'Вкупно прашања'];
  const rows = Object.entries(map)
    .map(([name, d]) => {
      const avg = Math.round(d.sum / d.quizzes);
      return [name, d.quizzes, avg, pctToGrade(avg), d.total];
    })
    .sort((a, b) => (b[2] as number) - (a[2] as number));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(XLSX, ws, headers.length);
  ws['!cols'] = autoWidths(headers);
  return ws;
}

// ── Sheet 3: Per-concept summary ──────────────────────────────────────────────
function buildConceptSheet(XLSX: XLSX, results: QuizResult[], mastery: ConceptMastery[]): XLSXType.WorkSheet {
  const map: Record<string, { title: string; sum: number; count: number }> = {};
  for (const r of results) {
    const key = r.conceptId || r.quizTitle;
    if (!map[key]) map[key] = { title: r.quizTitle, sum: 0, count: 0 };
    map[key].sum += r.percentage;
    map[key].count++;
  }
  const masteryMap: Record<string, boolean> = {};
  for (const m of mastery) {
    if (m.conceptId) masteryMap[m.conceptId] = m.mastered;
  }
  const headers = ['Концепт / Тема', 'Број квизови', 'Просечен %', 'Статус на совладување'];
  const rows = Object.entries(map)
    .map(([key, d]) => {
      const avg = Math.round(d.sum / d.count);
      const isMastered = masteryMap[key];
      const status = isMastered === true ? 'Совладано' : isMastered === false ? 'Во тек' : avg < 60 ? 'Тешкотии' : '—';
      return [d.title, d.count, avg, status];
    })
    .sort((a, b) => (a[2] as number) - (b[2] as number));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(XLSX, ws, headers.length);
  ws['!cols'] = autoWidths(headers);
  return ws;
}

// ── Public API (async — lazy-loads xlsx only on demand) ───────────────────────
export async function exportAnalyticsXlsx(
  results: QuizResult[],
  mastery: ConceptMastery[],
  filenamePrefix = 'analytics',
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildResultsSheet(XLSX, results), 'Резултати');
  XLSX.utils.book_append_sheet(wb, buildStudentSheet(XLSX, results), 'По ученик');
  XLSX.utils.book_append_sheet(wb, buildConceptSheet(XLSX, results, mastery), 'По концепт');
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
}
