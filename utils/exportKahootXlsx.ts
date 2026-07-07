import type { KahootQuestion } from '../services/gemini/kahootGenerator';

/**
 * Builds rows matching Kahoot's publicly documented bulk-question-import spreadsheet
 * format (kahoot.com's own "Import from spreadsheet" template: Question, Answer 1-4,
 * Time limit (sec), Correct answer(s) — 1-indexed answer number, comma-separated for
 * multiple correct answers, none of this app's question types need that). "Kahoot
 * Maker" previously only ever launched into this app's OWN Live Class — it never
 * actually produced anything a teacher could import into real kahoot.com, despite the
 * name. Not verified against a live kahoot.com import in this session — worth a real
 * spot-check before relying on it for a class.
 */
export function buildKahootExportRows(questions: KahootQuestion[], timerSeconds?: number): string[][] {
  const header = ['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)'];
  const timeLimit = String(timerSeconds ?? 20);
  const rows = questions.map(q => [
    q.question,
    ...q.options,
    timeLimit,
    String(q.correctIndex + 1),
  ]);
  return [header, ...rows];
}

/** Lazy-loads xlsx (same pattern as utils/exportExcel.ts) so it doesn't bloat the initial bundle. */
export async function exportKahootXlsx(title: string, questions: KahootQuestion[], timerSeconds?: number): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = buildKahootExportRows(questions, timerSeconds);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidths(rows[0]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const safeName = title.trim().replace(/[^\p{L}\p{N}\- ]/gu, '').slice(0, 60) || 'kahoot-quiz';
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

function autoWidths(headers: string[]): { wch: number }[] {
  return headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
}
