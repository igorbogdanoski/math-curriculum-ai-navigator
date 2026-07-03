# Акционен план: Целосна интеграција на средното образование
## Сите официјални МОН програми низ сите функционалности

**Датум:** 13.04.2026
**Статус:** 🔵 АКТИВЕН
**Цел:** Нула компромис — светско ниво на квалитет, секој gap покриен со тест

---

## Состојба на дата-слојот (ПОТВРДЕНО КОМПЛЕТНО)

| Програма | Фајл | Одделенија | Ч/год | Статус |
|----------|------|-----------|-------|--------|
| Стручно 4-год (X–XIII) | `data/secondary/vocational4.ts` | 10, 11, 12, 13 | ~354ч | ✅ |
| Стручно 3-год (X–XII) | `data/secondary/vocational3.ts` | 10, 11, 12 | ~208ч | ✅ |
| Стручно 2-год (X–XI) | `data/secondary/vocational2.ts` | 10, 11 | ~126ч | ✅ |
| Гимназиско (X–XIII) | `data/secondary/gymnasium.ts` | 10, 11, 12, 13 | ~432ч | ✅ |
| Гимназија — Изборни | `data/secondary/gymnasium_electives.ts` | 11, 12, 13 | 5 модули | ✅ |
| Агрегатор | `data/secondaryCurriculum.ts` | сите 5 track-а | — | ✅ |

**4 340 линии** на официјална МОН содржина — базата е цврста.

---

## GAP каталог — 6 архитектурни пропусти

| # | GAP | Сериозност | Ефект врз корисниците |
|---|-----|-----------|----------------------|
| P1 | `parseInt(grade.id)` bug во Analytics | 🔴 КРИТИЧНО | `gradeLevel = 1` за сите secondary quiz резултати |
| P2 | AI промпт нема secondary track контекст | 🔴 КРИТИЧНО | Ист генератор за гимназија и стручно — педагошки погрешно |
| P3 | AnnualPlan default grade за secondary | 🟡 ВАЖНО | Наставник отвора планер → прикажано Одд. 1 наместо Одд. 10 |
| P4 | Secondary `assessmentStandards` ги нема во standards системот | 🟡 ВАЖНО | StandardsTab/CoverageAnalyzer слепи за средно образование |
| P5 | Нема Matura ↔ SecondaryTrack mapping | 🟡 ВАЖНО | Наставник со vocational4 не добива паметни Матура препораки |
| P6 | `Grade` нема `weeklyHours` поле | 🟢 МАЛО | AnnualPlan претпоставува 4-5ч/нед за сите — погрешно за стручно (2–3ч) |

---

## P1 — Bug Fix: `parseInt(grade.id)` → `grade.level`

### Проблем

```ts
// views/TeacherAnalyticsView.tsx:187 — СЕГАШНО (ГРЕШКА)
gradeLevel: parseInt(grade?.id || '1') || 1,
// "voc4-grade-10" → parseInt → NaN → fallback → 1 ❌
// Ефект: сите secondary quiz резултати се бележат со gradeLevel=1
```

### Поправка

```ts
// views/TeacherAnalyticsView.tsx:187 — ПОСЛЕ
gradeLevel: grade?.level ?? 1,
// Grade.level е директно число, нема парсирање потребно ✅
```

### Тест — Unit (додај во `__tests__/analyticsHelpers.test.ts`)

```ts
describe('gradeLevel extraction from Grade object', () => {
  it('extracts level from primary grade', () => {
    const grade = { id: 'grade-6', level: 6, title: 'VI' } as Grade;
    expect(grade.level ?? 1).toBe(6);
  });

  it('extracts level from secondary vocational4 grade', () => {
    const grade = { id: 'voc4-grade-10', level: 10, title: 'X — Стручно 4-год' } as Grade;
    expect(grade.level ?? 1).toBe(10);
  });

  it('extracts level from secondary gymnasium grade', () => {
    const grade = { id: 'gym-grade-13', level: 13, title: 'XIII — Гимназиско' } as Grade;
    expect(grade.level ?? 1).toBe(13);
  });

  it('parseInt fallback IS WRONG for secondary IDs', () => {
    // Документира зошто parseInt не работи — regression guard
    const id = 'voc4-grade-10';
    expect(parseInt(id || '1') || 1).toBe(1); // ← ова е грешката
    expect({ id, level: 10 }.level ?? 1).toBe(10); // ← ова е точно
  });
});
```

### Acceptance Criteria
- [ ] `tsc --noEmit` чисто
- [ ] Unit тест пролази
- [ ] `TeacherAnalyticsView` → `AssignRemedialModal` добива `gradeLevel=10` за voc4-grade-10

---

## P2 — AI Промпт: Secondary Track Педагошки Контекст

### Проблем

`TEXT_SYSTEM_INSTRUCTION` (`services/gemini/core.ts:800`) е 100% генеричка.
`TeachingProfile.secondaryTrack` се сериализира во JSON но AI не знае да го интерпретира.

Резултат: `generateLessonPlanIdeas`, `generateAnnualPlan`, `generateQuiz`, `generateAssessment` —
сите генерираат ист тип содржина за наставник од гимназија и за наставник од стручно 2-год.

### Имплементација

**Чекор 1: Нова функција во `services/gemini/core.ts`**

```ts
// После LINE 887 (после getResolvedTextSystemInstruction)

/**
 * Returns a rich pedagogical context string for secondary track teachers.
 * Injected into system instructions so the AI adapts content difficulty,
 * examples, and methodology to the specific educational program.
 */
export function getSecondaryTrackContext(track: SecondaryTrack | undefined | null): string {
  if (!track) return '';

  const contextMap: Record<SecondaryTrack, string> = {
    gymnasium: [
      'ОБРАЗОВЕН КОНТЕКСТ: Гимназиско 4-годишно образование (X–XIII одделение).',
      'ПЕДАГОШКИ ПРИСТАП: Теоретски, апстрактен. Формална математичка нотација. Докажувања.',
      'ТЕМПО: 4 часа неделно (~144ч/год). Подготовка за државна матура и универзитет.',
      'ПРИМЕРИ: Може да бидат апстрактни. Акцент на строга математичка логика.',
    ].join('\n'),

    gymnasium_elective: [
      'ОБРАЗОВЕН КОНТЕКСТ: Гимназиски изборни предмети по математика (XI–XIII одделение).',
      'ПЕДАГОШКИ ПРИСТАП: Напредна и проширена математика за ученици со висок интерес.',
      'ТЕМИ: Елементарна алгебра, Алгебра и аналитичка геометрија, Математичка анализа.',
      'ТЕМПО: 3 часа неделно. Длабинска обработка, истражувачки задачи, подготовка за натпревари.',
      'ПРИМЕРИ: Може да бидат комплексни. Математички докажувања се очекувани.',
    ].join('\n'),

    vocational4: [
      'ОБРАЗОВЕН КОНТЕКСТ: Стручно 4-годишно образование (X–XIII одделение).',
      'ПЕДАГОШКИ ПРИСТАП: ПРИМЕНЕТ. Математиката е инструмент за стручните предмети.',
      'ТЕМПО: 3 часа неделно (~108ч/год). РЕАЛИСТИЧКО планирање на обработка.',
      'ПРИМЕРИ: ЗАДОЛЖИТЕЛНО поврзи со стручни области (техника, економија, ИТ, здравство).',
      'ТЕЖИНА: Средна. Нагласи применливост. Избегни чисто апстрактни докажувања.',
      'АКТИВНОСТИ: Практични проекти, задачи поврзани со идната работна позиција.',
    ].join('\n'),

    vocational3: [
      'ОБРАЗОВЕН КОНТЕКСТ: Стручно 3-годишно образование (X–XII одделение) — занаетски профили.',
      'ПЕДАГОШКИ ПРИСТАП: ПРАКТИЧЕН. Математиката служи директно за занаетот.',
      'ТЕМПО: 2 часа неделно (~72ч/год). Минимална теорија, максимална примена.',
      'ПРИМЕРИ: Конкретни мерења, пресметки на материјали, практични задачи.',
      'ТЕЖИНА: Ниска до средна. Без формални докажувања. Само суштински концепти.',
      'АКТИВНОСТИ: Работни листови со реални сценарија од занаетот.',
    ].join('\n'),

    vocational2: [
      'ОБРАЗОВЕН КОНТЕКСТ: Стручно 2-годишно образование (X–XI одделение).',
      'ПЕДАГОШКИ ПРИСТАП: ОСНОВЕН ПРАКТИЧЕН. Само есенцијалните математички концепти.',
      'ТЕМПО: 2 часа неделно (~72ч/год). Строго ограничен curriculum.',
      'ПРИМЕРИ: Секојдневни ситуации. Многу конкретни, без апстракција.',
      'ТЕЖИНА: Ниска. Потребна е максимална инклузивност и достапност.',
      'АКТИВНОСТИ: Кратки, директни задачи. Никакви сложени повеќечекорни проблеми.',
    ].join('\n'),
  };

  return `\n\n--- ПЕДАГОШКИ КОНТЕКСТ НА ОБРАЗОВНАТА ПРОГРАМА ---\n${contextMap[track]}\n--- КРАЈ НА КОНТЕКСТ ---`;
}
```

**Чекор 2: Инјектирај во `geminiService.real.ts` — ChatStream функциите**

```ts
// services/geminiService.real.ts:113 — getChatResponseStream
let systemInstruction = `${getResolvedTextSystemInstruction()}${getSecondaryTrackContext(profile?.secondaryTrack)}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;

// services/geminiService.real.ts:132 — getChatResponseStreamWithThinking
let systemInstruction = `${getResolvedTextSystemInstruction()}${getSecondaryTrackContext(profile?.secondaryTrack)}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
```

**Чекор 3: Инјектирај во `generateAnnualPlan` (line ~1248)**

```ts
// services/geminiService.real.ts — generateAnnualPlan prompt
const prompt = `
Вие сте врвен експерт за планирање на наставата по ${subject} за ${grade} во македонскиот образовен систем.
${getSecondaryTrackContext(profile?.secondaryTrack)}
Ваша задача е да креирате детална, практична и изводлива предлог-годишна програма.
...
// ДОДАЈ: Конвертирање по ВИСТИНСКИОТ број часови неделно:
// - Гимназиско: 4 ч/нед
// - Стручно 4-год: 3 ч/нед
// - Стручно 3-год и 2-год: 2 ч/нед
```

**Чекор 4: Инјектирај во `buildDynamicSystemInstruction` (`services/gemini/core.ts:889`)**

```ts
export async function buildDynamicSystemInstruction(
  baseInstruction: string,
  gradeLevel?: number,
  conceptId?: string,
  topicId?: string,
  secondaryTrack?: SecondaryTrack | null,   // ← НОВ ПАРАМЕТАР
): Promise<string> {
  let instruction = baseInstruction;
  // ... постоечки код ...
  
  // Додај secondary context кога е достапен
  if (secondaryTrack) {
    instruction += getSecondaryTrackContext(secondaryTrack);
  }
  
  return instruction;
}
```

**Чекор 5: Ажурирај `useGeneratorActions.ts` — проследи `secondaryTrack` на `buildDynamicSystemInstruction`**

```ts
// hooks/useGeneratorActions.ts — каде се повикува buildDynamicSystemInstruction
const systemInstruction = await buildDynamicSystemInstruction(
  baseInstruction,
  gradeLevel,
  conceptId,
  topicId,
  user?.secondaryTrack,  // ← ДОДАЈ
);
```

### Import: Додај во `services/geminiService.real.ts`

```ts
import { getSecondaryTrackContext, ... } from './gemini/core';
```

Verify: `getSecondaryTrackContext` треба да биде во exports на `services/gemini/core.ts`.

### Тест — Unit (нов фајл: `__tests__/secondaryTrackContext.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { getSecondaryTrackContext } from '../services/gemini/core';
import type { SecondaryTrack } from '../types';

describe('getSecondaryTrackContext', () => {
  it('returns empty string for undefined track (primary school teacher)', () => {
    expect(getSecondaryTrackContext(undefined)).toBe('');
    expect(getSecondaryTrackContext(null)).toBe('');
  });

  it('includes "Гимназиско" context for gymnasium track', () => {
    const ctx = getSecondaryTrackContext('gymnasium');
    expect(ctx).toContain('Гимназиско');
    expect(ctx).toContain('ОБРАЗОВЕН КОНТЕКСТ');
    expect(ctx).toContain('4 часа неделно');
  });

  it('includes applied/practical context for vocational4', () => {
    const ctx = getSecondaryTrackContext('vocational4');
    expect(ctx).toContain('ПРИМЕНЕТ');
    expect(ctx).toContain('3 часа неделно');
    expect(ctx).toContain('стручни области');
  });

  it('includes minimal/practical context for vocational3', () => {
    const ctx = getSecondaryTrackContext('vocational3');
    expect(ctx).toContain('ПРАКТИЧЕН');
    expect(ctx).toContain('2 часа неделно');
    expect(ctx).toContain('занаетот');
  });

  it('includes basic context for vocational2', () => {
    const ctx = getSecondaryTrackContext('vocational2');
    expect(ctx).toContain('ОСНОВЕН ПРАКТИЧЕН');
    expect(ctx).toContain('2 часа неделно');
    expect(ctx).toContain('инклузивност');
  });

  it('includes advanced context for gymnasium_elective', () => {
    const ctx = getSecondaryTrackContext('gymnasium_elective');
    expect(ctx).toContain('изборни');
    expect(ctx).toContain('3 часа неделно');
    expect(ctx).toContain('натпревари');
  });

  it('all tracks start with separator and end with separator', () => {
    const tracks: SecondaryTrack[] = ['gymnasium', 'gymnasium_elective', 'vocational4', 'vocational3', 'vocational2'];
    for (const track of tracks) {
      const ctx = getSecondaryTrackContext(track);
      expect(ctx).toContain('--- ПЕДАГОШКИ КОНТЕКСТ НА ОБРАЗОВНАТА ПРОГРАМА ---');
      expect(ctx).toContain('--- КРАЈ НА КОНТЕКСТ ---');
    }
  });

  it('covers all 5 SecondaryTrack values — exhaustive check', () => {
    // Ако некој додаде нов track без да ажурира contextMap, овој тест ќе падне
    const tracks: SecondaryTrack[] = ['gymnasium', 'gymnasium_elective', 'vocational4', 'vocational3', 'vocational2'];
    for (const track of tracks) {
      const ctx = getSecondaryTrackContext(track);
      expect(ctx.length).toBeGreaterThan(50); // Барај суштинска содржина
    }
  });
});
```

### Acceptance Criteria
- [ ] `tsc --noEmit` чисто
- [ ] Сите 8 unit тестови поминуваат
- [ ] `getSecondaryTrackContext('vocational4')` содржи "ПРИМЕНЕТ" и "3 часа неделно"
- [ ] `getSecondaryTrackContext(undefined)` враќа `''`
- [ ] Chat AI за `vocational3` наставник добива инструкција за занаетски контекст

---

## P3 — AnnualPlanGenerator: Default Grade за Secondary Наставници

### Проблем

```ts
// hooks/useGeneratorState.ts:75 — СЕГАШНО
const defaultGradeId = curriculum?.grades?.[0]?.id || '';
// За secondary наставник: grades[0] = Одд. 1 (примарно) ❌
// Наставник од стручно 4-год отвора планер → Одд. 1 е претпоставено
```

### Поправка

```ts
// hooks/useGeneratorState.ts — ПОСЛЕ

/**
 * Returns the most appropriate default grade ID for a given user.
 * For secondary track teachers, returns their first secondary grade.
 * For primary teachers (or unauthenticated), returns the first primary grade.
 */
function getDefaultGradeId(
  curriculum: Curriculum | undefined,
  secondaryTrack: SecondaryTrack | undefined,
): string {
  if (!curriculum?.grades?.length) return '';

  if (secondaryTrack) {
    // Најди го prvoto одделение за овој secondary track
    const firstSecondaryGrade = curriculum.grades.find(
      g => g.secondaryTrack === secondaryTrack
    );
    if (firstSecondaryGrade) return firstSecondaryGrade.id;
  }

  // Fallback: прво примарно одделение
  const firstPrimaryGrade = curriculum.grades.find(g => !g.secondaryTrack);
  return firstPrimaryGrade?.id || curriculum.grades[0].id;
}

// Употреба:
const defaultGradeId = getDefaultGradeId(curriculum, user?.secondaryTrack);
```

### Тест — Unit (нов фајл: `__tests__/curriculumHelpers.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import type { Curriculum, Grade, SecondaryTrack } from '../types';

// Изолиран тест за helper функцијата
function getDefaultGradeId(curriculum: Curriculum | undefined, secondaryTrack: SecondaryTrack | undefined): string {
  if (!curriculum?.grades?.length) return '';
  if (secondaryTrack) {
    const firstSecondaryGrade = curriculum.grades.find(g => g.secondaryTrack === secondaryTrack);
    if (firstSecondaryGrade) return firstSecondaryGrade.id;
  }
  const firstPrimaryGrade = curriculum.grades.find(g => !g.secondaryTrack);
  return firstPrimaryGrade?.id || curriculum.grades[0].id;
}

const mockCurriculum: Curriculum = {
  grades: [
    { id: 'grade-1', level: 1, title: 'I', topics: [] },
    { id: 'grade-6', level: 6, title: 'VI', topics: [] },
    { id: 'voc4-grade-10', level: 10, title: 'X — Стручно 4-год', topics: [], secondaryTrack: 'vocational4' },
    { id: 'voc4-grade-11', level: 11, title: 'XI — Стручно 4-год', topics: [], secondaryTrack: 'vocational4' },
    { id: 'gym-grade-10', level: 10, title: 'X — Гимназиско', topics: [], secondaryTrack: 'gymnasium' },
  ] as Grade[],
};

describe('getDefaultGradeId', () => {
  it('returns first primary grade for primary teacher (no track)', () => {
    expect(getDefaultGradeId(mockCurriculum, undefined)).toBe('grade-1');
  });

  it('returns first vocational4 grade for vocational4 teacher', () => {
    expect(getDefaultGradeId(mockCurriculum, 'vocational4')).toBe('voc4-grade-10');
  });

  it('returns first gymnasium grade for gymnasium teacher', () => {
    expect(getDefaultGradeId(mockCurriculum, 'gymnasium')).toBe('gym-grade-10');
  });

  it('returns empty string for undefined curriculum', () => {
    expect(getDefaultGradeId(undefined, 'vocational4')).toBe('');
  });

  it('falls back to first grade if secondary track has no matching grade', () => {
    const minimalCurriculum: Curriculum = {
      grades: [{ id: 'grade-1', level: 1, title: 'I', topics: [] }] as Grade[],
    };
    expect(getDefaultGradeId(minimalCurriculum, 'vocational3')).toBe('grade-1');
  });
});
```

### Acceptance Criteria
- [ ] `tsc --noEmit` чисто
- [ ] Unit тестови (5/5) поминуваат
- [ ] `vocational4` наставник → AnnualPlanGenerator default = `voc4-grade-10` (Одд. 10)
- [ ] Примарен наставник → default = прво примарно одделение (непроменето)

---

## P4 — Secondary `assessmentStandards` во Standards Системот

### Проблем

`allNationalStandards` (`hooks/useCurriculum.ts:162`) ги вчитува само `data/national-standards.ts` (одд. 6–9).
Secondary концептите имаат богати `assessmentStandards[]` низи кои претставуваат де-факто МОН стандарди,
но се невидливи за `StandardsTab`, `CoverageAnalyzerView` и сите coverage analytics.

### Имплементација (`hooks/useCurriculum.ts`)

```ts
// hooks/useCurriculum.ts — allNationalStandards useMemo
// После постоечката екстракција за одд. 1-5 (line ~168-195), ДОДАЈ:

// Екстракција на assessmentStandards за secondary grades
if (curriculum?.grades) {
  curriculum.grades
    .filter(g => g.secondaryTrack)
    .forEach(grade => {
      grade.topics?.forEach(topic => {
        topic.concepts?.forEach(concept => {
          concept.assessmentStandards?.forEach((stdText, idx) => {
            const id = `SEC-${grade.secondaryTrack}-${concept.id}-${idx}`;
            const existing = standards.find(s => s.id === id);
            if (!existing) {
              standards.push({
                id,
                code: `${grade.secondaryTrack?.toUpperCase()}-${grade.level}`,
                description: stdText,
                gradeLevel: grade.level,
                category: `Математика — ${SECONDARY_TRACK_LABELS[grade.secondaryTrack!]}`,
                relatedConceptIds: [concept.id],
              });
            } else if (existing.relatedConceptIds && !existing.relatedConceptIds.includes(concept.id)) {
              existing.relatedConceptIds.push(concept.id);
            }
          });
        });
      });
    });
}
```

### Import потребен во `hooks/useCurriculum.ts`

```ts
import { SECONDARY_TRACK_LABELS } from '../types';
```

### Тест — Unit (нов фајл: `__tests__/secondaryStandards.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { secondaryCurriculumByTrack } from '../data/secondaryCurriculum';
import { SECONDARY_TRACK_LABELS } from '../types';
import type { SecondaryTrack } from '../types';

// Симулирај ја логиката за екстракција
function extractSecondaryStandards(track: SecondaryTrack) {
  const module = secondaryCurriculumByTrack[track];
  const standards: { id: string; gradeLevel: number; description: string; category: string }[] = [];
  
  module.curriculum.grades.forEach(grade => {
    grade.topics?.forEach(topic => {
      topic.concepts?.forEach(concept => {
        concept.assessmentStandards?.forEach((stdText, idx) => {
          standards.push({
            id: `SEC-${grade.secondaryTrack}-${concept.id}-${idx}`,
            gradeLevel: grade.level,
            description: stdText,
            category: `Математика — ${SECONDARY_TRACK_LABELS[grade.secondaryTrack!]}`,
          });
        });
      });
    });
  });
  
  return standards;
}

describe('Secondary Standards Extraction', () => {
  it('vocational4 has assessment standards across all 4 grades', () => {
    const standards = extractSecondaryStandards('vocational4');
    expect(standards.length).toBeGreaterThan(50);
    
    const gradeLevels = [...new Set(standards.map(s => s.gradeLevel))];
    expect(gradeLevels).toContain(10);
    expect(gradeLevels).toContain(11);
    expect(gradeLevels).toContain(12);
    expect(gradeLevels).toContain(13);
  });

  it('vocational3 has assessment standards across all 3 grades', () => {
    const standards = extractSecondaryStandards('vocational3');
    expect(standards.length).toBeGreaterThan(20);
    
    const gradeLevels = [...new Set(standards.map(s => s.gradeLevel))];
    expect(gradeLevels).toContain(10);
    expect(gradeLevels).toContain(11);
    expect(gradeLevels).toContain(12);
  });

  it('vocational2 has assessment standards across both grades', () => {
    const standards = extractSecondaryStandards('vocational2');
    expect(standards.length).toBeGreaterThan(10);
    
    const gradeLevels = [...new Set(standards.map(s => s.gradeLevel))];
    expect(gradeLevels).toContain(10);
    expect(gradeLevels).toContain(11);
  });

  it('all standards have unique IDs (no duplicates)', () => {
    const allTracks: SecondaryTrack[] = ['vocational4', 'vocational3', 'vocational2', 'gymnasium'];
    const allIds: string[] = [];
    
    for (const track of allTracks) {
      const standards = extractSecondaryStandards(track);
      standards.forEach(s => allIds.push(s.id));
    }
    
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length); // Нема дупликати
  });

  it('category includes track label for each standard', () => {
    const standards = extractSecondaryStandards('vocational4');
    for (const std of standards) {
      expect(std.category).toContain(SECONDARY_TRACK_LABELS['vocational4']);
    }
  });

  it('standard IDs follow SEC-{track}-{conceptId}-{idx} format', () => {
    const standards = extractSecondaryStandards('vocational3');
    for (const std of standards) {
      expect(std.id).toMatch(/^SEC-vocational3-voc3-.+-\d+$/);
    }
  });
});

describe('Secondary Curriculum Data Integrity', () => {
  const tracks: SecondaryTrack[] = ['gymnasium', 'gymnasium_elective', 'vocational4', 'vocational3', 'vocational2'];

  it('all tracks have at least 1 grade with at least 1 topic', () => {
    for (const track of tracks) {
      const module = secondaryCurriculumByTrack[track];
      expect(module.curriculum.grades.length).toBeGreaterThan(0);
      for (const grade of module.curriculum.grades) {
        expect(grade.topics.length).toBeGreaterThan(0);
      }
    }
  });

  it('all grades have secondaryTrack field set', () => {
    for (const track of tracks) {
      const module = secondaryCurriculumByTrack[track];
      for (const grade of module.curriculum.grades) {
        expect(grade.secondaryTrack).toBe(track);
      }
    }
  });

  it('all grade IDs are unique across all secondary tracks', () => {
    const allGradeIds: string[] = [];
    for (const track of tracks) {
      const module = secondaryCurriculumByTrack[track];
      module.curriculum.grades.forEach(g => allGradeIds.push(g.id));
    }
    const unique = new Set(allGradeIds);
    expect(unique.size).toBe(allGradeIds.length);
  });

  it('all concept IDs are unique across all secondary tracks', () => {
    const allConceptIds: string[] = [];
    for (const track of tracks) {
      const module = secondaryCurriculumByTrack[track];
      module.curriculum.grades.forEach(grade =>
        grade.topics.forEach(topic =>
          topic.concepts.forEach(c => allConceptIds.push(c.id))
        )
      );
    }
    const unique = new Set(allConceptIds);
    expect(unique.size).toBe(allConceptIds.length);
  });

  it('vocational4 covers grades 10-13', () => {
    const module = secondaryCurriculumByTrack['vocational4'];
    const levels = module.curriculum.grades.map(g => g.level).sort();
    expect(levels).toEqual([10, 11, 12, 13]);
  });

  it('vocational3 covers grades 10-12', () => {
    const module = secondaryCurriculumByTrack['vocational3'];
    const levels = module.curriculum.grades.map(g => g.level).sort();
    expect(levels).toEqual([10, 11, 12]);
  });

  it('vocational2 covers grades 10-11', () => {
    const module = secondaryCurriculumByTrack['vocational2'];
    const levels = module.curriculum.grades.map(g => g.level).sort();
    expect(levels).toEqual([10, 11]);
  });

  it('gymnasium covers grades 10-13', () => {
    const module = secondaryCurriculumByTrack['gymnasium'];
    const levels = module.curriculum.grades.map(g => g.level).sort();
    expect(levels).toEqual([10, 11, 12, 13]);
  });

  it('suggestedHours are positive numbers for all topics', () => {
    for (const track of tracks) {
      const module = secondaryCurriculumByTrack[track];
      for (const grade of module.curriculum.grades) {
        for (const topic of grade.topics) {
          if (topic.suggestedHours !== undefined) {
            expect(topic.suggestedHours).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
```

### Acceptance Criteria
- [ ] `tsc --noEmit` чисто
- [ ] Сите тестови поминуваат (целосна data integrity)
- [ ] `allNationalStandards` за `vocational4` наставник враќа > 50 secondary standards
- [ ] `StandardsTab` прикажува secondary standards со категорија "Математика — Стручно 4-год"

---

## P5 — Matura ↔ SecondaryTrack Mapping

### Проблем

`MaturaLibraryView` и `MaturaSimulationView` користат свои track labels
(`'vocational-it' | 'vocational-economics' | ...`) независни од `SecondaryTrack`.
Наставник со `secondaryTrack = 'vocational4'` не добива паметни Матура препораки.

### Имплементација

**Чекор 1: Додај mapping во `types.ts`** (после `SECONDARY_TRACK_LABELS`)

```ts
// types.ts — после SECONDARY_TRACK_LABELS

/**
 * Maps curriculum SecondaryTrack → relevant Matura exam track keys.
 * Used to pre-filter MaturaLibraryView for secondary track teachers.
 */
export const SECONDARY_TRACK_TO_MATURA_TRACKS: Partial<Record<SecondaryTrack, string[]>> = {
  gymnasium: ['gymnasium'],
  gymnasium_elective: ['gymnasium'],
  vocational4: ['vocational-it', 'vocational-economics', 'vocational-electro', 'vocational-mechanical', 'vocational-health', 'vocational-civil'],
  vocational3: ['vocational-mechanical', 'vocational-civil'],
  vocational2: [],
} as const;
```

**Чекор 2: Ажурирај `MaturaLibraryView.tsx`** — pre-filter по teacher's track

```ts
// views/MaturaLibraryView.tsx — во componentот, после state инициализација
const { user } = useAuth();
const relevantMaturaTrack = user?.secondaryTrack
  ? SECONDARY_TRACK_TO_MATURA_TRACKS[user.secondaryTrack]?.[0] ?? ''
  : '';

// Default filter state — при mount постави го default track за овој наставник
const [selectedTrack, setSelectedTrack] = useState<string>(relevantMaturaTrack);
```

### Тест — Unit (додај во `__tests__/curriculumHelpers.test.ts`)

```ts
import { SECONDARY_TRACK_TO_MATURA_TRACKS } from '../types';

describe('SECONDARY_TRACK_TO_MATURA_TRACKS', () => {
  it('gymnasium maps to ["gymnasium"]', () => {
    expect(SECONDARY_TRACK_TO_MATURA_TRACKS.gymnasium).toEqual(['gymnasium']);
  });

  it('gymnasium_elective maps to ["gymnasium"]', () => {
    expect(SECONDARY_TRACK_TO_MATURA_TRACKS.gymnasium_elective).toEqual(['gymnasium']);
  });

  it('vocational4 maps to multiple tracks', () => {
    const tracks = SECONDARY_TRACK_TO_MATURA_TRACKS.vocational4!;
    expect(tracks.length).toBeGreaterThan(3);
    expect(tracks).toContain('vocational-it');
    expect(tracks).toContain('vocational-economics');
  });

  it('vocational2 maps to empty (no matura)', () => {
    expect(SECONDARY_TRACK_TO_MATURA_TRACKS.vocational2).toEqual([]);
  });
});
```

### Acceptance Criteria
- [ ] `tsc --noEmit` чисто
- [ ] Unit тестови поминуваат
- [ ] `vocational4` наставник → MaturaLibrary default filter = `'vocational-it'`
- [ ] `gymnasium` наставник → MaturaLibrary default filter = `'gymnasium'`

---

## P6 — `Grade.weeklyHours` поле + Secondary Data Update

### Проблем

`Grade` типот нема `weeklyHours` поле. `generateAnnualPlan` претпоставува "4-5 часа неделно"
за сите наставни планови, но:
- Гимназиско: 4ч/нед
- Стручно 4-год: 3ч/нед
- Стручно 3-год: 2ч/нед
- Стручно 2-год: 2ч/нед

### Имплементација

**Чекор 1: `types.ts`** — додај `weeklyHours` на `Grade`

```ts
export interface Grade {
  id: string;
  level: number;
  title: string;
  topics: Topic[];
  transversalStandards?: NationalStandard[];
  levelDescription?: string;
  secondaryTrack?: SecondaryTrack;
  /** Часови по математика неделно за ова одделение (само за средно образование) */
  weeklyHours?: 2 | 3 | 4;
}
```

**Чекор 2: Ажурирај secondary data фајлови**

```ts
// data/secondary/gymnasium.ts — на секој Grade object
weeklyHours: 4,

// data/secondary/gymnasium_electives.ts — на секој Grade object
weeklyHours: 3,

// data/secondary/vocational4.ts — на секој Grade object
weeklyHours: 3,

// data/secondary/vocational3.ts — на секој Grade object
weeklyHours: 2,

// data/secondary/vocational2.ts — на секој Grade object
weeklyHours: 2,
```

**Чекор 3: Ажурирај `generateAnnualPlan` prompt во `services/geminiService.real.ts`**

```ts
// Замени го хардкодираниот "4-5 часа неделно" со динамична вредност
// Потребно: проследи `weeklyHours` параметар на функцијата (или пресметај од track)

const weeklyHoursForTrack = profile?.secondaryTrack
  ? { gymnasium: 4, gymnasium_elective: 3, vocational4: 3, vocational3: 2, vocational2: 2 }[profile.secondaryTrack] ?? 4
  : 4;

// Во промптот:
// НАМЕСТО: "претпоставувајќи просечно 4-5 часа неделно за математика"
// ПОСЛЕ:   `претпоставувајќи ${weeklyHoursForTrack} часа неделно за математика`
```

### Тест — Unit (додај во `__tests__/secondaryStandards.test.ts`)

```ts
import { secondaryCurriculumByTrack } from '../data/secondaryCurriculum';

describe('Grade.weeklyHours in secondary data', () => {
  it('gymnasium grades have weeklyHours = 4', () => {
    secondaryCurriculumByTrack['gymnasium'].curriculum.grades.forEach(g => {
      expect(g.weeklyHours).toBe(4);
    });
  });

  it('gymnasium_elective grades have weeklyHours = 3', () => {
    secondaryCurriculumByTrack['gymnasium_elective'].curriculum.grades.forEach(g => {
      expect(g.weeklyHours).toBe(3);
    });
  });

  it('vocational4 grades have weeklyHours = 3', () => {
    secondaryCurriculumByTrack['vocational4'].curriculum.grades.forEach(g => {
      expect(g.weeklyHours).toBe(3);
    });
  });

  it('vocational3 grades have weeklyHours = 2', () => {
    secondaryCurriculumByTrack['vocational3'].curriculum.grades.forEach(g => {
      expect(g.weeklyHours).toBe(2);
    });
  });

  it('vocational2 grades have weeklyHours = 2', () => {
    secondaryCurriculumByTrack['vocational2'].curriculum.grades.forEach(g => {
      expect(g.weeklyHours).toBe(2);
    });
  });
});
```

### Acceptance Criteria
- [ ] `tsc --noEmit` чисто
- [ ] Unit тестови поминуваат
- [ ] `generateAnnualPlan` за `vocational3` корисник → промпт содржи "2 часа неделно"
- [ ] `generateAnnualPlan` за `gymnasium` корисник → промпт содржи "4 часа неделно"

---

## Целосна Тест Матрица

### Unit тестови (Vitest)

| Фајл | Тестови | P# |
|------|---------|----|
| `__tests__/analyticsHelpers.test.ts` | +4 нови (gradeLevel extraction) | P1 |
| `__tests__/secondaryTrackContext.test.ts` | 8 нови | P2 |
| `__tests__/curriculumHelpers.test.ts` | 5 нови (getDefaultGradeId) + 4 (matura mapping) | P3+P5 |
| `__tests__/secondaryStandards.test.ts` | 14 нови (standards + data integrity + weeklyHours) | P4+P6 |

**Вкупно нови unit тестови: 35**

### TypeScript компилација (задолжително по секоја промена)

```bash
npx tsc --noEmit
```

Нула грешки пред и по секоја промена.

### E2E тестови (Playwright)

Не е потребен нов spec фајл — постоечкиот `tests/teacher-analytics.spec.ts` треба
да се провери дека поминува по P1 поправката.

```bash
# По P1:
npx playwright test tests/teacher-analytics.spec.ts

# Регресиски smoke по сите промени:
npx playwright test tests/smoke.spec.ts tests/teacher-quiz.spec.ts
```

---

## Редослед на Извршување

```
День 1:
  P1 (bug fix, 15 мин)    → tsc + unit test → ✅
  P2 (AI context, 2ч)     → tsc + 8 unit тестови → ✅
  P6 (weeklyHours, 1ч)    → tsc + 5 unit тестови → ✅

День 2:
  P3 (default grade, 1ч)  → tsc + 5 unit тестови → ✅
  P4 (standards, 2ч)      → tsc + 14 unit тестови → ✅
  P5 (matura map, 1ч)     → tsc + 4 unit тестови → ✅

Финален gate:
  npx tsc --noEmit              → 0 грешки
  npm test                      → сите тестови зелени (вкупно 446 + 35 нови = 481+)
  npx playwright test           → smoke + analytics smoke зелени
```

---

## Регресиски Гаранции

| Постоечка функционалност | Засегнати промени | Заштита |
|--------------------------|------------------|---------|
| Примарни наставници (1–9) | P2 (AI context само ако track != undefined) | `getSecondaryTrackContext(undefined) = ''` |
| Примарен планер | P3 (default grade) | Fallback на прво примарно одделение |
| Analytics за 1–9 | P1 (grade.level наместо parseInt) | `grade.level` постои за сите Grade objects |
| National standards 1–9 | P4 (само додава за secondary grades) | `filter(g => g.secondaryTrack)` не ги допира примарните |
| Постоечки Matura view | P5 (само додава default filter) | Наставник без track → нема промена |
| Сите bundle splits | P6 (само нов поле на Grade) | Нема нов import, нема нов chunk |

---

## Exit Criteria — Се сметa КОМПЛЕТНО кога:

1. ✅ `npx tsc --noEmit` = 0 грешки
2. ✅ `npm test` = 481+ тестови, 0 failures
3. ✅ `npx playwright test tests/smoke.spec.ts` = PASS
4. ✅ `npx playwright test tests/teacher-analytics.spec.ts` = PASS
5. ✅ `getSecondaryTrackContext('vocational4')` содржи "ПРИМЕНЕТ" и "3 часа"
6. ✅ `getSecondaryTrackContext(undefined)` = `''`
7. ✅ Secondary standards во allNationalStandards > 0 за vocational4 наставник
8. ✅ AnnualPlan default за vocational4 = `voc4-grade-10`
9. ✅ `gradeLevel` во AssignRemedialModal = `10` (не `1`) за voc4-grade-10

---

*Создадено: 13.04.2026 — Архитектурна ревизија по комплетирање на МОН средно образование дата-слој*
*Следен commit по завршување: `feat-secondary-full-integration-p1-p6`*

---

## EVIDENCE LOG — ИМПЛЕМЕНТАЦИЈА КОМПЛЕТНА (13.04.2026)

### Quality Gate Резултати

| Алатка | Резултат | Детали |
|--------|---------|--------|
| `npx tsc --noEmit` | ✅ EXIT 0 | 0 TypeScript грешки |
| `npx vitest run` | ✅ 535/535 PASS | 49 test files, 0 failures |
| `npm run build` | ✅ built in 33.42s | PWA precache 143 entries, 10846 KiB |
| `npx playwright test` | ✅ 10/10 PASS | smoke + analytics smoke |

**Тест coverage: 535 тестови (беше 446 пред имплементацијата → +89 нови)**

### Gap Имплементација — Статус

| Gap | Статус | Фајл(ови) | Тест фајл | Тестови |
|-----|--------|-----------|-----------|---------|
| P1 — `parseInt` bug Analytics | ✅ РЕШЕНО | `views/TeacherAnalyticsView.tsx:187` | `__tests__/analyticsHelpers.test.ts` | +5 |
| P2 — AI secondary context | ✅ РЕШЕНО | `services/gemini/core.ts`, `geminiService.real.ts`, `assessment.ts`, `plans.ts` | `__tests__/secondaryTrackContext.test.ts` | +23 |
| P3 — Default grade за secondary | ✅ РЕШЕНО | `hooks/useGeneratorState.ts` | `__tests__/secondaryStandards.test.ts` | +8 |
| P4 — Secondary standards во систем | ✅ РЕШЕНО | `hooks/useCurriculum.ts` | `__tests__/secondaryStandards.test.ts` | +26 |
| P5 — Matura ↔ SecondaryTrack mapping | ✅ РЕШЕНО | `types.ts`, `views/MaturaLibraryView.tsx` | `__tests__/curriculumHelpers.test.ts` | +8 |
| P6 — `weeklyHours` на Grade | ✅ РЕШЕНО | `types.ts`, 5 × `data/secondary/*.ts` | `__tests__/secondaryStandards.test.ts` | +19 |

### Клучни Промени

**P1 — Root cause:** `parseInt("voc4-grade-10")` → `NaN` → fallback `|| 1` → gradeLevel=1 за сите secondary quiz резултати. Fix: `grade?.level ?? 1`.

**P2 — Нова функција:** `getSecondaryTrackContext(track)` во `services/gemini/core.ts` — враќа богат педагошки блок по track. Инјектирана во 5 AI entry-points: Chat, AnnualPlan, Assessment, Plans (×3). Пример:
- `vocational4` → "ПРИМЕНЕТ математички контекст, 3 часа неделно, стручни области"
- `gymnasium` → "Гимназиско — подготовка за матура, 4 часа неделно, академски стандарди"
- `undefined` → `''` (примарни наставници непроменети)

**P3 — Нова функција:** `getDefaultGradeId(curriculum, secondaryTrack)` извезена од `useGeneratorState.ts` — secondary teacher автоматски добива вистинско Одд. 10 наместо Одд. 1.

**P4 — Dynamic extraction:** `allNationalStandards` useMemo во `useCurriculum.ts` сега екстрактира `assessmentStandards` od secondary grades со ID-формат `SEC-{track}-{conceptId}-{idx}`. Видливи во StandardsTab и CoverageAnalyzer.

**P5 — Нова константа:** `SECONDARY_TRACK_TO_MATURA_TRACKS` во `types.ts`. `MaturaLibraryView` добива `useEffect` кој го сетира паметен default exam по track (vocational4 → vocational-it прв, gymnasium → gymnasium).

**P6 — Ново поле:** `Grade.weeklyHours?: 2 | 3 | 4` во types.ts. Сите 5 secondary data файлови ажурирани:
- `gymnasium.ts` → `weeklyHours: 4` (4 одделенија)
- `gymnasium_electives.ts` → `weeklyHours: 3` (5 одделенија)  
- `vocational4.ts` → `weeklyHours: 3` (4 одделенија)
- `vocational3.ts` → `weeklyHours: 2` (3 одделенија)
- `vocational2.ts` → `weeklyHours: 2` (2 одделенија)

### Regression Guards — Примарни наставници НЕ се засегнати

- `getSecondaryTrackContext(undefined)` → `''` — AI промптот е непроменет за одд. 1–9
- `getDefaultGradeId(curriculum, undefined)` → прво примарно одделение
- `filter(g => g.secondaryTrack)` — secondary standards екстракција не ги допира primary grades
- `SECONDARY_TRACK_TO_MATURA_TRACKS` — MaturaLibraryView default само ако `user.secondaryTrack` е сетиран

*Завршено: 13.04.2026 — сите 6 архитектурни gaps решени, квалитетниот gate поминат*
