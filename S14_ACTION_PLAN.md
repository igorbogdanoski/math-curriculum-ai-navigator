# S14 — Педагошки надградби: DoK · Algebra Tiles · 3D Геометрија
**Датум:** 30.03.2026
**Статус:** 🔄 Во изработка

---

## ФАЗА А — Алатки на светско ниво

### A1 · AlgebraTilesCanvas надградба
**Цел:** Од статична алатка до педагошки манипулатив

| # | Задача | Статус |
|---|---|---|
| A1.1 | `presetExpression` prop — парсирање на `"x²+3x+2"` → авто-постави плочки | ⬜ |
| A1.2 | Preset копчиња (Пример задачи): 5 вградени изрази по тежина | ⬜ |
| A1.3 | Guided Factoring Mode — „Постави плочки во правоаголник = факторизација" | ⬜ |
| A1.4 | Touch events (`onTouchStart/Move/End`) — целосна мобилна поддршка | ⬜ |
| A1.5 | Undo stack (максимум 20 чекори, `Ctrl+Z` / копче) | ⬜ |
| A1.6 | Export as PNG snapshot → за споделување во Форум | ⬜ |
| A1.7 | TSC check + commit | ⬜ |

### A2 · Shape3DViewer надградба
**Цел:** Наставна алатка со педагошки контекст

| # | Задача | Статус |
|---|---|---|
| A2.1 | `initialShape` auto-detection: концепт keyword → правилна форма | ⬜ |
| A2.2 | Dimensional labels на телото (SVG text + линии за `a`, `h`, `r`) | ⬜ |
| A2.3 | Preset view копчиња: ⊤ Одгоре / ↗ Изометриски / → Напред | ⬜ |
| A2.4 | Touch drag support (`onTouchStart/Move/End`) | ⬜ |
| A2.5 | Cross-section slider за цилиндар и коцка (хоризонтален пресек) | ⬜ |
| A2.6 | Embed во `GeneratedPresentation` → нов слајд тип `shape-3d` | ⬜ |
| A2.7 | TSC check + commit | ⬜ |

### A3 · DoK глобална видливост
**Цел:** DoK да биде видлив насекаде каде се прикажуваат прашања/материјали

| # | Задача | Статус |
|---|---|---|
| A3.1 | `ConceptDetailView` — DoK coverage ring: прикажи колку прашања по ниво | ⬜ |
| A3.2 | `NationalLibraryView` — DoK filter (checkbox 1/2/3/4) + badge на секој материјал | ⬜ |
| A3.3 | `MaterialsGeneratorView` — DoK summary chart по генерирање (замена на Bloom donut) | ⬜ |
| A3.4 | `StudentTutorView` — DoK badge до секоја практична задача | ⬜ |
| A3.5 | TSC check + commit | ⬜ |

---

## ФАЗА Б — Teacher Academy интеграција

### B1 · Нов Academy модул: „Webb's Depth of Knowledge"
**Цел:** Наставниците да ја разберат и применат DoK рамката

| # | Задача | Статус |
|---|---|---|
| B1.1 | Дефинирај `ACADEMY_DOK_MODULE` во `ACADEMY_CONTENT` (constants или посебен фајл) | ⬜ |
| B1.2 | Лекција 1: Теорија — 4 нивоа, разлика со Bloom's, примери за математика | ⬜ |
| B1.3 | Лекција 2: DoK во македонскиот математички curriculum (5-12 одд) | ⬜ |
| B1.4 | Лекција 3: Дизајн на балансиран тест (25/35/30/10 распределба) | ⬜ |
| B1.5 | Interactive Quiz: Класифицирај 8 прашања по DoK ниво → live feedback | ⬜ |
| B1.6 | Applied task: Генерирај assessment, провери DoK дистрибуција, рефлексија | ⬜ |
| B1.7 | TSC check + commit | ⬜ |

### B2 · Нов Academy модул: „Визуелна математика — Манипулативи"
**Цел:** Наставниците да ги применат Algebra Tiles и 3D Viewer во настава

| # | Задача | Статус |
|---|---|---|
| B2.1 | Дефинирај `ACADEMY_VISUAL_MATH_MODULE` во `ACADEMY_CONTENT` | ⬜ |
| B2.2 | Лекција 1: Алгебарски плочки — теорија, истражувања, педагошки основи | ⬜ |
| B2.3 | Интерактивна демо во лекцијата: вградена `AlgebraTilesCanvas` | ⬜ |
| B2.4 | Лекција 2: 3D геометрија со технологија — когнитивно оптоварување | ⬜ |
| B2.5 | Интерактивна демо во лекцијата: вграден `Shape3DViewer` | ⬜ |
| B2.6 | Лекција 3: Кога и зошто — избор на визуелни претстави по тема | ⬜ |
| B2.7 | TSC check + commit | ⬜ |

---

## ФАЗА В — Forum интеграција

### C1 · DoK во Форумот
**Цел:** DoK да биде дел од педагошката заедница

| # | Задача | Статус |
|---|---|---|
| C1.1 | DoK tag при постирање (опционален) — dropdown DoK 1/2/3/4 | ⬜ |
| C1.2 | DoK badge прикажан на thread cards во листата | ⬜ |
| C1.3 | DoK filter во форум sidebar (покрај постоечките категории) | ⬜ |
| C1.4 | „DoK Предизвик" weekly pinned thread — auto-generated, заедницата гласа | ⬜ |
| C1.5 | TSC check + commit | ⬜ |

### C2 · Algebra Tiles споделување во Форум
**Цел:** Наставниците да споделуваат визуелни алгебарски проблеми

| # | Задача | Статус |
|---|---|---|
| C2.1 | „📤 Сподели во Форум" копче во `AlgebraTilesCanvas` → PNG snapshot → prefill post | ⬜ |
| C2.2 | Forum post приказ: прикачена Algebra Tiles слика прикажана inline | ⬜ |
| C2.3 | TSC check + commit | ⬜ |

### C3 · Shape3D embed во Форум
**Цел:** Наставниците да поставуваат 3D задачи со визуелен контекст

| # | Задача | Статус |
|---|---|---|
| C3.1 | При пишување пост: копче „➕ Додај 3D тело" → Shape3DViewer compact embed | ⬜ |
| C3.2 | Forum thread приказ: Shape3DViewer рендериран inline (read-only) | ⬜ |
| C3.3 | TSC check + commit | ⬜ |

---

## Финален push

| # | Задача | Статус |
|---|---|---|
| F1 | Целосен TSC check (`npx tsc --noEmit`) | ⬜ |
| F2 | Build verify (`npm run build`) | ⬜ |
| F3 | `git push` — деплој на Vercel | ⬜ |
| F4 | Ажурирај MEMORY.md со S14 метрики | ⬜ |

---

## Метрики по S14 (цел)

| Метрика | Пред S14 | Цел S14 |
|---|---|---|
| `as any` | 0 ✅ | 0 ✅ |
| `@ts-ignore` | 0 ✅ | 0 ✅ |
| TSC грешки | 0 ✅ | 0 ✅ |
| DoK покриеност (views) | 3 views | 8+ views |
| Academy модули | N (DoK/Tiles нема) | +2 модули |
| Мобилна поддршка (Tiles/3D) | 0% | 100% |
| AlgebraTiles преsets | 0 | 5 |
| Shape3D label/views | 0 | 3 preset angles + labels |

---

## Архитектурни одлуки

- **AlgebraTiles PNG export:** `html2canvas` (веќе постои во bundle) на `canvasRef` div
- **Touch support:** Native `onTouchStart/Move/End` React synthetic events — no library
- **Academy модули:** Додај во постоечкиот `ACADEMY_CONTENT` object (не нов фајл)
- **Forum DoK tag:** Нов `dokLevel?: DokLevel` поле во `ForumThread` Firestore документ
- **Shape3D во Presentation:** Нов `type: 'shape-3d'` во `PresentationSlide` + рендерирање во `GammaModeModal`
- **Undo stack:** `useRef<Tile[][]>` history array — не Redux, не context, само локален ref

---

*Акционен план запишан: 30.03.2026 — Сесија 14*
