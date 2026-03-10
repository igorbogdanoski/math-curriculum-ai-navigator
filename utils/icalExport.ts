/**
 * iCal (.ics) export utility for Annual Curriculum Plans.
 *
 * Generates a standards-compliant RFC 5545 iCalendar file.
 * Compatible with: Google Calendar, Apple Calendar, Outlook, Thunderbird.
 *
 * Usage:
 *   const ics = generatePlanICS(plan, new Date(2026, 8, 1)); // 1 Sep 2026
 *   downloadICS(ics, 'годишна-програма.ics');
 */

import { AIGeneratedAnnualPlan } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toICSDate(date: Date): string {
  // Format: YYYYMMDD (all-day event — no time component)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Fold long lines to max 75 octets (RFC 5545 §3.1) */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  let result = '';
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      result += line.slice(0, MAX) + '\r\n';
      pos = MAX;
    } else {
      result += ' ' + line.slice(pos, pos + MAX - 1) + '\r\n';
      pos += MAX - 1;
    }
  }
  return result.trimEnd(); // remove trailing CRLF (caller adds it)
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@math-nav`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generates a .ics calendar string for the given annual plan.
 *
 * Each topic becomes a multi-day (all-day) VEVENT spanning its duration in weeks.
 * Topics are laid out sequentially starting from `schoolYearStart`.
 *
 * @param plan             The AI-generated annual plan
 * @param schoolYearStart  First day of school (default: 1 September of current year)
 */
export function generatePlanICS(
  plan: AIGeneratedAnnualPlan,
  schoolYearStart?: Date,
): string {
  const start = schoolYearStart ?? new Date(new Date().getFullYear(), 8, 1); // Sept 1

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Math AI Navigator//MK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(`${plan.subject} — ${plan.grade}`)}`,
    'X-WR-TIMEZONE:Europe/Skopje',
  ];

  let cursor = new Date(start);

  plan.topics.forEach((topic, idx) => {
    const dtStart = new Date(cursor);
    const dtEnd = addWeeks(cursor, topic.durationWeeks);

    // Short summary of objectives for the description
    const description = [
      `Тема ${idx + 1}: ${topic.title}`,
      `Траење: ${topic.durationWeeks} ${topic.durationWeeks === 1 ? 'недела' : 'недели'}`,
      '',
      'Цели:',
      ...topic.objectives.map((o) => `• ${o}`),
      '',
      'Активности:',
      ...topic.suggestedActivities.map((a) => `• ${a}`),
    ].join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:topic-${idx + 1}-${uid()}`,
      `DTSTART;VALUE=DATE:${toICSDate(dtStart)}`,
      `DTEND;VALUE=DATE:${toICSDate(dtEnd)}`,
      foldLine(`SUMMARY:${escapeICS(`[${idx + 1}] ${topic.title}`)}`),
      foldLine(`DESCRIPTION:${escapeICS(description)}`),
      `CATEGORIES:${escapeICS(plan.subject)}`,
      `SEQUENCE:0`,
      `STATUS:CONFIRMED`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );

    cursor = dtEnd;
  });

  lines.push('END:VCALENDAR');

  // RFC 5545: lines separated by CRLF
  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the .ics file.
 */
export function downloadICS(icsContent: string, filename = 'годишна-програма.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
