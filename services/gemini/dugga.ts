import {
  DEFAULT_MODEL, SAFETY_SETTINGS, callGeminiProxy,
  checkDailyQuotaGuard, getResolvedTextSystemInstruction, getAILanguageRule,
  generateAndParseJSON, Type,
} from './core';

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
    testType: 'topic' | 'midterm' | 'annual' | 'exam';
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
