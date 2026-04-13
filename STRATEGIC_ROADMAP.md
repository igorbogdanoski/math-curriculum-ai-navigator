# Стратешки план за развој — Math Curriculum AI Navigator

> Датум на составување: 06.04.2026  
> Статус: АКТИВЕН — живи документ, се ажурира по секоја завршена фаза  
> Производствен домен: https://ai.mismath.net  
> Репо: igorbogdanoski/math-curriculum-ai-navigator
> Фазно извршување (нов циклус): види NEW_STRATEGIC_PLAN_2026-04-08.md

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
| M6 — Remediation | ✅ | Phase 1+2 оперативно затворени (worksheet + teacher assignment), следи scale-up |

### Испитна база (06.04.2026)
- **12 испити**: ДИМ Гимназиско 2024 (јуни + август) × MK/AL/TR + 2025 (јуни + август) × MK/AL + 2022 (август) × MK/AL
- **380 прашања** со partial conceptIds enrichment (2022/2023 во тек)
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

**Оперативна одлука (08.04.2026):**
- Прво се затвора матура базата со целосен опфат до 2008.
- Vocational програми и испити се отвораат **од следната недела** по формален close на овој матура milestone.

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

### Sprint S16 — Мatura Scale + Extraction Foundation ✅ ЗАВРШЕНА

```
П1. ✅ track поле активација во UI (MaturaSimulation + Library)
П2. ✅ V1: ForumCTA компонент — ConceptDetail, MaturaAnalytics, MaturaPractice, StudentTutor
П3. ✅ B1: YouTube captions → реална екстракција (api/youtube-captions.ts, no API key)
П4. ✅ B2: Image Extractor (Gemini Vision, drag+drop, 3 режими)
П5. ✅ G1: Gamma брендирање (watermark free/pro, schoolLogoUrl)
П6. ✅ G3: Gamma PPTX export (lazy pptxgenjs, dark theme, 9 slide типови)
П7. ✅ B3: Web Extractor (api/webpage-extract.ts, SSRF-safe, full pipeline)
```

### Sprint S17 — M6 + Generator Integration ✅ ЗАТВОРЕН
```
П1. ✅ M6 Phase 1: Recovery Worksheet PDF
П2. ✅ B5: Extraction → Generator pre-fill pipeline
П3. ✅ G3: PPTX export од Gamma view
П4. ✅ A3: Auto conceptIds при import
П5. ✅ V2: Forum thread permalink
```

### Sprint S18 — Quality & Depth ✅ ОПЕРАТИВНО ЗАТВОРЕН
```
П1. ✅ M6 Phase 2: Teacher assignment
П2. ✅ G2: Gamma slide transitions
П3. ✅ G4: Contextual slide awareness
П4. ↪ EN/AL batch translations — префрлено во новиот стратегиски план (финален translation sweep по целосен app audit)
П5. ✅ D1: Algebra equation balance + AlgebraTiles platform integration
```

### S19+ — Interactive Math Platform 🟨 ВО ТЕК / BACKLOG
```
П1. 🟨 Статистика интерактивни компоненти (DataViz + ProbabilityLab постојат, треба formal close scope)
П2. ⏳ Forum FCM push (forum-specific trigger недостасува)
П3. 🟨 Vocational curriculum + испити (curriculum foundation постои; старт по close на матура база до 2008, од следна недела)
П4. ⏳ Multiplayer canvas (WebSocket)
П5. ✅ D2: Monte Carlo simulator (DONE — LLN convergence + latency milestone затворени со Vitest)
```

### S19 Highest-Level Close Checklist (активен фокус)

#### 1. Forum FCM push → PARTIAL
- Backend trigger е имплементиран (`onForumReplyCreated`) и сега има explicit delivery observability за recipient count, missing-token skip path и multicast result.
- Недостасува: финален live replay proof за delivery во реална средина.

#### 2. DataViz + ProbabilityLab → DONE
- Formal acceptance е затворен со RTL/Vitest: session import → chart hydration, ProbabilityLab → DataViz transfer, Gamma chart-slide payload, ProbabilityLab measured/theoretical export.
- Close артефакт: roadmap evidence + passing targeted suites.

#### 3. Monte Carlo simulator → DONE
- Formal D2 close: LLN convergence test (deterministic 50/50 mock, 1000 flips, |exp−theor| ≤ 5%) + latency benchmark (×1000 < 2 s) — оба Vitest tests passing.
- 4/4 ProbabilityLab acceptance tests passing (2 от S19-P1, 2 нови D2 milestones).

#### 4. Gamma + Algebra final hardening → DONE
- Final QA signoff е поткрепен со regression/acceptance tests за Gamma chart payload, Algebra guided solve, balance solve и read-only classroom embed.
- Export/accessibility/preset quality повеќе не се само рачна претпоставка.

#### Definition of done за овие 4 ставки
- `npm run build` PASS
- `npx tsc --noEmit` PASS
- релевантни Vitest/RTL тестови PASS
- roadmap snapshot + evidence log ажурирани во истата сесија

### S19 Execution Mode — Vercel Pro ✅ АКТИВЕН (08.04.2026)

Од 08.04.2026 платформата работи на **Vercel Pro** (корисничка претплата: 20/месечно), со цел да се избегне непотребно консолидирање на API endpoints и да се задржи чиста архитектура во S19.

#### Budget protection mode (критично, активен од 08.04.2026)
- Тековен циклус: 29 дена преостанати, Function Invocations: $0.60 од $20 кредит.
- Политика: без експериментални heavy jobs во production додека не постои јасен KPI и rollback.
- Hard cap по недела: максимум 2 нови backend endpoints и максимум 1 long-running extraction експеримент.
- Секој batch/extraction endpoint мора да има timeout guard + rate limit + fail-fast fallback.
- Ако projected spend надмине 70% од месечен буџет пред последните 7 дена од циклус: веднаш feature freeze за non-critical workloads.
- Ако projected spend надмине 85%: дозволени се само bugfix/security/incident промени.

#### Operational guardrails (важат и на Pro)
1. Нов endpoint се додава само со: owner + KPI + rollback note.
2. Максимум 2 нови endpoints неделно (освен incident/production hotfix).
3. Секој endpoint мора да има 60-дневен review: keep, merge или deprecate.
4. Не се укинуваат quality gates: `tsc --noEmit`, `npm run build`, релевантни тестови.

#### S19 Acceptance criteria (Pro mode)
| Item | Acceptance criteria | Validation evidence |
|---|---|---|
| S19-P2 Forum FCM push | Reply на thread тригерира push до учесници; dedupe за авторот; fail-safe без crash | E2E replay path + логови од notifier endpoint |
| S19-P3 Vocational exam pipeline | Import + enrich работи за најмалку 1 vocational track; `track` филтер и групирање валидни во UI | `npm run matura:validate` + UI smoke + sample exam import evidence |
| S19-P1 Interactive stats formal close | DataViz/ProbabilityLab имаат финален scope документ и затворен milestone | Acceptance checklist + demo recording |
| S19-P4 Multiplayer canvas | Докажан стабилен session lifecycle (create/join/leave) и basic sync без data loss | Integration test + latency snapshot |

#### Weekly review cadence
- Понеделник: endpoint budget check (нови vs deprecate)
- Среда: reliability check (SLO + error categories)
- Петок: sprint evidence update во овој roadmap

### Audit Snapshot — 08.04.2026 (Professional Handoff)
| Item | Статус | Доказ / Белешка |
|---|---|---|
| S17-P1 | DONE | Recovery worksheet modal + assignment flow + E2E тестови |
| S17-P2 | DONE | `handleGenerateFromExtraction()` + extraction pre-fill панел |
| S17-P3 | DONE | Gamma `exportGammaPPTX()` + `pptxgenjs` lazy import |
| S17-P4 | DONE | `scripts/import-matura.mjs` + `matura-concept-map.mjs` auto-map |
| S17-P5 | DONE | `#/forum?thread=<id>` deep-link + copy link |
| S18-P1 | DONE | Teacher assignment за `RECOVERY_WORKSHEET` |
| S18-P2 | DONE | Gamma transitions + reduced-motion hardening |
| S18-P3 | DONE | slide context continuity (`concept/formulas/priorFormulas`) |
| S18-P4 | DEFERRED | EN/AL batch translations свесно се префрлаат во новиот стратегиски план, по целосен app audit и section-by-section translation sweep |
| S18-P5 | DONE | D1 Алгебарски плочки — balance mode + BalanceScaleSvg SVG анимација + 14 grade-organized presets (6–10. одд.) во AlgebraTilesCanvas |
| S19-P1 | DONE | DataViz/ProbabilityLab formal acceptance затворен со RTL/Vitest coverage за session import, ProbabilityLab→DataViz transfer и Gamma chart-slide payload |
| S19-P2 | PARTIAL | forum reply FCM backend trigger постои; dedupe/no-token/result observability додадена, но live replay validation останува за финален DONE close |
| S19-P3 | PARTIAL | vocational curricula (`vocational3/4`) постојат; vocational matura exams не се затворени |
| S19-P4 | OPEN | Нема WebSocket canvas module |
| S19-P5 | DONE | D2 Monte Carlo формално затворен: LLN convergence (≤5% deviation after 1000 flips) + latency (<2s) Vitest tests passing; 4/4 ProbabilityLab suite |
| S19-PRO | DONE | Vercel Pro execution mode активиран; S19 endpoint growth дозволен со guardrails и acceptance criteria |
| S19-AT | DONE | AlgebraTiles world-class upgrade — balance mode (D1), 14 grade-aware presets (6–10. одд.), compact/readOnly/onSolve props, Gamma `algebra-tiles` slide type, QuizViewer visual aid, AcademyLessonView `algebraTilesPreset` pass-through, `types.ts` schema integration |

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
| Video extraction реалност | 0% (само oEmbed) | ✅ YouTube captions | + Долги видеа |
| Image extraction | ❌ | ✅ Gemini Vision | + Batch + OCR |
| Web extraction | ❌ | ✅ HTML→text Vercel fn | + JS-rendered pages |
| Forum entry points | 1 (TopicView) | ✅ 5+ views | 8+ views |
| Gamma watermark/branding | ❌ | ✅ Free+Pro tier | Custom color schemes |
| Gamma export formats | ❌ | ✅ PPTX (dark theme) | PPTX + PDF |
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
| 2026-04-06 | S16-A1 | track grouping во MaturaSimulation + MaturaLibrary; TRACK_LABELS/ACCENT/ORDER constants | DONE |
| 2026-04-06 | S16-V1 | ForumCTA компонент (inline/banner/float); вграден во ConceptDetail, MaturaAnalytics, MaturaPractice, StudentTutor | DONE |
| 2026-04-06 | S16-P3 | YouTube real transcript extraction — api/youtube-captions.ts (no API key); auto-fetch on preview; transcript → Gemini prompt | DONE |
| 2026-04-06 | S16-P4 | Image Extractor — ImageExtractorOptions (drag+drop, 3 modes); Gemini Vision inlineData; registered in all UI entry points | DONE |
| 2026-04-06 | S16-P5 | Gamma Branding — watermark overlay (free: ai.mismath.net, pro: schoolName/logo); schoolLogoUrl field in TeachingProfile | DONE |
| 2026-04-06 | S16-P6 | Gamma PPTX export — lazy pptxgenjs; dark theme; all 9 slide types; speaker notes; footer watermark per slide | DONE |
| 2026-04-06 | S16-B3 | Web Extractor — api/webpage-extract.ts (SSRF-safe, HTML→text); WEB_EXTRACTOR type; WebExtractorOptions; full generator pipeline | DONE |
| 2026-04-06 | S16-M1 | August 2022 (MK + AL) Gymnasium enriched; June 2023 TR partial integration (1-17) | DONE |
| 2026-04-07 | S17-P1 | Recovery Worksheet (M6) — AI PDF со слаби концепти; Gemini HTML; window.print(); матура analytics интеграција | DONE |
| 2026-04-07 | S17-P2 | Extraction → Generator pre-fill (B5) — cyan quick-pick панел по екстракција; handleGenerateFromExtraction(); extractedText state | DONE |
| 2026-04-07 | S17-P3 | Gamma PPTX export (G3) — веќе завршена во S16-P6; skip | DONE |
| 2026-04-07 | S17-P4 | Auto conceptIds при import (A3) — matura-concept-map.mjs shared module; import-matura.mjs auto-lookup; enrich script рефакториран | DONE |
| 2026-04-07 | S17-P5a | Home redesign: quote bubble (gradient + speech tail) + compact tools list + full SEO (JSON-LD, OG, Twitter, hreflang, author: Игор Богданоски) | DONE |
| 2026-04-07 | S17-P5 | Forum thread permalink — ?thread=<id> sharable URL; TeacherForumView deep-link; history.replaceState; Copy link button | DONE |
| 2026-04-07 | S18-B1 | Test quality: 429/429 passing — fix stale videoPreview tests + sanitizeWorksheetHtml utility + 9 new security tests | DONE |
| 2026-04-07 | S18-B2 | M6-P2 Teacher Recovery Assignment — send worksheet to class; saveAssignment(); Assignment type + RECOVERY_WORKSHEET; ActivityFeed deep-link | DONE |
| 2026-04-07 | S18-B3 | M6 E2E hardening — Playwright recovery suite: assignment submit path, Recovery→MaturaPractice prefill, 7-day plan start path (3 tests passing) | DONE |
| 2026-04-07 | S18-B4 | Matura local fallback fix — preserve conceptIds in local import path so M5 weak-concept analytics works without Firestore | DONE |
| 2026-04-07 | S17-H1 | Gamma hardening — extracted context inference utilities + 7 unit tests; reduced-motion aware transitions for accessibility and lower motion sensitivity | DONE |
| 2026-04-07 | S17-H2 | Gamma modal regression tests — context strip (explicit + inferred formulas), keyboard navigation, progress-dot jump, reduced-motion no-animation assertions (RTL/Vitest) | DONE |
| 2026-04-07 | S17-H3 | Gamma accessibility hardening — modal `role=dialog` + `aria-modal`, focus restore on close, live-region slide/status hints, grouped slide-dot navigation semantics | DONE |
| 2026-04-07 | S17-H4 | Gamma integration guard test — `generatePresentation` prompt/schema validated for `concept/formulas/priorFormulas` continuity fields | DONE |
| 2026-04-07 | S18-B5 | Extraction structuring foundation — `extractionBundle` (formulas/theory/tasks) persisted in extractor-generated materials with `sourceMeta` (conceptIds/topicId/grade/track) for curriculum linkage | DONE |
| 2026-04-07 | S18-P2 | Gamma transitions (G2) — directional keyframe animations (`gamma-enter-right/left/up`, `gamma-enter-fade-scale`), transition tick remount, animated dot-jump navigation | DONE |
| 2026-04-07 | S18-P3 | Contextual slide awareness (G4) — slide `concept/formulas/priorFormulas` metadata; generator prompt/schema continuity rules; Gamma context strip with concept + prior formulas fallback inference | DONE |
| 2026-04-07 | S18-PWA | PWA skipWaiting fix — skipWaiting:true + clientsClaim:true in workbox config; stale bundle issue resolved | DONE |
| 2026-04-07 | S18-M1 | Matura pipeline: legacy 40Q validator; AL/TR Cyrillic normalization script; 2021+2022 full import (11 exams); conceptIds enrichment 410/788 | DONE |
| 2026-04-07 | S18-B6 | Extraction robustness — `api/webpage-extract.ts` upgraded with PDF native text extraction (`pdf-parse`) and JS-rendered reader fallback path; returns `sourceType/extractionMode` metadata | DONE |
| 2026-04-07 | S18-B7 | Library extraction intelligence — Content Library adds source filter (video/image/web), extraction-aware search ranking, source/bundle chips, and structured preview panels for formulas/theory/tasks | DONE |
| 2026-04-07 | S18-B8 | Curriculum linkage depth — extractor outputs now auto-map inferred conceptIds from extracted bundle text (utility + unit tests), merged with teacher-selected concepts | DONE |
| 2026-04-07 | S18-B9 | PDF OCR fallback — `api/webpage-extract.ts` now falls back to Gemini document OCR for scanned/low-text PDFs (`pdf-ocr-fallback` mode) when native parse is weak | DONE |
| 2026-04-07 | S18-B10 | Multi-source batch extraction — Web Extractor supports batch URL intake (up to 8), merged source context, failed URL tracking, and persisted source metadata for generator/linkage | DONE |
| 2026-04-07 | S18-B11 | Extraction quality scoring — bundle quality metrics (`score/label/formula/theory/task/text-signal`) computed and persisted in `sourceMeta`, surfaced in Content Library chips and preview | DONE |
| 2026-04-08 | AUDIT | S17/S18/S19+ статус ревизија: S17 затворен; S18 делумно (отворени EN/AL batch translations, Algebra equation balance); S19+ класифициран во DONE/PARTIAL/OPEN за handoff продолжување | DONE |
| 2026-04-08 | S18-P5 | D1 Algebra equation balance целосно затворен преку `AlgebraTilesCanvas` balance mode + grade-aware presets + cross-app integration | DONE |
| 2026-04-08 | PLAN | EN/AL batch translations свесно извадени од активен sprint scope и префрлени во новиот strategic plan по целосен app audit | DONE |
| 2026-04-08 | S19-AT | AlgebraTiles world-class upgrade — balance mode, 14 presets, compact/readOnly/onSolve, Gamma slide type, Quiz visual aid, Academy preset pass-through, schema integration | DONE |
| 2026-04-08 | F2 | Reopen verification: student wizard stress + full gate rerun | DONE | 24/24 wizard repeat и 106/106 full e2e (без flaky) |
| 2026-04-08 | F3 | Bundle/perf hardening wave-1+wave-2 | DONE | Perf budget PASS (total 9909.57 kB; third-party 6114.36 kB), smoke+auth-guard 21/21 |
| 2026-04-08 | S19-PRO | Vercel Pro execution mode activated with endpoint guardrails + measurable acceptance criteria for S19 | DONE |
| 2026-04-08 | S19-BUDGET | Budget protection mode activated (20 monthly plan): spend thresholds 70/85, weekly endpoint cap, and non-critical freeze rules | DONE |
| 2026-04-08 | PLAN-SEQ | Scope sequencing locked: complete matura test base to 2008 first, then start vocational programs/exams from next week | DONE |
| 2026-04-08 | S19-P2 | Forum reply FCM backend trigger shipped via Firebase Functions; final replay/dedupe/fail-safe validation remains for DONE close | PARTIAL |
| 2026-04-08 | S19-P1 | DataViz/ProbabilityLab formal close: targeted RTL/Vitest acceptance for session import, ProbabilityLab→DataViz transfer, Gamma chart-slide payload, and measured/theoretical export | DONE |
| 2026-04-08 | S19-P5 | Monte Carlo formal close: LLN convergence (1000 flips, ≤5% deviation) + latency benchmark (<2s) added in ProbabilityLab.test.tsx; ProbabilityLab suite 4/4 passing | DONE |
| 2026-04-08 | S19-REVIEW | Deep review bugfix wave: AlgebraTilesCanvas drag-state null-guard (undo-during-drag crash fix) + onAssignmentCreated FCM token dedupe hardening; full Vitest 456/456 + tsc + functions build PASS | DONE |
| 2026-04-08 | S19-HARDEN | Gamma + Algebra final hardening signoff: acceptance tests for guided solve, balance solve, read-only embed, and Gamma chart payload | DONE |
| 2026-04-08 | S19-P2 | Forum FCM observability hardening: recipient/token dedupe logs, missing-token skip evidence, and multicast delivery result logging | PARTIAL |
| 2026-04-08 | S20-KICKOFF | Pedagogical RAG Vision execution plan created (`PEDAGOGICAL_RAG_VISION_EXECUTION_PLAN_2026-04-08.md`): pedagogy-first homework/test grading, curriculum RAG alignment, scan-archive foundation, and immediate P0 backlog | DONE |
| 2026-04-08 | S20-P0.1 | Vision RAG contracts draft created (`docs/VISION_RAG_CONTRACTS_V1.md`) for `homework_feedback`, `test_grading`, `content_extraction` with schema and fallback policies | DONE |
| 2026-04-08 | S20-P0.2 | Test-review robustness kickoff: `gradeTestWithVision` now validates JSON rows, retries once with strict contract prompt, and throws explicit errors instead of silent empty success; `WrittenTestReviewView` now surfaces actionable error state on empty/invalid grading | DONE |
| 2026-04-08 | S20-P0.3 | Vision depth wiring kickoff: `AIVisionGraderView` now passes selected analysis depth to `analyzeHandwriting`; service prompt differentiates `standard` vs `detailed` mode with pedagogical diagnosis + remediation micro-steps | DONE |
| 2026-04-08 | S20-P0.4 | Scan-archive schema scaffold added in `types.ts` (`ScanArtifactRecord`, `VisionAssessmentMode`, `PedagogicalFeedbackEntry`) as foundation for persistent saved scanned artifacts with pedagogical and extraction metadata | DONE |
| 2026-04-08 | S20-P0.4a | First runtime persistence wired: OCR homework flow now persists `scan_artifacts` records via new `saveScanArtifactRecord` Firestore service method with teacher/school linkage, mode/source metadata, extracted text and quality summary; persistence failures are surfaced without discarding analysis result | DONE |
| 2026-04-08 | S20-P0.4b | Written-test archive persistence wired: `WrittenTestReviewView` (single + batch) now saves `test_grading` scan artifacts with per-question pedagogical feedback, misconception hints and grading summary while keeping grading UX resilient on persistence failure | DONE |
| 2026-04-08 | S20-P0.4c | Extraction archive persistence expansion: `useGeneratorActions` now saves `content_extraction` scan artifacts for image/web/video extractor flows (source metadata, extracted text, extraction bundle, quality labels) as non-blocking archival writes | DONE |
| 2026-04-08 | S20-P0.5 | Extraction endpoint hardening wave-1: `api/youtube-captions.ts` and `api/webpage-extract.ts` now require Firebase bearer auth, include per-user in-memory rate limiting (20/min), enforce Authorization CORS header, add stricter SSRF host blocking (localhost/private/link-local/internal/metadata) and tighter timeout guards | DONE |
| 2026-04-08 | S20-P0.5a | Client compatibility patch for hardened endpoints: `MaterialOptions` web-extract calls and `videoPreview` YouTube captions requests now attach Firebase bearer token from current user to avoid auth regressions after server hardening | DONE |
| 2026-04-08 | S20-P0.6 | Targeted quality gate for new S20 surface: added unit tests for `saveScanArtifactRecord` Firestore payload/timestamps and YouTube captions bearer-header propagation (`services/firestoreService.materials.scanArtifact.test.ts`, `utils/videoPreview.captionsAuth.test.ts`); focused Vitest run PASS (3/3) | DONE |
| 2026-04-08 | S20-P0.7 | API hardening tests added for extractor endpoints: `api/webpage-extract.hardening.test.ts` validates SSRF unsafe-host blocking + 20/min limiter, `api/youtube-captions.hardening.test.ts` validates per-user limiter isolation; focused Vitest run PASS (7/7 across S20 targeted suite) | DONE |
| 2026-04-08 | S20-P0.8 | Full gate verification for active S20 set: `npx tsc --noEmit` PASS, `functions npm run build` PASS, `npm run build` PASS (PWA precache generated; no blocking errors) | DONE |
| 2026-04-08 | S20-P1.1 | Scan-archive observability hardening: centralized `persistScanArtifactWithObservability` helper wired in OCR homework, written-test review, and extraction flows with structured success/failure telemetry (`flow/stage/mode/sourceType/duration`) + Sentry capture on persistence failure; helper unit tests added (`services/scanArtifactPersistence.test.ts`) | DONE |
| 2026-04-08 | S19-P2b | Forum FCM replay validation path: `functions/src/index.ts` refactored with reusable delivery pipeline + new authenticated callable `replayForumReplyNotification` supporting dry-run/live replay for recipient/token resolution and production replay evidence without changing trigger behavior | DONE |
| 2026-04-08 | S19-P2c | Forum FCM runtime validation partial: deployed `onForumReplyCreated` + `replayForumReplyNotification`, seeded synthetic thread/reply in `ai-navigator-ee967`, observed `delivery attempt` and `delivery result` logs with `recipientCount:1`, `uniqueTokenCount:1`, `failureCount:1` against fake test token; backend no-crash path verified, final DONE still requires one real browser token replay | PARTIAL |
| 2026-04-08 | S19-P2d | Authenticated callable replay re-run completed against `KC7qZl06E4s493m7XOxt` / `K3uIvBqqqJw5gMfew3mZ`: `dryRun` returned 200 with `recipientCount:1` + `uniqueTokenCount:1`, `liveRun` returned 200 with `successCount:0`, `failureCount:1`; confirms callable/auth path is healthy and close is blocked only by stale browser token refresh on recipient side | PARTIAL |
| 2026-04-08 | S19-P2e | Forum replay security hardening: `replayForumReplyNotification` now authorizes only admins or actual thread participants and blocks non-admin author impersonation; deployed to Firebase Functions and admin dry-run replay revalidated (`ok:true`, `recipientCount:1`, `uniqueTokenCount:1`) | DONE |
| 2026-04-08 | S19-HARDEN-2 | Forum unread + school onboarding integrity: thread-level `participantUids` denormalization added (`createForumThread` + `createForumReply`), unread badge now counts participated threads (deduped merge), and `/api/create-school` switched to atomic Firestore batch (school + user role link in single commit); Vercel production deploy + smoke route sweep executed | DONE |
| 2026-04-13 | SEC-DATA | Сите 5 MoN средно образование програми во дата-слој: vocational4 (X–XIII, 3ч), vocational3 (X–XII, 2ч), vocational2 (X–XI, 2ч), gymnasium (X–XIII, 4ч), gymnasium_elective (XI–XIII, 3ч) — 4 340 линии официјална MoN содржина | DONE |
| 2026-04-13 | SEC-P1 | P1 Bug fix: `parseInt(grade.id)` → `grade.level ?? 1` во TeacherAnalyticsView:187 — gradeLevel беше NaN→1 за сите secondary quiz резултати | DONE |
| 2026-04-13 | SEC-P2 | P2 AI secondary context: `getSecondaryTrackContext()` во `services/gemini/core.ts` — инјектирана во 5 AI entry-points (Chat, AnnualPlan, Assessment, Plans×3); секој track добива свој педагошки AI блок со ч/нед, пристап и примери | DONE |
| 2026-04-13 | SEC-P3 | P3 Default grade fix: `getDefaultGradeId()` извезена од `useGeneratorState.ts` — secondary наставници добиваат одд. 10 наместо одд. 1 во AnnualPlanGenerator | DONE |
| 2026-04-13 | SEC-P4 | P4 Secondary standards: `allNationalStandards` useMemo во `useCurriculum.ts` — secondary `assessmentStandards` сега видливи во StandardsTab и CoverageAnalyzer | DONE |
| 2026-04-13 | SEC-P5 | P5 Matura mapping: `SECONDARY_TRACK_TO_MATURA_TRACKS` константа во `types.ts` + smart default exam во MaturaLibraryView (vocational4→vocational-it, gymnasium→gymnasium) | DONE |
| 2026-04-13 | SEC-P6 | P6 weeklyHours: `Grade.weeklyHours?: 2\|3\|4` во types.ts + сетирано на сите 18 secondary Grade објекти (gymnasium:4, gymnasium_elective:3, vocational4:3, vocational3:2, vocational2:2) | DONE |
| 2026-04-13 | MATURA-PIPE | Матура pipeline верификација: 57 raw JSON фајлови (2 004 прашања, 2016–2025, MK+AL+TR, 2020-август отсутен COVID ✓) веќе поврзани преку `import.meta.glob` во firestoreService.matura.ts — сè работи | DONE |
| 2026-04-13 | MATURA-DEAD | `data/matura/index.ts` (570 линии мртов код — никогаш не се увезувал) — ИЗБРИШАН | DONE |
| 2026-04-13 | GRAPH-SEC | CurriculumGraphView: бои за одд. X–XIII, getRomanGrade за 10–13, smart default selection по secondaryTrack, динамична легенда (наместо хардкодирана 6–9) | DONE |
| 2026-04-13 | ROAD-SEC | RoadmapView: `grade.weeklyHours` за точни часови на secondary (2/3/4ч); `getDefaultGradeId` за smart default grade — стручни наставници отвораат на одд. 10 | DONE |
| 2026-04-13 | QA | Quality gate: tsc EXIT:0 \| vitest 535/535 PASS \| npm run build ✓ (33s) \| Playwright 10/10 | DONE |
| 2026-04-13 | B2-3 | Matura Readiness Path: `computeReadinessPath()` pure fn + `useMaturaReadinessPath` hook (localStorage exam date, SM-2 gaps); MaturaAnalyticsView патека card + date picker; `MaturaNextStepWidget` на HomeView (600ms defer, route `/matura-stats`) | DONE |
| 2026-04-13 | B4-1 | Vocational4 Economics мatura: 6 испити (2022-2024, јуни+август, MK), 20Q×6=120 прашања, 40pts/120min. Концептни IDs верифицирани и поправени: `voc4-10-c2-5`→`voc4-10-c4-2`, `voc4-12-c4-4/5`→`voc4-12-c5-2` | DONE |
| 2026-04-13 | B4-2 | aiSolution on-demand: `handleGenerateSolution` во `QuestionCard` со `callGeminiProxy({model,contents,generationConfig})`; localStorage cache (`matura_ai_sol_{examId}_{q}`); Part 2+3 show generated solution | DONE |
| 2026-04-13 | B1-3 | Central logger `utils/logger.ts`: `info` (dev-only), `warn/error` (all envs + Sentry); замена на console.log во firestoreService.quiz, indexedDBService, pushService | DONE |
| 2026-04-13 | B5-1 | FCM silent token refresh: `silentRefreshFCMToken(uid)` во pushService + dynamic import во App.tsx на `firebaseUser` auth event; stale token root cause: registration само при explicit Settings click | DONE |

---

*Овој документ е единствениот извор на вистина за развојната патека. Секоја завршена задача добива ред во Evidence log. Секој нов приоритет се вметнува во соодветниот Sprint блок.*
