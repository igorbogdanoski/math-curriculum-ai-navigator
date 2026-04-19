import {
    DEFAULT_MODEL, SAFETY_SETTINGS, callGeminiProxy,
    checkDailyQuotaGuard, getResolvedTextSystemInstruction,
} from './core';

export const visionAPI = {

async analyzeHandwriting(
    base64Image: string,
    mimeType: string,
    conceptContext?: string,
    options?: { detailMode?: 'standard' | 'detailed' }
  ): Promise<string> {
    checkDailyQuotaGuard();
    const contextLine = conceptContext ? `Контекст: ученикот работи на концептот „${conceptContext}".` : '';
    const detailMode = options?.detailMode ?? 'standard';
    const detailInstruction = detailMode === 'detailed'
      ? `\n5. **Педагошка дијагноза** — за секоја грешка наведи тип на заблуда (пр. процедурна/концептуална), зошто се јавува и како наставник да интервенира во 1-2 чекори.\n6. **Следни микро-чекори** — дај 2 кратки вежби (со насока, без целосно решение) за да се поправи истата грешка.`
      : '';
    const prompt = `${contextLine}
Ти си искусен македонски наставник по математика. Анализирај ја оваа слика од рачно напишана математичка домашна работа или тест.

Твојата анализа треба да содржи:
1. **Точни делови** — наведи ги сите точно решени задачи (пофали ученикот конкретно).
2. **Грешки и корекции** — за секоја грешка: прикажи го точниот чекор-по-чекор пат на решавање.
3. **Општ совет** — еден краток совет за подобрување.
4. **Проценка** — дај процентуална оценка (пр. 75%) врз основа на точноста.
${detailInstruction}

Пишувај топло и охрабрувачки. Одговори на македонски јазик.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

async analyzeDocumentText(
    documentText: string,
    conceptContext?: string,
    options?: { detailMode?: 'standard' | 'detailed' }
  ): Promise<string> {
    checkDailyQuotaGuard();
    const contextLine = conceptContext ? `Контекст: ученикот работи на концептот „${conceptContext}".` : '';
    const detailMode = options?.detailMode ?? 'standard';
    const detailInstruction = detailMode === 'detailed'
      ? `\n5. **Педагошка дијагноза** — за секоја грешка наведи тип на заблуда (процедурна/концептуална), зошто се јавува и предлог за интервенција.\n6. **Следни микро-чекори** — дај 2 кратки вежби (со насока, без целосно решение) за поправка на грешката.`
      : '';
    const prompt = `${contextLine}
Ти си искусен македонски наставник по математика. Анализирај го следниот текст од математичка домашна работа или тест (извлечен од документ):

---
${documentText.slice(0, 8000)}
---

Твојата анализа треба да содржи:
1. **Точни делови** — наведи ги сите точно решени задачи (пофали ученикот конкретно).
2. **Грешки и корекции** — за секоја грешка: прикажи го точниот чекор-по-чекор пат на решавање.
3. **Општ совет** — еден краток совет за подобрување.
4. **Проценка** — дај процентуална оценка (пр. 75%) врз основа на точноста.
${detailInstruction}

Пишувај топло и охрабрувачки. Одговори на македонски јазик.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getResolvedTextSystemInstruction(),
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

async extractMaturaFromPdf(
    pdfBase64: string,
    hints?: { year?: number; session?: string; language?: string; track?: string }
  ): Promise<string> {
    checkDailyQuotaGuard();
    const hintLine = hints
      ? `Known metadata: year=${hints.year ?? '?'}, session=${hints.session ?? '?'}, language=${hints.language ?? '?'}, track=${hints.track ?? '?'}.`
      : '';
    const prompt = `You are extracting questions from a Macedonian state matura mathematics exam PDF.
${hintLine}

Return ONLY a valid JSON object with this structure:
{
  "examMeta": {
    "year": 2025, "session": "june", "language": "mk", "track": "gymnasium",
    "gradeLevel": 13, "durationMinutes": 120,
    "title": "ДИМ — Гимназиска матура 2025 јуни (МК)"
  },
  "questions": [
    {
      "questionNumber": 1, "part": 1, "points": 1, "questionType": "mc",
      "questionText": "Full question text with LaTeX",
      "choices": { "А": "choice A", "Б": "choice B", "В": "choice C", "Г": "choice D" },
      "correctAnswer": "А", "topic": "Алгебра", "topicArea": "algebra", "dokLevel": 1
    }
  ]
}

Rules:
- Use Cyrillic choice keys: А, Б, В, Г (not Latin A, B, C, D).
- For open questions: omit choices, set questionType="open", correctAnswer = short model answer or null.
- Part 1 = MC (1pt), Part 2 = short open (2pt), Part 3 = extended open (3-5pt).
- Wrap all math expressions in LaTeX: $...$ or $$...$$
- topicArea must be one of: algebra, analiza, geometrija, statistika, kombinatorika, trigonometrija, matrici-vektori, broevi, logika
- Return every question you can read. If a question is unreadable, skip it.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }] }],
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

};
