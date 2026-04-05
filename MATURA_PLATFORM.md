# Платформа за Државна Матура — Целосна Евиденција

> Последно ажурирање: Април 2026  
> Проект: `ai-navigator-ee967` (Firebase) · `main` branch · Vercel deployment

---

## 1. Визија

Единствена платформа за матура во регионот и пошироко — со 13+ години историски тестови, AI оценување, адаптивна практика и аналитика по тема. Цел: државата (МОН) сама да бара учество во понатамошниот развој.

---

## 2. Тековна архитектура — целосна слика

```
┌─────────────────────────────────────────────────────────┐
│  data/matura/raw/          ← Извор на вистина (JSON)    │
│    dim-gymnasium-YYYY-SSS-LL.json  (30 прашања, 61pt)  │
│                                                          │
│  scripts/validate-matura.mjs   ← Валидација пред import │
│  scripts/import-matura.mjs     ← Еден испит → Firestore │
│  scripts/import-matura-all.mjs ← Batch сите + skip dup  │
│  scripts/generate_matura_images.py ← PNG илустрации     │
│                                                          │
│  Firestore (ai-navigator-ee967):                        │
│    matura_exams/{examId}        ← метадата (4 docs)     │
│    matura_questions/{examId_qN} ← прашања (120 docs)    │
│                                                          │
│  public/matura/images/          ← PNG → Vercel static   │
│    2025/june/q05-fig1.png       (парабола)              │
│    2025/august/q07-fig1.png     (линеарна функција)     │
│                                                          │
│  services/firestoreService.matura.ts  ← Firestore I/O  │
│  hooks/useMatura.ts                   ← React hooks     │
│                                                          │
│  views/MaturaLibraryView.tsx   (M2 — прелистувај/вежба) │
│  views/MaturaPracticeView.tsx  (M3 — адаптивна практика)│
└─────────────────────────────────────────────────────────┘
```

---

## 3. Структура на JSON испит

```json
{
  "exam": {
    "id": "dim-gymnasium-2025-june-mk",
    "year": 2025,
    "session": "june",
    "language": "mk",
    "title": "ДИМ Гимназиско — Јуни 2025 (МК)",
    "durationMinutes": 180,
    "track": "gymnasium",
    "gradeLevel": 12
  },
  "questions": [
    {
      "questionNumber": 1,
      "part": 1,
      "points": 1,
      "questionType": "mc",
      "questionText": "...",
      "choices": { "А": "...", "Б": "...", "В": "...", "Г": "..." },
      "correctAnswer": "Б",
      "topic": "Искази",
      "topicArea": "algebra",
      "dokLevel": 1,
      "hasImage": false,
      "imageUrls": [],
      "imageDescription": null,
      "conceptIds": [],
      "hints": [],
      "aiSolution": null,
      "successRatePercent": null
    }
  ]
}
```

### Структура на испит (ДИМ гимназиско):
| Дел | Прашања | Тип | Поени |
|-----|---------|-----|-------|
| I   | Q1–Q15  | MC (4 избора) | 1pt × 15 = 15pt |
| II  | Q16–Q20 | Отворено (А+Б) | 2pt × 5 = 10pt |
| III | Q21–Q30 | Отворено (чекори) | 3–5pt × 10 = 36pt |
| **Вкупно** | **30** | | **61pt** |

**Праг за положување:** 35/61 (≈57%)

---

## 4. Firestore колекции

### `matura_exams/{examId}`
```
id, year, session, language, title, track, gradeLevel,
questionCount, totalPoints, importedAt
```

### `matura_questions/{examId_qNN}`
Сите полиња од JSON + `examId`, `year`, `session`, `language`  
Doc ID формат: `dim-gymnasium-2025-june-mk_q01` (нула-пад до 2 цифри)

**Потребен Firestore индекс:**
```
Collection: matura_questions
Fields:     examId ASC, questionNumber ASC
```
⚠️ Без овој индекс → `FAILED_PRECONDITION` во production!

---

## 5. Сервис и Hooks

### `services/firestoreService.matura.ts`

| Функција | Опис | Кеш |
|---------|------|-----|
| `listExams()` | Сите испити, сортирани newest-first | Module-level |
| `getExamQuestions(examId)` | 30 прашања за еден испит | Map per examId |
| `getMultiExamQuestions(ids, filters?)` | Паралелен fetch + client filter | Преку горните |
| `clearCache()` | Ресет (за admin re-import) | — |

### `hooks/useMatura.ts`

```typescript
useMaturaExams()
// → { exams: MaturaExamMeta[], loading, error, refetch }

useMaturaQuestions(examIds: string[], filters?, enabled?)
// → { questions: MaturaQuestion[], loading, error }
// Stable key dedup — не fetches ако examIds не се сменети
```

---

## 6. Модули на матура платформата

| ID | View | Рута | Статус |
|----|------|------|--------|
| M1 | MaturaSimulationView | `/matura` | ✅ Firestore + сите 3 дела (Апр 2026) |
| M2 | MaturaLibraryView | `/matura-library` | ✅ Firestore (Апр 2026) |
| M3 | MaturaPracticeView | `/matura-practice` | ✅ Firestore (Апр 2026) |
| M4 | (=M1 реимплементиран) | `/matura` | ✅ 180мин, AI grade, resume, part breakdown |
| M5 | MaturaAnalyticsView | `/matura-stats` | ⏳ Планирано |
| M6 | MaturaAdminView | `/matura-admin` | ⏳ Планирано |

### Foundation Gate — Curriculum Alignment (пред целосен M5 rollout)

- Матура прашањата мора да се врзат со постојниот гимназиски курикулум преку стабилен `curriculumRefs` модел.
- Оваа врска треба да поддржи `Истражи програма`, curriculum graph, planner/generator flows и remediation препораки.
- Alignment слојот мора да биде reusable utility/hook, а не логика закована во еден view.
- M5 analytics ќе користи истата foundation оска за topic mastery, DoK insights и препораки кон постојните алатки.
- Целта е брзо проширување со минимални промени по клучните места и без дуплирање на curriculum state.

### M2 — Библиотека (MaturaLibraryView)
- Динамички exam picker (сите испити од Firestore)
- Browse режим: прелистувај, филтрирај по Дел/Тема/DoK/Тип/Пребарај
- Прикажи одговор / Скриј одговор
- Skeleton shimmer додека се вчитуваат прашањата
- **Вежба режим:**
  - Part I MC → автоматска оценка (зелено/црвено)
  - Part II → Gemini AI оценување (А+Б под-делови, 2pt)
  - Part III → self-assess checkboxes (N checkboxes = N поени) + опционален AI

### M3 — Адаптивна практика (MaturaPracticeView)
- Setup: јазик, сесија (динамички од Firestore), теми (chips), дел, DoK, shuffle, број
- Loading spinner додека Firestore fetches
- Едно прашање на екран — Progress bar + Score counter
- Ист hybrid grading систем како M2
- Results screen: Score ring (%), тема breakdown bars, DoK grid 4×, слаби теми препорака
- „Повтори грешки" → replay само погрешните

---

## 7. Python генератор на слики

### `scripts/generate_matura_images.py`

**Инсталација:**
```bash
pip install matplotlib numpy
```

**Типови на илустрации:**

| Type | Опис | Клучни параметри |
|------|------|-----------------|
| `quadratic` | Парабола `a(x-h)²+k` | `h, k, a, xlim, ylim, mark_vertex` |
| `linear` | Права `y=mx+b` | `m, b, xlim, ylim, color, mark_points` |
| `geometry` | Геометриски фигури | `shapes` листа (polygon/circle/line/angle/dim/text) |
| `trig` | sin/cos функции | `func, a, b, c, d, pi_labels` |

**Командна линија:**
```bash
python scripts/generate_matura_images.py           # генерирај само недостасувачки
python scripts/generate_matura_images.py --force   # регенерирај сè
python scripts/generate_matura_images.py --list    # статус на сите
python scripts/generate_matura_images.py q05-june-2025  # само еден
```

**Важно:** Сликите се генерираат во `public/matura/images/YYYY/session/` (не во `data/`!) за да ги сервира Vercel. URL во browser: `/matura/images/2025/june/q05-fig1.png`

### Регистар на тековни слики:

| ID | Испит | Тип | Математика |
|----|-------|-----|-----------|
| `q05-june-2025` | Јуни 2025 Q5 | `quadratic` | `f(x) = (x-2)² + 1`, теме (2,1) |
| `q07-august-2025` | Август 2025 Q7 | `linear` | `y = -3x + 3`, точки (0,3) и (1,0) |

---

## 8. Workflow: Додавање историски испит

```bash
# Чекор 1: Подготви JSON по шемата
#   data/matura/raw/dim-gymnasium-YYYY-SESS-LL.json

# Чекор 2: Валидирај
npm run matura:validate -- --input data/matura/raw/[filename].json

# Чекор 3: Генерирај слики (ако испитот има hasImage: true прашања)
#   а) Додај запис во IMAGE_REGISTRY во scripts/generate_matura_images.py
#   б) Стави ја вистинската математика во params
python scripts/generate_matura_images.py

# Чекор 4: Импортирај во Firestore
#   (ги прескокнува веќе-импортираните автоматски)
npm run matura:import-all

# Чекор 5: Commit
git add data/matura/raw/ public/matura/images/ scripts/generate_matura_images.py
git commit -m "Add [SESS YYYY LL] matura exam"

# Автоматски резултат:
# ✅ M2 Библиотека го прикажува новиот испит
# ✅ M3 Практика го вклучува во setup
# ✅ Нула промени во TypeScript код
```

---

## 9. npm scripts — Матура

```bash
npm run matura:validate    # Валидирај еден JSON
npm run matura:import      # Импортирај еден JSON (--input path)
npm run matura:import-all  # Batch import сите во data/matura/raw/
npm run matura:enrich      # Збогати со AI (aiSolution, hints)
```

---

## 10. ⚠️ Идентификувани ризици и митигации

### РИЗИК 1 — Firestore composite индекс [ВИСОК]
**Проблем:** `where('examId','==',x) + orderBy('questionNumber')` бара composite индекс.  
**Симптом:** `FAILED_PRECONDITION` error во production при прво отворање.  
**Решение:** Во Firebase Console → Firestore → Indexes → Create composite:
```
Collection: matura_questions
Field 1: examId (Ascending)
Field 2: questionNumber (Ascending)
```

### РИЗИК 2 — Слики патеки [РЕЗОЛВИРАНО ✅]
**Беше:** `data/matura/images/...` → 404 во production (Vite не сервира `data/`)  
**Фиксирано:** Слики се во `public/matura/images/` → URL `/matura/images/...`  
**JSON:** imageUrls сега се `/matura/images/...` (апсолутни патеки)

### РИЗИК 3 — Gemini квота [СРЕДЕН]
**Проблем:** M2 и M3 повикуваат Gemini при секое AI оценување. Со 100+ ученици истовремено → квота исцрпена.  
**Тековна заштита:** `ai_daily_quota_exhausted` localStorage guard (Pacific midnight reset)  
**Препорака:** Додај rate limiting по endpoint или кеширај AI одговори во Firestore (`matura_ai_grades/{examId_qN_hash}`)

### РИЗИК 4 — Bundle пораст [РЕЗОЛВИРАНО ✅]
**Беше:** 4 JSON фајли (~120KB) бандлирани во JS  
**Фиксирано:** Firestore lazy loading — 0KB бандл за прашања  
**Скала:** 78 испити → сè уште 0KB бандл

### РИЗИК 5 — Firebase credentials во скриптата [НИЗОк]
`npm run matura:import-all` хардкодира `GOOGLE_APPLICATION_CREDENTIALS=./firebase-adminsdk-key.json`  
**Добро:** Клучот е во `.gitignore` — нема во git  
**Ризик:** Ако CI/CD pipeline го извршува → ќе фали (нема клуч во CI)  
**Препорака:** Во CI, постави `FIREBASE_SERVICE_ACCOUNT` env var (inline JSON)

### РИЗИК 6 — `parseSubParts` регекс [НИЗОк]
Функцијата работи само ако correctAnswer има формат `"А. ..., Б. ..."`.  
Ако историски испит има поинаков формат → `sub.A` и `sub.B` се `undefined`.  
**Заштита:** UI прикажува го целиот `correctAnswer` string ако sub-parts не се парсираат.

---

## 11. Систем за вредности — Матура модул

```
Принципи:
  1. JSON е извор на вистина — Firestore е проекција
  2. Слики во public/ — никогаш во data/
  3. Еден скрипт = еден испит (идемпотентен import)
  4. Нула TypeScript грешки пред секој commit (TSC --noEmit)
  5. Кеш прво — Firestore reads само при прво барање
```

---

## 12. Планирано — Следни фази

### M4 — Симулација 180 мин (Наредно)
- Целосен испит во реален ред (Q1→Q30)
- Тајмер одбројување (180 мин → упозорување при 30 мин)
- Автоматска предача при 0:00
- Part I MC автоматски, Part II/III hybrid grading
- Финален резултат со официјален распоред на поени

### M5 — Cross-year аналитика (Државно ниво)
- Споредба на DoK дистрибуција 2012–2025
- Успешност по тема низ годините (aggregated анонимно)
- Предиктивен скор: „врз основа на практиката, очекуваш ~45/61"
- Тренд на тежина: „Алгебра DoK 3 се зголемува 7% годишно"

### M5.1 — Curriculum-connected analytics foundation
- `curriculumRefs` на ниво на прашање: `conceptIds`, `topicIds`, `gradeIds`, `secondaryTrack`, опционално `standardIds`
- derive/fallback strategy кога историски испит нема рачно внесени refs
- bridge кон curriculum goals и activities преку постојните `Concept.assessmentStandards` и `Concept.activities`
- deep-link preparation за Explore и Graph, така што analytics резултатот да води кон учење и акција, не само кон приказ

### M5.2 — Врска со остатокот од платформата
- Matura Library: прикажи поврзани curriculum concepts за прашање/тема
- Matura Practice: после грешка предложи релевантни concepts, активности и follow-up practice
- Matura Simulation: results screen да изведува weak-concept remediation препораки
- M5 Analytics: topic/DoK insight + „next best action" кон Explore, Graph, Planner и Generator

### M5.3 — Recovery Session Loop ✅ [05.04.2026]
- `startRecoverySession()` во `MaturaAnalyticsView` пишува prefill во sessionStorage
- `MaturaPracticeView` ги чита prefill параметрите при mount и ги применува (topicArea, dokLevels, maxQ)
- Зелен Recovery banner во Setup screen потврдува дека сесијата е насочена кон weak concept
- По `handleStart` prefill се брише и сесијата продолжува нормално

### M5.4 — Improvement Delta Tracking ✅ [05.04.2026]
- `ConceptDelta` интерфејс во `useMaturaStats.ts`: `{ pctBefore, pctAfter, deltaAt }`
- При клик на Recovery: `MaturaAnalyticsView` запишува `matura_concept_snap_{id}` во localStorage со `pctBefore` (тековниот % во M5)
- По завршување на practice сесија: `saveConceptProgress()` во `MaturaPracticeView` го пресметува `pctAfter` по топик или overall, ги споредува и зачувува во `matura_concept_progress[]` во localStorage
- `useMaturaStats` ги чита entries при mount и ги меригрира со weak concepts преку `conceptDeltas` Map
- `MaturaAnalyticsView` прикажува `+X.X% recovery` / `−X.X% recovery` badge до секој слаб концепт
- Feedback loop — корисникот го гледа конкретниот напредок по recovery сесија, не само апстрактни %

### M5.5 — 7-Day Recovery Mission Plan ✅ [05.04.2026]
- `MaturaMissionPlan` и `MaturaMissionDay` типови во `firestoreService.matura.ts`
- Firestore CRUD: `saveMaturaMissionPlan()`, `getActiveMaturaMission()`, `buildMissionPlan()`
  - Колекција: `users/{uid}/maturaMissions/{uid_ts}`
  - Планот трае 7 дена; DoK секвенца: [1, 2, 2, 3, 2, 3, 3]; topic варијанти за разновидност
- `useMaturaMissions` hook: `startMission`, `completeDay`, `skipDay`, `todayDay`, `streakLabel`
  - Streak се пресметува backward по ред на завршени денови
  - Badge се заработува кога сите 7 дена се completed/skipped (со мин. 1 completed)
- `MissionPanel` компонент (`components/matura/MissionPanel.tsx`):
  - 7 редови (Д1–Д7) со статус иконки (✓/→/○), денешна задача хајлајтована
  - "Вежбај" копче → пишува sessionStorage prefill + localStorage snapshot → навигира кон Practice
  - Progress bar (X/7 денови), Flame streak брои, Trophy badge celebrate при завршување
  - Nudge порака "Денешната сесија трае само ~5 минути"
- Wiring во `MaturaAnalyticsView`: ако нема активен план → 3 копчиња "План за: {concept}" за брзо стартување; ако постои план → рендерира `MissionPanel`
- `MaturaPracticeView`: `useMaturaMissions().completeDay(missionDay, pctAfter)` се вика при крај на сесија ако prefill содржи `missionDay` поле
- `Sidebar`: M5 nav item добива `badge="🔥N"` кога постои активен streak (N = број денови), иначе `badge="M5"`

### M5.6 — Recovery Summary Export/Share ✅ [05.04.2026]
- Во `MaturaAnalyticsView` додадени 3 action копчиња за наставник/родител комуникација:
  - `Сподели Recovery Summary` (native share ако е поддржано)
  - `Копирај текст` (clipboard fallback)
  - `Преземи .txt` (offline-ready export)
- Summary содржи: attempts, average/best/pass rate, top weak concepts (со delta каде што постои), mission status и кратки next-step препораки.
- Цел: побрзо споделување на доказлив напредок и јасни follow-up чекори без рачно препишување.

### M5.7 — Recovery Summary PDF Export ✅ [05.04.2026]
- Додаден `Преземи PDF` action во `MaturaAnalyticsView`.
- Export се генерира преку постоечкиот `downloadAsPdf()` helper (`html2canvas + jsPDF`) за конзистентен output.
- PDF template вклучува KPI summary, weak concepts со recovery delta, mission status и recommended next steps.

### M5.8 — Public Recovery Share Link ✅ [05.04.2026]
- Додаден action `Копирај public линк` во `MaturaAnalyticsView`.
- Link формат: `#/share/matura/:data` со encoded payload (read-only summary view).
- Нов `SharedMaturaRecoveryView` прикажува KPI, weak concepts и mission status без најава.
- Payload е валидиран преку Zod schema во `shareService` (`generate/decodeMaturaRecoveryShareData`).

### M5.9 — Share Link Hardening (TTL + Validation) ✅ [05.04.2026]
- Matura share payload сега има metadata: `v=1` и `expiresAt` (default TTL: 30 дена).
- Воведени се size guard + decode status (`invalid` / `expired`) за појасни failure состојби.
- Поддржан е покомпактен линк формат со компресија кога `pako` е достапен (`z:` prefix), со fallback `u:`.
- `SharedMaturaRecoveryView` прикажува посебна порака за истечен линк наместо generic невалиден статус.
- UI за upload + валидирање на нов испит без CLI
- Прикажи статистики по испит (успешност, топ-3 тешки прашања)
- Editable correctAnswer / topic за грешки после публикација

### Спорне повторување (Спaced Rep Integration)
- Погрешено прашање во M3 → автоматски оди во spaced_rep колекција
- Следната сесија го прикажува во Мој напредок

### Официјални рубрики
- Тековно: `correctAnswer` е само текст/LaTeX
- Подобрување: `rubric: [{ step, points, keyword }]` структура
- Овозможува прецизна AI оценка по чекори (не само вкупни поени)

---

## 13. Тековна состојба на Firestore (Април 2026)

```
matura_exams:     5 docs
  dim-gymnasium-2025-june-mk   (30q, 61pt, mk)
  dim-gymnasium-2025-june-al   (30q, 61pt, al)
  dim-gymnasium-2025-august-mk (30q, 61pt, mk)
  dim-gymnasium-2025-august-al (30q, 61pt, al)
  dim-gymnasium-2024-august-mk (30q, 63pt, mk)  ← Додадено Апр 2026

matura_questions: 150 docs
  30 per exam × 5 exams

public/matura/images/:  2 PNG files
  2025/june/q05-fig1.png    (Q5 парабола)
  2025/august/q07-fig1.png  (Q7 линеарна)

Напомена: 2024 испитот има 63pt (наместо 61pt) — Part III е пообемен.
```

**Очекувана состојба со 13 години историски тестови:**
```
matura_exams:     ~78 docs (26 сесии × 3 јазика)
matura_questions: ~2,340 docs (78 × 30)
Firestore reads per ден (100 активни ученици): ~3,000 (во кеш лимит)
```

---

## 14. Врски

| Ресурс | Линк |
|--------|------|
| Firebase Console | https://console.firebase.google.com/project/ai-navigator-ee967 |
| Firestore | /firestore/data |
| Storage | /storage |
| Vercel deployment | (production URL) |
| GitHub repo | igorbogdanoski/math-curriculum-ai-navigator |
