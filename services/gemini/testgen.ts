import {
    Type, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, SAFETY_SETTINGS, callGeminiProxy,
    checkDailyQuotaGuard, getCached, setCached, sanitizePromptInput,
} from './core';
import { getSecondaryTrackContext } from './core.instructions';
import {
    GeneratedTest, ProGeneratedTest, DifferentiatedLevel, AssessmentQuestion, AIGeneratedAssessment,
    type SecondaryTrack,
} from '../../types';
import { GeneratedTestSchema } from '../../utils/schemas';

export const testgenAPI = {

async generateParallelTest(topic: string, gradeLevel: number, questionCount: number, difficulty: 'easy' | 'medium' | 'hard', secondaryTrack?: SecondaryTrack | null): Promise<GeneratedTest> {
    const safeTopic = sanitizePromptInput(topic, 160);
    const trackKey = secondaryTrack ? `_${secondaryTrack}` : '';
    const cacheKey = `test_parallel_${safeTopic.replace(/\s+/g, '_').toLowerCase()}_g${gradeLevel}_n${questionCount}_${difficulty}${trackKey}`;
    const cached = await getCached<GeneratedTest>(cacheKey);
    if (cached) return cached;

    const gradeLevelPrompt = gradeLevel <= 3 ? 'ЗАБЕЛЕШКА: Ова е за рана училишна возраст (1-3 одд). Користи многу едноставни зборови и секојдневни предмети во текстуалните задачи.' : 'Вклучи и текстуални задачи.';
    const trackContext = getSecondaryTrackContext(secondaryTrack);
    const prompt = `${trackContext ? trackContext + '\n\n' : ''}Генерирај тест по математика за "${safeTopic}" (одделение ${gradeLevel}).\nТестот треба да има ДВЕ ГРУПИ (Група А и Група Б).\nВкупно прашања по група: ТОЧНО ${questionCount} прашања.\nВАЖНО:\n- Прашањата во Група А и Група Б мора да бидат "паралелни" (исти по тип и тежина, но со различни бројки или примери).\n- Типот на прашањето ("type") МОРА ДА БИДЕ ЕДНО ОД СЛЕДНИВЕ: "multiple-choice", "short-answer", ИЛИ "word-problem".\n- ${gradeLevelPrompt}\n- Додај "dokLevel" (1-4 Webb DoK) за секое прашање: 1=Припомнување, 2=Вештини, 3=Стратешко, 4=Проширено. Целна распределба: ~40% DoK-1, ~40% DoK-2, ~20% DoK-3.\n- МАТЕМАТИЧКИ ЗАПИС (КРИТИЧНО): Строго е забрането користење на ASCII знаци за математика! НИКОГАШ не користи '*' за множење (секогаш користи '\\cdot'). Сите математички изрази мора да бидат форматирани како чист LaTeX опкружен со '$'.\n\nВрати JSON:\n{\n  "title": "Тест по Математика: ${safeTopic}",\n  "groups": [\n    { "groupName": "Group A", "questions": [ ... ] },\n    { "groupName": "Group B", "questions": [ ... ] }\n  ]\n}`;

    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, groups: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { groupName: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, type: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.STRING }, points: { type: Type.NUMBER }, cognitiveLevel: { type: Type.STRING }, dokLevel: { type: Type.NUMBER } }, required: ['id', 'text', 'correctAnswer', 'points'] } } }, required: ['groupName', 'questions'] } } }, required: ['title', 'groups'] };

    const result = await generateAndParseJSON<GeneratedTest>([{ text: prompt }], schema, DEFAULT_MODEL, GeneratedTestSchema);
    const enrichedResult: GeneratedTest = {
        ...result, topic: safeTopic, gradeLevel, createdAt: new Date().toISOString(),
        groups: result.groups.map((g: GeneratedTest['groups'][number]) => ({
            ...g,
            questions: g.questions.map((q: GeneratedTest['groups'][number]['questions'][number]) => ({
                ...q, difficulty,
                type: q.type === 'multiple-choice' ? 'multiple-choice' : 'open-ended',
            })),
        })),
    };
    await setCached(cacheKey, enrichedResult, { type: 'test_parallel', gradeLevel, topic: safeTopic });
    return enrichedResult;
  },

async generateParallelQuestions(originalQuestions: AssessmentQuestion[]): Promise<AssessmentQuestion[]> {
    const prompt = `Дадени ти се следниве прашања од математички квиз:\n${JSON.stringify(originalQuestions, null, 2)}\n\nТвојата задача е да генерираш ПАРАЛЕЛНИ прашања (Mastery Learning).\nСекое ново прашање треба да има ИСТА ТЕЖИНА, ИСТ ОЧЕКУВАН НАЧИН НА РЕШАВАЊЕ и ИСТ ФОРМАТ како оригиналот, но со РАЗЛИЧНИ БРОЈКИ или РАЗЛИЧЕН КОНТЕКСТ.\nГенерирај точно ${originalQuestions.length} прашања.`;
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.NUMBER }, type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING } }, required: ['type', 'question', 'answer'] } };
    return generateAndParseJSON<AssessmentQuestion[]>([{ text: prompt }], schema);
  },

async refineMaterialJSON(originalMaterial: Record<string, unknown>, tweakInstruction: string, _materialType?: string): Promise<Record<string, unknown>> {
    const safeInstruction = sanitizePromptInput(tweakInstruction, 700);
    const prompt = `You are an expert educational AI assistant.\n\nThe teacher has already generated the following educational material (in JSON format):\n\`\`\`json\n${JSON.stringify(originalMaterial, null, 2)}\n\`\`\`\n\nThe teacher wants to modify/refine this material with the following instructional request:\n"${safeInstruction}"\n\nPlease modify the JSON to incorporate exactly what the teacher requested.\nIMPORTANT: You must return the updated material EXACTLY in the same generic JSON schema/structure as the input. Return ONLY the raw JSON object.`;
    try {
      const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' }, systemInstruction: 'You are a helpful AI that strictly outputs valid JSON that matches the format of the provided input document, just with modified values based on the prompt.', safetySettings: SAFETY_SETTINGS });
      return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      const { logger } = await import('../../utils/logger');
      logger.error('Refine material error:', e);
      throw e;
    }
  },

async generateAdaptiveHomework(conceptTitle: string, gradeLevel: number, percentage: number, misconceptions?: { question: string; studentAnswer: string; misconception: string }[], profile?: import('../../types').TeachingProfile): Promise<import('../../types').AdaptiveHomework> {
    checkDailyQuotaGuard();
    const level = percentage < 60 ? 'remedial' : percentage < 80 ? 'standard' : 'challenge';
    const levelLabel = level === 'remedial' ? 'Ремедијална' : level === 'standard' ? 'Стандардна' : 'Предизвик';
    const difficultyInstruction = level === 'remedial' ? 'лесни задачи со чекор-по-чекор помош (hint). Задачите треба да ги покриваат истите концепти каде ученикот греши, со помали бројки и поедноставен контекст.' : level === 'standard' ? 'средно тешки задачи. Мешај директна примена и мал трансфер. Hint само за 2 задачи.' : 'предизвик задачи — нови контексти, примена на концептот на нов начин, проширување. Без hints.';
    const misconceptionContext = misconceptions && misconceptions.length > 0 ? `\nУченикот специфично греши кај:\n${misconceptions.slice(0, 3).map(m => `- „${m.question}" → дал „${m.studentAnswer}" (грешка: ${m.misconception})`).join('\n')}` : '';
    const prompt = `Генерирај адаптивна домашна задача за ученик ${gradeLevel}. одделение.\nКонцепт: „${conceptTitle}"\nРезултат на квизот: ${percentage}%\nНиво на домашна: ${levelLabel}${misconceptionContext}\n\nГенерирај точно 5 ${difficultyInstruction}\n\nВрати JSON со conceptTitle, gradeLevel, level, levelLabel, encouragement, exercises (5 задачи со number, problem, hint).`;
    const schema = { type: Type.OBJECT, properties: { conceptTitle: { type: Type.STRING }, gradeLevel: { type: Type.INTEGER }, level: { type: Type.STRING }, levelLabel: { type: Type.STRING }, encouragement: { type: Type.STRING }, exercises: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { number: { type: Type.INTEGER }, problem: { type: Type.STRING }, hint: { type: Type.STRING } }, required: ['number', 'problem'] } } }, required: ['conceptTitle', 'gradeLevel', 'level', 'levelLabel', 'encouragement', 'exercises'] };
    return generateAndParseJSON<import('../../types').AdaptiveHomework>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier);
  },

async generateTargetedRemedialQuiz(conceptTitle: string, misconceptions: { text: string; count: number }[], gradeLevel: number): Promise<{ title: string; type: 'QUIZ'; questions: AssessmentQuestion[] }> {
    checkDailyQuotaGuard();
    const topMisc = misconceptions.slice(0, 4).map((m, i) => `${i + 1}. „${m.text}" (${m.count} ученик${m.count === 1 ? '' : 'и'})`).join('\n');
    const prompt = `Си искусен наставник по математика. Генерирај ремедијален квиз за ${gradeLevel}. одделение за концептот „${conceptTitle}".\n\nИдентификувани концептуални грешки кај учениците:\n${topMisc}\n\nГенерирај точно 6 прашања со повеќекратен избор (4 опции) кои ДИРЕКТНО ги адресираат овие грешки. Прашањата да бидат јасни, со македонска терминологија и математички точни.`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.INTEGER }, type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, cognitiveLevel: { type: Type.STRING }, difficulty_level: { type: Type.STRING } }, required: ['id', 'type', 'question', 'options', 'answer', 'cognitiveLevel'] } } }, required: ['title', 'questions'] };
    const result = await generateAndParseJSON<{ title: string; questions: AssessmentQuestion[] }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    return { title: result.title || `Ремедијација: ${conceptTitle}`, type: 'QUIZ', questions: result.questions };
  },

async generateRecoveryWorksheet(conceptTitle: string, misconceptions: { text: string; count: number }[], gradeLevel: number): Promise<AIGeneratedAssessment> {
    checkDailyQuotaGuard();
    const topMisc = misconceptions.slice(0, 5).map((m, i) => `${i + 1}. „${m.text}" (${m.count} ученик${m.count === 1 ? '' : 'и'})`).join('\n');
    const prompt = `Си искусен наставник по математика. Генерирај recovery worksheet за ${gradeLevel}. одделение за концептот „${conceptTitle}".\n\nИдентификувани концептуални грешки кај учениците:\n${topMisc}\n\nБарања:\n- Генерирај точно 6 прашања.\n- Формат: работен лист со поддршка, не класичен тест.\n- Прашањата да бидат постепени: од препознавање грешка, преку водена корекција, до самостојна примена.\n- За секое прашање врати и кратко решение или насока во полето solution.\n- Користи јасна македонска терминологија и математички точна нотација.`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.INTEGER }, type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, cognitiveLevel: { type: Type.STRING }, difficulty_level: { type: Type.STRING } }, required: ['id', 'type', 'question', 'answer', 'cognitiveLevel'] } } }, required: ['title', 'questions'] };
    const result = await generateAndParseJSON<{ title: string; questions: AssessmentQuestion[] }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    return { title: result.title || `Recovery Worksheet: ${conceptTitle}`, type: 'WORKSHEET', questions: result.questions };
  },

async generateDifferentiatedTest(topics: string[], gradeLevel: number, levels: DifferentiatedLevel[]): Promise<ProGeneratedTest> {
    const { PRO_MODEL } = await import('./core');
    const topicStr = topics.join(', ');
    const levelDesc = levels.map(l => `Ниво ${l.level} (${l.bloomLabel}, ${l.pointsPerTask}п): ${l.taskCount} задачи`).join('\n');
    const prompt = `Генерирај диференцирана ПИСМЕНА РАБОТА по математика за одделение ${gradeLevel}.\nТеми: ${topicStr}\n\nСТРУКТУРА (3 нивоа по Bloom):\n${levelDesc}\n\nПравила:\n- ДВЕ ГРУПИ (А и Б): паралелни задачи, различни бројки\n- LaTeX за сите математички изрази: $...$\n- Секоја задача носи точниот број поени наведен за нивото\n\nВрати JSON со title, rubric, groups [{groupName, questions}].`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, rubric: { type: Type.STRING }, groups: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { groupName: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, type: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.STRING }, points: { type: Type.NUMBER }, cognitiveLevel: { type: Type.STRING } }, required: ['id', 'text', 'correctAnswer', 'points'] } } }, required: ['groupName', 'questions'] } } }, required: ['title', 'groups'] };
    const result = await generateAndParseJSON<{ title: string; rubric?: string; groups: GeneratedTest['groups'] }>([{ text: prompt }], schema, PRO_MODEL);
    return { ...result, model: 'differentiated', topics, gradeLevel, topic: topicStr, levels, rubric: result.rubric, createdAt: new Date().toISOString() };
  },

async generateMasteryTest(topics: string[], gradeLevel: number, questionCount: number, masteryThreshold = 80): Promise<ProGeneratedTest> {
    const { PRO_MODEL } = await import('./core');
    const topicStr = topics.join(', ');
    const prompt = `Генерирај тест по МОДЕЛ НА МАСТЕРИ (Bloom, 1968) за математика, одделение ${gradeLevel}.\nТеми: ${topicStr}\nБрој прашања: ${questionCount} (по група А и Б)\nПраг на мастери: ${masteryThreshold}%\n\nПедагошки принципи:\n- 60% прашања = базично владеење\n- 30% прашања = примена во нов контекст\n- 10% прашања = трансфер/проблем (бонус)\n- ДВЕ ГРУПИ (А и Б): паралелни задачи\n- LaTeX за сите математички изрази: $...$\n\nВрати JSON со title, rubric, groups [{groupName, questions}].`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, rubric: { type: Type.STRING }, groups: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { groupName: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, type: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.STRING }, points: { type: Type.NUMBER }, cognitiveLevel: { type: Type.STRING } }, required: ['id', 'text', 'correctAnswer', 'points'] } } }, required: ['groupName', 'questions'] } } }, required: ['title', 'groups'] };
    const result = await generateAndParseJSON<{ title: string; rubric?: string; groups: GeneratedTest['groups'] }>([{ text: prompt }], schema, PRO_MODEL);
    return { ...result, model: 'mastery', topics, gradeLevel, topic: topicStr, masteryThreshold, rubric: result.rubric, createdAt: new Date().toISOString() };
  },

async extractTestQuestions(input: { kind: 'image' | 'pdf'; base64: string; mimeType: string } | { kind: 'text'; text: string }): Promise<Array<{ text: string; correctAnswer: string; points: number }>> {
    const { ULTIMATE_MODEL } = await import('./core');
    const prompt = `Анализирај го овој тест документ и извлечи ги сите прашања со нивните точни одговори.\n\nВрати JSON во форматот:\n{ "questions": [ { "text": "Текст на прашањето", "correctAnswer": "Точниот одговор", "points": 10 } ] }\n\nПравила:\n- "text": целиот текст на прашањето (без бројот/редниот број)\n- "correctAnswer": точниот одговор, решението или клучниот чекор\n- "points": поени ако се видливи во документот, инаку 10\n- Ако документот е тест без точни одговори, ставај "correctAnswer": ""\n- Не додавај ништо надвор од JSON`;

    const attempt = async () => {
      let result;
      if (input.kind === 'text') {
        result = await callGeminiProxy({ model: ULTIMATE_MODEL, skipTierOverride: true, contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n---\n${input.text.slice(0, 8000)}\n---` }] }], generationConfig: { responseMimeType: 'application/json' } });
      } else {
        result = await callGeminiProxy({ model: ULTIMATE_MODEL, skipTierOverride: true, contents: [{ role: 'user', parts: [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } });
      }
      const parsed = JSON.parse(result.text || '{}') as { questions?: unknown };
      if (!Array.isArray(parsed.questions)) throw new Error('Невалиден формат');
      return (parsed.questions as Array<Record<string, unknown>>).map((q, i) => ({
        text: String(q.text ?? `Прашање ${i + 1}`).trim(),
        correctAnswer: String(q.correctAnswer ?? '').trim(),
        points: Number.isFinite(Number(q.points)) && Number(q.points) > 0 ? Number(q.points) : 10,
      })).filter(q => q.text.length > 0);
    };

    try { return await attempt(); } catch { return await attempt(); }
  },

async gradeTestWithVision(imageBase64: string, mimeType: string, testQuestions: Array<{ id: string; text: string; points: number; correctAnswer: string }>): Promise<{ questionId: string; earnedPoints: number; maxPoints: number; feedback: string; misconception?: string; correctionHint?: string; confidence?: number }[]> {
    const { PRO_MODEL } = await import('./core');
    const questionsStr = testQuestions.map((q, i) => `${i + 1}. [${q.points}п] ${q.text} → Точен одговор: ${q.correctAnswer}`).join('\n');
    const prompt = `Си наставник по математика. Прегледај ја сликата на пишаниот тест на ученикот.\n\nПрашања и точни одговори:\n${questionsStr}\n\nЗа секое прашање:\n1. Прочитај го одговорот на ученикот од сликата\n2. Спореди го со точниот одговор\n3. Дај поени (0 до max) и кратка повратна информација на македонски\n4. Ако постои типична грешка (misconception), наведи ја накратко\n5. Ако одговорот е делумно или целосно погрешен, дај correctionHint (1 реченица на македонски)\n6. confidence: веројатност дека правилно ја прочитал рачно напишаниот одговор (0.0–1.0)\n\nВрати JSON:\n{ "grades": [ { "questionId": "1", "earnedPoints": X, "maxPoints": Y, "feedback": "...", "misconception": "...", "correctionHint": "...", "confidence": 0.9 } ] }`;

    const normalizeGradeRows = (raw: unknown) => {
      if (!Array.isArray(raw)) return null;
      const normalized = raw.map((row) => {
        const item = row as Record<string, unknown>;
        return { questionId: String(item.questionId ?? ''), earnedPoints: Number(item.earnedPoints), maxPoints: Number(item.maxPoints), feedback: String(item.feedback ?? ''), misconception: item.misconception ? String(item.misconception) : undefined, correctionHint: item.correctionHint ? String(item.correctionHint) : undefined, confidence: item.confidence !== undefined ? Number(item.confidence) : undefined };
      });
      const valid = normalized.every(g => g.questionId.length > 0 && Number.isFinite(g.earnedPoints) && Number.isFinite(g.maxPoints) && g.maxPoints >= 0 && g.earnedPoints >= 0 && g.earnedPoints <= g.maxPoints && g.feedback.trim().length > 0);
      return valid ? normalized : null;
    };

    const attempt = async (attemptPrompt: string) => {
      const result = await callGeminiProxy({ model: PRO_MODEL, skipTierOverride: true, contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: attemptPrompt }] }], generationConfig: { responseMimeType: 'application/json' } });
      const parsed = JSON.parse(result.text || '{}') as { grades?: unknown };
      const rows = normalizeGradeRows(parsed.grades);
      if (!rows) throw new Error('Невалиден формат на оценување од AI.');
      if (rows.length !== testQuestions.length) throw new Error(`Некомплетно оценување: добиени ${rows.length}/${testQuestions.length} прашања.`);
      return rows;
    };

    try {
      return await attempt(prompt);
    } catch {
      const strictPrompt = `${prompt}\n\nКРИТИЧНО:\n- Врати ИСКЛУЧИВО валиден JSON објект.\n- Полето grades мора да содржи точно ${testQuestions.length} елементи.`;
      try { return await attempt(strictPrompt); }
      catch (retryError) { throw new Error((retryError as Error).message || 'AI оценувањето не врати валиден резултат. Обидете се повторно.'); }
    }
  },

};
