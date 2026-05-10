import {
  DEFAULT_MODEL, SAFETY_SETTINGS, callGeminiProxy,
  checkDailyQuotaGuard, getResolvedTextSystemInstruction, getAILanguageRule,
  generateAndParseJSON, Type,
} from './core';
import type {
  DuggaQuestion, DuggaQuestionType, DuggaDok, DuggaOption,
} from '../firestoreService.dugga';

// ─── Math Editor AI ──────────────────────────────────────────────────────────

export const duggaAPI = {

  async explainExpression(latex: string): Promise<string> {
    checkDailyQuotaGuard();
    const prompt = `Ти си македонски наставник по математика. Ученикот напишал:

$${latex}$

Објасни го овој математички израз на разбирлив начин:
1. **Што претставува** — опиши го изразот со зборови
2. **Компоненти** — наброј ги деловите и нивното значење
3. **Пример** — дај конкретен нумеричен пример или примена
4. **Поврзано со** — каде се среќава во наставната програма (разред/тема)

Пиши кратко и јасно. ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },

  async solveExpression(latex: string): Promise<string> {
    checkDailyQuotaGuard();
    const prompt = `Ти си македонски наставник по математика. Реши/поедностави го следниов израз чекор-по-чекор:

$${latex}$

Структурирај го решението:
1. **Идентификација** — тип на задача (равенка/неједнаквост/израз/итн.)
2. **Стратегија** — кој пристап ќе користиш
3. **Решение** (секој чекор на нова линија, со образложение)
4. **Одговор** — финалниот резултат истакнат

Ако е израз (не равенка) — поедностави и пресметај. Ако е равенка — реши.
ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },

  async checkExpression(latex: string): Promise<string> {
    checkDailyQuotaGuard();
    const prompt = `Ти си македонски наставник по математика. Прегледај го следниов математички израз:

$${latex}$

Провери:
1. **Синтаксна точност** — дали нотацијата е математички исправна
2. **Логичка точност** — дали изразот има смисла
3. **Проблеми** — наброј конкретни грешки ако има
4. **Исправена верзија** — ако има грешки, дај ја точната форма
5. **Совет** — краток совет за избегнување слична грешка

Ако изразот е точен — потврди и пофали ја точноста. ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },

  async generateSimilarProblem(latex: string): Promise<string> {
    checkDailyQuotaGuard();
    const prompt = `Ти си македонски наставник по математика. Врз основа на овoj израз/равенка:

$${latex}$

Генерирај 3 слични задачи за вежбање (со различни бројни вредности, ист тип):

За секоја задача:
- **Задача N:** [израз/равенка]
- **Тип:** [тип на задача]
- **Совет:** [еден клучен совет]

Потоа дај кратко **Решение** на секоја. ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },

  // ─── Dugga Test Generation (Phase B) ─────────────────────────────────────

  async generateTestQuestions(params: {
    grade: number;
    subject: string;
    topics: string[];
    testType: 'topic' | 'midterm' | 'annual' | 'exam' | 'custom';
    totalQuestions: number;
    dokDistribution: { 1: number; 2: number; 3: number; 4: number };
    language?: string;
  }): Promise<string> {
    checkDailyQuotaGuard();

    const testTypeLabel: Record<string, string> = {
      topic: 'тематски тест (1-2 теми)',
      midterm: 'полугодишен тест',
      annual: 'годишен тест',
      exam: 'завршен испит / матура',
    };

    const prompt = `Ти си стручњак за математичко оценување и дизајн на тестови за македонскиот образовен систем.

Генерирај ${params.totalQuestions} прашања за:
- **Тип тест:** ${testTypeLabel[params.testType]}
- **Разред:** ${params.grade}
- **Тема(и):** ${params.topics.join(', ')}
- **DoK распределба:** DoK1=${params.dokDistribution[1]} · DoK2=${params.dokDistribution[2]} · DoK3=${params.dokDistribution[3]} · DoK4=${params.dokDistribution[4]}

**Типови прашања** — искористи разновидност (MC, Точно/Неточно, пополни, краток одговор, есеј):

За секое прашање врати JSON:
{
  "type": "multiple_choice" | "true_false" | "fill_blanks" | "short_answer" | "essay" | "ordering" | "multi_match",
  "dok": 1 | 2 | 3 | 4,
  "points": number,
  "text": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],  // само за MC
  "correctAnswer": "...",
  "solution": "...",  // кратко решение за наставникот
  "hint": "..."       // насока за ученик
}

Врати САМО валиден JSON array. Без markdown. ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },

  // ─── S61-D1 — Курикулум-aware генерација од концепт ──────────────────────

  async generateFromConcept(params: {
    conceptId: string;
    conceptLabel: string;
    gradeLevel: number;
    track?: string;
    topics?: string[];
    count: number;
    dokDistribution?: { 1?: number; 2?: number; 3?: number; 4?: number };
    allowedTypes?: DuggaQuestionType[];
    language?: string;
  }): Promise<DuggaQuestion[]> {
    checkDailyQuotaGuard();

    const dok = {
      1: params.dokDistribution?.[1] ?? Math.ceil(params.count * 0.25),
      2: params.dokDistribution?.[2] ?? Math.ceil(params.count * 0.45),
      3: params.dokDistribution?.[3] ?? Math.floor(params.count * 0.2),
      4: params.dokDistribution?.[4] ?? Math.max(0, params.count - (
        Math.ceil(params.count * 0.25) +
        Math.ceil(params.count * 0.45) +
        Math.floor(params.count * 0.2)
      )),
    };

    const allowed = params.allowedTypes ?? [
      'multiple_choice', 'true_false', 'fill_blanks',
      'short_answer', 'essay', 'ordering', 'multi_match',
    ];

    const trackLine = params.track ? `\n- **Насока:** ${params.track}` : '';
    const topicLine = params.topics?.length ? `\n- **Поврзани теми:** ${params.topics.join(', ')}` : '';

    const prompt = `Ти си стручњак за оценување по математика во македонскиот образовен систем.
Генерирај ${params.count} прашања строго поврзани со конкретниот концепт од курикулумот.

- **Концепт ID:** ${params.conceptId}
- **Концепт:** ${params.conceptLabel}
- **Разред:** ${params.gradeLevel}${trackLine}${topicLine}
- **DoK распределба:** DoK1=${dok[1]} · DoK2=${dok[2]} · DoK3=${dok[3]} · DoK4=${dok[4]}
- **Дозволени типови:** ${allowed.join(', ')}

Секое прашање мора:
1. Да го испитува точно овој концепт (не сродни концепти).
2. Да биде на разредно ниво ${params.gradeLevel}.
3. Да содржи кратко решение и совет (hint) за ученикот.

Врати САМО валиден JSON array со објекти од видот:
{
  "type": <еден од: ${allowed.join(' | ')}>,
  "dok": 1 | 2 | 3 | 4,
  "points": number,
  "text": "...",
  "options": [{"id":"a","text":"...","isCorrect":true|false}],   // само за multiple_choice/checklist
  "correctAnswer": "...",
  "solution": "...",
  "hint": "..."
}

Без markdown. ЈАЗИК: ${params.language ?? getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });

    const raw = parseGeneratedQuestionsJson(r.text);
    return raw.map((q, i) => normaliseGeneratedQuestion(q, params.conceptId, i));
  },

  // ─── S61-C5 — AI grading for `geometry_construct` questions ─────────────

  async gradeGeometryConstruction(params: {
    question: string;
    expectedDescription: string;
    studentNotes: string;
    constructionState?: string;
    rubric?: string;
    maxPoints: number;
  }): Promise<string> {
    checkDailyQuotaGuard();
    const rubricSection = params.rubric ? `\nРубрика: ${params.rubric}` : '';
    const stateSection = params.constructionState
      ? `\nGeoGebra состојба (XML/JSON): ${params.constructionState.slice(0, 4000)}`
      : '\nGeoGebra состојба: (не е достапна — оцени врз база на белешки)';
    const prompt = `Ти си македонски наставник по математика. Оцени дали ученикот ја извел правилно бараната геометриска конструкција.

Прашање: ${params.question}
Барана конструкција: ${params.expectedDescription}
Белешки на ученик: ${params.studentNotes || '(нема)'}${stateSection}${rubricSection}
Максимум поени: ${params.maxPoints}

Оцени строго но праведно (рубрика: точност на чекорите, употреба на алатки, прецизност):
1. **Поени:** X/${params.maxPoints}
2. **Точно изведени чекори** — наброј
3. **Грешки/недостатоци** — наброј
4. **Коментар** — 1-2 реченици совет

ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },

  async gradeEssayAnswer(params: {
    question: string;
    studentAnswer: string;
    rubric?: string;
    maxPoints: number;
  }): Promise<string> {
    checkDailyQuotaGuard();
    const rubricSection = params.rubric ? `\nРубрика: ${params.rubric}` : '';
    const prompt = `Ти си македонски наставник по математика. Оцени го одговорот на ученикот.

Прашање: ${params.question}
Одговор на ученик: ${params.studentAnswer}${rubricSection}
Максимум поени: ${params.maxPoints}

Оцени строго но праведно:
1. **Поени:** X/${params.maxPoints}
2. **Точни елементи** — конкретно наброј
3. **Грешки/недостатоци** — конкретно наброј
4. **Коментар** — 1-2 реченици совет

ЈАЗИК: ${getAILanguageRule()}`;

    const r = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return r.text.trim();
  },
};

// ─── S61-D1 — Helpers for parsing AI output into DuggaQuestion[] ──────────────

const VALID_TYPES: ReadonlySet<DuggaQuestionType> = new Set<DuggaQuestionType>([
  'multiple_choice', 'checklist', 'true_false', 'inline_select', 'multi_match',
  'fill_blanks', 'short_answer', 'list_items', 'essay', 'multi_part',
  'ordering', 'diagram_annotate', 'statement_eval', 'interactive_table',
  'table_completion', 'student_chart', 'function_match', 'unit_circle_pick',
  'proof_steps', 'geometry_construct', 'section_header',
]);

interface RawGeneratedQuestion {
  type?: string;
  dok?: number;
  points?: number;
  text?: string;
  options?: unknown;
  correctAnswer?: unknown;
  solution?: unknown;
  hint?: unknown;
}

export function parseGeneratedQuestionsJson(raw: string): RawGeneratedQuestion[] {
  if (!raw) return [];
  let cleaned = raw.trim();
  // strip surrounding ```json fences if the model added them anyway
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // try direct parse, else extract first array
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as RawGeneratedQuestion[];
  } catch { /* fallthrough */ }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed as RawGeneratedQuestion[];
    } catch { /* fallthrough */ }
  }
  return [];
}

export function normaliseGeneratedQuestion(
  raw: RawGeneratedQuestion,
  conceptId: string,
  index: number,
): DuggaQuestion {
  const type: DuggaQuestionType = VALID_TYPES.has(raw.type as DuggaQuestionType)
    ? (raw.type as DuggaQuestionType)
    : 'short_answer';

  const dok: DuggaDok = ([1, 2, 3, 4] as DuggaDok[]).includes(raw.dok as DuggaDok)
    ? (raw.dok as DuggaDok)
    : 2;

  const points = typeof raw.points === 'number' && Number.isFinite(raw.points) && raw.points > 0
    ? Math.round(raw.points)
    : (dok === 1 ? 1 : dok === 2 ? 2 : dok === 3 ? 4 : 6);

  const options = normaliseOptions(raw.options);

  const q: DuggaQuestion = {
    id: `gen_${conceptId}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    text: typeof raw.text === 'string' ? raw.text.trim() : '',
    dok,
    points,
    linkedConceptIds: [conceptId],
  };
  if (options) q.options = options;
  if (typeof raw.correctAnswer === 'string') q.correctAnswer = raw.correctAnswer;
  if (typeof raw.solution === 'string') q.solution = raw.solution;
  if (typeof raw.hint === 'string') q.hint = raw.hint;
  return q;
}

function normaliseOptions(raw: unknown): DuggaOption[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: DuggaOption[] = [];
  raw.forEach((o, i) => {
    if (typeof o === 'string') {
      out.push({ id: String.fromCharCode(97 + i), text: o });
    } else if (o && typeof o === 'object') {
      const obj = o as { id?: unknown; text?: unknown; isCorrect?: unknown };
      const text = typeof obj.text === 'string' ? obj.text : '';
      if (!text) return;
      out.push({
        id: typeof obj.id === 'string' && obj.id ? obj.id : String.fromCharCode(97 + i),
        text,
        ...(obj.isCorrect === true ? { isCorrect: true } : {}),
      });
    }
  });
  return out.length ? out : undefined;
}
