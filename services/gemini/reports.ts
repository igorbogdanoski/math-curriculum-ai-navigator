import {
    Type, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, SAFETY_SETTINGS, callGeminiProxy,
    checkDailyQuotaGuard, sanitizePromptInput, withLangRule, buildDynamicSystemInstruction, JSON_SYSTEM_INSTRUCTION,
} from './core';
import type { AIGeneratedWorkedExample, SecondaryTrack } from '../../types';
import { DailyBriefSchema, WorkedExampleSchema } from '../../utils/schemas';

export const reportsAPI = {

async generateParentReport(
    studentName: string,
    results: Array<{ quizTitle: string; percentage: number; conceptId?: string }>,
    mastery: Array<{ conceptTitle?: string; conceptId: string; mastered: boolean; bestScore: number; attempts: number }>
  ): Promise<string> {
    const mastered = mastery.filter(m => m.mastered);
    const struggling = mastery.filter(m => !m.mastered && m.attempts > 0).sort((a, b) => a.bestScore - b.bestScore);
    const totalQuizzes = results.length;
    const avgPct = totalQuizzes > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalQuizzes) : 0;
    const passed = results.filter(r => r.percentage >= 70).length;
    const safeStudentName = sanitizePromptInput(studentName, 80);

    const prompt = `Ти си педагошки советник. Напиши кратко (5-7 параграфи), топло и охрабрувачко родителско писмо на македонски јазик за ученикот „${safeStudentName}".

Податоци за учениковите перформанси:
- Вкупно одиграни квизови: ${totalQuizzes}
- Положени (≥70%): ${passed}/${totalQuizzes}
- Просечен резултат: ${avgPct}%
- Совладани концепти (${mastered.length}): ${mastered.map(m => m.conceptTitle || m.conceptId).join(', ') || 'Нема'}
- Области кои треба подобрување (${struggling.length}): ${struggling.slice(0, 5).map(m => `${m.conceptTitle || m.conceptId} (${m.bestScore}%)`).join(', ') || 'Нема'}

Структура на писмото:
1. Поздравен пасус до родителот
2. Силни страни на ученикот — пофали конкретни совладани концепти
3. Области кои треба работа — деликатно, без критика
4. Конкретни препораки за учење дома (2-3 совети)
5. Охрабрувачки заклучок

Тон: топол, стручен, позитивен. НЕ употребувај клише. Пишувај конкретно.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: withLangRule('Ти си педагошки советник кој пишува родителски извештаи.'),
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

async generateDailyBrief(stats: {
    totalQuizzes: number;
    weakConcepts: { conceptId?: string; title: string; avg: number; count: number }[];
    strugglingCount: number;
  }): Promise<{ summary: string; priority: 'high' | 'medium' | 'low'; primaryAction?: { label: string; conceptId?: string; conceptTitle?: string } }> {
    checkDailyQuotaGuard();
    const weakList = stats.weakConcepts.slice(0, 3).map(c => `„${c.title}" (просек ${c.avg}%, ${c.count} обиди)`).join('; ');
    const contents = [{ text:
      `Ти си педагошки асистент. Генерирај КРАТКО дневно резиме за наставник.
ПОДАТОЦИ ОД ПОСЛЕДНИТЕ 48 ЧАСА:
- Решени квизови: ${stats.totalQuizzes}
- Слаби концепти (avg<70%): ${weakList || 'Нема'}
- Ученици со avg<50%: ${stats.strugglingCount}

Врати JSON по оваа структура:
{
  "summary": "<2-3 реченици на македонски. Конкретно: кои концепти, колку ученици, акциска препорака за денес>",
  "priority": "<high ако avg<60% или strugglingCount>3, medium ако avg<70%, иначе low>",
  "primaryAction": { "label": "<кратка акциска реченица>", "conceptId": "<id или null>", "conceptTitle": "<наслов или null>" }
}` }];
    const schema = { type: 'object', properties: { summary: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] }, primaryAction: { type: 'object', properties: { label: { type: 'string' }, conceptId: { type: 'string' }, conceptTitle: { type: 'string' } } } }, required: ['summary', 'priority'] };
    return generateAndParseJSON<{ summary: string; priority: 'high' | 'medium' | 'low'; primaryAction?: { label: string; conceptId?: string; conceptTitle?: string } }>(contents, schema, DEFAULT_MODEL, DailyBriefSchema);
  },

async generateQuizFeedback(
    studentName: string,
    percentage: number,
    conceptTitle: string,
    correctCount: number,
    totalQuestions: number,
    misconceptions?: { question: string; studentAnswer: string; misconception: string }[],
  ): Promise<string> {
    checkDailyQuotaGuard();
    const safeStudentName = sanitizePromptInput(studentName, 80);
    const wrongParts = misconceptions?.slice(0, 2).map(m =>
      `- Прашање: "${sanitizePromptInput(m.question, 200)}" → Одговорено: "${sanitizePromptInput(m.studentAnswer, 100)}"`
    ).join('\n') ?? '';
    const toneHint = percentage >= 80
      ? 'Тонот е позитивен и охрабрувачки — ученикот се справил одлично.'
      : percentage >= 60 ? 'Тонот е поддржувачки — ученикот е на добар пат, но треба уште вежбање.'
      : 'Тонот е топол и поддржувачки — ученикот треба помош, не критика.';
    const prompt = `Ученикот ${safeStudentName} завршил квиз за концептот „${conceptTitle}".\nРезултат: ${correctCount}/${totalQuestions} (${percentage}%).\n${wrongParts ? `Грешни прашања:\n${wrongParts}\n` : ''}${toneHint}\n\nНапиши САМО 2-3 реченици персонализирана повратна информација на македонски јазик.\nБиди конкретен: спомни го концептот и дај еден практичен совет за подобрување.\nНЕ започнувај со „Здраво", „Браво" или генерички пофалби. Биди директен и корисен.`;
    const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], systemInstruction: withLangRule('Ти си пријателски педагог кој дава кратки, конкретни повратни информации.'), safetySettings: SAFETY_SETTINGS, generationConfig: { maxOutputTokens: 150 } });
    return response.text.trim();
  },

async generateWorkedExample(conceptTitle: string, gradeLevel: number, secondaryTrack?: SecondaryTrack): Promise<AIGeneratedWorkedExample> {
    checkDailyQuotaGuard();
    const schema = {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING }, gradeLevel: { type: Type.INTEGER },
        steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phase: { type: Type.STRING }, title: { type: Type.STRING }, problem: { type: Type.STRING }, solution: { type: Type.ARRAY, items: { type: Type.STRING } }, partialPlaceholder: { type: Type.STRING } }, required: ['phase', 'title', 'problem'] } },
      },
      required: ['concept', 'gradeLevel', 'steps'],
    };
    const gradeLabel = gradeLevel >= 10
      ? `${gradeLevel === 10 ? 'X' : gradeLevel === 11 ? 'XI' : gradeLevel === 12 ? 'XII' : 'XIII'} одделение`
      : `${gradeLevel}. одделение`;
    const prompt = `Креирај Worked Example со Scaffolded Fading за концептот „${conceptTitle}", ${gradeLabel}.\n\nВрати JSON со точно 3 чекори (steps):\n\n1. phase: "solved" — Целосно решен пример (I do):\n   - Задача со реални македонски бројки\n   - solution: низа од 4-6 чекори, секој чекор е 1 реченица + пресметка\n   - title: „Погледни — решено заедно"\n\n2. phase: "partial" — Делумно решен пример (We do):\n   - Иста или слична структура на задача\n   - solution: само првите 2-3 чекори се дадени\n   - partialPlaceholder: „Твој ред — заврши го решението"\n   - title: „Заврши го ти"\n\n3. phase: "quiz" — Самостојна задача (You do):\n   - Нова задача, ист концепт, без помош\n   - title: „Самостојно!"\n   - НЕ давај solution\n\nСите текстови на македонски јазик. Задачите мора да се математички точни.`;
    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, gradeLevel, undefined, undefined, secondaryTrack);
    return generateAndParseJSON<AIGeneratedWorkedExample>([{ text: prompt }], schema, DEFAULT_MODEL, WorkedExampleSchema, MAX_RETRIES, false, systemInstr);
  },

async generateStudentNarrative(
    studentName: string,
    masteredCount: number,
    avgPercentage: number,
    totalQuizzes: number,
    topConcepts: string[],
    weakConcepts: string[],
    metacognitiveNotes: string[],
  ): Promise<string> {
    checkDailyQuotaGuard();
    const safeStudentName = sanitizePromptInput(studentName, 80);
    const notesSample = metacognitiveNotes.slice(0, 3).map(n => `"${sanitizePromptInput(n, 200)}"`).join('; ');
    const prompt = `Напиши кратка (3–4 параграфи) персонализирана нарација за учениковото портфолио на македонски јазик.\n\nУченик: ${safeStudentName}\nСовладани концепти: ${masteredCount}\nПросечен резултат: ${Math.round(avgPercentage)}%\nВкупно квизови: ${totalQuizzes}\nНајдобри концепти: ${topConcepts.slice(0, 3).join(', ') || 'нема'}\nКонцепти за подобрување: ${weakConcepts.slice(0, 2).join(', ') || 'нема'}\n${notesSample ? `Рефлексивни белешки на ученикот: ${notesSample}` : ''}\n\nСтруктура:\n1. Општа оценка на напредокот\n2. Силни страни (кои концепти се совладани добро)\n3. Области за раст (со конкретен совет)\n4. Охрабрување и следен чекор\n\nПишувај топло, конкретно и мотивирачки. НЕ пишувај „Здраво" или формален поздрав.`;
    const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], systemInstruction: withLangRule('Ти си педагог кој пишува персонализирани нарации за ученичко портфолио.'), safetySettings: SAFETY_SETTINGS, generationConfig: { maxOutputTokens: 400 } });
    return response.text.trim();
  },

};
