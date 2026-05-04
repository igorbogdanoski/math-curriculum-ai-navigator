import {
  DEFAULT_MODEL, SAFETY_SETTINGS, callGeminiProxy,
  checkDailyQuotaGuard, getResolvedTextSystemInstruction, getAILanguageRule,
} from './core';
import type { OlympiadProblem } from '../../data/olympiad/problems';
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from '../../data/olympiad/problems';

export const olympiadAPI = {

  async gradeHandwrittenSolution(
    base64Image: string,
    mimeType: string,
    problem: OlympiadProblem,
  ): Promise<string> {
    checkDailyQuotaGuard();
    const prompt = `Ти си искусен македонски наставник по математика и судија на математички натпревари.

Задача: "${problem.title}"
Категорија: ${CATEGORY_LABELS[problem.category]}
Тежина: ${DIFFICULTY_LABELS[problem.difficulty]}
Поставка: ${problem.statement.replace(/\$/g, '')}
Точен одговор: ${problem.answer.replace(/\$/g, '')}

Ученикот го качил своето решение (слика). Оцени го решението:

1. **Точност на одговорот** (0–40 поени) — дали е точен финалниот одговор?
2. **Логика и расудување** (0–30 поени) — дали чекорите се правилно поврзани?
3. **Математичка прецизност** (0–20 поени) — дали нотацијата е правилна?
4. **Јасност и организација** (0–10 поени) — дали решението е читливо и уредно?

Потоа дај:
- **Вкупен резултат** (0–100 поени)
- **Конкретни забелешки** — зошто е одземено, ако е
- **Совет** — еден практичен совет за следниот пат
- **Охрабрување** — кратка позитивна порака

Биди конкретен и конструктивен. ЈАЗИК НА ОДГОВОР: ${getAILanguageRule()}`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } },
        ],
      }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

  async generateHint(
    problem: OlympiadProblem,
    hintLevel: 1 | 2 | 3,
  ): Promise<string> {
    checkDailyQuotaGuard();
    const levels = {
      1: 'Дај само општа насока за пристапот, без да открие конкретни чекори.',
      2: 'Дај поконкретен hint: кој концепт или формула да се примени.',
      3: 'Дај детален hint кој го покажува клучниот чекор без целосното решение.',
    };
    const prompt = `Задача (${CATEGORY_LABELS[problem.category]}, разред ${problem.grade}): ${problem.statement.replace(/\$/g, '')}

${levels[hintLevel]}

Пиши само хинтот, без воведни фрази. ЈАЗИК: ${getAILanguageRule()}`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

  async generateSimilarProblem(problem: OlympiadProblem): Promise<string> {
    checkDailyQuotaGuard();
    const prompt = `Генерирај НОВА математичка задача слична на оваа, за разред ${problem.grade}, категорија ${CATEGORY_LABELS[problem.category]}, тежина ${DIFFICULTY_LABELS[problem.difficulty]}:

Оригинал: ${problem.statement.replace(/\$/g, '')}

Барања:
- Сличен тип на размислување и концепт
- Различни бројни вредности или контекст
- Вклучи го решението и одговорот
- Форматирај: Поставка / Решение / Одговор

ЈАЗИК: ${getAILanguageRule()}`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },
};
