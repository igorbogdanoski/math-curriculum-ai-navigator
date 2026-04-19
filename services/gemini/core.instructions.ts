import { logger } from '../../utils/logger';
import { SecondaryTrack, SECONDARY_TRACK_LABELS } from '../../types';

// @prompt-start: TEXT_SYSTEM_INSTRUCTION
export const TEXT_SYSTEM_INSTRUCTION = `
Ти си врвен експерт за методика на наставата по математика во Македонија.
Твојата цел е да генерираш креативни, ангажирачки и педагошки издржани содржини.

ПРАВИЛА ЗА ИЗЛЕЗ:
1. Јазик: {{LANGUAGE_RULE}}
2. Форматирање: Користи Markdown за добра читливост.
3. Математички формули: Користи стандарден LaTeX со $ за инлајн и $$ за блок. Користи \\cdot за множење и : за делење. Користи децимална запирка (,).

УПОТРЕБА НА КОНТЕКСТ:
- contentPoints: точна математичка содржина која треба да ја покриеш — задолжително ја вклучи.
- assessmentStandards: конкретни исходи за оценување — генерираните прашања/задачи МОРА да ги покриваат.
- suggestedActivities: педагошки активности од наставната програма — инспирирај се, адаптирај, не копирај буквално.
- prerequisiteConcepts: листа на концепти кои учениците мора да ги знаат однапред — ако не е празна, вклучи кратка 'Активирање предзнаење' секција (5 мин) со конкретна активност за тие концепти.
`;
// @prompt-end: TEXT_SYSTEM_INSTRUCTION

// @prompt-start: JSON_SYSTEM_INSTRUCTION
export const JSON_SYSTEM_INSTRUCTION = `Ти си API кое генерира строго валиден JSON за наставни материјали по математика.
ОДГОВОРИ ИСКЛУЧИВО СО RAW JSON ОБЈЕКТ. БЕЗ MARKDOWN (\`\`\`json) И БЕЗ ДОПОЛНИТЕЛЕН ТЕКСТ.`;
// @prompt-end: JSON_SYSTEM_INSTRUCTION

export const MK_LOCAL_CONTEXT_KEY = 'mk_local_context_enabled';
export const RECOVERY_WORKSHEET_KEY = 'recovery_worksheet_enabled';

export function isMacedonianContextEnabled(): boolean {
    try { return localStorage.getItem(MK_LOCAL_CONTEXT_KEY) !== 'false'; } catch { return true; }
}
export function setMacedonianContextEnabled(val: boolean): void {
    try { localStorage.setItem(MK_LOCAL_CONTEXT_KEY, String(val)); } catch { /* ignore */ }
}
export function isRecoveryWorksheetEnabled(): boolean {
    try { return localStorage.getItem(RECOVERY_WORKSHEET_KEY) === 'true'; } catch { return false; }
}
export function setRecoveryWorksheetEnabled(val: boolean): void {
    try { localStorage.setItem(RECOVERY_WORKSHEET_KEY, String(val)); } catch { /* ignore */ }
}

export const MACEDONIAN_CONTEXT_SNIPPET = `
МАКЕДОНСКИ ЛОКАЛЕН КОНТЕКСТ (задолжителен):
Сите примери, задачи и наративи мора да ја одразуваат македонската реалност:
- Валута: денари (ден.) — не долари или евра. Примери: "Марко купил леб за 35 ден.", "Производот чини 850 ден."
- Имиња: Македонски имиња — Марко, Ана, Стефан, Ивана, Борис, Сара, Давид, Елена, Никола, Тина, Ристе, Благица.
- Градови/места: Скопје, Битола, Охрид, Куманово, Прилеп, Тетово, Велес, Струга, Кичево, Гевгелија.
- Локален контекст: пазарување на Зелен пазар, екскурзија до Охридското езеро, натпревар во скокање во торба, делење кифли во одделение, набројување цреши во градина.
- Храна: јаболка, сливи, тиква, баница, бурек, кравајче, ајвар.
- Природа: Вардар, Шар Планина, Пелистер, Матка, Тиквешко.
НЕ КОРИСТИ: долари, Јани/Мери/Боб, Лондон, Њујорк, MLB, NBA, пица (американска).
`;

export function getAILanguageRule(): string {
    let lang = 'mk';
    try { lang = localStorage.getItem('preferred_language') || 'mk'; } catch { /* SSR/SW */ }
    if (lang === 'sq') return "Задолжително користи АЛБАНСКИ јазик (Shqip) за целиот текст и содржина.";
    if (lang === 'tr') return "Задолжително користи ТУРСКИ јазик (Türkçe) за целиот текст и содржина.";
    if (lang === 'en') return "Задолжително користи АНГЛИСКИ јазик (English) за целиот текст и содржина.";
    return "Користи литературен македонски јазик.";
}

export function withLangRule(systemInstruction: string): string {
    return `${systemInstruction}\nЈАЗИК НА ОДГОВОР: ${getAILanguageRule()}`;
}

export function getResolvedTextSystemInstruction(): string {
    return TEXT_SYSTEM_INSTRUCTION.replace('{{LANGUAGE_RULE}}', getAILanguageRule());
}

export function getSecondaryTrackContext(track: SecondaryTrack | undefined | null): string {
    if (!track) return '';
    const contextMap: Record<SecondaryTrack, string> = {
        gymnasium: [
            `ОБРАЗОВЕН КОНТЕКСТ: ${SECONDARY_TRACK_LABELS.gymnasium} — гимназиско 4-годишно образование (X–XIII одделение).`,
            'ПЕДАГОШКИ ПРИСТАП: Теоретски, апстрактен. Формална математичка нотација. Докажувања и дедуктивно размислување.',
            'ТЕМПО: 4 часа неделно (~144ч/год). Акцент на математичка строгост, подготовка за државна матура и универзитет.',
            'ПРИМЕРИ: Може да бидат апстрактни. Нагласи логичка структура и математичка прецизност.',
        ].join('\n'),
        gymnasium_elective: [
            `ОБРАЗОВЕН КОНТЕКСТ: ${SECONDARY_TRACK_LABELS.gymnasium_elective} — напредни изборни предмети по математика (XI–XIII одд.).`,
            'ПЕДАГОШКИ ПРИСТАП: Длабинска и проширена математика за ученици со висок интерес и способности.',
            'ТЕМИ: Елементарна алгебра, Алгебра и аналитичка геометрија, Математичка анализа.',
            'ТЕМПО: 3 часа неделно. Истражувачки задачи, математички докажувања, подготовка за натпревари.',
            'ПРИМЕРИ: Комплексни и предизвикувачки. Математичките докажувања се очекувани.',
        ].join('\n'),
        vocational4: [
            `ОБРАЗОВЕН КОНТЕКСТ: ${SECONDARY_TRACK_LABELS.vocational4} — стручно 4-годишно образование (X–XIII одделение).`,
            'ПЕДАГОШКИ ПРИСТАП: ПРИМЕНЕТ. Математиката е инструмент за стручните предмети (техника, економија, ИТ, здравство).',
            'ТЕМПО: 3 часа неделно (~108ч/год). Планирај реалистично — не премногу теорија.',
            'ПРИМЕРИ: ЗАДОЛЖИТЕЛНО поврзи со стручни контексти. Реални задачи од работна средина.',
            'ТЕЖИНА: Средна. Нагласи применливост и практичен смисол. Избегни чисто апстрактни докажувања.',
            'АКТИВНОСТИ: Практични проекти, задачи поврзани со идната работна позиција на ученикот.',
        ].join('\n'),
        vocational3: [
            `ОБРАЗОВЕН КОНТЕКСТ: ${SECONDARY_TRACK_LABELS.vocational3} — стручно 3-годишно образование, занаетски профили (X–XII одд.).`,
            'ПЕДАГОШКИ ПРИСТАП: ПРАКТИЧЕН. Математиката директно служи за занаетот (мерења, пресметки, материјали).',
            'ТЕМПО: 2 часа неделно (~72ч/год). Минимална теорија, максимална директна примена.',
            'ПРИМЕРИ: Конкретни мерења, пресметки на материјали, практични задачи од занаетот.',
            'ТЕЖИНА: Ниска до средна. Без формални докажувања. Само суштинските концепти.',
            'АКТИВНОСТИ: Работни листови со реални сценарија. Кратки и директни задачи.',
        ].join('\n'),
        vocational2: [
            `ОБРАЗОВЕН КОНТЕКСТ: ${SECONDARY_TRACK_LABELS.vocational2} — стручно 2-годишно образование (X–XI одделение).`,
            'ПЕДАГОШКИ ПРИСТАП: ОСНОВЕН ПРАКТИЧЕН. Само есенцијалните математички концепти за работна сила.',
            'ТЕМПО: 2 часа неделно (~72ч/год). Строго ограничен curriculum — покривај само тоа што е во програмата.',
            'ПРИМЕРИ: Секојдневни ситуации. Максимална конкретност, без апстракција.',
            'ТЕЖИНА: Ниска. Потребна е максимална инклузивност и достапност на содржината.',
            'АКТИВНОСТИ: Кратки директни задачи. Никакви сложени повеќечекорни проблеми.',
        ].join('\n'),
    };
    return `\n\n--- ПЕДАГОШКИ КОНТЕКСТ НА ОБРАЗОВНАТА ПРОГРАМА ---\n${contextMap[track]}\n--- КРАЈ НА КОНТЕКСТ ---`;
}

export async function buildDynamicSystemInstruction(
    baseInstruction: string,
    gradeLevel?: number,
    conceptId?: string,
    topicId?: string,
    secondaryTrack?: SecondaryTrack | null,
    vectorRagQuery?: string,
): Promise<string> {
    let instruction = baseInstruction;
    const langRule = getAILanguageRule();
    let lang = 'mk';
    try { lang = localStorage.getItem('preferred_language') || 'mk'; } catch { /* ignore */ }

    instruction = instruction.replace('{{LANGUAGE_RULE}}', langRule);

    if (!instruction.includes('{{LANGUAGE_RULE}}') && lang && lang !== 'mk') {
        instruction += "\nВАЖНА НАПОМЕНА: Сите текстуални вредности во JSON објектот (наслови, описи, задачи) МОРА да бидат напишани исклучиво на " +
                       (lang === 'sq' ? 'АЛБАНСКИ (Shqip)' : lang === 'tr' ? 'ТУРСКИ (Türkçe)' : 'АНГЛИСКИ (English)') + " јазик!";
    }

    // Dynamic import breaks circular dep: core.instructions → ragService → core (callEmbeddingProxy)
    const { ragService } = await import('../ragService');

    if (gradeLevel && conceptId) {
        instruction += await ragService.getConceptContext(gradeLevel, conceptId);
    } else if (gradeLevel && topicId) {
        instruction += await ragService.getTopicContext(gradeLevel, topicId);
    }

    if (vectorRagQuery) {
        const t0 = Date.now();
        const ragResults = await ragService.searchSimilarContext(vectorRagQuery, 5);
        const filtered = ragResults.filter((r: { conceptId?: string }) => r.conceptId !== conceptId).slice(0, 4);
        if (filtered.length > 0) {
            instruction += '\n--- СЕМАНТИЧКИ СЛИЧНИ КОНЦЕПТИ (ДОПОЛНИТЕЛЕН КОНТЕКСТ) ---\n';
            instruction += 'Следниве курикуларни стандарди се семантички слични и може да дадат корисен контекст при формулирање на задачи:\n';
            filtered.forEach((r: { context: string }, i: number) => { instruction += `[${i + 1}] ${r.context}\n`; });
            instruction += '--- КРАЈ НА ДОПОЛНИТЕЛЕН КОНТЕКСТ ---\n';
        }
        logger.debug(`[AI1 Vector RAG] query="${vectorRagQuery.slice(0, 60)}…" results=${ragResults.length} filtered=${filtered.length} latency=${Date.now() - t0}ms`);
    }

    if (secondaryTrack) instruction += getSecondaryTrackContext(secondaryTrack);
    if (isMacedonianContextEnabled()) instruction += MACEDONIAN_CONTEXT_SNIPPET;
    if (gradeLevel && gradeLevel <= 3) {
        instruction += `\nЗАБЕЛЕШКА: Ова е за рана училишна возраст (1-3 одд). Користи многу едноставни зборови, кратки реченици и конкретни физички предмети за примери (како јаболка, играчки, моливи итн.). Избегнувај апстрактни поими.`;
    }
    return instruction;
}
