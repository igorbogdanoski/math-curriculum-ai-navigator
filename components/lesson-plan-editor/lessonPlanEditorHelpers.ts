import type { LessonPlan } from '../../types';

export const initialPlanState: Partial<LessonPlan> = {
  title: '',
  grade: 6,
  topicId: '',
  conceptIds: [],
  subject: 'Математика',
  theme: '',
  lessonNumber: 1,
  objectives: [],
  assessmentStandards: [],
  scenario: { introductory: { text: '' }, main: [], concluding: { text: '' } },
  materials: [],
  progressMonitoring: [],
  differentiation: '',
  reflectionPrompt: '1. Што помина добро на часот и зошто?\n2. Каде учениците имаа најголеми потешкотии и зошто?\n3. Што би променил/а следниот пат кога ќе го предавам овој час?',
  selfAssessmentPrompt: '',
};

export const stringToArray = (str: string = ''): string[] =>
  str.split('\n').filter(line => line.trim() !== '');

export const arrayToLines = (arr: any[] = []): string =>
  arr.map(item => `- ${typeof item === 'string' ? item : item.text}${item.bloomsLevel ? ` [${item.bloomsLevel}]` : ''}`).join('\n');

export const escapeHtml = (unsafe: string = ''): string =>
  unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildPlanFullText(plan: Partial<LessonPlan>): string {
  const { title, grade, theme, objectives, assessmentStandards, scenario, materials, progressMonitoring } = plan;
  const introductoryText = typeof scenario?.introductory === 'string' ? scenario.introductory : scenario?.introductory?.text;
  const concludingText = typeof scenario?.concluding === 'string' ? scenario.concluding : scenario?.concluding?.text;
  const mainActivitiesText = (scenario?.main || [])
    .map((a: any) => typeof a === 'string' ? a : `${a.text}${a.bloomsLevel ? ` [${a.bloomsLevel}]` : ''}`)
    .join('; ');
  return `Наслов: ${title}\nОдделение: ${grade}\nТема: ${theme}\n\nЦЕЛИ:\n${arrayToLines(objectives || [])}\n\nСТАНДАРДИ ЗА ОЦЕНУВАЊЕ:\n${(assessmentStandards || []).join('\n')}\n\nСЦЕНАРИО:\nВовед: ${introductoryText}\nГлавни: ${mainActivitiesText}\nЗавршна: ${concludingText}\n\nМАТЕРИЈАЛИ:\n${(materials || []).join('\n')}\n\nСЛЕДЕЊЕ НА НАПРЕДОК:\n${(progressMonitoring || []).join('\n')}\n`;
}

export function buildPlanMarkdown(plan: Partial<LessonPlan>): string {
  const { title, grade, theme, objectives, assessmentStandards, scenario, materials, progressMonitoring } = plan;
  const introductoryText = typeof scenario?.introductory === 'string' ? scenario.introductory : scenario?.introductory?.text;
  const concludingText = typeof scenario?.concluding === 'string' ? scenario.concluding : scenario?.concluding?.text;
  return `# ${title || 'Без наслов'}\n\n**Одделение:** ${grade || ''}\n**Тема:** ${theme || ''}\n\n---\n\n## Цели\n${arrayToLines(objectives)}\n\n## Стандарди за оценување\n${arrayToLines(assessmentStandards)}\n\n## Сценарио\n### Вовед\n${introductoryText || ''}\n### Главни активности\n${arrayToLines(scenario?.main)}\n### Завршна активност\n${concludingText || ''}\n\n---\n\n## Материјали\n${arrayToLines(materials)}\n\n## Следење на напредокот\n${arrayToLines(progressMonitoring)}`;
}

export function sanitizeFilename(title: string = 'plan'): string {
  return title.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase();
}
