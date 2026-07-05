import { AIGeneratedAnnualPlan, TeachingProfile } from '../../types';
import {
    Type, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, sanitizePromptInput,
    getSecondaryTrackContext,
} from './core';
import { buildPedagogyPromptContext } from '../../data/official/pedagogy';
import { educationalHints } from '../../data/educationalModelsInfo';
import { MATH_STANDARDS, CROSS_CURRICULAR_WITH_MATH, AREA_LABELS } from '../../data/allNationalStandardsComplete';

function buildNationalStandardsContext(gradeNumber: number | null): string {
  const forPrimary = gradeNumber !== null && gradeNumber >= 6 && gradeNumber <= 9;

  const mathBlock = MATH_STANDARDS
    .map(s => `  ${s.code}: ${s.description}`)
    .join('\n');

  // Cross-curricular: group by area, show only entries with mathBridge
  const crossByArea = new Map<string, string[]>();
  for (const s of CROSS_CURRICULAR_WITH_MATH) {
    const key = AREA_LABELS[s.area];
    if (!crossByArea.has(key)) crossByArea.set(key, []);
    crossByArea.get(key)!.push(`    ${s.code}: ${(s.mathBridge ?? []).join(' | ')}`);
  }
  const crossBlock = [...crossByArea.entries()]
    .map(([area, lines]) => `  ${area}:\n${lines.join('\n')}`)
    .join('\n');

  if (forPrimary) {
    return `
### НАЦИОНАЛНИ СТАНДАРДИ (БРО) — математика III-А.1–27
Годишниот план треба да ги адресира сите 27 стандарди кумулативно до крај на 9. одд.
За СЕКОЈА тема, наведи ги кодовите на стандардите кои ги надградуваме (нпр. III-А.3, III-А.22).

МАТЕМАТИЧКИ СТАНДАРДИ (знаења и вештини):
${mathBlock}

### МЕЃУПРЕДМЕТНИ ПОВРЗУВАЊА (БРО — сите 8 подрачја)
Кога е педагошки оправдано, поврзи ги темите со стандардите од другите подрачја:
${crossBlock}
`.trim();
  }

  // Secondary (grade 10+): curriculum competencies, NOT БРО codes
  if (gradeNumber !== null && gradeNumber > 9) {
    return `
### СРЕДНО ОБРАЗОВАНИЕ — МОН Наставна програма (одд. ${gradeNumber})
Годишниот план треба да ги опфати следните компетенции:
- Математичко размислување и аргументирање (докази, дедукција, индукција)
- Решавање на комплексни проблеми (моделирање, апстракција, примена)
- Математичка комуникација (прецизна употреба на математички јазик и симболи)
- Поврзување на математиката со природните науки, физиката, хемијата, економијата
- Дигитална компетентност (GeoGebra, Desmos, CAS системи)
- Критичко мислење и самооценување (рефлексија, евалуација на сопствени решенија)

За секоја тема, наведи ги конкретните ИСХОДИ НА УЧЕЊЕ (не БРО кодови — тие важат само за основно образование).

### МЕЃУПРЕДМЕТНИ ПОВРЗУВАЊА (средно образование)
${crossBlock}
`.trim();
  }

  // For grades 1-5: only cross-curricular bridges
  return `
### МЕЃУПРЕДМЕТНИ ПОВРЗУВАЊА — национални стандарди (БРО)
Поврзи ги математичките теми со стандардите од другите подрачја каде е оправдано:
${crossBlock}
`.trim();
}

const MIN_ANNUAL_PLAN_TOPICS = 8;
const ANNUAL_PLAN_FALLBACK_TOPICS = [
  'Вовед и дијагностика',
  'Рационални броеви и операции',
  'Пропорции и проценти',
  'Алгебарски изрази и равенки',
  'Геометрија и конструкции',
  'Мерење и примени',
  'Статистика и веројатност',
  'Систематизација и проектни задачи',
];

function normalizeTopicWeeks(plan: AIGeneratedAnnualPlan): AIGeneratedAnnualPlan {
  const topics = (plan.topics ?? []).map((topic) => ({
    ...topic,
    durationWeeks: Math.max(1, Math.round(Number(topic.durationWeeks ?? 1))),
    objectives: Array.isArray(topic.objectives) && topic.objectives.length > 0
      ? topic.objectives
      : ['Совладување на клучните поими за темата.'],
    suggestedActivities: Array.isArray(topic.suggestedActivities) && topic.suggestedActivities.length > 0
      ? topic.suggestedActivities
      : ['Кратка наставна активност со проверка на разбирање.'],
  }));

  let sum = topics.reduce((acc, t) => acc + t.durationWeeks, 0);
  const baseWeeks = plan.totalWeeks ?? sum ?? 1;
  const targetWeeks = Math.max(1, Math.round(Number(baseWeeks)));

  if (topics.length === 0) {
    return {
      ...plan,
      totalWeeks: targetWeeks,
      topics: [{ title: 'Годишна рамка', durationWeeks: targetWeeks, objectives: ['Покривање на годишните цели според наставната програма.'], suggestedActivities: ['Насочено планирање, вежбање и формативна евалуација.'] }],
    };
  }

  let cursor = 0;
  while (sum < targetWeeks) { topics[cursor % topics.length].durationWeeks += 1; sum += 1; cursor += 1; }
  while (sum > targetWeeks) {
    const idx = cursor % topics.length;
    if (topics[idx].durationWeeks > 1) { topics[idx].durationWeeks -= 1; sum -= 1; }
    cursor += 1;
  }
  return { ...plan, totalWeeks: targetWeeks, topics };
}

function enforceAnnualPlanQuality(plan: AIGeneratedAnnualPlan): AIGeneratedAnnualPlan {
  const topics = [...(plan.topics ?? [])];
  const existingTitles = new Set(topics.map((topic) => (topic.title ?? '').toLowerCase()));
  for (const title of ANNUAL_PLAN_FALLBACK_TOPICS) {
    if (topics.length >= MIN_ANNUAL_PLAN_TOPICS) break;
    if (existingTitles.has(title.toLowerCase())) continue;
    topics.push({ title, durationWeeks: 1, objectives: ['Развивање на математички компетенции и примена во контекст.'], suggestedActivities: ['Наставна активност со вежби, дискусија и кратка проверка.'] });
  }
  return normalizeTopicWeeks({ ...plan, topics });
}

export const annualAPI = {

async generateAnnualPlan(
    grade: string,
    subject: string,
    totalWeeks: number,
    curriculumContext: string,
    profile?: TeachingProfile,
    customInstruction?: string
  ): Promise<AIGeneratedAnnualPlan> {
    const safeCustomInstruction = sanitizePromptInput(customInstruction, 600);
    const weeklyHoursForTrack = profile?.secondaryTrack
      ? ({ gymnasium: 4, gymnasium_elective: 3, vocational4: 3, vocational3: 2, vocational2: 2 } as const)[profile.secondaryTrack] ?? 4
      : 4;
    const secondaryContextBlock = getSecondaryTrackContext(profile?.secondaryTrack);

    // Detect grade number for national standards context
    const gradeMatch = grade.match(/\b(IX|VIII|VII|VI|V|IV|III|II|I|9|8|7|6|5|4|3|2|1)\b/i);
    const romanMap: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9 };
    const detectedGrade = gradeMatch
      ? (romanMap[gradeMatch[1].toUpperCase()] ?? parseInt(gradeMatch[1], 10) ?? null)
      : null;
    const nationalStandardsBlock = buildNationalStandardsContext(detectedGrade);

    const prompt = `
Вие сте врвен експерт за планирање на наставата по ${subject} за ${grade} во македонскиот образовен систем.
Ваша задача е да креирате детална, практична и изводлива предлог-годишна програма.
${secondaryContextBlock}

ПАРАМЕТРИ:
- Вкупно недели на располагање: ${totalWeeks}.

ОФИЦИЈАЛНА ПРОГРАМА (МОРА да се придржувате до овие теми и нивните специфики):
${curriculumContext}

ПЕДАГОШКИ ПРИНЦИПИ:
${buildPedagogyPromptContext()}

УПАТСТВА:
1. Строго базирајте го вашиот план на официалните теми дадени погоре.
2. Распределете ги темите низ неделите така што сумата од сите недели да биде ТОЧНО ${totalWeeks}.
3. Вклучи најмалку ${MIN_ANNUAL_PLAN_TOPICS} одделни теми во полето "topics".
4. Конвертирајте ги часовите во реални недели (${weeklyHoursForTrack} часа неделно). Ако официјалната програма дава точни часови по подтема, почитувај ја таа распределба.
5. За секоја тема, извлечете ги примарните цели и предложете 2-3 конкретни активности (групна работа, проекти, истражување) усогласени со официјалните активности.
5б. За секоја тема, во полето "pedagogicalModel" наведи ТОЧНОТО име на еден педагошки модел од листата кој најдобро одговара на предложените активности (не измислувај ново име): ${Object.keys(educationalHints.pedagogicalModels).join(', ')}
6. ТЕМИ КОИ СЕ РЕАЛИЗИРААТ НИЗ ЦЕЛАТА ГОДИНА (Геометрија, Мерење, Работа со податоци): разбивај ги на подтеми кои се вметнуваат меѓу другите теми — не ги ставај само на крај.
7. КАЛЕНДАРСКИ ИНТЕЛИГЕНТНО ПЛАНИРАЊЕ: Земете ги предвид македонските државни празници (8 Септември, 11 Октомври, 23 Октомври, 8 Декември, 1 Мај, 24 Мај) и зимски распусти.
8. Вклучи 4 писмени работи рамномерно распоредени низ годината.
${nationalStandardsBlock}

${safeCustomInstruction ? `ДОПОЛНИТЕЛНИ ИНСТРУКЦИИ ОД НАСТАВНИКОТ: ${safeCustomInstruction}\n` : ''}
Вратете ВАЛИДЕН JSON според шемата, без дополнителен текст.
    `.trim();

    const schema = {
      type: Type.OBJECT,
      properties: {
        grade: { type: Type.STRING }, subject: { type: Type.STRING }, totalWeeks: { type: Type.NUMBER },
        topics: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, durationWeeks: { type: Type.NUMBER }, objectives: { type: Type.ARRAY, items: { type: Type.STRING } }, suggestedActivities: { type: Type.ARRAY, items: { type: Type.STRING } }, pedagogicalModel: { type: Type.STRING } }, required: ['title', 'durationWeeks', 'objectives', 'suggestedActivities'] } },
      },
      required: ['grade', 'subject', 'totalWeeks', 'topics'],
    };

    const generatedPlan = await generateAndParseJSON<AIGeneratedAnnualPlan>(
      [{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier, { temperature: 0.2, topP: 0.9 }
    );
    return enforceAnnualPlanQuality(generatedPlan);
  },

};
