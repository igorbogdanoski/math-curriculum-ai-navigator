# Math Curriculum AI Navigator — Master Plan S54–S57
> Генерирано: 26.04.2026 | Автор: Claude Sonnet 4.6 | Статус: АКТИВЕН

---

## Контекст — Состојба по S53

### Завршени спринтови (хронолошки)
| Sprint | Опис | Commit |
|--------|------|--------|
| S21–S22 | Matura Library, Inline practice, DoK Scaffolding, Recovery worksheets | `48e208d` |
| S23 | Matura PDF import, Vision RAG contracts, OCR elevation | — |
| S34 | FunctionGrapher, Shape3D nets | — |
| S42 | Extraction Hub (image OCR, clipboard paste, language dropdown) | — |
| S43 | Quick-Generate from ExtractionHub (2-click workflow) | — |
| S44 | Tech debt + perf (MathInput, as-any cleanup, lazy matura/secondary) | — |
| S50 | Kahoot Maker v1, SRS review panel, Cognitive telemetry | `9087c41` |
| S51 | Per-question answer tracking, Post-session heatmap, CSV export | — |
| S52 | KahootMaker redesign (3 creation paths + question editor + correct answer fix) | — |
| S53 | DoK/Bloom integration (Kahoot + МакедоТест + Gamma) + secondary track context | `11b2050` |

### Тековни метрики
| TSC грешки | Tests | `as any` | `@ts-ignore` | Build |
|---|---|---|---|---|
| 0 | 1153/1153 | 0 | 0 | PASS |

### Архитектурен инвентар (по S53 аудит)
- **71 views** (React SPA, hash routing)
- **181+ компоненти** (14 контексти, 42 hooks)
- **23 AI сервис модули** (services/gemini/*)
- **4 јазици** (mk/sq/tr/en) × 366 i18n клучови
- **90+ тест фајлови**, 1153 assertions
- **Firestore**: 18 колекции, security rules per-role

---

## Експертска Оценка — Три Критични Слабости

### 1. ПЕДАГОШКИ — Feedback Loop е скршен (КРИТИЧНО)
Секој чекор на Mastery Learning постои изолирано, но **никогаш не се врзани автоматски**:

```
Постоечки состојби (изолирани):
  InteractiveQuizPlayer → score %
  generateTargetedRemedialQuiz → ако наставникот рачно одлучи
  generateRecoveryWorksheet → ако наставникот рачно одлучи
  socraticHint → само во AcademyLessonView
  StudentProgressView → статистика (не акции)

Цел (автоматски поток):
  Квиз → detectMisconceptions → MiniLesson (3 чекори) →
  VerificationMicroQuiz → ако <70%: RecoveryWorksheet →
  StudentNextStepCard (наредна акција)
```

**Impact**: Ученикот завршува квиз и не знае шта да прави. Наставникот мора рачно да ги иницира сите follow-up активности.

### 2. АРХИТЕКТОНСКИ — Монолитот расте без контрола
- 71 views, само дел lazy-loaded → bundle ќе продолжи да расте
- AI calls synchronous blocking (10-15с без streaming, без progress)
- 3 state синхронизациски механизми (BroadcastChannel + sessionStorage + Firestore)
- Firebase vendor lock-in без апстракциски слој
- Нема server-side jobs за долги AI операции

### 3. UI/UX — Нема унифициран Teacher Command Center
- HomeView покажува статистика, не акции → наставникот не знае каде да почне
- 5 критични views не се mobile-friendly
- AI loading = generic spinner без streaming/progress
- Inconsistent стилови меѓу 71 views (различни sprint-и = различен стил)
- Albanian/Turkish ученици добиваат Macedonian AI content

---

## S54 — Intelligent Teacher Dashboard
> **Траење: 2–3 дена | Приоритет: КРИТИЧНО**

### Цел
Трансформација на `HomeView.tsx` од статистика-приказ во **AI-driven Command Center** кој секоја сесија ги покажува приоритетните акции.

### Нови компоненти
```
components/home/
  ActionablePriorityCard.tsx     — AI-генерирана акциска картичка
  SmartHomeDashboard.tsx         — контејнер за приоритетни акции
  ClassHealthSummary.tsx         — состојба на класот (traffic light)
  UpcomingLessonWidget.tsx       — суtra: опфатен материјал?
  WeakConceptsActionWidget.tsx   — extends WeakConceptsWidget со акции
```

### Логика на приоритизација
```typescript
// hooks/useSmartDashboard.ts
interface ActionCard {
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  metric: string;          // "42% точност на последниот квиз"
  actions: ActionButton[]; // [Генерирај ремедијација, Прегледај]
  conceptIds: string[];
  affectedStudentCount: number;
}

// Логика:
// 1. Земи последните 30 quiz_results за класот
// 2. Групирај по concept → пресметај avg score
// 3. Концепти под 65% → ActionCard (critical)
// 4. Концепти 65–79% → ActionCard (high)  
// 5. Ученици без активност 7+ дена → ActionCard (medium)
// 6. Планирани теми без генериран материјал → ActionCard (medium)
```

### UI структура
```
┌─────────────────────────────────────────────────────────┐
│  Добродојде назад, [Наставник]                          │
│  [ClassHealthSummary: 🔴 3 критично · 🟡 5 внимание]  │
├─────────────────────────────────────────────────────────┤
│  🔴 КРИТИЧНО: 5 ученика немаат разбрано дроби          │
│  Последен квиз: 42% просечна точност на „Дроби"        │
│  [Генерирај ремедијален квиз] [Испрати recovery sheet] │
├─────────────────────────────────────────────────────────┤
│  🟡 Утре: Геометрија — нема подготвен материјал        │
│  [Генерирај лекција]  [Пребарај библиотека]            │
├─────────────────────────────────────────────────────────┤
│  🚀 3 ученика се подготвени за напредување             │
│  [Генерирај предизвик]  [Додај во Academy]             │
└─────────────────────────────────────────────────────────┘
```

### Фајлови за промена
- `views/HomeView.tsx` — замени статистика секции со `SmartHomeDashboard`
- `hooks/useSmartDashboard.ts` — нов hook (Firestore query + AI prioritization)
- `components/home/ActionablePriorityCard.tsx` — нова компонента
- `components/home/ClassHealthSummary.tsx` — нова компонента

### Прифатливост тест
- [ ] Наставникот отвора апликација → гледа ≤5 акциски картички
- [ ] Секоја картичка има 1–2 primary actions (директен генератор call)
- [ ] Картичките се пресметуваат под 2с (Firestore query + локална логика)
- [ ] Без AI call при load (чисти Firestore aggregations)

---

## S55 — Automated Student Learning Loop
> **Траење: 3–4 дена | Приоритет: КРИТИЧНО**

### Цел
Затворање на Mastery Learning feedback loop без рачна интервенција на наставникот.

### Архитектура на новиот поток
```
InteractiveQuizPlayer.onComplete(result)
  → [НОВО] analyzeMisconceptions(result.answers, questions)
       → returns: { weakConcepts: string[], misconceptions: MisconceptionItem[] }
  → if result.score < 70:
       → [НОВО] show MisconceptionExplainer (per concept, 3 чекори)
       → after Explainer: show VerificationMicroQuiz (3 прашања)
       → if verification < 70: push RecoveryTask to student's queue
  → if result.score >= 70:
       → show CelebrationScreen (streak, badge if earned)
       → suggest NextConceptCard
  → StudentNextStepCard always shown (never empty state)
```

### Нови компоненти
```
components/student/
  MisconceptionExplainer.tsx     — 3-чекорна мини-лекција per misconception
  VerificationMicroQuiz.tsx      — 3 прашања за верификација
  StudentNextStepCard.tsx        — следна препорачана акција
  LearningLoopCelebration.tsx    — completion celebration (streak, XP)
  RecoveryTaskQueue.tsx          — листа на pending recovery задачи

hooks/
  useStudentLearningLoop.ts      — orchestrира целиот поток
  useStudentNextStep.ts          — пресметува следна препорачана акција
```

### Промени на постоечки фајлови
```
components/ai/InteractiveQuizPlayer.tsx
  → onComplete добива analyzeMisconceptions() повик
  → show MisconceptionExplainer ако score < 70%

views/StudentPlayView.tsx
  → wrap quiz completion со LearningLoop component

views/StudentProgressView.tsx
  → замени статистика со StudentNextStepCard на врв
  → RecoveryTaskQueue ако има pending tasks
```

### AI генерирање
```typescript
// services/gemini/tutor.ts — нова функција
async explainMisconception(
  conceptTitle: string,
  studentAnswer: string,
  correctAnswer: string,
  gradeLevel: number,
): Promise<{ steps: string[]; visualHint?: string; commonMistake: string }>

// 3 чекори: 1) зошто е погрешно, 2) правилен пристап, 3) пример
```

### Прифатливост тест
- [ ] Ученик со <70% гледа objаснување веднаш по квиз (без клик на наставник)
- [ ] Мини-лекцијата е ≤3 чекори, на соодветен јазик
- [ ] Верификациски квиз е различни прашања (не ист квиз)
- [ ] StudentProgressView прикажува "Следно: ..." не само бројки

---

## S56 — Streaming AI + Mobile-First Redesign
> **Траење: 3–4 дена | Приоритет: ВИСОК**

### S56-A: Streaming AI responses

Тековна состојба: сите AI повици го блокираат UI 10–15 секунди со generic spinner.

```typescript
// services/gemini/core.proxy.ts — нова streaming функција
export async function streamGeminiProxy(
  payload: GeminiRequestPayload,
  onChunk: (partial: string) => void,
): Promise<void>

// Употреба во MaterialsGeneratorView:
// Наместо: const result = await geminiService.generateMaterial(...)
// setContent(result)
//
// Ново: await streamGeminiProxy(payload, chunk => {
//   setContent(prev => prev + chunk)  // real-time append
// })
```

**Views за streaming** (по приоритет):
1. `MaterialsGeneratorView` — работни листови, квизови (longest wait)
2. `TestGeneratorView` — тест генерирање
3. `LessonPlanEditorView` — AI pedagogy analysis
4. `AssistantView` — chat (можеби веќе streaming)
5. `AnnualPlanGeneratorView` — годишен план (најдолго)

### S56-B: Lazy-load сите views

```typescript
// App.tsx — сите 71 views да бидат React.lazy()
// Тековно: само ~15 se lazy
// Цел: сите views, со Suspense + SkeletonLoader fallback

// Pattern:
const HomeView = React.lazy(() => import('./views/HomeView'));
const TestGeneratorView = React.lazy(() => import('./views/TestGeneratorView'));
// ... (71 views total)
```

**Очекуван impact**: Initial bundle намалување со ~300–400kB.

### S56-C: Mobile-first redesign на 5 views

**TestGeneratorView** — стекирај panels вертикално на мобил; topics multi-select да е drawer
**ExamBuilderView** — wizard-style на мобил наместо паралелни колони
**NationalLibraryView** — bottom sheet filter на мобил
**TeacherAnalyticsView** — single-column cards на мобил, charts со scroll
**MaterialsGeneratorView** — step-by-step wizard на мобил (не accordion)

**Breakpoint стратегија**:
```css
/* Моментален паттерн: grid-cols-3 на мобил = broken */
/* Нов паттерн: */
.view-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3;
}
```

### S56-D: PWA offline support

- `vite-plugin-pwa` конфигурација за curriculum data и quiz content
- Service Worker кеширање на `/api/gemini` responses (TTL: 24ч)
- Offline banner кога нема врска (веќе постои OfflineBanner.tsx — поврзи со SW)

---

## S57 — Design System + Matura↔Curriculum Links
> **Траење: 2–3 дена | Приоритет: ВИСОК**

### S57-A: Semantic Design Tokens

```css
/* styles/tokens.css */
:root {
  /* Colors */
  --color-primary:      theme('colors.indigo.600');
  --color-primary-light: theme('colors.indigo.50');
  --color-success:      theme('colors.emerald.600');
  --color-warning:      theme('colors.amber.500');
  --color-danger:       theme('colors.red.600');

  /* Spacing */
  --space-card:         theme('spacing.6');    /* 24px */
  --space-section:      theme('spacing.8');    /* 32px */

  /* Radius */
  --radius-card:        theme('borderRadius.2xl');  /* 16px */
  --radius-button:      theme('borderRadius.xl');   /* 12px */

  /* Typography */
  --text-heading:       'font-black text-gray-900';
  --text-label:         'text-xs font-bold text-gray-500 uppercase tracking-widest';
}
```

**Примена**: Audit 10 најчесто-посетени views и замени ad-hoc Tailwind со tokens.

### S57-B: Matura ↔ Curriculum Direct Links

Секој концепт треба да покажува поврзани матурски прашања.

```typescript
// hooks/useMaturaCurriculumAlignment.ts — веќе постои!
// Само треба да се прикажи во ConceptDetailView

// ConceptDetailView.tsx — додај секција:
// "Матурски прашања за овој концепт (N)"
// → колапсибилна листа со MaturaQuestionCard компоненти
// → "Вежбај" копче → navigate('/matura-practice?conceptId=...')
```

**Тек на поврзување**:
```
Concept.id → useMaturaCurriculumAlignment → MaturaQuestion[] →
ConceptDetailView → collapsed "Матурски прашања" section →
MaturaQuestionCard (preview) → link to full practice
```

### S57-C: Micro-interactions + Celebration States

**Quiz completion celebration**:
```tsx
// components/student/LearningLoopCelebration.tsx (S55)
// Confetti за 100%, streak badge за 3+ consecutive, XP counter
```

**DoK level-up animation**:
```tsx
// Кога ученик прв пат точно одговара на DoK-3 прашање:
// Brief "Стратешко размислување!" toast со DoK badge animation
```

**Concept mastery badge**:
```tsx
// Кога concept_mastery > 80%:
// Badge "Совладано" на ConceptDetailView со timestamp
```

### S57-D: i18n AI Content Gap

Тековен проблем: AI генерира само на MK дури и кога UI е на SQ/TR.

```typescript
// services/gemini/core.instructions.ts
// buildDynamicSystemInstruction веќе го чита localStorage preferred_language
// Проблем: не сите повиковачи го поминуваат profile?.language

// Fix: додај getAILanguageRule() повик во СИТЕ 3 generation prompts
// кои моментално не го имаат (kahootGenerator, testgen генерирање)
```

---

## Редослед на имплементација

```
СЕСИЈА 1 → S54 (Dashboard Command Center)
СЕСИЈА 2 → S55 (Student Learning Loop)
СЕСИЈА 3 → S56-A + S56-B (Streaming + Lazy loading)
СЕСИЈА 4 → S56-C (Mobile redesign на 5 views)
СЕСИЈА 5 → S57-A + S57-B (Design tokens + Matura links)
СЕСИЈА 6 → S57-C + S57-D (Micro-interactions + i18n AI fix)
```

---

## Педагошки Визија — Целна состојба

```
СЕГА:   Богат алат кој педагошки умниот наставник може да го искористи.
        Ученикот добива квиз → гледа резултат → чека наставник да реагира.

ПОСЛЕ:  Интелигентен коучинг систем кој сам знае шта треба да направи.
        Ученикот добива квиз → системот веднаш му дава мини-лекција →
        верификација → следна задача. Без чекање.

        Наставникот отвора апликација → гледа 3 приоритетни акции →
        со 2 клика генерира и испраќа remediation. Без пребарување.
```

### Педагошки принципи кои ги имплементираме
| Принцип | S54 | S55 | S56 | S57 |
|---------|-----|-----|-----|-----|
| Mastery Learning (Bloom 1968) | ✓ | ✓✓ | | |
| Immediate Corrective Feedback | | ✓✓ | | |
| Spaced Repetition (Ebbinghaus) | ✓ | ✓ | | |
| Zone of Proximal Development (Vygotsky) | ✓ | ✓ | | |
| Cognitive Load Theory (Sweller) | | | ✓✓ | ✓ |
| Motivation / Self-Efficacy (Bandura) | | ✓ | | ✓✓ |
| Formative Assessment Loop | ✓✓ | ✓✓ | | |
| Curriculum Alignment (standards-based) | | | | ✓✓ |

---

## Технички Must-Do (parallel со секој sprint)

1. **Секој нов view** мора да биде `React.lazy()` — без исклучок
2. **Секој нов AI повик** мора да поминува `profile?.secondaryTrack` и `preferred_language`
3. **Секоја нова компонента** мора да има `aria-label` на сите интерактивни елементи
4. **TSC 0 грешки** и **сите постоечки тестови паст** пред секој commit
5. **Mobile breakpoint** проверка (≤390px) на секој нов view пред merge

---

*Последно ажурирање: 26.04.2026 | Следна ревизија: по завршување на S57*
