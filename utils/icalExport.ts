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

import { AIGeneratedAnnualPlan, LessonPlan } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toICSDate(date: Date, includeTime = false): string {
  // Format: YYYYMMDD (all-day event) or YYYYMMDDTHHMMSS (with time)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  
  if (!includeTime) return `${y}${m}${d}`;
  
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function escapeICS(str: string): string {
  if (!str) return '';
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

// ── Main exports ───────────────────────────────────────────────────────────────

/**
 * Generates a .ics calendar string for the given individual lesson plan.
 */
export function generateLessonICS(plan: LessonPlan, date?: Date): string {
  const eventDate = date ?? new Date();
  const dtStart = new Date(eventDate);
  // Default to 45 mins lesson if not specified
  const dtEnd = new Date(eventDate.getTime() + 45 * 60000);

  const description = [
    `Предмет: ${plan.subject}`,
    `Тема: ${plan.theme}`,
    `Одделение: ${plan.grade}`,
    '',
    'Цели:',
    ...plan.objectives.map((o) => `• ${o.text}`),
    '',
    'Материјали:',
    ...plan.materials.map((m) => `• ${m}`),
    '',
    'Сценарио (кратко):',
    `Вовед: ${plan.scenario.introductory.text.substring(0, 100)}...`,
    `Завршен дел: ${plan.scenario.concluding.text.substring(0, 100)}...`,
  ].join('\\n');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Math AI Navigator//MK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:lesson-${plan.id || uid()}`,
    `DTSTART:${toICSDate(dtStart, true)}`,
    `DTEND:${toICSDate(dtEnd, true)}`,
    foldLine(`SUMMARY:${escapeICS(`[Математика] ${plan.title}`)}`),
    foldLine(`DESCRIPTION:${escapeICS(description)}`),
    `CATEGORIES:${escapeICS(plan.subject)}`,
    `SEQUENCE:0`,
    `STATUS:CONFIRMED`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Generates a Google Calendar Template URL for a lesson.
 */
export function getGoogleCalendarUrl(plan: LessonPlan, date?: Date): string {
  const eventDate = date ?? new Date();
  const dtStart = toICSDate(eventDate, true) + 'Z';
  const dtEnd = toICSDate(new Date(eventDate.getTime() + 45 * 60000), true) + 'Z';

  const description = [
    `Предмет: ${plan.subject}`,
    `Тема: ${plan.theme}`,
    `Одделение: ${plan.grade}`,
    '',
    'Цели:',
    ...plan.objectives.map((o) => `• ${o.text}`),
    '',
    'Материјали:',
    ...plan.materials.map((m) => `• ${m}`),
  ].join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[Математика] ${plan.title}`,
    details: description,
    dates: `${dtStart}/${dtEnd}`,
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

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
