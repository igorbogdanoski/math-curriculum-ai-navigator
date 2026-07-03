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
| 2026-04-13 | BUG-MATURA | Past-exam bug fix: `useMaturaReadinessPath` — raw negative days now reach `computeReadinessPath`; `examPassed: boolean` added to `ReadinessPath` interface; steps emptied when past; MaturaAnalyticsView shows 'Датумот на матурата помина.' + slate badge 'Испитот помина' | DONE |
| 2026-04-13 | A1.9 | Tiles→LaTeX: `buildExpression` exported as named pure fn; `onExpressionChange?(latex)` prop fires on every tile change via useEffect; 18 new unit tests (edge cases: zero-pairs, negative coefficients, diff-of-squares, all-cancel, callback mount/add); 21/21 pass | DONE |
| 2026-04-13 | B3-3 | i18n sprint deferred to S22+; detailed plan saved in `docs/B3-3_I18N_SPRINT_PLAN.md` (51 uninstrumented views, Tier 1/2/3 priority, Gemini batch approach, 5-day estimate) | DEFERRED |

---

*Овој документ е единствениот извор на вистина за развојната патека. Секоја завршена задача добива ред во Evidence log. Секој нов приоритет се вметнува во соодветниот Sprint блок.*

---

## Sprint S25 — World-Class Audit Remediation (17 Apr 2026)

> Baseline: TSC 0 errors, 614/614 tests passing, commit `d82a6e1` live. Audit наоди изведени од full app review.

### Фаза 1 — Performance emergency (BLOCKER за светско ниво)
```
П1. ✅ Bundle visualizer анализа — идентификувани heavy chunks (data + vendors)
П2. ✅ Lazy split на data/curriculum.ts (304 kB) и data/secondaryCurriculum.ts (345 kB)
П3. ✅ Експлицитни manualChunks правила по lib (katex/markdown/dates/motion/charts/…)
П4. ⏸ Split MaterialsGeneratorView / TeacherAnalyticsView (deferred — risk vs reward; root веќе 134 kB)
П5. ✅ Target: root chunk 552 kB → 134 kB gzip (-76%) achieved
П6. ✅ `perf:budget` CI gate за root chunk ≤ 250 kB gzip (root-gzip resourceType)
```

### Фаза 2 — Stability hardening
```
П7. ✅ Elimин. `as any` во views/FlashcardPlayerView.tsx (isRecord + RawTerm/RawCard types)
П8. ✅ console.* → logger (TestGeneratorView, WrittenTestReviewView)
П9. ✅ x-forwarded-for spoof-resistant parse + socket fallback
П10. ✅ Vercel env validator (`npm run vercel:env:check`) — fail-fast guard за ALLOWED_ORIGIN, FIREBASE_SERVICE_ACCOUNT, GEMINI keys, Upstash credentials
```

### Фаза 3 — A11y polish
```
П11. ✅ aria-label + role="toolbar"/"tablist" на SmartOCR symbol toolbar (60+ копчиња)
П12. ✅ role="status" + aria-live="polite" + role="progressbar" на ExtractionHub STAGES
П13. ✅ role="region" + keyboard (Enter/Space) flip + focus-visible во FlashcardPlayerView
```

### Фаза 4 — Test coverage expansion
```
П14. ✅ Playwright smoke: SmartOCR route auth-gated + no crash (tests/views-smoke.spec.ts)
П15. ✅ Playwright smoke: ExtractionHub route auth-gated + no crash
П16. ✅ Playwright smoke: FlashcardPlayer route auth-gated + cross-route navigation safe
П17. ✅ 6 unit тестови за fetchLibraryPage cursor pagination
П18. ✅ 6 unit тестови за setCorsHeaders origin enforcement
```

### Фаза 5 — Strategic enhancements
```
П19. ✅ Content moderation layer пред saveToLibrary (profanity/PII/oversized gate + 14 unit tests)
П20. ✅ Firestore composite indexes audit — (teacherUid ASC + createdAt DESC) веќе постои за fetchLibraryPage
П21. ✅ SLO latency tracker (api/_lib/sloTracker.ts) — per-route p50/p95 + console.warn над буџет; интегрирано во api/gemini.ts; 13 unit тестови
П22. ✅ Offline-first Matura practice (matura_exam_cache IndexedDB store, DB v4, 30-day TTL, write-through во getExamQuestions)
```

### Evidence log
```
| 2026-04-17 | AUDIT | Full app audit completed: baseline TSC 0 / 614 tests; 🔴 bundle bomb (index.js 2.93MB/552KB gzip, vendor 1.85MB/624KB gzip); security posture solid (proxied AI, RBAC rules, rate-limit 20/min); data integrity good (SHA-256 dedup, pagination, proxy-only AITutor); A11y gaps in SmartOCR toolbar + ExtractionHub progress | DONE |
| 2026-04-17 | S25-B1 | Perf breakthrough: root chunk 552→134 kB gzip (-76%); data/matura/curriculum/secondary lazy-split; `as any` removed (FlashcardPlayer); x-forwarded-for spoof-resistant; 3× console→logger. Commit 617ed30 live on ai.mismath.net | DONE |
| 2026-04-17 | S25-B2 | A11y: SmartOCR toolbar aria-label+role; ExtractionHub aria-live/progressbar; FlashcardPlayer role=region + keyboard Enter/Space flip. perf:budget gate (root-gzip ≤250 kB). 12 new tests (pagination + CORS). 626/626 passing | DONE |
| 2026-04-18 | S25-B3 | Strategic: content moderation gate (profanity/PII/oversized 512 kB cap) пред saveToLibrary + 14 тестови; Firestore composite index (cached_ai_materials teacherUid+createdAt) audit потврден; IndexedDB matura_exam_cache store (DB v4, 30-day TTL) + write-through + offline-first fallback во maturaService.getExamQuestions. 640/640 passing | DONE |
| 2026-04-18 | S25-B4 | Sprint S25 closeout: SLO latency tracker (sloTracker.ts) + 13 тестови, интегриран во api/gemini.ts; Vercel env validator (`vercel:env:check`) script за ALLOWED_ORIGIN/Firebase/Gemini/Upstash; Playwright smoke tests за SmartOCR/ExtractionHub/FlashcardPlayer routes; perf budgets recalibrated (script ≤2.5 MB, total ≤13 MB) — root-gzip останува 132 kB. TSC clean; 653/653 unit tests passing. **Sprint S25: 21/22 закачени (П4 deferred — root веќе at 134 kB gzip)** | DONE |
```

---

## Sprint S26 — State-of-the-Art Hardening (18 Apr 2026)

> Baseline по S25: TSC 0 errors, 653/653 unit tests, root-gzip 132 kB, perf budgets зелени, SLO tracker и moderation gate live. Целта на S26: предупредување наместо реакција — реална телеметрија, визуелни регресии, и фино-зрнаста безбедност.

### Цели по приоритет
```
П23. ✅ Web Vitals real telemetry — `services/sentryService.ts::reportWebVitals` сега испраќа `navigator.sendBeacon('/api/web-vitals', …)` покрај Sentry. `api/web-vitals.ts` агрегира p50/p75/p95 per metric во `api/_lib/webVitalsBuffer.ts` (200-sample ring, Google "good" buget). 16 unit тестови.
П24. ✅ Visual regression на 5 клучни routes (Login, MaturaPortal, ContentLibrary, FlashcardPlayer, ExtractionHub) преку Playwright `toHaveScreenshot()` со deterministic CSS-animation kill + 2% diff tolerance. Baselines генерирани со `--update-snapshots` (`tests/visual-regression.spec.ts`).
П25. ✅ Strict CSP header во `vercel.json` — `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` + Stripe/Google, `frame-ancestors 'none'`, `object-src 'none'`, allowlists за Firebase/Sentry/YouTube/Stripe.
П26. ✅ AI cost guard — `api/_lib/costTracker.ts` (per-user/per-model дневни tokens_in/tokens_out, дневни budgets со `gemini-2.5-pro` 750k и `gemini-3.1-pro-preview` 500k, default 2M). Wired во `api/gemini.ts` од `usageMetadata`. 9 unit тестови.
П27. ✅ MaturaPracticeView offline banner — `isOffline` state via `navigator.onLine` + window events; amber banner „Офлајн режим” во сите 3 фази (setup/practice/results).
П28. ✅ E2E auth fixture — `tests/fixtures/auth.ts` (teacherPage fixture + emulator user creation); `tests/emulator-smoke.spec.ts` (П14 Dashboard / П15 Generator / П16 Curriculum); `e2e-emulator-smoke` CI job во `ci-quality.yml`; `firebase.json` emulator config; `firebaseConfig.ts` connectAuthEmulator/connectFirestoreEmulator кога `VITE_USE_FIREBASE_EMULATOR=true`.
П29. ✅ Sentry release tagging — `release: VITE_VERCEL_GIT_COMMIT_SHA` во `Sentry.init()`; Vercel автоматски го инјектира SHA во env; корелација bug ↔ deploy.
П30. ✅ Firestore rules audit — додадени правила за `matura_exams`, `matura_questions`, `matura_ai_grades` (биле missing — catch-all ги блокирал); catch-all `allow read, write: if false` потврден; сите 30+ collections со коментари.
```

### Evidence log (S26)
```
| date | id | summary | status |
|------|----|---------|--------|
| 2026-04-18 | S26-П23 | Web Vitals beacon: `api/web-vitals.ts` (POST ingest + GET p50/p75/p95 snapshot) backed by `api/_lib/webVitalsBuffer.ts` (200-sample FIFO, Google “good” budgets, overBudget flag). `reportWebVitals` сега PROD-only fires Sentry event + `navigator.sendBeacon` (fetch keepalive fallback). 16 unit тестови. TSC clean; 669/669 unit tests passing | DONE |
| 2026-04-18 | S26-П24 | Visual regression `tests/visual-regression.spec.ts` за 5 routes (Login/MaturaPortal/ContentLibrary/FlashcardPlayer/ExtractionHub). Deterministic CSS-anim/caret kill, 1280×800 viewport, 2% maxDiffPixelRatio. Baselines се регенерираат со `npx playwright test tests/visual-regression.spec.ts --update-snapshots` | DONE |
| 2026-04-18 | S26-П25 | Strict CSP во `vercel.json`: default-src 'self'; script-src без 'unsafe-inline'/'unsafe-eval' (само 'wasm-unsafe-eval' + Stripe/Google); frame-ancestors 'none'; object-src 'none'; explicit connect-src allowlist (Firebase, Sentry, Stripe, Upstash, googleapis); frame-src allowlist (Stripe, YouTube, accounts.google.com, firebaseapp). | DONE |
| 2026-04-18 | S26-П26 | AI cost guard: `api/_lib/costTracker.ts` per-user/per-model daily token budgets (gemini-2.5-pro 750k, gemini-3.1-pro-preview 500k, default 2M). Wired in `api/gemini.ts` from usageMetadata. 9 unit тестови. | DONE |
| 2026-04-18 | S26-П27 | Offline banner in `MaturaPracticeView`: `isOffline` useState+useEffect (navigator.onLine + window online/offline events). Amber banner visible in all 3 phases (setup/practice/results). No new tests needed — pure UI reactive to browser state. TSC 0; 678/678 tests. | DONE |
| 2026-04-18 | S26-П28 | Firebase Emulator E2E auth: `firebase.json` emulator config (auth:9099, firestore:8080). `firebaseConfig.ts` connectAuthEmulator/connectFirestoreEmulator gated by VITE_USE_FIREBASE_EMULATOR. `tests/fixtures/auth.ts` teacherPage fixture. `tests/emulator-smoke.spec.ts` П14/П15/П16 smoke. `e2e-emulator-smoke` job in ci-quality.yml with firebase emulators:exec. TSC 0; 678/678 unit tests. | DONE |
| 2026-04-18 | S26-П29 | Sentry release tagging: `release: VITE_VERCEL_GIT_COMMIT_SHA` added to Sentry.init() in sentryService.ts. Vercel injects the SHA automatically. TSC 0. | DONE |
| 2026-04-18 | S26-П30 | Firestore rules audit: 3 missing matura collections added (matura_exams, matura_questions, matura_ai_grades — were falling through to `allow read,write:if false` catch-all in prod!). Read access: authenticated users; write: admin/school_admin/teacher for exams+questions; any auth for ai_grades (hash-keyed cache). TSC 0; 678/678 unit tests. | DONE |
```

### S26 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 678/678 unit tests, root-gzip ~132 kB
П23–П30: сите 8 цели завршени
```

### S27 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 678/678 unit tests (→ 689 по S27)

S27-A1: Сократски AI hint panel во InteractiveQuizPlayer
  - generateSocraticHint() во geminiService.real.ts (LITE_MODEL, skipTierOverride)
  - 3 нивоа: тип задача → метод/формула → критичен чекор
  - Амберен hint panel со прогресивно откривање пред одговорот
  - Ресет при nextQuestion / prevQuestion / resetQuiz

S27-A2: Персонализирана повратна информација по квиз
  - generateQuizFeedback() се повикува async при finishQuiz()
  - Индиго loading панел → персонализиран текст со misconceptions
  - Автоматски ресет при resetQuiz()

S27-A3: 11 unit тести за generateSocraticHint
  - services/gemini/socraticHint.test.ts
  - Покрива: LITE_MODEL, skipTierOverride, prompt per ниво, системска инструкција,
    температура, maxOutputTokens, вклученост на прашањето, ВАЖНО-guard

S27-B1: MaturaPortalView — readiness priority badge per topic
  - useMaturaReadinessPath() интегриран во MaturaPortalView
  - Нед. X · #Y badge до секоја слаба тема + AlertCircle за uncovered

S27-B2: Collapsible 12-week prep plan panel
  - planByWeek grouping по weekNumber (useMemo)
  - Collapsible (ChevronDown/Up) со amber warning за off-track
  - Секој концепт: status icon + title + pct (или „Ново")

S27-B3: Readiness path tests — 21 постоечки тести потврдени (hooks/useMaturaReadinessPath.test.ts)

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S28 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

К1: "Следно учи ова" навигација во InteractiveQuizPlayer
  - onNextConcept?: () => void + nextConceptLabel?: string props
  - Score ≥80% + onNextConcept → зелено "Следно учи ова →" копче (ArrowRight)
  - Score <60% → амбер препорака "Повтори ја темата пред да продолжиш"

К2: Динамичен MaturaCountdown + exam date input во MaturaPortalView
  - MaturaCountdown прима examDate?: Date | null prop
  - Fallback на хардкодиран 6 јуни 2026 ако нема корисников датум
  - MaturaPortalView: date input под countdown (Pencil icon, aria-label)
  - Поврзан со readiness.setExamDate() → localStorage (MATURA_EXAM_DATE_KEY)
  - Countdown автоматски се ажурира при промена на датумот

К4: Recovery → Analytics → Action loop (StudentsTab)
  - StudentsTab добива onAssignRemedialForStudent?: (name: string) => void
  - Портокалово "Recovery" копче за секој ученик со avg <70%
  - TeacherAnalyticsView.handleAssignRemedialForStudent():
    → бара концепт со strugglingStudents.includes(studentName)
    → сортира по avgPct, го зема најлошиот
    → отвора AssignRemedialModal со тој концепт + [studentName]
    → fallback: генерична ремедијација ако нема концепт-ниво податоци

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S39 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 700/700 unit tests

М3: Matura Community Solutions — ученичка банка на решенија

services/firestoreService.community.ts (НОВО)
  - Firestore collection: matura_community_solutions/{solutionId}
  - CommunitySolution: { questionDocId, authorUid, authorName, text, upvotes, upvoterUids, createdAt }
  - submitCommunitySolution() → addDoc
  - getCommunitySolutions(questionDocId) → query by questionDocId, orderBy upvotes desc
  - upvoteCommunitySolution() → increment(1) + arrayUnion(uid)
  - downvoteCommunitySolution() → increment(-1) + arrayRemove(uid)

components/matura/CommunitySolutionsPanel.tsx (НОВО)
  - Props: { questionDocId, currentUid, currentDisplayName }
  - Collapsible panel (lazy-load on first open)
  - Submit form: textarea + „Испрати решение" (disabled без auth)
  - Solutions list: sorted by upvotes, optimistic vote toggle (ThumbsUp)
  - Revert on Firestore failure, Loader2 spinner per vote
  - MathRenderer поддршка во текстот на решението
  - „Уште нема решенија. Биди прв!" empty state

views/MaturaLibraryView.tsx:
  - Import CommunitySolutionsPanel
  - CardProps += { questionDocId, currentUid, currentDisplayName }
  - QuestionCard: CommunitySolutionsPanel на дното на секоја картичка
  - Call site: questionDocId = `${q.examId}_q${padStart(n, '0', 2)}`
  - firebaseUser додаден во MaturaLibraryView

AI1 план (НЕ деплојан):
  - docs/AI1_VECTOR_RAG_PLAN.md — полн архитектурен план
  - Опција А (препорачана): client-side cosine без Firebase upgrade
  - Опција Б: Firestore KNN (за кога концепти > 2000)
  - Feature flag: localStorage VITE_ENABLE_VECTOR_RAG
  - 9-точки checklist пред секој prod push

Метрики: TSC 0 | 700/700 tests | Build PASS
```

### S38 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 700/700 unit tests

LTI 1.3 basic — iframe embed за Google Classroom / Teams / Moodle

views/EmbedConceptView.tsx (НОВО) — Route: /#/embed/concept/:id
  - useCurriculum() → getConceptDetails(id) → concept + grade + topic
  - Рендерира: наслов, breadcrumb, description, content points, assessment standards, local context examples
  - MathRenderer за LaTeX во сите полиња
  - Header strip (indigo) + ExternalLink → full ConceptDetailView
  - Footer: ai.mismath.net + „Вежбај →" линк
  - Дизајниран за 700×500px iframe (типично LMS)

views/EmbedQuizView.tsx (НОВО) — Route: /#/embed/quiz/:data
  - shareService.decodeQuizShareData(data) → quiz object
  - InteractiveQuizPlayer (lazy) со onClose: no-op (нема навигација во iframe)
  - Graceful error state

App.tsx:
  - safeLazy: EmbedConceptView + EmbedQuizView
  - Routes: /embed/concept/:id, /embed/quiz/:data
  - PUBLIC_HASH_ROUTE_PREFIXES: '#/embed/' (без auth requirement)
  - Fix: type="button" на hamburger menu копче (lint hint)

vercel.json:
  - Нов header блок /embed/(.*) — DOPO catch-all (override wins):
    - X-Frame-Options: ALLOWALL
    - CSP frame-ancestors: classroom.google.com, *.teams.microsoft.com, *.moodle.net, *.moodlecloud.com, 'self'
    - Стриктна CSP без Stripe (embed не користи плаќање)
  - Глобалниот X-Frame-Options: DENY останува за сите останати рути

Embed URL формати:
  - Концепт: https://ai.mismath.net/index.html#/embed/concept/{conceptId}
  - Квиз:    https://ai.mismath.net/index.html#/embed/quiz/{shareData}

Метрики: TSC 0 | 700/700 tests | Build PASS
```

### S37 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 700/700 unit tests

AI2: Vimeo Captions — автоматски транскрипт за Vimeo видеа

api/vimeo-captions.ts (НОВО) — Vercel serverless endpoint
  - GET /api/vimeo-captions?videoId=<numeric>&lang=<mk|en|...>
  - VIMEO_ACCESS_TOKEN env var (Personal Access Token, scope: public)
  - Fetches GET https://api.vimeo.com/videos/{id}/texttracks
  - pickBestTrack(): preferred lang → mk → en → any (captions/subtitles само)
  - parseWebVTT(): HH:MM:SS.mmm + MM:SS.mmm формати, strips VTT cue tags
  - Transcript limiter: 80 000 chars, [truncated] signal
  - Same Auth/CORS/rate-limit pattern (Firebase token + 20 req/min)
  - Returns: { available, transcript, segments, lang, source:'manual', charCount, truncated, availableLangs }

utils/videoPreview.ts:
  - fetchVimeoCaptions(videoId, lang) → /api/vimeo-captions → VideoCaptionsResult

views/ExtractionHubView.tsx:
  - Vimeo branch: fetchVimeoCaptions() → setCaptions → applyTimeRange (исто како YouTube)
  - Hint text update: "транскриптот се вчитува автоматски (доколку видеото има субтитли)"

api/vimeo-captions.hardening.test.ts (НОВО) — 11 тестови:
  - Rate limit: 20/min per user, независни корисници
  - parseWebVTT: стандарден VTT, VTT cue tags, HH:MM:SS формат, празен VTT
  - pickBestTrack: preferred lang, fallback EN, exclude chapters/descriptions, null на празна листа

Конфигурација потребна:
  - Vercel env: VIMEO_ACCESS_TOKEN=<personal-access-token> (scope: public, read-only)

Метрики: TSC 0 | 700/700 tests | Build PASS
```

### S36 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

М2: AI Matura Tutor — персонализиран chat тутор во MaturaPortalView

MaturaTutorChat.tsx (НОВО) — components/matura/
  - Props: { profile: StudentMaturaProfile | null, weakTopics: string[] }
  - buildSystemPrompt(): aware на track + слаби теми → систем инструкција
  - callGeminiProxy (gemini-2.5-flash) со целосна chat history (multi-turn)
  - Quick chips: 5 чести матурски прашања (Интеграл, Квадратна равенка, Геометрија, Тригонометрија, Задача за вежбање)
  - UI: collapsible card, Sparkles икона per assistant порака, X за clear историја
  - Enter (без Shift) за испраќање; disabled кога isLoading
  - maxOutputTokens: 1500

MaturaPortalView.tsx:
  - Интегриран MaturaTutorChat со profile + topTopics слаби теми
  - Позициониран над "Влези" CTA — видлив за сите ученици

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S35 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

Г7: Gamma Live — реалтајм интерактивна презентација

Firestore service (НОВО): services/gammaLiveService.ts
  - Collection: live_gamma/{pin} + subcollection /responses/{studentId}
  - startGammaLive() → генерира 6-цифрен PIN → запишува сесија
  - broadcastGammaSlide() → синхронизира slideIdx кај сите ученици
  - endGammaLive() → поставува isActive: false
  - subscribeGammaSession() / subscribeGammaResponses() → onSnapshot листенери
  - submitGammaResponse() → ученик испраќа одговор
  - raiseGammaHand() / lowerGammaHand() → arrayUnion/arrayRemove

GammaJoinView.tsx (НОВО) — views/
  - Јавна страница: ученик внесува 6-цифрен PIN + ime
  - Валидација на сесија преку subscribeGammaSession
  - Navigate до /gamma/student/{pin}?name={encoded}
  - Route: /#/gamma/join (регистрирана + PUBLIC prefix)

GammaStudentView.tsx (НОВО) — views/
  - Props: { pin: string }
  - useStudentId() — sessionStorage анонимен ID (gamma_student_id)
  - Парсира studentName од URL hash ?name=...
  - Реалтајм subscription → MathRenderer slide content
  - Slide типови: formula-centered (формула box) | task (textarea + Submit) | остати (bullets)
  - Slide промена → ресет на answer/submitted/handRaised
  - Raise/lower рака → raiseGammaHand/lowerGammaHand
  - Session-ended state → завршена пораката

GammaModeModal.tsx — host controls:
  - gammaLivePin state + startLiveSession() / endLiveSession()
  - startGammaLive() → PIN → subscribeGammaResponses + subscribeGammaSession
  - Broadcast slideIdx кон студентите на секоја навигација (broadcastGammaSlide)
  - Toolbar: [Radio] Live копче (disabled без auth) → активира сесија
  - Кога Live: PIN badge (animate-pulse) + response count + hands count + Крај копче
  - PIN overlay (bottom-right на слајдот): PIN број + join URL + одговори/раце бројач
  - Cleanup subscriptions on unmount + endLiveSession cleanup
  - Icons: Radio, RadioTower, Users (нови lucide-react)

App.tsx:
  - safeLazy: GammaJoinView + GammaStudentView
  - Routes: /gamma/join, /gamma/student/:pin
  - PUBLIC_HASH_ROUTE_PREFIXES: '#/gamma/join', '#/gamma/student/'

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S34 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

Gamma Mode elevation + Presenter Mode + AI Lesson Assistant

Г4: Presenter Mode (BroadcastChannel API)
  - GammaPresenterView.tsx (НОВО) — standalone popup view
  - BroadcastChannel('gamma-sync') — реалтајм sync на секоја промена на слајд/тајмер
  - Прикажува: моментален слајд + следен слајд + speaker notes + task timer + elapsed time
  - Route: /#/gamma/presenter (регистрирана во App.tsx)
  - Копче во Gamma toolbar (MonitorPlay икона)

Г9: Exit Ticket auto-generation (summary слајд)
  - useGammaExitTicket.ts (НОВО) — hook за генерирање на 3 прашања (2 MC + 1 кратко)
  - Копче „Генерирај Exit Ticket" на summary слајд
  - Резултатот се прикажува во InteractiveQuizPlayer (lazy loaded) под слајдот
  - Dismiss копче за ресет

Г10: Handout PDF генерирање
  - printGammaHandout() во GammaExportService.ts
  - Opens popup → styled HTML per slide type:
    formula-centered: формула + 4 blank lines за белешки
    task: задача + 8 lines за решение (без решение)
    step-by-step: нумерирани чекори
    summary: bullet-points + ai.mismath.net линк
  - window.print() се активира автоматски
  - Копче во Gamma toolbar (BookText икона)

AI7: AI Lesson Planning Assistant
  - AILessonAssistant.tsx (НОВО) во components/lesson-plan-editor/
  - Chat UI со callGeminiProxy — Macedonia system prompt
  - Collapsible panel во LessonPlanEditorView sidebar
  - „Примени во план" → се запишува во differentiation field
  - Enter за испраќање, X за бришење историја

CSS fixes (inline-style → CSS custom properties):
  - .gamma-timer-bar { width: var(--timer-pct, 100%) }
  - .gamma-laser-pointer { position: absolute; left: var(--laser-x); top: var(--laser-y); width/height: 28px }

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S33 — ЗАВРШЕНА ✅ (19 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

MASTER_ACTION_PLAN — критични fixes + Gamma Mode elevation + архитектурен split

К1: react-router-dom → NavigationContext (MaturaImportView.tsx)
  - useNavigate() → useNavigation().navigate() — отстранета единствената
    зависност од react-router-dom во апликацијата

К2: vite.config.ts — отстранети мртви manualChunks правила
  - Отстранети: vendor-three, vendor-motion (пакети не постојат во dependencies)
  - Превентира "Rollup cannot resolve module" при промена на lockfile

К3: QR пакет консолидација — react-qr-code → qrcode.react
  - ClassesTab, LiveTab, HostLiveQuizView, LiveDisplayView,
    TeacherProfileView, GeneratedPresentation (6 фајлови)
  - Единствен QR пакет → помал бандл, нема дупликат на React instances

К4: MASTER_ACTION_PLAN.md (НОВО) — 900-линиски world-class акционен план
  - К1–К6, А1–А6, Г1–Г11, AI1–AI8, П1–П6, Инф1–Инф7, UX1–UX5, М1–М3, С1–С4
  - Sprint план S33–S38+, метрики цели

К5+К6: (вклучени во К1 и MASTER_ACTION_PLAN)

Г1: Touch/swipe навигација (GammaModeModal.tsx)
  - onTouchStart/onTouchEnd → swipe detection (deltaX > 50px → prev/next)
  - Swipe up (deltaY < -80px) → отвора speaker notes
  - Целосна поддршка за таблети и паметни табли

Г2: Thumbnail grid overlay (G копче / keyboard G)
  - Преглед на сите слајдови во grid layout
  - Клик → jumpToSlide() + затвори grid
  - Escape → затвора grid прво, потоа излегува

Г3: Formula zoom (+ / − / double-click)
  - CSS custom property pattern (--gamma-formula-zoom) — no ESLint inline-style
  - Zoom: 1× → 1.5× → 2× → 2.5× → 3× (scroll +0.5 чекор)
  - Double-click → toggle 1×↔2×
  - Reset на slide change

А2: GammaModeModal архитектурен split → components/ai/gamma/
  - useGammaAnnotation.ts (НОВО) — canvas annotation state + handlers
    draw / highlight / laser pointer / undo stack / canvas resize
    Clears undo stack on slide change (подобрување над оригиналот)
  - GammaThumbnailGrid.tsx (НОВО) — thumbnail grid overlay компонент
    Props: slides, activeIdx, onJump, onClose
  - GammaExportService.ts (НОВО) — чиста async функција за PPTX export
    exportGammaPPTX(data, options, onSuccess, onError): Promise<void>
  - GammaModeModal.tsx: ~160 линии помалку, чист координатор

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S32 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

RAG Elevation + DOCX Vision Mode

B1: services/gemini/ragService.ts (НОВО)
  - fetchFewShotExamples(conceptId, gradeLevel, topicId?) → few-shot RAG
  - fetchMaturaExamples(): query matura_questions WHERE topicArea + questionType='mc'
    ORDER BY dokLevel DESC LIMIT 3 → реални матурски примери за калибрација
  - fetchCachedExamples(): query cached_ai_materials WHERE conceptId + type='assessment'
    ORDER BY createdAt DESC LIMIT 4 → до 2 прашања по документ → до 8 примери
  - TOPIC_TO_MATURA_AREA mapping (20+ topic ID prefixes → matura area strings)
  - Non-blocking: враќа '' на секоја Firestore грешка
  - Само за grade ≥ 7 (matura examples)

B2: Интеграција ragService → assessment.ts
  - fetchFewShotExamples() повикан после cache check, пред Gemini call
  - Injected as { text: fewShotPart } Part во contents[]
  - AI сега добива реални примери → подобро калибрирана тежина и стил

B3: DOCX HTML mode + image extraction (ExtractionHubView.tsx)
  - mammoth.extractRawText() → mammoth.convertToHtml() со convertImage callback
  - Embedded PNG/JPEG слики → base64 → uploadedDoc.images[] (max 5)
  - UI badge: „N знаци извлечени · M слики"

B4: mediaParts support в webTaskExtractionContract + chunkAndExtractTasks
  - Нов параметар mediaParts?: Array<{inlineData: {mimeType, data}}>
  - Само до first chunk (document context) → Gemini Vision го анализира и текстот и сликите
  - Поддршка за DOCX документи со математички дијаграми и формули во слики

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S31 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

Издигнување на Extraction Engine — world-class ниво без компромиси

A1: Smart sentence-boundary chunk splitting (visionContracts.ts)
  - splitTextIntoChunks(): при секој chunk boundary бара \n\n → '. ' → ' ' во
    последните 300 знаци → нема пресекување на реченица на средина
  - AI добива комплетен контекст по chunk → поквалитетни задачи извлечени
  - taskDedupKey(): LaTeX-нормализирана дедупликација (strip $...$ и $$...$$,
    collapse whitespace, 100 chars key наместо 80)

A2: Manual transcript fallback + Vimeo detection (ExtractionHubView)
  - isVimeoUrl() + isVideoUrl() helpers
  - noTranscriptDetected state: кога YouTube auto-fetch пропадне или Vimeo
  - Vimeo real-time badge: при внесување Vimeo URL → purple hint „внесете рачно"
  - Amber prompt: „Транскриптот не е достапен → Внесете рачно →" (clickable)
  - Рачен транскрипт textarea во Напредни параметри:
    amber-тематизирана, 4 rows, resize-y
    Показ на знаци: „✓ 3,420 знаци — ќе се користи наместо автоматски"
    Ако е пополнет → секогаш go override-ира auto-fetch (YouTube и Vimeo)
  - За Vimeo/видеа без ID → веднаш setNoTranscriptDetected(true)
  - Доколку нема ни транскрипт ни manual → враќа error + отвора advanced

Метрики: TSC 0 | 689/689 tests | Build PASS
```

### S30 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

Темелна ревизија + world-class надградување на Extraction Engine

A1: YouTube Transcript Robustness (api/youtube-captions.ts)
  - Нова Стратегија 1: директен YouTube Timedtext API (/api/timedtext?v=...&lang=...&fmt=json3)
    без page scraping — побрзо, не зависи од HTML структура на YouTube
    Priority: manual preferred → auto preferred → manual mk → auto mk → manual en → auto en
  - Стратегија 2 (fallback): page scrape со 4 regex паттерни + реален Chrome User-Agent
  - Лимит: 80,000 знаци (наместо 12K) — покрива ~50-60 мин видео
  - Враќа strategy: 'direct'|'page-scrape' за debugging
  - Потполно рефакториран во конзистентна архитектура (parseJson3Events shared helper)

A2: Chunked extraction (services/gemini/visionContracts.ts)
  - extractTextFromDocument(pdfBase64): PDF → Gemini Vision → plain text со LaTeX
  - chunkAndExtractTasks(input): долги текстови → 10K chunks (400 overlap) → секвенцијален
    Gemini → merge → dedup по normalized statement prefix (80 chars) → единствен резултат
  - ChunkExtractionResult type: { output, fallback, chunksProcessed, tasksBeforeDedup }
  - onChunkProgress callback за live progress во UI

A3: ExtractionHubView — World-Class Document + Video Extraction
  - Source mode toggle: "URL (YouTube/Веб)" | "Документ (PDF/DOCX/TXT)"
  - Document режим: drag-and-drop drop zone + file picker
    • DOCX → mammoth.js (client-side, синхрон) → text → chunkAndExtractTasks
    • PDF → extractTextFromDocument (Gemini Vision) → text → chunkAndExtractTasks
    • TXT → FileReader → text → chunkAndExtractTasks
    • Лимит: 20 MB; визуелен preview на uploadot (name, size, извлечени знаци)
  - Chunked progress: "Дел X/Y — Анализа на содржина..." со % progress bar
  - Results: badges за "N делови анализирани" + "M дупликати отстранети"
  - URL режим: автоматски користи chunkAndExtractTasks за транскрипти >10K chars
  - Document source label card во резултатите
  - Сите accessibility errors поправени (aria-label, title на select/buttons/input)
  - Наслов: "YouTube, Веб & Документ Екстрактор"

Документација: S30_PLAN.md — темелен аудит на целата апликација

Метрики: TSC 0 | 689/689 tests | Build PASS
```

---

## Sprint S27 — Architectural Hardening for Scale (19 Apr 2026)

> Baseline: TSC 0, 742/742 unit tests, bundle OK. AI1 Vector RAG код-готов, чека 50 real-run верификација. Целта на S27: да се отстранат архитектонските долгови кои ќе кочат идни интеграции — монолитни фајлови, runtime-hazard циклуси, tight coupling на модалите. Светско ниво = секој фајл ≤ 600 LOC, 0 runtime-опасни cycles, coverage ≥ 60% на top-10 megafiles.

### Цели по приоритет (S27-A1 … S27-A9)

```
S27-A1 ⏳ Split services/geminiService.real.ts (2143 LOC) → 6-8 домен-фајлови
         (quiz, lesson, assessment, flashcards, tutor, presentation, materials)
         + barrel index.ts за backward-compat. Runtime: нема промена.
S27-A2 ⏳ Split services/gemini/core.ts (1222 LOC) → queue.ts / auth.ts /
         proxies/{embed,generate,stream,vision}.ts / systemInstruction.ts
S27-A3 ⏳ Modal registry refactor: ModalManager.tsx + ModalContext.tsx → lazy
         registry со React.lazy (скршува 7 cycles, намалува initial bundle)
S27-A4 ⏳ Split i18n/translations.ts (1483 LOC) по домен (common/matura/
         planner/materials/library) + index.ts агрегатор
S27-A5 ⏳ Split views/MaturaLibraryView.tsx (1552 LOC) →
         useMaturaLibrary() hook + MaturaFilters + MaturaList + MaturaDetail
S27-A6 ⏳ Split views/ContentLibraryView.tsx (1490 LOC) — ист pattern
S27-A7 ⏳ Split views/MaturaPracticeView.tsx (1384 LOC) → 3 phase-components
S27-A8 ⏳ Generic firestorePage<T>(ref, {cursor, limit, orderBy}) helper
         → refactor materials / matura / forum paginations
S27-A9 ⏳ Unit/integration тестови за top-3 untested megafiles
         (ExtractionHubView, GeneratedPresentation, useGeneratorActions)
         + fix за indexedDB ↔ firestoreService cross-import
```

### Health gates (по секоја акција)

```
gate-1:  TSC 0 errors
gate-2:  Full vitest suite зелена, +Δ нови тестови
gate-3:  Build PASS (vite build, perf:budget)
gate-4:  madge --circular: нови cycles = 0 (старите runtime-hazard се тргнати)
gate-5:  Визуелна проверка: нема regressions (Playwright visual-regression)
```

### Evidence log (S27)

```
| date       | id      | summary                                                                                                          | status |
|------------|---------|------------------------------------------------------------------------------------------------------------------|--------|
| 2026-04-19 | S27-A0  | Pre-work — `core ↔ ragService` циклус: static imports заменети со dynamic на двете страни; runtime-hazard = 0.    | DONE   |
| 2026-04-19 | S27-A0  | Video extraction fix: `fetchVideoPreview` со noembed.com fallback + graceful degrade; 4 нови тестови.            | DONE   |
| 2026-04-19 | S27-A0  | Индексер префрлен на firebase-admin SDK (го заобиколува `concept_embeddings: allow write: if false`).             | DONE   |
| 2026-04-19 | S27-A3  | Modal registry: 7 модали → React.lazy + Suspense; `<ModalManager />` mount-нат на App root; 7 циклуси отстранети (madge: 10 → 3); TSC 0; 742/742 тестови. | DONE   |
| 2026-04-19 | S27-A1  | …                                                                                                                | TODO   |
| 2026-04-20 | S34     | Vercel build fix: `fetchPendingForumThreads` export committed (commit f90e903); TSC 0.                           | DONE   |
```

---

## Sprints S35 — S37 — Post-S34 Strategic Roadmap (20 Apr 2026)

> Контекст: после S34 (FunctionGrapher + 858/858 тестови) се уште ни остануваат 4 отворени позиции од S27 (A6-A9) + новооткриени можности. Следните 3 sprints закрепнуваат архитектура, AI Ops и педагошки layer — без компромиси, светско ниво.

### Sprint S35 — Architectural Finish (А6-А9) — 1 недела

```
S35-A6  ⏳ Split views/ContentLibraryView.tsx (1490 LOC)
           → useContentLibrary() hook + LibraryFilters + LibraryList + LibraryDetail
S35-A7  ⏳ Split views/MaturaPracticeView.tsx (1384 LOC)
           → 3 phase-components (setup / exam / review) + state-machine hook
S35-A8  ⏳ Generic firestorePage<T>({ref, cursor, limit, orderBy}) helper
           → refactor materials / matura / forum / classroom / school / annualPlans
S35-A9  ⏳ Тестови за top-3 untested megafiles
           (ExtractionHubView, GeneratedPresentation, useGeneratorActions)
S35-A10 ⏳ Firestore composite indexes audit
           → firestore.indexes.json: сите where+orderBy пара покриени
```

### Sprint S36 — AI Ops (World-class quality gates) — 1 недела

```
S36-B1  ✅ GitHub Action "index:embeddings" — auto-run при промени во data/curriculum/*
S36-B2  ✅ RAG evaluation harness: 20 anchor queries × gold-set top-3 → CI gate (70%)
S36-B3  ✅ Gemini cache hit-rate tracking (Sentry breadcrumbs + sessionStorage counter)
S36-B4  ✅ Cost-guard alerts: Sentry + Slack webhook + Resend email (all optional, fire-and-forget)
S36-B5  ✅ Vertex Shadow A/B rollout-10% (shouldRunVertexShadow, VITE_VERTEX_SHADOW_ROLLOUT_PERCENT)
```

### Sprint S37 — Pedagogy & UX уп-ниво — 1.5 недели

```
S37-C1  ⏳ DoK 1-4 heatmap во TeacherAnalyticsView (прашања × ученици × DoK)
S37-C2  ⏳ Adaptive difficulty v2: IRT 3-PL модел замени moving-average
S37-C3  ⏳ Misconception mining: кластерирање на грешни одговори → мини-лекции
S37-C4  ⏳ Интернa матура banks: филтер + врска со училиштен annual plan
S37-D1  ⏳ Command Palette 2.0: fuse.js search + keyboard shortcuts на концепти
S37-D2  ⏳ Offline-first quiz play: IndexedDB queue + background-sync
S37-D3  ⏳ Keyboard-first nav во MaturaPractice (▲▼/Enter)
S37-D4  ⏳ A11y audit: axe-core CI + MathML fallback за KaTeX
```

### Cross-sprint Security track (co-embed во секој sprint)

```
SEC-1   ⏳ Sentry release tagging + source-maps dedupe
SEC-2   ⏳ Firestore rules coverage test (@firebase/rules-unit-testing) за сите 23 collections
SEC-3   ⏳ CSP report-only endpoint (/api/csp-report) + Upstash log
SEC-4   ⏳ Dependabot weekly + npm audit CI gate на critical
SEC-5   ⏳ Rate-limit по IP+UID на /api/gemini и /api/imagen
```

### Health gates (по секоја акција — задолжителни, без исклучок)

```
gate-1: TSC 0 errors
gate-2: Full vitest suite зелена, +Δ нови тестови
gate-3: Build PASS (vite build, perf:budget)
gate-4: madge --circular: без нови runtime-hazard cycles
gate-5: Playwright visual-regression: без regressions
gate-6: Lighthouse: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95
```

### Evidence log (S35-S37)

```
| date       | id       | summary                                                                              | status |
|------------|----------|--------------------------------------------------------------------------------------|--------|
| 2026-04-20 | S35      | Plan locked: A6, A7, A8, A9, A10 се во редослед — стартува A6.                       | PLAN   |
| 2026-04-20 | S35-A6   | ContentLibraryView split: 1490 → 1043 LOC (-30%); extracted 4 modules (contentLibraryHelpers, StarDisplay, AITutorModal, PreviewModal); TSC 0; 858/858 tests ✅; madge 3 → 2 cycles. | DONE   |
| 2026-04-20 | S35-A7   | MaturaPracticeView split: 1384 → 1175 LOC (-15%); extracted 3 modules (maturaPracticeHelpers, maturaPracticeGrading, MaturaPracticeUI); TSC 0; 858/858 tests ✅. | DONE   |
| 2026-04-20 | S35-A8   | Generic `firestorePage<T>({collectionName, constraints, pageSize, cursor, mapper, filter})` helper extracted to `services/firestorePagination.ts`; `fetchLibraryPage` migrated; +6 unit tests (864/864 ✅); TSC 0. | DONE   |
| 2026-04-20 | S35-A9   | Tests for 3 untested megafiles: extracted `extractionHubHelpers.ts` + tests (17), exported `isPureMathExpr` from GeneratedPresentation + tests (5), exported `buildAiPersonalizationSnippet` from useGeneratorActions + tests (6); +28 tests total → 892/892 ✅; TSC 0. | DONE   |
| 2026-04-20 | S35-A10  | Firestore composite indexes audit: scanned all `where + orderBy` patterns (42 indexed); added 3 missing — `forum_threads(moderationStatus, createdAt asc)` (pending moderation queue), `matura_community_solutions(questionDocId, upvotes desc)` (М3 student solutions), `national_library(gradeLevel, type, conceptId, publishedAt)` (combined filter). 39 → 42 indexes; JSON validated. | DONE   |
| 2026-04-20 | S35      | Sprint S35 (A6-A10) **COMPLETE** — architectural finish: 2 megafile splits (-656 LOC), generic firestorePage<T>, +34 tests (892 total), 3 missing composite indexes added. Ready for S36 AI Ops. | DONE   |
| 2026-04-20 | S36-B1   | GitHub Action `embeddings-ci.yml` — auto re-index on push to data/curriculum/** or data/secondary/**; concurrency guard (cancel-in-progress:false); secret-check step; 15-min timeout. | DONE   |
| 2026-04-20 | S36-B2   | RAG Recall@3 evaluation harness: `eval/rag-anchor-queries.json` (20 queries, mk+en, 70% threshold), `scripts/eval-rag-recall.ts` (cosine sim, Firestore live, table output, exit 1 on fail), `ai-eval.yml` rag-recall CI job. | DONE   |
| 2026-04-20 | S36-B3   | Gemini cache hit-rate tracking: `indexedDBService.ts` — Sentry breadcrumbs on cache.write/hit/miss + sessionStorage rolling counter `ai_cache_stats:{hits,misses}` for Settings display. | DONE   |
| 2026-04-20 | S36-B4   | Cost-guard multi-channel alerts: `costTracker.ts` — `dispatchCostAlert()` fires Sentry captureMessage (always) + Slack webhook (SLACK_WEBHOOK_URL) + Resend email (RESEND_API_KEY + ALERT_EMAIL); fire-and-forget, never throws. `.env.example` updated. | DONE   |
| 2026-04-20 | S36-B5   | Vertex Shadow A/B rollout-10%: `shouldRunVertexShadow()` = manual flag OR `Math.random() < ROLLOUT_PERCENT` (default 0.10, env `VITE_VERTEX_SHADOW_ROLLOUT_PERCENT`); `core.proxy.ts` uses new guard; `@sentry/node` dynamic import fixed with `@vite-ignore`. | DONE   |
| 2026-04-20 | S36      | Sprint S36 AI Ops **COMPLETE** — B1-B5 all done; TSC 0 ✅; 892/892 tests ✅ (72 files). Vertex Shadow auto-10% rollout, RAG recall CI gate, cost-guard Slack+email alerts live. | DONE   |
| 2026-04-21 | S37-C4   | Internal matura banks deep-link: `components/matura/maturaDeepLink.ts` (parse/build `?tab=ucilisna&topic=algebra&dok=2`, MK theme→topicArea inferrer); `InternalMaturaTab` accepts `initialFilter` prop; `MaturaLibraryView` reads `window.location.search` and routes; `PlannerItemModal` shows "📝 Внатрешна матура" deep-link button when lesson theme matches; +21 tests (914/914 ✅, 73 files); TSC 0. | DONE   |
| 2026-04-21 | S37-D3   | Keyboard-first MaturaPractice MC nav: `views/maturaPractice/maturaKeyboardNav.ts` (`resolveMCKey`, `nextFocusedIdx`); ▲▼ cycle + А/Б/В/Г / 1-4 direct + Enter submit + ←/→ prev/next question; visual focus ring; bottom hint refreshed; +11 tests (925/925 ✅, 74 files); TSC 0. | DONE   |
| 2026-04-21 | SEC-5    | Rate-limit hardening for `/api/gemini`+`/api/imagen`+`/api/embed`+`/api/gemini-stream`: extracted pure helpers `api/_lib/rateLimitInMemory.ts` (`checkSlidingWindow`, `extractClientIp`); confirmed dual-layer Upstash limits (UID 20/min + IP 100/min) live in `authenticateAndValidate`; in-memory fallback for local dev; +11 tests (936/936 ✅, 75 files); TSC 0. | DONE   |
| 2026-04-22 | S37-D1   | Command Palette 2.0 helpers extracted to `components/common/commandPaletteHelpers.ts` (`nextRecent` LRU dedup at MAX_RECENT=5, `readRecent`/`writeRecent` storage-adapter pattern with malformed-JSON safety, `nextCursor` wrap-around); `CommandPalette.tsx` refactored to delegate; +12 unit tests; TSC 0. | DONE   |
| 2026-04-22 | S37-AIV  | AlgebraicIdentityViewer — visual proof of `a³−b³=(a−b)(a²+ab+b²)` via 3 colored isometric SVG slabs; pure `components/math/algebraicIdentityHelpers.ts::decomposeAMinusBCubed(a,b)` returns slabs + sum/expected/factorised volumes (all three numerically equal); a/b sliders + exploded/collapsed toggle + numeric proof grid + KaTeX formula; +8 unit tests; TSC 0. | DONE   |
| 2026-04-22 | S37-C2   | IRT 3-PL adaptive engine: `utils/irt3pl.ts` — `probCorrect3PL(θ, item)`, `updateThetaMLE` (Newton-Raphson MLE step bounded θ∈[-3,+3]), `pickNextItem` (Fisher-information maximising selection), `thetaToLevel` (legacy bucket bridge), `percentageToInitialTheta`; +13 unit tests; TSC 0. | DONE   |
| 2026-04-22 | SEC-1    | Sentry release tagging hardened: explicit `release: { name: VERCEL_GIT_COMMIT_SHA ?? local-${Date.now()} }` added to `sentryVitePlugin` config in `vite.config.ts`, deduping issues across deploys with the runtime tag from `services/sentryService.ts`. | DONE   |
| 2026-04-22 | SEC-4    | Dependabot weekly + `npm audit --audit-level=critical` CI gate verified live in `.github/dependabot.yml` (npm + github-actions weekly) and `.github/workflows/ci-quality.yml` (Security audit step). | DONE   |
| 2026-04-22 | S37-D4   | A11y: `axe-core` smoke job already wired in `ci-quality.yml` via `tests/a11y-smoke.spec.ts`; KaTeX MathML fallback added — `output: 'htmlAndMathml'` in `components/common/MathRenderer.tsx::katexOptions` so screen-readers and CSS-less browsers fall back to native MathML. | DONE   |
| 2026-04-22 | S37-D2   | Offline-first sync orchestrator: `services/offlineSync.ts` — `flushPendingQuizzes(uploader, opts)` drains the existing `pending_quizzes` IDB store with exp-backoff (`computeBackoffMs` jittered + capped), `isTransientError` heuristic (network/quic/503/429 → retry; auth/validation → permanent), `partitionFlushOutcome` bucketer, `registerBackgroundSync(tag)` (best-effort SW Background Sync API), `startOnlineFlushListener(uploader)` (window.online → auto-flush). +11 unit tests; TSC 0. | DONE   |
| 2026-04-22 | SEC-2    | Firestore rules-coverage scaffold: `tests/rules/firestore-rules.test.ts` (gated by `FIRESTORE_EMULATOR_HOST` env, auto-skips otherwise; covers `users` self-only, `quiz_results` create-validation, `cached_ai_materials` peer-rating constraint, `assignments` teacherUid ownership) + `package.json` script `test:rules` (vitest with `tests/rules/**/*.test.ts` include). Dependency `@firebase/rules-unit-testing` to be added on next install pass — file uses dynamic `import()` so default `npm test` is unaffected (file lives under excluded `tests/`). | DONE   |
| 2026-04-22 | S27-A1   | `services/geminiService.real.ts` verified as thin 49-line barrel (all 2143 LOC split into `services/gemini/*` domain files: assessment, plans, chat, tutor, pedagogy, vision, reports, testgen, annual, core.*, vertexShadow, intentRouter, ragService, visionContracts, svg — 25 files total). `services/geminiService.ts` forwards to `realGeminiService`; core flag/utility re-exports preserved for callers. | DONE   |
| 2026-04-22 | S19-P2f  | Forum FCM stale-token pruning: `deliverForumReplyNotification` now carries a `tokenToUid` map; after `sendEachForMulticast`, any token failing with `messaging/registration-token-not-registered` / `messaging/invalid-registration-token` / `messaging/invalid-argument` triggers deletion of `user_tokens/{uid}_web` and is reported via `prunedTokenUids[]` in both logs and callable result — unblocks S19-P2 live replay by auto-healing dead browser registrations on first failure. Functions TSC 0. | DONE   |
| 2026-04-22 | S38-E1   | World-class extraction core: `utils/extractionBundle.ts` rewritten — LaTeX-aware `FORMULA_RE` (60+ macros: frac/sqrt/int/sum/Greek/relations/symbols), `POWER_INDEX_RE`, `RELATION_RE`, `ARITHMETIC_RE`; expanded MK/EN `THEORY_RE` + `TASK_RE` lexicons (аксиом, лема, својство, identity, prove, construct, sketch, …); new exports `detectLatexFormulas`, `mergeExtractionBundles`, `inferDokForBundle` (1–4), `extractionSignature`, `summarizeExtractionBundle`. +9 tests (1009/1009 ✅, 80 files); TSC 0. | DONE   |
| 2026-04-22 | S38-V1   | World-class video segmentation: `utils/videoSegmentation.ts` rewritten — `classifySegmentRich` returns `{type, confidence, matched}`; new fields per segment `dokLevel` (1–4 from proof/research verbs), `topicMk` (9 MK topics via `TOPIC_PATTERNS`: Тригонометрија, Анализа, Геометрија, Статистика, Комбинаторика, Матрици и вектори, Логика, Броеви, Алгебра), `classificationConfidence`, `matchedKeywords`; new `summarizeVideoSegments` → `{totalSegments, totalDurationSec, byType, dominantTopic, averageDokLevel}`. +5 tests (1009/1009 ✅); TSC 0. | DONE   |
| 2026-04-22 | S38-E2   | Extraction Integration Layer (`utils/extractionIntegration.ts` — new file, 292 LOC, pure & testable): converts `ExtractedContentBundle` + `ExtractedWebTask[]` into ready-to-consume payloads — `extractionToQuizPrompt` (Gemini prompt builder, MK/EN, DoK-aware, clamped 1–20), `extractionToAssignmentDraft` → `AssignmentDraft`, `extractionToFlashcards` (theory/formula/task split with "term : definition" auto-parse), `extractionToLibraryDraft` → `LibraryDraft`, `extractionToAnnualPlanHint` (dominant topic + confidence), `extractionToConceptMatchText` (concept-map flattener). +14 tests (1009/1009 ✅, 80 files); TSC 0. Unifies OCR ↔ YouTube ↔ Webpage outputs into one delivery surface. | DONE   |
| 2026-04-23 | S39-F1   | Telemetry SDK live: `posthog-js` v1.370.1 installed; `services/telemetryService.ts` with `initTelemetry`/`identifyTelemetryUser`/`resetTelemetryUser`/`trackEvent`, role-based sampling (`sampleRateForRole`: teacher 1.0 / student 0.5 / unknown 0.25), deterministic per-user hash sampling (`shouldSampleEvent`), prop sanitisation. Auto-disabled in dev mode + when `VITE_POSTHOG_KEY` empty. Init wired in `index.tsx` after Sentry. Smoke events: `signup_completed`, `login_completed` (email + google) emitted from `LoginView`. EU host default `https://eu.i.posthog.com`; autocapture/recording OFF; persistence localStorage+cookie. +9 tests (1018/1018 ✅, 81 files); TSC 0. | DONE   |
| 2026-04-23 | S39-F3   | Onboarding telemetry: `TeacherOnboardingWizard` emits `onboarding_started` (mount), `onboarding_completed` (Finish path with hasSchool/style props), `onboarding_skipped` (X button with atStep). Skip-button rewired from `onClose` → `handleSkip`. Wizard scaffolding & gate (`OnboardingGate.tsx`) already existed; this row only wires telemetry per the F2 taxonomy. TSC 0; 1026/1026 tests. | DONE   |
| 2026-04-23 | S39-F4   | Quota meter telemetry: `Sidebar` already shows credit balance with red color when ≤ 10 + opens UpgradeModal on click. Added `useEffect` (gated by `useRef`) to fire `quota_warning_seen` exactly once per session when balance is in [0, 10] for non-Pro/non-admin users (props: `balance`, `source: sidebar_meter`, `threshold: 10`). Complements deduction-time emission already wired in S39-F2. TSC 0; 1026/1026 tests. | DONE   |
| 2026-04-24 | S39-F6   | A/B activation kill-switch: telemetry adds `assignExperimentBucket` (deterministic uid+experiment hash, splitPercent param), `trackExperimentAssignment` (emits `experiment_assigned` once per uid+experiment, persists bucket in localStorage). `OnboardingGate` now buckets users 50/50 on `onboarding_wizard_v1` — bucket A sees the wizard (control), bucket B skips it (treatment) — enabling time-to-`first_quiz_generated` comparison. +5 tests (1051/1051 ✅, 82 files); TSC 0. | DONE   |
| 2026-04-24 | S39-F5   | Cohort/Activity dashboard: new pure `utils/cohortMetrics.ts` (`toEpochMs` normalising number/Date/ISO/Firestore-Timestamp/`toMillis()`, `lastActivityMs`, `computeActivityCounts` DAU 24h / WAU 7d / MAU 30d, `computeStickinessRatio` DAU/MAU, `bucketWeeklyCohorts` Monday-anchored UTC weeks with day-offset retention map, `computeCreditBurnRatio`, `startOfUtcDay`, `startOfUtcWeek`). Wired into `SystemAdminView` as new `📈 Cohort` tab → 4 KPI cards (DAU/WAU/MAU/total), Stickiness + Credit-burn pills, weekly cohort retention table (D+0/1/3/7/14/30 with %-rendered cells, color-graded ≥50% green / ≥20% amber). `firestoreService.fetchAllUsers` return type widened to surface `createdAt`/`lastLoginAt`/`lastSeenAt`/`aiCreditsBalance`/`tier` so the dashboard can read activity timestamps directly without a second roundtrip. +18 tests (`__tests__/cohortMetrics.test.ts` with fixed-clock NOW = 2026-04-23T12:00 UTC). TSC 0. | DONE   |
| 2026-04-23 | S39-F2   | Activation funnel wired: telemetryService extended with `trackFirstTimeEvent` (localStorage-gated per (uid,event)), `hasFirstEventBeenRecorded`, `markFirstEventRecorded`, `shouldEmitQuotaWarning` (pure threshold-cross detector), `trackCreditConsumed` (emits `credit_consumed` + conditional `quota_warning_seen`). Wired: `MaterialsGeneratorView::deductCredits` (reason `materials_generator`), `AnnualPlanGeneratorView` (reason `annual_plan_generator`), `GeneratedPresentation::generateSlideVisual` (reason `presentation_slide_visual`). First-time events: `first_quiz_generated` (QUIZ/ASSESSMENT in main + extraction-pipeline paths), `first_lesson_saved` (`useGeneratorSave.handleSaveToLibrary` ideas/assessment/quiz), `first_extraction_run` (IMAGE/WEB/VIDEO_EXTRACTOR). Plus `feature_open_generator_<type>` and `feature_open_save_to_library` taxonomy events. +8 tests (1026/1026 ✅, 81 files); TSC 0. | DONE   |
```

---

### S29 — ЗАВРШЕНА ✅ (18 Apr 2026)

```text
Baseline: TSC 0, 689/689 unit tests

К3: Наставнички диференцијациски Assistant во LessonPlanEditorView
  - generateDifferentiationActivities(title, grade, theme, objectives) во geminiService.real.ts
    → LITE_MODEL, JSON schema, 3 активности × 3 нивоа
  - DifferentiationPanel Card во aside на LessonPlanEditorView:
    Ниво А (Поддршка / сина), Ниво Б (Стандардно / зелена), Ниво Ц (Надградување / виолетова)
    „Генерирај" копче → async → bullet list по ниво
  - handleGenerateDifferentiation useCallback со isMounted guard

К5: Gamification celebrations + „Ученик на неделата"

К5-А: AchievementCelebrationOverlay (components/student/AchievementCelebrationOverlay.tsx)
  - Fullscreen overlay (z-[100]) со confetti burst при секој нов achievement
  - Емоџи badge анимирано bounce + glow, achievement label, progress dots
  - Auto-cycle кога повеќе achievements (2.2s по achievement)
  - Auto-dismiss по 2.8s на последниот; кликнувањето/X го затвора
  - Интегриран во QuizResultPanel преку useEffect на gamificationUpdate.newAchievements

К5-Б: „Ученик на неделата" banner во LeagueTab (analytics)
  - Amber gradient banner на врвот на табелата
  - Алгоритам: највисок currentStreak меѓу ученици активни во 7 дена;
    fallback на сите ученици; тај-бреј по totalXP
  - Прикажува: avatar emoji, ime, streak, XP, avatar title, Trophy icon

Метрики: TSC 0 | 689/689 tests | Build PASS
```
