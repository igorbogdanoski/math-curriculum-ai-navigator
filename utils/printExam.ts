import type { ExamQuestion, ExamVariantKey } from '../services/firestoreService.types';

// ─── Inline selection parser ──────────────────────────────────────────────────
// Syntax: "Квадратот има {4|3} страни." → [{text:"Квадратот има "}, {options:["4","3"], correctIndex:0}, {text:" страни."}]

export type InlineSegment =
  | { type: 'text'; value: string }
  | { type: 'choice'; options: string[]; correctIndex: number };

export function parseInlineSelection(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  const re = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: text.slice(last, match.index) });
    }
    const parts = match[1].split('|');
    segments.push({ type: 'choice', options: parts, correctIndex: 0 });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

// ─── ZipGrade CSV export ──────────────────────────────────────────────────────

export interface ZipGradeQuestion {
  number: number;
  answer: string; // A/B/C/D or T/F
  points: number;
}

export function buildZipGradeCSV(
  title: string,
  variantKey: ExamVariantKey,
  questions: ZipGradeQuestion[],
): string {
  const lines: string[] = [];
  lines.push(`"${title} — Варијанта ${variantKey}"`);
  lines.push('');
  lines.push('Question,Correct Answer,Points');
  questions.forEach(q => {
    lines.push(`${q.number},"${q.answer}",${q.points}`);
  });
  return lines.join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Answer key helper ────────────────────────────────────────────────────────

export function extractMCAnswer(question: ExamQuestion, answerText: string): string {
  if (!question.options?.length) return answerText;
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const idx = question.options.findIndex(
    o => o.trim().toLowerCase() === answerText.trim().toLowerCase(),
  );
  return idx >= 0 ? labels[idx] : answerText;
}
