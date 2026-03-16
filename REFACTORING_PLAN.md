# Фаза Р — Refactoring Plan (Светско Ниво)

> Анализа: 16.03.2026 | Целна оценка: A (10/10) | Тековна оценка: 6.5/10
> Основата е одлична — offline, Firestore rules, PWA, архитектура се solid.
> Потребни се 3 спринта (~80 часа) за да се достигне светски стандард.

---

## СТАТУС

| Спринт | Фокус | Статус |
|--------|-------|--------|
| Р1 | Type Safety — 870 `any` + 117 `@ts-ignore` | ✅ Завршен |
| Р2 | Component Decomposition — StudentPlayView + hooks | ⬜ Не започнат |
| Р3 | Error System + Security + Tests | ⬜ Не започнат |

---

## СПРИНТ Р1 — TYPE SAFETY *(Приоритет: КРИТИЧЕН)*

**Проблем**: 870 `as any` assertions + 117 `@ts-ignore` низ целата кодна база.
**Ризик**: На национална платформа, нетипизираниот код крие runtime грешки кои TypeScript би ги фатил при компилација.

### Р1-А: Типизирај ги `useGeneratorActions` параметрите
**Файл**: `hooks/useGeneratorActions.ts` (785 линии)
**Проблем**:
```typescript
// СЕГА (лошо)
interface UseGeneratorActionsParams {
  curriculum: any;
  firebaseUser: any;
  addItem: (item: any) => void;
  getConceptDetails: (id: string) => any;
  findConceptAcrossGrades: (id: string) => any;
}

// ТРЕБА
interface UseGeneratorActionsParams {
  curriculum: Curriculum;
  firebaseUser: import('firebase/auth').User | null;
  addItem: (item: SavedQuestion | SavedMaterial) => void;
  getConceptDetails: (id: string) => ConceptDetails | undefined;
  findConceptAcrossGrades: (id: string) => { grade: Grade; topic: Topic; concept: Concept } | undefined;
}
```
**Задачи**:
- [x] Замени `curriculum: any` → `curriculum: Curriculum`
- [x] Замени `firebaseUser: any` → `User | null` (firebase/auth)
- [x] Замени `addItem: (item: any)` → `Omit<PlannerItem, 'id'>`
- [x] Замени `showModal payload: any` → `Record<string, unknown>`
- [x] Замени `getConceptDetails` return тип → `{ grade?, topic?, concept? }`
- [x] Замени `findConceptAcrossGrades` return тип → `ConceptProgression | undefined`
- [x] Бонус: 3 скриени bugs fixed (saveStudentIdentity arity, generateAssessment context, Grade.label→title)

### Р1-Б: Типизирај ги AI одговорите во `geminiService.real.ts`
**Проблем**: `data.data`, `p.bytesBase64Encoded` — пристап без type guards
**Задачи**:
- [x] `ImagenProxyResponse` интерфејс во `gemini/core.ts` — `callImagenProxy` типизиран
- [x] `generateStepByStepSolution` / `solveSpecificProblemStepByStep` — `generateAndParseJSON<any>` → конкретен тип
- [x] `generatePedagogicalRecommendations` — `generateAndParseJSON<any[]>` → inline return тип
- [x] `regenerateLessonPlanSection` — `Promise<any>` → `Promise<LessonScenario['main'] | LessonScenario['introductory']>`
- [x] `generatePresentation` — `Promise<any>` → `Promise<AIGeneratedPresentation>`
- [x] `generateParallelTest` → `generateAndParseJSON<GeneratedTest>` (претходно)
- [x] `refineMaterialJSON` → `Record<string, unknown>` (претходно)
- [x] `generateSmartQuizTitle` → `Record<string, unknown>` param (претходно)
- [x] `assessment.ts` — отстранет `(assessmentAPI as any)._tier` хак
- [x] `useDailyBrief.ts` — `(r.playedAt as any)?.toMillis?.()` → `r.playedAt?.toMillis()`
- [x] `useCurriculum.ts` — `as any` → `as unknown as Concept/Topic`

### Р1-В: Firestore reads — runtime validation со Zod
**Проблем**: `docSnap.data() as TeachingProfile` без runtime проверка
**Задачи**:
- [x] Создај `schemas/firestoreSchemas.ts` — 6 schemas + `parseFirestoreDoc` helper
- [x] Примени во `AuthContext.tsx` (TeachingProfile), `firestoreService.quiz.ts` (QuizResult, ConceptMastery, StudentGamification), `firestoreService.classroom.ts` (SchoolClass, ClassMembership)

### Р1-Г: Исклучи `@ts-ignore` — fix underlying issues
**Задачи**:
- [ ] `grep -rn "@ts-ignore\|@ts-nocheck" src/` — листа на сите 117 места
- [ ] Fixирај Top 20 по критичност (типично во views и services)
- [ ] Останатите конвертирај во `// TODO(types): описи зошто`

---

## СПРИНТ Р2 — COMPONENT DECOMPOSITION *(Приоритет: ВИСОК)*

### Р2-А: Разложи `StudentPlayView.tsx` (1,243 линии → 4 компоненти)

**Нова структура**:
```
views/StudentPlayView.tsx          (~200 линии — само оркестрација)
components/student/
  StudentOnboardingWizard.tsx      (~150 линии — wizard чекори 0-2)
  QuizContentLoader.tsx            (~100 линии — hook за loading + cache)
  QuizSessionManager.tsx           (~300 линии — reducer + session логика)
  AdaptiveHomeworkPanel.tsx        (~150 линии — homework рендерирање)
hooks/
  useStudentQuiz.ts                (~200 линии — business логика)
  useStudentIdentity.ts            (~80 линии — deviceId + onboarding state)
```

**Задачи**:
- [ ] Екстрактирај `useStudentIdentity` hook (deviceId, name wizard, class membership)
- [ ] Екстрактирај `useStudentQuiz` hook (loading, caching, offline fallback)
- [ ] Екстрактирај `StudentOnboardingWizard` компонента (линии 175-239)
- [ ] Екстрактирај `AdaptiveHomeworkPanel` компонента (линии 430-500)
- [ ] `StudentPlayView` станува тенок orchestrator — само поврзување

### Р2-Б: Разложи `useGeneratorActions.ts` (785 линии → 3 hooks)

**Нова структура**:
```
hooks/generator/
  useGeneratorAssessment.ts    (quiz, rubric, remedial генерација)
  useGeneratorVisuals.ts       (illustrations, presentations, PPTX)
  useGeneratorPlanning.ts      (learning paths, lesson plans, annual plans)
```

**Задачи**:
- [ ] Идентификувај 15 генератори и групирај ги по домен
- [ ] Екстрактирај `buildAiPersonalizationSnippet` → `utils/aiPromptUtils.ts`
- [ ] Создај `hooks/generator/index.ts` re-export за backward compatibility
- [ ] Провери дека GeneratorPanelContext сè уште работи

### Р2-В: `TeacherAnalyticsView.tsx` (886 линии → tab components)

**Задачи**:
- [ ] Провери колку tab components веќе постојат во `components/analytics/`
- [ ] Екстрактирај останатите inline табови во посебни компоненти
- [ ] Главниот view треба само: data fetching + tab routing + pagination

---

## СПРИНТ Р3 — ERROR SYSTEM + SECURITY + TESTS

### Р3-А: Structured Error System

**Создај `utils/errors.ts`**:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly userMessage: string, // МК јазик
    public readonly retryable: boolean = false
  ) { super(message); }
}

export class OfflineError extends AppError { ... }
export class QuotaError extends AppError { ... }
export class PermissionError extends AppError { ... }
export class AIServiceError extends AppError { ... }
```

**Задачи**:
- [ ] Дефинирај `ErrorCode` enum со сите casos
- [ ] Замени `throw new Error('...')` во geminiService со typed errors
- [ ] Замени `catch { /* non-fatal */ }` со `catch (e) { logger.warn(e); }`
- [ ] Додај user-facing МК пораки за секој error тип
- [ ] Создај `ErrorBoundary` компонента со retry UI

### Р3-Б: Security Hardening

**Задачи**:
- [ ] **Реактивирај Firebase App Check** во `firebaseConfig.ts`
  - Линија: `// ПРИВРЕМЕНО ОНЕВОЗМОЖЕНО ЗА ДЕБАГИРАЊЕ` — ова мора да се отстрани
  - Конфигурирај reCAPTCHA v3 за production
- [ ] **Prompt Injection Protection** — `utils/sanitizePrompt.ts`:
  ```typescript
  export function sanitizeUserInput(input: string): string {
    // Strip instruction-like patterns before embedding in AI prompts
    return input.replace(/ignore previous|system:|<\|im_start\|>/gi, '[filtered]');
  }
  ```
- [ ] Примени `sanitizeUserInput` на сите места каде кориснички имиња/текст влегуваат во prompts

### Р3-В: IndexedDB Housekeeping

**Задачи**:
- [ ] Додај `cleanupExpiredCache()` функција во `indexedDBService.ts`
  - Избриши entries постари од TTL при startup
  - Избриши entries кога IDB quota > 50MB
- [ ] Додај DB migration во `openDB`: version 2 → 3 чисти стари records
- [ ] Додај UI индикатор: „X резултати чекаат sync" кога `pendingQuizzes.length > 0`

### Р3-Г: Unit Tests за Business Logic

**Приоритет** (нема ниту еден unit test за hooks/services):
- [ ] `hooks/useCurriculum.test.ts` — concept lookup, memoization
- [ ] `hooks/useQuotaManager.test.ts` — quota exhaustion, Pacific midnight reset
- [ ] `services/geminiService.test.ts` — mock Gemini API, test error paths
- [ ] `utils/errors.test.ts` — error classification, МК messages
- [ ] Target: **80% coverage** за hooks + services

---

## АРХИТЕКТУРНИ ПРИНЦИПИ (за идните фази)

| Правило | Зошто |
|---------|-------|
| Ниту еден view > 300 линии | Single responsibility; лесно за тестирање |
| Ниту еден hook > 200 линии | Ако е поголем, треба да се подели по домен |
| 0 `as any` во нови файлови | TypeScript е нашиот safety net |
| Секој нов Firestore read → Zod parse | Runtime safety за external data |
| Секоја нова AI функција → typed input/output | Gemini може да врати unexpected formats |
| Секоја нова грешка → typed AppError со МК порака | Корисниците заслужуваат јасни пораки |

---

## МЕРИЛА ЗА УСПЕХ

| Метрика | Сега | Цел (после Р1-Р3) |
|---------|------|-----|
| `as any` / `@ts-ignore` | 870 / 117 | < 10 / 0 |
| Најголема компонента | 1,243 линии | < 300 линии |
| Unit test coverage | ~0% за hooks | > 80% |
| Firebase App Check | ❌ Оневозможен | ✅ Активен |
| Structured errors | ❌ `throw new Error('...')` | ✅ `AppError` + МК пораки |
| IndexedDB cleanup | ❌ Нема | ✅ TTL + quota guard |

---

*Документ создаден: 16.03.2026 — врз основа на детална техничка анализа*
*Следна сесија: Почни со Р1-А (`useGeneratorActions` типови)*
