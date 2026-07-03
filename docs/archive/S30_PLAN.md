# S30 — World-Class Extraction Engine
## Темелна ревизија + имплементација (18.04.2026)

---

## АУДИТ — Состојба пред S30

### 1. YouTube / Видео екстракција

**Тековна архитектура (`api/youtube-captions.ts`):**
- Стратегија: YouTube watch page HTML scrape → `ytInitialPlayerResponse` JSON → caption tracks → JSON3 transcript
- Лимит: **12,000 знаци** (hard truncate) → само ~8-10 минути анализирани
- Rate limit: 20 req/min per UID

**Дијагностицирани проблеми:**
1. **"Нема транскрипт" за видеа со субтитли** — Regex `/ytInitialPlayerResponse\s*=\s*(\{.+?\});.../s` пропаѓа кога YouTube го менува HTML форматот (bot detection, различна структура на script блоковите)
2. **Долги видеа — само 13-15% се анализираат** — 60-мин видео → ~80K транскрипт знаци → truncate на 12K → AI анализира само први 10 мин
3. **Нема fallback стратегија** — ако page scrape пропадне, враќа `available: false` наместо да проба директниот timedtext API
4. **User-Agent е минималистички** — YouTube bot detection лесно го блокира

**Fix план S30:**
- Стратегија 1 (нова): Директен YouTube Timedtext API (`/api/timedtext?v=...&lang=...&fmt=json3`) — без page scraping, побрзо, поробусно
- Стратегија 2 (fallback): постоен page scrape со подобрени regex и реален браузер User-Agent
- Лимит: **80,000 знаци** (~50-60 мин видео)
- Client-side chunked extraction: ако транскрипт > 12K → поделба на 10K chunks → секој chunk → Gemini → merge + deduplicate

---

### 2. RAG — Состојба

**Тоа НЕ е вистински vector RAG.** Е **curriculum injection** во system prompt.

**5 Vision Contracts (структурирани AI излези со JSON validation + retry):**
| Contract | Влез | Излез |
|---|---|---|
| `homeworkFeedbackContract` | Скен домашна | misconceptionType + correctionSteps + mastery% |
| `testGradingContract` | Скен тест + прашања | per-question points + pedagogy gaps |
| `contentExtractionContract` | PDF/слика | formulas[] + theories[] + tasks[] + quality |
| `smartOCRContract` | Слика/ракопис | LaTeX + curriculumHints (grade, topic, DoK) |
| `webTaskExtractionContract` | YT transcript/web | tasks[] со title+latex+difficulty+dokLevel |

**Нема vector DB, нема embeddings, нема Firestore Vector Search.**

**Fix план (S31+):** Firestore Vector Search extension → embed секое задача при зачувување → semantic search при генерирање → намалени token трошоци + побрзи повторени теми.

---

### 3. PDF / Word / Стари книги и списанија

**Тековна поддршка:**
| Формат | Каде | Статус |
|---|---|---|
| Слика (JPG/PNG) | SmartOCRView, AIVisionGraderView | ✅ Полна |
| PDF (base64 inline) | AIVisionGraderView, MaturaImportView | ✅ до 10MB |
| DOCX (mammoth.js) | AIVisionGraderView | ⚠️ само текст, без слики |
| Скенирана книга (multi-page) | Нигде | ❌ Не постои |
| Web страница | ExtractionHubView | ✅ |
| **DOCX/PDF во ExtractionHub** | Нема | ❌ Gap |

**Fix план S30:** Додавање "Документ" режим во ExtractionHubView:
- DOCX → mammoth.js (client-side) → plain text → `chunkAndExtractTasks`
- PDF → Gemini Vision (native PDF support) → text → `chunkAndExtractTasks`
- TXT → FileReader → `chunkAndExtractTasks`
- Поддршка за книги и списанија до 20MB

---

### 4. DataViz — Состојба ✅ КОМПЛЕТНО

`DataVizStudioView` + 4 компоненти:
- 20+ типови графикони сите поврзани со МОН ниво на одделение
- Основни: bar, line, pie, histogram, dot-plot, pictogram
- Напредни: scatter+regression (R²), box-whisker, heatmap, pareto, bubble, back-to-back
- Специфично МК: divided-bar, frequency-polygon, cumulative-frequency (огива)
- Export: PNG (300dpi), SVG, Print, Clipboard
- AI Stats Assistant, Probability Lab
- Gamma Mode интеграција (slide type: `chart-embed`)

**Нема потреба од fixes во S30.**

---

### 5. Gamma Mode (презентациски мотор) — Состојба ✅ КОМПЛЕТНО

`GammaModeModal.tsx` — 11 типови слајдови:
```
title | content | formula-centered | step-by-step | example | task
summary | chart-embed | shape-3d | algebra-tiles | comparison | proof
```
Annotation tools (draw/highlight/laser), PPTX export, speaker notes, task timer, SVG illustrations.

---

### 6. Curriculum connectivity — Состојба ✅ КОМПЛЕТНО

```
data/curriculum.ts (одд. 1-13) + verticalProgression + national-standards
    ↓ buildDynamicSystemInstruction(grade, conceptId, topicId, track)
    ↓ инјектирање во СЕКОЈ AI повик
    ↓ concept_evaluated на секое прашање → mastery tracking
```

---

### 7. Task/Quiz pipeline — Состојба ✅ КОМПЛЕТНО (4 влезни патеки)

1. Direct generation (MaterialsGeneratorView)
2. YouTube/web → ExtractionHub → Library
3. OCR/scan → SmartOCR → Library → Generator
4. Matura PDF → MaturaImportView → matura_questions

---

## S30 ИМПЛЕМЕНТАЦИЈА — Задачи

### A1: YouTube transcript robustness (`api/youtube-captions.ts`)
- [x] Стратегија 1: директен `/api/timedtext` endpoint (нема page scraping)
- [x] Стратегија 2 (fallback): page scraping со подобрен User-Agent
- [x] Лимит: 80K знаци (наместо 12K)
- [x] Retry на MK → EN → auto ако manual пропадне

### A2: Chunked extraction (`services/gemini/visionContracts.ts`)
- [x] `chunkAndExtractTasks()` — split 10K chunks + sequential Gemini + dedup
- [x] `extractTextFromDocument()` — PDF → Gemini Vision → plain text

### A3: Document mode in ExtractionHub (`views/ExtractionHubView.tsx`)
- [x] "Документ" таб: DOCX/PDF/TXT upload
- [x] DOCX → mammoth → text → chunkAndExtractTasks
- [x] PDF → extractTextFromDocument → chunkAndExtractTasks
- [x] TXT → FileReader → chunkAndExtractTasks
- [x] Progress показ: "Дел X/Y — Анализира..."
- [x] Резултат badge: chunks processed + deduplicated count

---

## Метрики по S30
| Видео (60 мин) | Пред S30 | По S30 |
|---|---|---|
| Анализиран транскрипт | ~13% (12K chars) | ~100% (80K chars, 8 chunks) |
| Ризик "нема транскрипт" | Висок (page scrape fragile) | Низок (direct API first) |
| Документи во ExtractionHub | 0 формати | DOCX + PDF + TXT |

---

## Следни чекори (S31+)
1. **Vector RAG** — Firestore Vector Search → semantic similarity за задачи
2. **Multi-page book pipeline** — page-by-page PDF batch processing за учебници
3. **Video chapters** — YouTube chapter markers → smart chunk boundaries
4. **Vimeo/Loom transcript** — поддршка за повеќе видео платформи
5. **AI Auto-Translation** — "Преведи" копче во NationalLibraryView
