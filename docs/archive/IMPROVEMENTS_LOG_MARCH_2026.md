# ЛОГ НА ПОДОБРУВАЊА (МАРТ 2026)

Овој документ ги содржи клучните технички и функционални подобрувања на **Math Curriculum AI Navigator** платформата, со цел транзиција кон професионален SaaS модел.

---

## 🚀 ФАЗА 8: Server-side Infrastructure & Стабилност (12 Март 2026)

### 🛠️ Технички Подобрувања
- **Gemini Server Proxy**: Целосна транзиција од основни client-side API клучеви кон безбеден **Server-side Proxy** (`/api/gemini`). Ова ги заштитува клучевите од злоупотреба.
- **Model Routing**: Имплементирана динамичка селекција на модели базирана на корисничкиот ранг (`userTier`):
  - **Free**: Gemini 1.5 Flash (Брзина)
  - **Standard**: Gemini 1.5 Pro (Педагошко размислување)
  - **Unlimited/Pro**: Gemini 3.1 Pro (Највисока интелигенција и резонирање)
- **RAG Context Injection**: Оптимизирана инјекција на националниот курикулум во секој AI промпт за максимална локална релевантност.
- **Dual-Write Quota Guard**: Имплементирано следење на квоти преку комбинација на **Cookies** и **LocalStorage** за справување со "Tracking Prevention" во модерни пребарувачи.

---

## 💎 ФАЗА 9: Премиум Функционалности & Монетизација (14 Март 2026)

### ✨ Нови Функционалности
- **Contextual AI Illustrations**: Интеграција на **Imagen 3.0** за автоматско генерирање на визуелни заглавија во сценаријата за часови и работните листови.
- **Math Gamma Presentations**: Динамички генератор на PPTX презентации со AI-структурирани слајдови и вградени визуелни идеи.
- **Teacher Academy 2.0**: Целосен редизајн на порталот за професионален развој со следење на прогрес и интерактивен ментор.
- **Annual Plan Generator V2**: Напредно планирање на цела учебна година со поддршка за Drag & Drop редослед на теми.

### 💰 Кредитен Систем
- **Upfront Credit Gating**: Сигурносна проверка на кредити пред почеток на генерација.
- **Диференцирани Трошоци**:
  - **1 кредит**: Основни текст материјали (Квиз, сценарио, идеи).
  - **5 кредити**: AI Илустрации (Imagen 3).
  - **10 кредити**: Комплетни годишни програми и PPTX презентации.
- **Secure Cloud Deduction**: Интеграција на Firebase Cloud Functions за безбедно дебитирање на балансот на корисникот.

---

## 🔍 ЕКСПЕРТСКИ УВИД: СЕГАШНА СОСТОЈБА

### ✅ Силни страни
1. **Педагошка Прецизност**: Користењето на Блумова таксономија и RAG контекст ја прави апликацијата уникатна на пазарот.
2. **SaaS Архитектура**: Системот за кредити и рутирање на модели е технички подготвен за плаќања.
3. **Административно олеснување**: Експортните опции (PDF, Word, ICS, PPTX) директно ги решаваат најголемите проблеми на наставниците.

---

## 📅 АКЦИОНЕН ПЛАН: ФАЗА 10 (SaaS Perfection)

| Ставка | Опис | Статус |
| :--- | :--- | :--- |
| **1. PPTX Localize** | Инсталација на `pptxgenjs` преку npm и отстранување на CDN за подобра стабилност. | **ЗАВРШЕНО** |
| **2. Wizard UI за Планови** | Трансформација на `AnnualPlanGeneratorView` во чекор-по-чекор интерфејс. | **ЗАВРШЕНО** |
| **3. Imagen 3 Stability** | Поправен 404 модел-еррор преку користење на `imagen-3.0-generate-001`. | **ЗАВРШЕНО** |
| **4. Multi-Image Quizzes** | Генерирање илустрации за поединечни тешки прашања во квизовите. | **ЗАВРШЕНО** |
| **5. Semantic Search** | Паметно пребарување низ библиотеката со користење на `gemini-embed-004`. | **ЗАВРШЕНО** |
| **6. NotebookLM Infrastructure** | Подготвена основа за семантичко поврзување на наставните материјали. | **ЗАВРШЕНО** |

---

## 🏗️ ФАЗА 10: SaaS Perfection & Интеграција (15 Март 2026)

### 🧩 Завршени Технички Модули
- **Multi-Image Quiz Refactor**: Рефакториран е целиот систем на квизови. Сега секој `AssessmentQuestion` има свој `imageUrl`, што овозможува контекстуална визуелизација за секое прашање поединечно.
- **Imagen 3.0 Stability Fix**: Решен е проблемот со `404 Not Found` преку стандардизација на `imagen-3.0-generate-001`.
- **Semantic Library Search**: Имплементирано е семантичко пребарување во `ContentLibraryView` користејќи косинусна сличност (Cosine Similarity) на векторските записи.
- **Vercel Embedding Proxy**: Креиран е нов безбеден прокси сервер за `text-embedding-004` на `/api/embed`.

### 📅 СЛЕДНИ ЧЕКОРИ (Action Plan)

1. ~~**Semantic Teacher Assistant**~~: RAG чат-бот врз лична библиотека. **ЗАВРШЕНО (15 Март 2026)**
2. **Teacher Academy Gamification**: Поврзување на успешно генерираните материјали со „Achievements” системот за наставници.
3. **Advanced PDF Export**: Подобрување на изгледот на PDF извештаите за да вклучуваат генерирани AI илустрации во висока резолуција.

---

## 🧠 ФАЗА 11: Semantic Teacher Assistant / NotebookLM (15 Март 2026)

### ✅ Имплементирани Модули

- **RAG Chat Mode во AssistantView**: Додаден „Библиотечен режим” копче. Кога е активен, AI асистентот:
  1. Ги вчитува сите наставникови материјали со embeddings од Firestore
  2. Го embedira прашањето на наставникот преку `/api/embed`
  3. Пресметува cosine similarity и ги наоѓа топ-3 релевантни материјали (праг 0.35)
  4. Ги инјектира материјалите ккако RAG контекст во системската инструкција
  5. Прикажува **source citations** (индиго badge) на секој AI одговор

- **getChatResponseStream** надграден со опционален `ragContext?: string` параметар
- **Rules of Hooks fix**: Отстранет нелегален `useLanguage()` повик внатре во `handleItemClick` (WeeklySchedule.tsx)
- **callEmbeddingProxy** додаден во import на geminiService.real.ts (fix за TS2552)

### 🏗️ Архитектура

```text
Наставник пишува прашање
    ↓
callEmbeddingProxy(query) → /api/embed → number[768]
    ↓
hybridScore = 0.6·cosineSimilarity + 0.4·bm25Score  ← НАДГРАДЕН (15 Март 2026)
    ↓
Топ-3 материјали (score > 0.30) → RAG context string
    ↓
getChatResponseStream(..., ragContext) → /api/gemini-stream
    ↓
AI одговор + source citations (badge)
```

---

## 🚀 ФАЗА 12: World-Class Upgrades (15 Март 2026)

### ✅ Имплементирани Подобрувања

| # | Подобрување | Статус |
| --- | ----------- | ------ |
| 1 | **Model Upgrade** — Gemini 3.1 Pro Preview + Imagen 4.0 + нов whitelist | ✅ ЗАВРШЕНО |
| 2 | **Embeddings на saveRemediaQuiz / saveExitTicketQuiz** — целосна RAG покриеност | ✅ ЗАВРШЕНО |
| 3 | **Persistent Chat History** — Firestore `chat_sessions`, autosave 3s debounce, sidebar со 20 разговори | ✅ ЗАВРШЕНО |
| 4 | **Hybrid Search (BM25 + cosine)** — `0.6·cosine + 0.4·bm25` во ContentLibraryView и AssistantView | ✅ ЗАВРШЕНО |
| 5 | **Streaming Thinking Tokens** — `thinkingBudget: 8000`, Brain toggle за Pro/Unlimited, purple collapsible panel | ✅ ЗАВРШЕНО |

### 🏗️ Клучни Технички Детали

#### Hybrid Search

- `bm25Score(query, docText)` — BM25-lite, k1=1.5, b=0.75, avgDocLen=25, нормализиран на ~[0,1]
- ContentLibraryView: Semantic ON → hybrid (праг 0.15); Semantic OFF → чист BM25 ranking
- AssistantView RAG: hybrid праг 0.30 (наместо 0.50 чист cosine) — точни совпаѓања ("7. одделение") не се пропуштаат

#### Streaming Thinking Tokens

- `api/gemini-stream.ts`: детектира `part.thought === true` → SSE `{ thinking: "..." }`
- `services/gemini/core.ts`: нов `streamGeminiProxyRich()` → `StreamChunk = { kind: 'text'|'thinking', text }`
- `services/geminiService.real.ts`: нов метод `getChatResponseStreamWithThinking()` со `thinkingConfig: { thinkingBudget: 8000 }`
- `AssistantView.tsx`: Brain копче (само Pro/Unlimited) → лила collapsible панел „Прикажи размислување" по порака

---

## 🗺️ ФАЗА 14: World-Class Math Presentation & Tools (15 Март 2026)

### Акционен план (приоритизиран)

| Приоритет | ID | Функција | Опис | Статус |
| --- | --- | --- | --- | --- |
| 🔴 P0 | М1 | **PPTX LaTeX→SVG** | KaTeX рендерира секоја формула → SVG → вметнување во PPTX слајд. Без ова математиката е нечитлива во export. | ✅ ЗАВРШЕНО |
| 🔴 P0 | М2 | **GeoGebra iframe embed** | Вградување на GeoGebra editor во MathToolsPanel. `ggb.getBase64()` → PNG → зачување во `plan.mathEmbeds[]`. Прикажување во LessonPlanDisplay. | ✅ ЗАВРШЕНО |
| 🟠 P1 | М3 | **Desmos граф embed** | Вградување на Desmos Graphing Calculator. `calculator.screenshot()` → PNG → export во материјали. | ✅ ЗАВРШЕНО |
| 🟠 P1 | М4 | **`step-by-step` слајд layout** | Нов тип слајд во GeneratedPresentation: нумерирани чекори со прогрес бар, клик-анимација, идеален за докажување теореми. | ✅ ЗАВРШЕНО |
| 🟡 P2 | М5 | **Archive на материјали** | Soft-delete: `archivedAt` поле во Firestore. Таб „Архива" во ContentLibraryView. Копче „Врати" и „Избриши засекогаш". | ✅ ЗАВРШЕНО |
| 🟡 P2 | М6 | **Unit тестови** | `bm25Score` edge cases + `cosineSimilarity` + `hybridScore` — 21 теста во `utils/search.test.ts`. `bm25Score` извлечен во `utils/search.ts` (делен помеѓу ContentLibraryView и AssistantView). | ✅ ЗАВРШЕНО |
| 🟢 P3 | М7 | **`formula-centered` слајд layout** | Layout само со голема формула + визуелизација — за клучни дефиниции и теореми. content[0] = главна формула, content[1..] = белешки. Централна box + PPTX roundRect export. | ✅ ЗАВРШЕНО |
| 🟢 P3 | М8 | **Live quiz од слајд** | Директно стартување на квиз-сесија од презентациски слајд (Premium WOW feature). | ✅ |

### Архитектура — GeoGebra + Desmos

```text
MathToolsPanel → таб "GeoGebra" → iframe (GeoGebra API, без API key, образование бесплатно)
    ↓ наставникот конструира фигура
window.ggbApplet.getBase64(true) → PNG base64
    ↓
firestoreService.saveMathEmbed({ type: 'geogebra', base64, params, teacherUid })
    ↓
ContentLibraryView → embed preview
Presentation слајд → image insert
Инфографик → вметнување

Desmos: window.Dcalculator.screenshot({ width, height }) → PNG
```

### Архитектура — PPTX LaTeX fix

```text
PresentationSlide.content[] → parseFormulaTokens() → [текст, $формула$, текст]
    ↓
За секоја $формула$: katex.renderToString() → SVG → Buffer → pptxgen.addImage(svgBase64)
    ↓
Текстот и формулите се на различни y-позиции на слајдот (line-by-line layout)
```

### Кога да се пишуваат тестови

- **Пред merge на P0 (М1, М2)**: unit тест за KaTeX SVG конверзија и GeoGebra mock
- **По имплементација на М5 (Archive)**: Firestore soft-delete интеграциски тест
- **По имплементација на М6**: bm25Score unit тест (чиста функција, 20 мин)
- **НИКОГАШ пред commit/push** — тестовите се пишуваат паралелно или веднаш по функцијата, не во посебна фаза на крајот

---

## 🎨 ФАЗА 13: AI Lesson Infographic Generator (Premium) — 15 Март 2026

### Акционен план

| # | Чекор | Опис | Статус |
| --- | ----- | ---- | ------ |
| И1 | `/api/generate-infographic` | Нов Vercel endpoint: Gemini JSON → satori SVG → resvg PNG | ✅ html2canvas@3x (client-side, поверлив) |
| И2 | `geminiService.generateInfographicLayout()` | Gemini 3.1 Pro генерира структуриран JSON за инфографикот | ✅ ЗАВРШЕНО |
| И3 | `InfographicPreviewModal` | React компонент: preview + download PNG копче (Premium gate) | ✅ ЗАВРШЕНО |
| И4 | Интеграција во `LessonPlanView` | Копче „Генерирај инфографик" по генерирање сценарио | ✅ ЗАВРШЕНО |
| И5 | Premium gate | Само Pro/Unlimited тир (tier check во UI) | ✅ ЗАВРШЕНО |

### Архитектура

```text
Наставник кликнува „Генерирај инфографик" (LessonPlanView)
    ↓
geminiService.generateInfographicLayout(lessonContent)
    → Gemini 3.1 Pro → JSON { title, keyPoints[], sections[], palette }
    ↓
POST /api/generate-infographic  { layout: JSON }
    → satori(JSX template + layout) → SVG string
    → @resvg/resvg-wasm SVG → PNG buffer (2480×3508 = A4 @ 300dpi)
    ↓
InfographicPreviewModal → base64 PNG preview + Download копче
```

### Технички избори

- **satori** (`@vercel/og`) — JSX → SVG, zero-browser, serverless-native, пиксел-перфект
- **@resvg/resvg-wasm** — SVG → PNG @ 300dpi (печатлив квалитет)
- **Gemini 3.1 Pro** за layout JSON (само Pro/Unlimited тир го повикува)
- **Premium gate**: само `tier === 'Pro' || 'Unlimited'`, 10 кредити по генерација
- Резолуција: **A4 @ 300dpi (2480×3508px)** — директно испратлив до принтер

---

## 🔬 ФАЗА 16: Длабинска Мултидимензионална Ревизија (15 Март 2026)

> **Цел**: Издигнување на апликацијата над светскиот просек преку системски audit и поправки на сите идентификувани технички, UX и архитектурни недостатоци.

### ✅ Завршени Подобрувања

| ID | Компонента | Проблем | Решение |
|----|------------|---------|---------|
| A1 | `MathToolsPanel` | GeoGebra/Desmos — нема loading state; корисникот гледа празен прозорец 2-3s | Animate-pulse skeleton за двете алатки додека `ready === false` |
| A1 | `MathToolsPanel` | Нема error state кога CDN e offline | `ErrorFallback` компонент со WifiOff икона + „Обиди се повторно" копче; retry преку `retryKey` state |
| A2 | `DigitalScratchpad` | Нацртот исчезнува при затворање на панелот | `localStorage.setItem('math_scratchpad_v1', canvas.toDataURL())` — debounced 800ms по секој потег; restore при mount |
| A2 | `DigitalScratchpad` | Inline CSS стилови за grid/lines/dots | Извлечени во `app.css` (`.scratchpad-bg-grid`, `.scratchpad-bg-lines`, `.scratchpad-bg-dots`) |
| A3 | `MathToolsPanel` | GeoGebra/Desmos boolean flag singleton — race condition при concurrent mounts | Заменет со Promise singleton (`ggbLoadPromise`, `desmosLoadPromise`); грешката ја поништува Promise-от за retry |
| A4 | `DailyBriefCard` | Refresh копче | Веќе постоеше (`useDailyBrief.refresh`) — потврдено ✅ |
| A5 | `gemini/core.ts` | `callGeminiProxy` — 429 ги фрлаше генеричка грешка | Typed error handling: 429→`RateLimitError`+`markDailyQuotaExhausted()`, 401/403→`AuthError`, 5xx→`ServerError` |
| A5 | `gemini/core.ts` | Мртов код: `GoogleGenerativeAI` import + `genAI` декларација | Отстранети — целото SDK оди преку server proxy |
| A5 | `gemini/core.ts` | Неискористени schemas import блок | Отстранет (11 schemas кои не се користеа во `core.ts`) |
| A6 | `utils/schemas.ts` | Нема Zod schemas за `generateDailyBrief`, `generateWorkedExample`, reflection | Додадени: `DailyBriefSchema`, `WorkedExampleSchema`, `ReflectionSummarySchema` |
| A6 | `geminiService.real.ts` | 3 клучни AI функции без Zod validation | Поврзани: `generateDailyBrief`→`DailyBriefSchema`, `generateWorkedExample`→`WorkedExampleSchema`, reflection→`ReflectionSummarySchema` |
| A6 | `geminiService.real.ts` | **🔴 Критичен баг**: `askTutor(message, history)` — `message` параметарот не се додаваше кон `contents`! Студентовото прашање не стигнуваше до AI | Поправено: `message` се додава како последна `user` порака во `contents` |
| A6 | `geminiService.real.ts` | 10+ unused parameters и variables | Префиксирани со `_` или отстранети |
| A7 | `MathToolsPanel` | Нема Escape тастер | `useEffect` keydown listener: Escape → прво излез од fullscreen, потоа затвори панелот |
| A7 | `MathToolsPanel` | `isExpanded` state не се ресетираше при close | `handleClose()` wrapper: `setIsExpanded(false)` + `onClose?.()` |
| A7 | `MathToolsPanel` | z-index буг: Expand во `LessonPlanEditorView` (z-60 modal) — панелот se криеше зад backdrop | `z-[200]` наместо `z-50` |
| A7 | `MathToolsPanel` | GeoGebra memory leak при unmount | DOM cleanup: `containerRef.current.innerHTML = ''` + `appletRef.current = null` |
| A7 | Coverage | `ModalContainer` — WCAG-compliant Escape + focus trap | Потврдено дека сите модали го користат ✅ |

### 🏗️ Архитектурни Детали

#### MathToolsPanel — Нова Архитектура

```text
Script Loading (Promise singleton, thread-safe):
  loadGgbScript()    → ggbLoadPromise   (единствен Promise, retry on error)
  loadDesmosScript() → desmosLoadPromise

State flow per panel:
  init → loading skeleton → ready (applet injected) → normal UI
                          ↘ error (CDN down)         → ErrorFallback + Retry button

Cleanup:
  GeoGebra: containerRef.innerHTML = '' + appletRef = null
  Desmos:   calcRef.destroy() + calcRef = null

Escape handling:
  Esc pressed → if isExpanded → setIsExpanded(false)
              → else          → onClose?.()
  handleClose: setIsExpanded(false) + onClose?.()  ← resets state before unmount
```

#### askTutor Bug Fix

```text
ПРЕД (broken):
  contents = history.map(...)  ← message параметарот ИГНОРИРАН

ПОСЛЕ (fixed):
  contents = [...history.map(...), { role: 'user', parts: [{ text: message }] }]
```

#### Quota Guard — Typed Errors

```text
Server 429     → RateLimitError + markDailyQuotaExhausted()
Server 401/403 → AuthError
Server 5xx     → ServerError
Catch block    → if (err instanceof ApiError) throw err  // не се логира двапати
```

---

## 🎯 ФАЗА 15: World-Class Pedagogy & Polish (15 Март 2026)

> **Визија**: Да станеме најдобрата EdTech апликација за математика во регионот и пошироко.
> Резултат од длабока експертска анализа на педагошки, технички и UX недостатоци.

### 📊 Рангиран Акционен План

| Приоритет | ID | Функција | Педагошки импакт | Напор | Статус |
| --- | --- | --- | --- | --- | --- |
| 🔴 P0 | П-Б | **Misconception → Ремедијација** | ⭐⭐⭐⭐⭐ | Низок | ✅ |
| 🔴 P0 | П-А | **Formative Assessment Loop** — auto next-step card во HomeView | ⭐⭐⭐⭐⭐ | Среден | ✅ |
| 🟠 P1 | П-Г | **AI Илустрација во Word Export** (docx ImageRun) | ⭐⭐⭐⭐ | Низок | ✅ |
| 🟠 P1 | П-Ѓ | **Диференцирани нивоа** — 3 таба (Поддршка/Стандардно/Збогатување) | ⭐⭐⭐⭐ | Низок | ✅ |
| 🟠 P1 | П-В | **Bloom Objective Builder** — dropdown глаголи + мерлив исход | ⭐⭐⭐⭐ | Среден | ✅ |
| 🟡 P2 | П-Д | **Spaced Rep во HomeView** — due concepts + 1-click review quiz | ⭐⭐⭐ | Низок | ✅ |
| 🟡 P2 | П-Е | **Teacher Onboarding Wizard** — 4 чекори на прво логирање | ⭐⭐⭐ | Среден | ✅ |
| 🟡 P2 | П-Ж | **PDF Export** (branded A4, формули + слика) | ⭐⭐⭐ | Висок | ✅ |
| 🟡 P2 | П-З | **MathRenderer a11y** — `aria-label` + `role="math"` | ⭐⭐ | Низок | ✅ |
| 🟡 P2 | П-Л | **Print Quiz** — `@media print` CSS visibility | ⭐⭐ | Низок | ✅ |
| 🟢 P3 | М8 | **Live Quiz од слајд** (Premium WOW feature) | ⭐⭐⭐ | Висок | ⏳ |
| 🟢 P3 | П-И | **Collaborative Share** — share lesson plan со колега | ⭐⭐⭐ | Среден | ✅ |
| 🟢 P3 | П-Ј | **Smart Quiz Title** — Gemini Flash генерира наслов при зачувување | ⭐⭐ | Низок | ✅ |

### 🧠 Дијагностицирани Критични Дефицити

#### Формативен циклус — Непотполн

```text
Quiz резултати → DailyBrief (прикажано)
                              ↓ НЕДОСТАСУВА
                    Auto-queue на следен концепт
                    Auto-генерација на ремедијална активност
```

**Решение (П-А + П-Б)**: По секој квиз со слаб резултат (<70%) системот
автоматски нуди „Следен чекор" card + 1-click ремедијален квиз насочен точно
на грешните прашања (misconceptions[]).

#### Диференцијација — Само слободен текст

```typescript
// СЕГАШНА СОСТОЈБА (types.ts):
differentiation?: string  // ← наставникот не знае штo да пишува

// РЕШЕНИЕ (П-Ѓ):
differentiation?: {
  support: string;    // AI-генерирано за побавни ученици
  standard: string;   // AI-генерирано за просекот
  advanced: string;   // AI-генерирано за напредните
}
```

#### Цели на часот — Педагошки неструктурирани

```text
СЕГАШНО: "Учениците ќе разберат дропки"  ← неизмерливо
РЕШЕНИЕ (П-В): Bloom ниво dropdown + глагол-предлози + мерлив исход поле
→ "Учениците ќе АНАЛИЗИРААТ (Bloom 4) еквивалентни дропки преку 3 нумерички примери"
```

#### Погрешки — Прикажани но не искористени

```text
СЕГАШНО: misconceptions[] → само листа во аналитиките
РЕШЕНИЕ (П-Б): misconceptions[] → "Генерирај ремедијација" копче
→ geminiService.generateRemediaQuiz(misconceptions) → таргетиран квиз
```
