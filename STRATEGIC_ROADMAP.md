# Стратешки план за развој — Math Curriculum AI Navigator

> Датум на составување: 06.04.2026  
> Статус: АКТИВЕН — живи документ, се ажурира по секоја завршена фаза  
> Производствен домен: https://ai.mismath.net  
> Репо: igorbogdanoski/math-curriculum-ai-navigator

---

## 1. Каде сме сега — Снимка на состојбата

### Архитектура
- **56 views**, 43 hooks, 22 services, 28 Firestore колекции, 16 Rollup chunks
- React 19 + TypeScript strict + Vite 6 + Tailwind 4 + Firebase 11 + Gemini 2.5 Flash
- PWA offline, SLO monitoring, Sentry, Stripe, RBAC Firestore rules
- TSC грешки: **0** · `as any`: **0** · `@ts-ignore`: **0**
- Оценка: **production-grade систем, не prototype**

### Матура платформа
| Модул | Статус | Опис |
|---|---|---|
| M1 — Библиотека | ✅ | Преглед на испити, metadata |
| M2 — Прашања | ✅ | Вградено во M3/M4 |
| M3 — Адаптивна практика | ✅ | По тема, DoK, јазик, AI оценување |
| M4 — Симулација | ✅ | Целосен 3ч ДИМ испит, AI грading, кеш |
| M5 — Аналитика | ✅ | Статс, слаби концепти, 7-Day Mission, recovery loop |
| M6 — Remediation | ❌ | Не постои — следна голема задача |

### Испитна база (06.04.2026)
- **10 испити**: ДИМ Гимназиско 2024 (јуни + август) × MK/AL/TR + 2025 (јуни + август) × MK/AL
- **300 прашања** со conceptIds enrichment (100% покриеност)
- **Само gymnasium track** — средно стручно следи по завршување на матура базата

---

## 2. Систематски прилев на испити — Оперативен план

### Дневниот ритам (веднаш активен)
```
Секој ден:
  1 × Јунски испит  (MK + AL + TR = 3 JSON фајлови)
  1 × Августовски испит (MK + AL + TR = 3 JSON фајлови)
  ─────────────────────────────────────────────────────
  Вкупно: ~6 фајлови / ден → import → enrichment → commit
```

### Редослед на испити (приближен)
```
2024 ✅ → 2023 → 2022 → 2021 → 2020 → 2019 → 2018 → ...
(секоја година: Јуни + Август × 2–3 јазика)
```

### Pipeline чекори
```bash
# 1. Прими JSON (MK верзија) → AL → TR
# 2. Нормализирај choices → А/Б/В/Г (за AL: A/B/C/Ç → cyrillic)
# 3. Додај aiSolution на Q16–Q30
# 4. npm run matura:import -- --input path/to/file.json
# 5. npm run matura:enrich  (conceptIds auto-mapping)
# 6. Потврди: npm run matura:validate
# 7. git commit
```

### Пред почетокот — БЛОКЕР: `track` полето
`MaturaExamMeta.track` постои во типот но **не се рендерира никаде**.  
Кога ќе пристигнат средно стручно испити (Economics, IT, Electro...) без track-групирање UI ќе биде хаос.

**Задача:** Активирај `track` во Simulation + Library пред првиот средно-стручен испит.  
**Проценка:** 1 работен ден.

---

## 3. Работни патеки — Приоритизирано

### ПАТЕКА А — Мatura платформа (HIGH)

#### A1. `track` поле во UI *(пред средно стручно)*
- `MaturaSimulationView`: групирај `gymnasium → year → session → lang` / `vocational-it → ...`
- `MaturaLibraryView`: филтер по track
- JSON schemas: додади `"track": "gymnasium"` на сите постоечки испити
- **Проценка:** 4–6 часа

#### A2. M6 — Recovery Remediation Loop *(следна голема задача)*

Инфраструктурата веќе постои:
```
M5 → идентификува слаби концепти (conceptIds ✅)
   → M6 UI: "Генерирај Recovery Worksheet"
   → callGeminiProxy → персонализиран PDF по концепти
   → html2canvas / jspdf → print / download
   → sessionStorage prefill → M3 auto-init ✅
   → M5 мери delta подобрување ✅
   → Mission Plan го следи прогресот ✅
```

Она што недостасува (само UI + Gemini prompt):
- Копче "Генерирај Recovery Worksheet" во M5 слаби концепти панел
- Gemini prompt → структуриран PDF worksheet по концепти
- Teacher assignment на recovery план (M6 Phase 2)
- **Проценка:** 3–4 дена (Phase 1: worksheet PDF)

#### A3. conceptIds auto-mapping при import
Сега enrichment е рачен (`TOPIC_MAP` скрипта).  
Цел: при `import-matura.mjs` автоматски lookup на conceptIds ако topicArea се совпаѓа.  
**Проценка:** 2–3 часа

---

### ПАТЕКА Б — Екстракција на содржини (HIGH — уникатна карактеристика)

#### Тековна состојба (искрено)
```
videoPreview.ts → само oEmbed (наслов + thumbnail)
useGeneratorActions → праќа URL + наслов до Gemini → AI измислува, НЕ чита видеото
Поддржани: YouTube + Vimeo
Останато (веб, слики, ракопис): НЕ ПОСТОИ
```

#### B1. YouTube Captions → реална екстракција *(веднаш реализабилно)*
- YouTube Data API v3: `captions.list` + `captions.download`
- Vercel function `/api/youtube-extract` → fetch captions → Gemini структурира
- Резултат: вистинска наставна содржина, не халуцинација
- **Проценка:** 2–3 дена

#### B2. Слики → задачи/теорија *(веднаш — Gemini Vision веќе постои)*
- `AIVisionGraderView` веќе испраќа image → Gemini Vision
- Иста логика, различен prompt: "извлечи математички задачи и теорија"
- Нов режим во Generator: "Слика од учебник / ракопис"
- Поддржува: стари учебници, белешки, handwriting
- **Проценка:** 1–2 дена

#### B3. Веб страни со математичка содржина
- Vercel function: `fetch(url)` → parse HTML → extract text → Gemini
- Проблеми: CORS, JavaScript-rendered pages, rate limits
- **Проценка:** 3–4 дена (basic), 2+ недели (robust)

#### B4. Долги видеа (>25 мин)
- Gemini 2.5 Flash поддржува native audio input (~8h лимит)
- Chunked processing за > 1h видеа
- **Проценка:** 1–2 недели (сложено, бавно API)

#### B5. Поврзување со Generator
Секоја екстракција треба да отвора Generator Panel со pre-filled контекст:
```
Извлечена содржина → contextual pre-fill во GenerationContextForm
→ корисникот само избира тип на материјал и кликнува Генерирај
```
Ова е **уникатна карактеристика** — ниту еден конкурент нема ваква pipeline.

---

### ПАТЕКА В — Форум на светско ниво (MEDIUM)

#### Тековна состојба
- Categories, hot sort, реакции, pinned нишки, DoK тагови ✅
- AlgebraTiles + Shape3D share ✅
- Unread badge во sidebar ✅
- FCM push: ❌ (бара Cloud Function)
- Форум линк: САМО во TopicView — никаде другаде

#### V1. Форум linк од секој дел на апликацијата *(1 ден)*
Мал `ForumCTA` component — "Дискутирај во форум →":
- `ConceptDetailView` — по концепт
- `MaturaAnalyticsView` M5 — по слаб концепт
- `MaturaPracticeView` — по грешен одговор
- `StudentTutorView` — по AI одговор
- `TopicView` — веќе постои ✅
- **Проценка:** 4–6 часа

#### V2. Thread permalink *(1 ден)*
Shareable URL за конкретна нишка → `/forum?thread=:id`  
Со shareService (HMAC signing, веќе постои за matura).

#### V3. Forum FCM push notifications *(2–3 дена)*
Бара Cloud Function во `functions/` директориум.  
Trigger: нов reply → notify thread participants.

#### V4. Moderation queue за нови нишки
Admin-only view за одобрување пред публикување.  
**Проценка:** 1–2 дена

---

### ПАТЕКА Г — Gamma презентации (MEDIUM→HIGH)

#### Тековна состојба
11 slide типови, canvas annotations, laser pointer, fullscreen, step-by-step, SVG illustrations, 3D shapes, chart embeds, speaker notes, print.

#### G1. Брендирање — school logo + watermark *(2 дена)*
```typescript
// Во GammaModeModal:
// Free tier: "ai.mismath.net" watermark долу-десно
// Pro tier: school logo + custom color scheme
// Slide export: logo во footer на секој слајд
```
- Добива school logo од `users.schoolLogoUrl` (Firestore)
- Pro check: `user.isPremium || user.tier === 'pro'`

#### G2. Slide transitions *(1 ден)*
Тековно: CSS opacity + translate. Треба: smooth directional transitions.  
CSS `@keyframes` за `slide-in-right`, `slide-in-up`, `fade-scale`.

#### G3. PPTX export директно од Gamma view *(2–3 дена)*
`pptxgenjs` веќе е во проектот (за Generator).  
Adapter: `GammaModeModal` slides → pptxgenjs format → `.pptx` download.  
Секој slide type има свој pptx layout.

#### G4. Contextual slide awareness *(3–4 дена)*
Секој slide во `step-by-step` и `example` знае:
- Кој концепт се предава (од Generator context)
- Кои формули беа на претходниот slide
- Gemini добива slide_history при генерација → поврзани слајдови

---

### ПАТЕКА Д — Интерактивна математика (LONG-TERM)

#### Тековна состојба
- `AlgebraTilesCanvas` — S14 ✅ (5 presets, undo, export, forum share)
- `Shape3DViewer` — S14 ✅ (6 тела, cross-section, orbit)
- `DataVizStudio` ✅

#### D1. Algebra — equation balance визуализација *(2–3 дена)*
Интерактивна везна — лева и десна страна, drag операции кои балансираат.  
Реализабилно со Canvas или SVG + React state.

#### D2. Статистика / Веројатност интерактивни компоненти *(2–4 недели)*
- Анимиран histogram (bin slider)
- Монте-Карло die/coin симулатор (реално бавна конвергенција)
- Normal distribution curve со interactive μ/σ sliders
- Ова е **S16–S17 territory** — не сега

#### D3. Mathigon-ниво алгебра *(S17+, 6+ месеци)*
Factor trees, polynomial factoring animation, equation step editor.  
Mathigon гради ова со декади. Нашиот патот: 1 компонента месечно.

---

## 4. Техничкиот долг — Мора да се реши

| Проблем | Приоритет | Проценка |
|---|---|---|
| Stale фајлови во root (`=`, `--outputs`, `## ФАЗА`) | Low | 10 мин: `git rm` |
| Vertex AI proxy → 501 | Low | Или имплементирај или отстрани endpoint |
| EN/AL/TR UI преводи (~800 клучеви, ~5% покриеност) | Medium | 1 ден со Gemini batch |
| Tests се površinski | Medium | Бавно подобрување per sprint |
| `console.log` во production | Low | Централен logger сервис |
| MathInput `.d.ts` декларација | Low | 30 мин |

---

## 5. Средно стручно образование — кога и како

### Кога
Откако ќе се исцрпи базата на гимназиски испити (проценка: 2–4 месеци дневен прилев).

### Структура на нови испити
```json
{
  "exam": {
    "track": "vocational-economics",   // ← НОВО ПОЛЕ
    "year": 2024,
    "session": "june",
    "language": "mk",
    "title": "ДИМ Средно стручно — Економија — Јуни 2024 (МК)",
    "questionCount": 30,
    "totalPoints": 61
  }
}
```

### Нови track вредности (приближни)
```
gymnasium         ← веќе постои
vocational-it
vocational-economics
vocational-electro
vocational-mechanical
vocational-health
```

### Нови curriculum концепти
Средно стручно математика ≠ гимназиска. Потребен нов `vocational.ts` curriculum file  
(паралелно со постоечкиот `gymnasium.ts`).  
conceptIds ќе имаат нов prefix: `voc-it-c1-1`, `voc-eco-c1-1` итн.

---

## 6. Редослед на следните спринтови

### Sprint S16 — Мatura Scale + Extraction Foundation
```
П1. track поле активација во UI (блокер за средно стручно)
П2. B1: YouTube captions → реална екстракција
П3. B2: Слики → задачи (Gemini Vision, 1-2 дена)
П4. V1: ForumCTA компонент во сите главни views
П5. G1: Gamma брендирање (watermark + pro school logo)
```

### Sprint S17 — M6 + Generator Integration
```
П1. M6 Phase 1: Recovery Worksheet PDF
П2. B5: Extraction → Generator pre-fill pipeline
П3. G3: PPTX export од Gamma view
П4. A3: Auto conceptIds при import
П5. V2: Forum thread permalink
```

### Sprint S18 — Quality & Depth
```
П1. M6 Phase 2: Teacher assignment
П2. G2: Gamma slide transitions
П3. G4: Contextual slide awareness
П4. EN/AL batch translations
П5. D1: Algebra equation balance
```

### S19+ — Interactive Math Platform
```
П1. Статистика интерактивни компоненти
П2. Forum FCM push
П3. Vocational curriculum + испити
П4. Multiplayer canvas (WebSocket)
П5. D2: Monte Carlo simulator
```

---

## 7. Непреговарачки принципи (наследени од WORLD_CLASS_PLATFORM)

1. Секоја production промена: owner + risk note + rollback note + validation evidence
2. TSC `--noEmit` + `npm run build` пред секој commit (enforced со husky)
3. Нема high-impact rollout ако reliability или security gate е црвен
4. SLO dashboard е оперативен извор на вистина, не декорација
5. Документацијата се ажурира во истата сесија кога се менува behavior
6. **Нема` as any`, нема `@ts-ignore`**
7. Матурата не смее да остане изолирана — секоја нова M-функција се поврзува со curriculum graph

---

## 8. Метрики за успех (KPI)

| Метрика | Тековно | Цел S16 | Цел S18 |
|---|---|---|---|
| Испити во базата | 10 | 30+ | 60+ |
| Концепти со conceptIds | 270/270 | 270/270 | 400+ (voc) |
| Video extraction реалност | 0% (само oEmbed) | YouTube captions | + Слики + Веб |
| Forum entry points | 1 (TopicView) | 5+ views | 8+ views |
| Gamma export formats | 0 | PPTX | PPTX + PDF |
| M6 coverage | 0% | Worksheet PDF | Teacher assignment |
| UI translation coverage | MK: 100%, EN/AL/TR: 5% | MK: 100% | EN: 60%, AL: 40% |
| TSC грешки | 0 | 0 | 0 |

---

## 9. Evidence log

| Датум | Sprint | Промена | Статус |
|---|---|---|---|
| 2026-04-05 | S15/M5 | M5 Analytics + Cloud Persistence + Recovery Session + Mission Plan | DONE |
| 2026-04-05 | S15 | conceptIds enrichment 270/270 прашања | DONE |
| 2026-04-06 | UI | Home compact quote, Matura featured tool, Simulation year-grouped, Practice redesign | DONE |
| 2026-04-06 | SLO | PERMISSION_DENIED fallback на custom claims | DONE |
| 2026-04-06 | PLAN | Стратешки roadmap составен (овој документ) | DONE |

---

*Овој документ е единствениот извор на вистина за развојната патека. Секоја завршена задача добива ред во Evidence log. Секој нов приоритет се вметнува во соодветниот Sprint блок.*
