# S58 — Closing the Gaps Action Plan
> Генерирано: 26.04.2026 | После: S54–S57 Master Plan | Статус: ГОТОВ ЗА РЕАЛИЗАЦИЈА

---

## Контекст — Зошто S58?

По завршување на S54–S57, експертскиот аудит идентификува **gap меѓу "дефинирано" и "применето"**:

| Gap | Проблем | Impact |
|-----|---------|--------|
| Streaming UI не е поврзано | `streamGeminiProxy` постои, но 0 generators го користат | Корисниците чекаат 10–15с без feedback |
| VerificationMicroQuiz скипнат | S55 loop скока директно на NextStep без верификација | Педагошки incomplete Mastery loop |
| Design tokens неприменети | `--spacing-card`, `--radius-card` итн. постојат само во `app.css` | 71 views со ad-hoc класи |
| 3 mobile views не се поправени | NationalLibraryView, ExamBuilderView, MaterialsGeneratorView | Broken mobile UX |
| i18n AI gap делумно | Само kahootGenerator поправен; tutor.ts, testgen, scenario итн. сè уште МК | Albanian/Turkish ученици добиваат МК AI content |

---

## Приоритетен редослед — 3 сесии

```
СЕСИЈА S58-A → Streaming UI (MaterialsGeneratorView + AssistantView)
СЕСИЈА S58-B → VerificationMicroQuiz + i18n AI gap (сите services)
СЕСИЈА S58-C → Design tokens на 5 views + 3 mobile views
```

---

## S58-A — Streaming UI (Највисок ROI)
> **Траење: 1 сесија | Приоритет: КРИТИЧНО**

### Цел
Поврзи `streamGeminiProxy` на двата најчесто-користени генератори. Корисниците треба да гледаат текст кој се пишува во реално-време наместо spinner.

### Фајлови

**1. `views/MaterialsGeneratorView.tsx`** — главен генератор (работни листови, квизови, etc.)

```typescript
// СЕГА (блокира UI 10-15с):
const result = await geminiService.generateMaterial(params);
setGeneratedContent(result);

// НОВО (streaming — текстот се пишува во реално-време):
import { streamGeminiProxy } from '../services/gemini/core.proxy';

setIsStreaming(true);
setGeneratedContent('');
await streamGeminiProxy({ model, contents, systemInstruction }, chunk => {
  setGeneratedContent(prev => prev + chunk);
});
setIsStreaming(false);
```

**UI промени во MaterialsGeneratorView:**
- Додај `isStreaming: boolean` state
- Кога `isStreaming`:  наместо spinner покажи `StreamingIndicator` (мала анимирана точка + "AI пишува…")
- Постепено append на текстот (стриминг ефект)
- Disable генерира копче за време на streaming

**2. `components/ai/StreamingIndicator.tsx`** — нова компонента
```tsx
// Мала компонента: пулсирачка точка + текст
// Покажа се додека isStreaming е true
export const StreamingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 text-sm text-gray-500">
    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
    AI пишува одговор…
  </div>
);
```

**3. `views/AssistantView.tsx`** — chat интерфејс (веројатно веќе има streaming, провери прво)

### Прифатливост тест
- [ ] Кога наставникот кликне "Генерирај" → текстот почнува да се појавува во рок од 1с
- [ ] Нема пауза > 2с меѓу chunks
- [ ] Копчето "Генерирај" е disabled за време на streaming
- [ ] На грешка → јасна error порака (не frozen spinner)

---

## S58-B — VerificationMicroQuiz + i18n AI Fix
> **Траење: 1 сесија | Приоритет: ВИСОК**

### B1: VerificationMicroQuiz

**Проблем:** S55 loop: Quiz → MisconceptionExplainer → **директно** StudentNextStepCard
**Треба:** Quiz → MisconceptionExplainer → VerificationMicroQuiz (3 прашања) → StudentNextStepCard

```
Педагошки принцип: без верификација не знаеш дали ученикот навистина разбрал.
3 прашања е оптимум — доволно за верификација, не преоптоварувачки.
```

**Нови/изменети фајлови:**

```
components/student/VerificationMicroQuiz.tsx  — НОВ
hooks/useStudentLearningLoop.ts               — ИЗМЕНИ phase: додај 'verifying'
```

**`LoopPhase` (измени во `useStudentLearningLoop.ts`):**
```typescript
export type LoopPhase = 'idle' | 'loading' | 'explaining' | 'verifying' | 'next-step';
//                                                             ^^^^^^^^^^^^ НОВО
```

**`VerificationMicroQuiz.tsx`** — 3 MC прашања генерирани од `tutorAPI.generateVerificationQuestions()`:
```typescript
// Во services/gemini/tutor.ts — нова функција:
async generateVerificationQuestions(
  conceptTitle: string,
  misconception: string,
  gradeLevel: number,
): Promise<Array<{ question: string; options: [string,string,string]; answer: string }>>
// 3 прашања, 3 опции (не 4 — побрзо за мобил)
// Fallback: ако quota exhausted → skip директно на next-step
```

**Flow:**
```
advanceStep() на последен чекор на Explainer
  → phase = 'verifying'
  → генерирај 3 прашања (со graceful fallback)
  → ученикот одговара
  → ако ≥ 2/3 точни: phase = 'next-step' со "Одлично!" message
  → ако < 2/3: phase = 'next-step' со "Можеш повторно!" message
```

### B2: i18n AI Gap — Сите services

**Листа на services кои сè уште хардкодираат МК:**

| Фајл | Проблем | Fix |
|------|---------|-----|
| `services/gemini/tutor.ts` | `explainMisconception` prompt во МК | Додај `getAILanguageRule()` во systemInstruction |
| `services/gemini/testgen.ts` | `generateParallelTest` prompt во МК | Додај `getSecondaryTrackContext` + langRule |
| `services/gemini/scenario.ts` | Scenario prompts во МК | Додај `withLangRule()` wrapper |
| `services/gemini/lessonPlanGenerator.ts` | Lesson plan во МК | Додај langRule |
| `services/gemini/flashcards.ts` | Flashcards во МК | Додај langRule |

**Pattern (исти за сите):**
```typescript
import { withLangRule } from './core.instructions';

// СЕГА:
systemInstruction: 'Ti si ekspert makedonski nastavnik...'

// НОВО:
systemInstruction: withLangRule('Ti si ekspert nastavnik...')
```

### Прифатливост тест
- [ ] После MisconceptionExplainer → 3 верификациски прашања се прикажуваат
- [ ] При SQ UI → AI генерира на Albanski
- [ ] Quota exhausted → VerificationMicroQuiz се скипнува без грешка

---

## S58-C — Design Tokens + 3 Mobile Views
> **Траење: 1 сесија | Приоритет: СРЕДЕН**

### C1: Примени семантички токени на 5 views

**Цел:** Замени ad-hoc Tailwind со `--spacing-card`, `--radius-card` итн. на 5 најчесто-посетени views.

**5 Target views (по фреквентност):**
1. `views/HomeView.tsx` — `p-6` → `p-[var(--spacing-card)]`
2. `views/ConceptDetailView.tsx` — card padding конзистентност
3. `views/MaterialsGeneratorView.tsx` — card padding
4. `views/NationalLibraryView.tsx` — card padding + border radius
5. `views/StudentPlayView.tsx` — вон scope (студентски UI со специфичен индиго стил)

**Забелешка:** Tailwind v4 со `@theme` ги регистрира CSS variables автоматски. Можеш да пишуваш:
```html
<!-- Tailwind v4 начин — директно -->
<div class="p-(--spacing-card) rounded-(--radius-card)">
```

### C2: 3 останати mobile views

**NationalLibraryView:**
- Filter sidebar: `w-64 flex-shrink-0` → drawer/sheet на mobile
- Grid: `grid-cols-3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**ExamBuilderView:**
- Two-column layout → `flex-col lg:flex-row`
- Question list → collapsible на mobile

**MaterialsGeneratorView:**
- Config accordion → step-by-step на mobile (ова е поврзано со S58-A streaming)

### Прифатливост тест
- [ ] NationalLibraryView на 390px — filters се достапни (не скриени)
- [ ] ExamBuilderView на 390px — question list е над preview
- [ ] MaterialsGeneratorView на 390px — Generate копчето е видливо без scroll

---

## Технички Must-Do (секоја сесија)

1. `npx tsc --noEmit` → 0 грешки пред commit
2. `npx vitest run` → 1153/1153 (или повеќе) тестови
3. Секоја нова AI функција мора да поминува `getAILanguageRule()`
4. Нови компоненти → `aria-label` на сите interactive елементи
5. Нови views → `React.lazy()` преку `safeLazy()` во App.tsx

---

## Метрики — Цел по S58

| Метрика | Сега | Цел |
|---------|------|-----|
| AI streaming coverage | 0 / 23 модули | ≥ 2 (MaterialsGenerator + Assistant) |
| Pedagogy loop completeness | 85% (без verification) | 100% |
| i18n AI coverage | 1 / 23 модули | ≥ 6 (highest-traffic) |
| Mobile-ready views | 2 / 5 планирани | 5 / 5 |
| Design token adoption | 0 / 71 views | 5 / 71 (top views) |

---

## За следната сесија — READ THIS FIRST

```
git log --oneline -5   →  последен commit: 7bc8b06 (S57)
Почни со: S58-A (Streaming UI — највисок ROI)
Фајл за старт: views/MaterialsGeneratorView.tsx
```

### Клучни референци
- `services/gemini/core.proxy.ts:199` — `streamGeminiProxy()` async generator (веќе имплементиран)
- `services/gemini/core.instructions.ts:55` — `getAILanguageRule()` функција
- `services/gemini/core.instructions.ts:64` — `withLangRule()` wrapper
- `hooks/useStudentLearningLoop.ts` — S55 loop (додај `'verifying'` фаза)
- `components/student/MisconceptionExplainer.tsx` — последен `advanceStep()` повик

---

*Последно ажурирање: 26.04.2026 | По S57 аудит*
