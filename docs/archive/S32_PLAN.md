# S32 — RAG Elevation + DOCX Vision Mode
## Акционен план (18.04.2026)

---

## АУДИТ — Состојба на RAG пред S32

### Постоечка „RAG" — Curriculum Injection

Тоа НЕ е вистински vector RAG. Функционира со:
```
buildDynamicSystemInstruction(grade, conceptId, topicId, track)
    ↓ инјектира curriculumData (концепти, теми, стандарди) во system prompt
    ↓ AI го добива контекстот на наставната програма
    ↓ НО: нема примери од реалните прашања на претходните ученици/матури
```

### Gap — Нема few-shot примери

**Проблем:** AI генерира прашања „во вакуум" — не знае:
- Какви прашања се веќе поставувале за оваа тема/концепт (cached_ai_materials)
- Какви матурски прашања постојат за оваа тематска област (matura_questions)

**Последица:** Дупликати, непримерена тежина, несовпаѓање со реалниот наставен контекст.

### Зошто НЕ vector search (S32)

Firebase SDK 4.7.9 → `findNearest()` returns `undefined` (не е достапно).
Embeddings (text-embedding-004) се зачувани во `cached_ai_materials`, но не може да се пребаруваат.

**Решение S32:** Simple Firestore query few-shot RAG:
- По `topicArea` (matura_questions) + `conceptId` (cached_ai_materials)
- Без vector similarity — но сепак значително подобрување

---

## S32 АРХИТЕКТУРА — Few-Shot RAG

```
generateAssessment(type, questionTypes, n, context, ...)
    │
    ├─ 1. Cache check (постоечко) ──── hit → return cached
    │
    ├─ 2. [НОВО S32] fetchFewShotExamples(conceptId, grade, topicId)
    │       │
    │       ├─ fetchMaturaExamples(topicArea, grade) — Firestore: matura_questions
    │       │   WHERE topicArea == X AND gradeLevel >= 7
    │       │   ORDER BY dokLevel DESC  LIMIT 3
    │       │   → форматирани МК примери (только MC, со choices + correctAnswer)
    │       │
    │       └─ fetchCachedExamples(conceptId) — Firestore: cached_ai_materials
    │           WHERE conceptId == X AND type == 'assessment'
    │           ORDER BY createdAt DESC  LIMIT 4
    │           → извлекува до 2 прашања по документ (вкупно до 8)
    │
    ├─ 3. Inject few-shot as extra Part в contents[]
    │   contents = [prompt, context, fewShotPart?, image?]
    │
    └─ 4. Gemini call + cache store (постоечко)
```

---

## S32 ИМПЛЕМЕНТАЦИЈА — Задачи

### B1: `services/gemini/ragService.ts` (НОВО)
- [x] `TOPIC_TO_MATURA_AREA` mapping: algebra→algebra, geometry→geometrija, statistics→statistika...
- [x] `fetchMaturaExamples(topicArea, gradeLevel)` — query matura_questions
- [x] `fetchCachedExamples(conceptId)` — query cached_ai_materials
- [x] `fetchFewShotExamples(conceptId, gradeLevel, topicId?)` — merge + format
- [x] Non-blocking (returns '' on Firestore error)
- [x] Max 6 few-shot examples total (matura preferred)

### B2: Integrate ragService → `services/gemini/assessment.ts`
- [x] Import `fetchFewShotExamples` from ragService
- [x] Call after cache check, before Gemini call
- [x] Inject as `{ text: fewShotPart }` Part в contents[]
- [x] Guarded: skip if canCache=false (already has custom context/image)

### B3: DOCX HTML mode + image extraction (`views/ExtractionHubView.tsx`)
- [x] `mammoth.convertToHtml()` instead of `extractRawText()`
- [x] `convertImage` callback → base64 PNG/JPEG extraction
- [x] Store images in `uploadedDoc.images?: Array<{mimeType:string; data:string}>`
- [x] Pass first image as `mediaParts` to `chunkAndExtractTasks`

### B4: `mediaParts` support in `webTaskExtractionContract`
- [x] Add optional `mediaParts` param to `webTaskExtractionContract`
- [x] Add optional `mediaParts` param to `chunkAndExtractTasks` (passed to first chunk only)
- [x] Include inline image parts в Gemini request parts

### B5: TSC + vitest + STRATEGIC_ROADMAP + commit + push
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npx vitest run` → 689/689 pass
- [x] S32 log в STRATEGIC_ROADMAP.md
- [x] git commit + push

---

## Метрики по S32

| Индикатор | Пред S32 | По S32 |
|---|---|---|
| Few-shot примери при генерирање | 0 | до 6 (матура + кеш) |
| DOCX слики во ExtractionHub | Изгубени | Зачувани + Vision-анализирани |
| Quалитет на прашањата | AI „во вакуум" | Калибриран кон реалниот наставен контекст |
| Vector RAG | ❌ SDK premature | 🔜 S33+ (Firebase SDK upgrade) |

---

## Следни чекори (S33+)
1. **Firebase SDK upgrade** → `findNearest()` за vector similarity search
2. **Vimeo OAuth** — captions API (бара регистрирана Vimeo апликација + backend OAuth)
3. **Multi-page >20MB PDF** — Gemini File API (server-side `/api/process-large-doc`)
4. **DOCX EMF/WMF equations** — LibreOffice server-side конверзија
5. **AI Auto-Translation** — „Преведи" во NationalLibraryView + cultural adaptation
