# MASTER ACTION PLAN — Math Curriculum AI Navigator
## Сеопфатен план за светско ниво
### Датум: 18.04.2026 | Состојба: S32 завршена | Baseline: TSC 0 · 689 tests · Build PASS

---

> **Цел:** Апликацијата да биде технички, педагошки, архитектонски и UX-совршена на глобално ниво.
> Секоја препорака е базирана на темелен аудит на сите 63 views, 150+ components, 43 hooks, 22 services, 14 API endpoints, bundle config и тестовата покриеност.

---

## КРИТИЧНА ЛЕНТА — Веднаш (пред следен sprint)

### К1 — `StudentLiveQuizView.tsx` е ПРАЗНА ДАТОТЕКА
**Приоритет: КРИТИЧЕН · Ефект: Route 404 за ученици во live quiz**

```
views/StudentLiveQuizView.tsx = 0 bytes
```

Ако `/student-live-quiz` рутата е активна → учениците добиваат blank/crash.
Акција: или имплементирај view (ги има сите Firestore hooks во `firestoreService.live.ts`) или отстрани ја рутата додека не е готова.

---

### К2 — Мртви chunk rules во `vite.config.ts`
**Приоритет: ВИСОК · Ефект: Confusing bundle analysis, false positives**

```typescript
// Постојат chunk rules за пакети кои НЕ се во package.json:
'vendor-motion'   → framer-motion   // не постои
'vendor-three'    → three           // не постои
```

Акција: отстрани ги двете rules или додади пакетите ако се планирани.

---

### К3 — Дупликат QR пакети
**Приоритет: УМЕРЕН · Ефект: ~15 kB dead bundle weight**

```json
"qrcode.react": "^4.2.0",
"react-qr-code": "^2.0.18"
```

Акција: задржи само `qrcode.react`, отстрани `react-qr-code`.

---

### К4 — `@types/*` пакети во production dependencies
**Приоритет: УМЕРЕН · Ефект: ~5 kB unnecessary prod weight**

```json
// Треба да бидат во devDependencies:
"@types/recharts", "@types/canvas-confetti", "@types/dompurify"
```

---

### К5 — `react-router-dom` веројатно dead dependency
**Приоритет: УМЕРЕН · Ефект: ~50 kB непотребен bundle**

Апликацијата користи сопствен hash-based router (`useRouter.ts`). Верифицирај дали `react-router-dom` е навистина неупотребен → ако да, отстрани го.

---

### К6 — `/api/vertex-shadow` е dead endpoint (20 линии, враќа 501)
**Приоритет: НИЗОk · Ефект: Конфузија во codebase**

Акција: отстрани го ако Vertex AI не е во план за следните 6 месеци.

---

## ДЕЛ I — АРХИТЕКТУРА

### А1 — Раздели ги монолитните views (S33)
**Приоритет: ВИСОК · Ефект: -40% parse time за тешки рути**

| View | Линии | Акција |
|---|---|---|
| `GammaModeModal.tsx` | 1,216 | Split на 5 компоненти (види Gamma план) |
| `MaturaLibraryView.tsx` | 1,538 | Lazy-load tab content (FilterPanel, ExamList, QuestionPanel) |
| `ContentLibraryView.tsx` | 1,489 | Lazy-load (S25-П4 beше одложено — сега треба) |
| `MaterialsGeneratorView.tsx` | 1,073 | Lazy-load GenerationContextForm + GeneratedContent panels |
| `TeacherForumView.tsx` | 1,237 | Lazy-load ThreadList + ThreadDetail |
| `geminiService.real.ts` | 2,098 | Split на domain services (assessment.ts постои — продолжи по истиот паттерн) |

**Паттерн:**
```typescript
// Секој view → suspense boundary + dedicated chunk
const HeavyPanel = lazy(() => import('./panels/HeavyPanel'));
<Suspense fallback={<Skeleton />}><HeavyPanel /></Suspense>
```

---

### А2 — `GammaModeModal.tsx` архитектурен split (S33)
**Приоритет: ВИСОК · Претпоставка за сите Gamma features**

```
components/ai/gamma/
  GammaModeModal.tsx          ← orchestrator (~150 линии)
  GammaSlideRenderer.tsx      ← сиот renderBody() switch (~400 линии)
  GammaAnnotationLayer.tsx    ← canvas, draw/highlight/laser, undo stack
  GammaExportService.ts       ← PPTX + print (не компонента — сервис)
  GammaSpeakerNotes.tsx       ← notes panel
  GammaNavigation.tsx         ← footer, dots, prev/next
  GammaTimerBar.tsx           ← task timer + progress bar
  GammaContextStrip.tsx       ← formula context strip
  useGammaKeyboard.ts         ← keyboard shortcuts hook
  useGammaAnnotation.ts       ← canvas annotation hook
  useGammaTimer.ts            ← timer hook
```

---

### А3 — Консолидирај RAG сервисите (S33)
**Приоритет: УМЕРЕН**

Постојат два RAG модули со преклопувачки концерни:
- `services/ragService.ts` (root-level, 161 линии)
- `services/gemini/ragService.ts` (177 линии, новиот S32)

Акција: провери дали root-level `ragService.ts` е уште активен → ако не, отстрани го или мигрирај.

---

### А4 — Консолидирај Planner contexts (S34)
**Приоритет: НИЗОk**

`PlannerContext.tsx` и `PlannerItemsContext.tsx` управуваат со иста domain — плановите. Акција: merge во еден `PlannerContext.tsx` со чисто раздвоени state slices.

---

### А5 — `ForumThread` / `ForumReply` / `Notification` типови во `types.ts` (S33)
**Приоритет: УМЕРЕН**

Тие живеат само во `firestoreService.types.ts` — недостапни надвор од services layer. Акција: екстрахирај ги во `types.ts` за конзистентност во целата апликација.

---

### А6 — `StudentMaturaProfile.track` type gap (S33)
**Приоритет: УМЕРЕН**

```typescript
type MaturaTrack = 'gymnasium' | 'vocational4' // само 2 вредности
type SecondaryTrack = 'gymnasium' | 'vocational4' | 'vocational3' | 'vocational2' | 'gymnasium_elective' // 5
```

Ученици на vocational3/2 не можат да имаат matura profile. Акција: проширување на `MaturaTrack` или документирање зошто не.

---

## ДЕЛ II — GAMMA MODE / ПРЕЗЕНТАЦИЈА

### Г1 — Touch/Swipe поддршка (S33)
**Приоритет: КРИТИЧЕН за мобилно · Ефект: Tablet/Phone употребливост**

```typescript
// pointer events на слајдот:
onPointerDown → record startX, startY
onPointerUp   → deltaX > 60 → goNext/goPrev
               → deltaY < -80 → setNotesOpen(true)
// Apple Pencil: pointerType === 'pen' → annotation mode auto-on
```

---

### Г2 — Slide Overview / Thumbnail Grid (S33)
**Приоритет: ВИСОК · Ефект: Nastavnikot може да скокне до секој слајд**

```
Escape (кога нема annotation) → не излегува директно
                              → отвора thumbnail grid (12-col grid)
                              → секој thumbnail = mini renderBody() во scale(0.15)
                              → клик = jumpToSlide(i), затвори grid, focus на слајдот
Shortcut: G → toggle grid
```

---

### Г3 — Zoom/Pan на formula слајдови (S33)
**Приоритет: ВИСОК · Ефект: Читливост на сложени формули на проектор**

```typescript
// На formula-centered слајдови:
// Scroll wheel / pinch → CSS scale(zoom) на формулата
// Double-tap/click → toggle zoom 1x/2.5x
// Pan при zoom > 1: drag-to-pan
const [zoom, setZoom] = useState(1);
const formulaStyle = { transform: `scale(${zoom})`, transformOrigin: 'center center' };
```

---

### Г4 — Presenter Mode (два прозорци) (S34)
**Приоритет: ВИСОК · Ефект: Наставникот гледа notes + next slide + timer на лаптоп, учениците гледаат презентацијата на проектор**

```typescript
// Главен прозорец (проектор):
window.open('/gamma/presenter', 'presenter', 'width=900,height=650');

// Комуникација преку BroadcastChannel API:
const bc = new BroadcastChannel('gamma-sync');
bc.postMessage({ type: 'slide-change', idx, slide });

// Presenter popup прикажува:
// 1. Моменталниот слајд (preview, mini)
// 2. Следниот слајд (preview, slightly larger)
// 3. Speaker notes (целосен текст)
// 4. Task timer
// 5. Live student response count (ако е активна Gamma Live сесија)
// 6. Elapsed time (вкупно за презентацијата)
```

---

### Г5 — PPTX export: вистинска поддршка за chart/3D/algebra slides (S33)
**Приоритет: УМЕРЕН · Тековна состојба: chart-embed/shape-3d/algebra-tiles → само текст fallback**

```typescript
// chart-embed: html2canvas на ChartPreview div → base64 PNG → pptSlide.addImage()
// shape-3d:    Three.js renderer.domElement.toDataURL() → addImage()
// algebra-tiles: html2canvas на AlgebraTilesCanvas → addImage()
// annotations:   canvasRef.current.toDataURL() → addImage() (overlay layer)
```

---

### Г6 — SVG Illustrations на повеќе слајд типови (S33)
**Приоритет: УМЕРЕН · Тековна состојба: само task/example имаат SVG generation**

Акција: Додади `visualPrompt` поддршка за `formula-centered` и `content` слајдови.
```typescript
// formula-centered: visualPrompt = "geometric interpretation of the formula"
// content: visualPrompt = "conceptual diagram for the topic"
// Auto-generate on enter (веќе постои логиката за task/example)
```

---

### Г7 — Live Student Sync / Gamma Live (S35) ← ТРАНСФОРМАТИВНА ФУНКЦИЈА
**Приоритет: СТРАТЕШКИ · Ефект: Скок од „дигитализиран проектор" кон интерактивна педагогија**

```
АРХИТЕКТУРА:
─────────────────────────────────────────────────────
Наставник: [Gamma Mode] → [▶ Старт Gamma Live]
  → генерира 6-цифрен PIN
  → запишува во Firestore: live_gamma/{pin}/currentSlideIdx
  → QR код + PIN се прикажуваат врз слајдот

Ученици: ai.mismath.net/gamma/join → PIN → /gamma/student/{pin}
  → Firestore onSnapshot на live_gamma/{pin}/currentSlideIdx
  → добиваат реалтајм слајд (read-only, само content без annotations)
  → на task слајд: input поле за одговор
  → "Дигни рака" копче → live_gamma/{pin}/hands[] += studentId

Наставник гледа (overlay во Gamma):
  → "8/24 одговориле" прогрес бар
  → [Прикажи одговори] → frequency distribution на одговорите
  → [Зачувај одговорите] → во quiz_results за аналитика

FIRESTORE:
  live_gamma/{pin}: { slideIdx, totalStudents, hostUid, startedAt }
  live_gamma/{pin}/responses/{studentId}: { answer, submittedAt, slideIdx }
  live_gamma/{pin}/hands: [studentId...]

SECURITY:
  allow read: if request.auth.uid in resource.data.studentUids
             || request.auth.uid == resource.data.hostUid
  allow write on /responses/{studentId}: if request.auth.uid == studentId
```

---

### Г8 — Adaptive Branching mid-presentation (S36)
**Приоритет: ВИСОК (бара Г7) · Ефект: Динамична педагогија**

```
По task слајд + live responses:
  < 40% точни → наставникот добива копче „Вметни поддршка"
    → Gemini генерира 1 support слајд (step-by-step тип) inline
    → insertAt(idx + 1) → slides мутира in-memory
    → наставникот продолжува без прекин на Gamma Live сесијата

  ≥ 80% точни → „Вметни предизвик"
    → Gemini генерира 1 advanced task inline → insertAt(idx + 1)
```

---

### Г9 — Exit Ticket auto-generation (S34)
**Приоритет: УМЕРЕН**

```typescript
// На summary слајд:
<button onClick={generateExitTicket}>
  Генерирај Exit Ticket за учениците
</button>

// Логика:
// 1. Извлечи ги темите/формулите од slides (gammaContext.ts веќе го прави)
// 2. assessmentAPI.generateAssessment('ASSESSMENT', ['multiple-choice'], 3, context)
// 3. Прикажи го во InteractiveQuizPlayer (веќе постои)
// 4. Ако Gamma Live е активна → автоматски испрати до поврзаните ученици
```

---

### Г10 — Handout PDF генерирање (S34)
**Приоритет: УМЕРЕН · Ефект: Наставникот испечатува материјал за учениците**

```
Секој слајд → printable layout (@media print CSS + jsPDF):
  formula-centered: формулата + 4 linii празно место за белешки
  task:             задачата + 8 linii за решение (без решение — тоа е point)
  step-by-step:     нумерирани чекори + празна колона за белешки
  summary:          bullet-point резиме + QR код кон ai.mismath.net

[Генерирај Handout] копче во Gamma toolbar → window.print() со print layout
```

---

### Г11 — Lesson Recording Mode (S37)
**Приоритет: СТРАТЕШКИ ДОЛГОРОЧНО**

```typescript
// MediaRecorder API → screen + audio capture
const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
const recorder = new MediaRecorder(stream);
const chunks: BlobPart[] = [];
recorder.ondataavailable = e => chunks.push(e.data);
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  // → Firebase Storage upload → shareable URL
  // Auto-generated chapter markers при секоја промена на idx
};
```

---

## ДЕЛ III — AI / RAG ЕЛЕВАЦИЈА

### AI1 — Firestore Vector Search (S35)
**Приоритет: ВИСОК · Тековна состојба: Firebase SDK 4.7.9 → findNearest() = undefined**

```bash
# Чекори:
# 1. Upgrade @firebase/firestore → ≥ 11.5.0 (first version with findNearest GA)
# 2. Firebase Console → Extensions → Vector Search → Enable
# 3. Create composite index: (conceptId ASC, embedding VECTOR)
# 4. Update ragService.ts:
#    fetchCachedExamples() → findNearest('embedding', queryEmbedding, { limit: 5, distanceMeasure: 'COSINE' })
#    → вистински semantic similarity наместо exact conceptId match
```

Embeddings веќе постојат во `cached_ai_materials` (text-embedding-004 via `/api/embed`).

---

### AI2 — Vimeo OAuth Captions (S34)
**Приоритет: УМЕРЕН · Тековна состојба: Vimeo детекција постои, API не**

```
# 1. Регистрирај Vimeo OAuth App на developer.vimeo.com
# 2. Нов API endpoint: /api/vimeo-captions
#    GET https://api.vimeo.com/videos/{videoId}/texttracks
#    Authorization: Bearer {VIMEO_ACCESS_TOKEN}
#    → враќа transcript (srt/vtt) → парсирај → ист pipeline
# 3. ExtractionHubView: ако isVimeoUrl() → /api/vimeo-captions наместо /api/youtube-captions
```

---

### AI3 — Multi-page >20MB PDF pipeline (S35)
**Приоритет: УМЕРЕН · Ефект: Старите учебници и списанија**

```typescript
// Нов endpoint: /api/process-large-doc
// 1. Прими PDF → Gemini File API upload (до 1GB)
//    const file = await fileManager.uploadFile(buffer, { mimeType: 'application/pdf' });
// 2. Gemini обработува по страница (native PDF support до 1000 страни)
// 3. Враќа chunked plain text → ист chunkAndExtractTasks pipeline
// ExtractionHub: ако PDF > 10MB → /api/process-large-doc наместо inline base64
```

---

### AI4 — AI Auto-Translation со Cultural Adaptation (S33)
**Приоритет: ВИСОК · Ефект: AL/TR ученици добиваат целосно локализирана содржина**

```typescript
// Копче „Преведи" во NationalLibraryView на секој материјал:
async function translateMaterial(material: SavedMaterial, targetLang: 'al' | 'tr') {
  const prompt = `Преведи го следниов македонски образовен материјал на ${lang === 'al' ? 'albaneski' : 'turski'}.
  ВАЖНО: Задржи ги математичките формули во LaTeX. Адаптирај ги примерите кон локален контекст (имиња, валута, мерки).
  Не е директен превод — е cultural adaptation за македонски ${lang} ученици.`;
}
// Зачувај преводот во national_library/{id}/translations/{lang}
// UI: јазичното копче → вчитај превод ако постои, или генерирај
```

---

### AI5 — Socratic Questioning во Gamma Mode (S35) ← Бара Г7
**Приоритет: ВИСОК**

```
На секој слајд, наставникот може да кликне [Сократско прашање]:
→ Gemini добива: slide.content + претходни 3 слајди + gradeLevel + topicId
→ Генерира 3 прашања по Bloom taxonomy:
  "Знаење: Кој е резултатот на ...?"
  "Разбирање: Зошто важи ...?"
  "Примена: Примени го ова на ...?"
→ Наставникот избира 1
→ Се прикажува на учениците (ако е активна Gamma Live)
→ Одговорите → AI анализира → feedback
```

---

### AI6 — Gemini грешки анализа → автоматски misconception detection (S34)
**Приоритет: ВИСОК · Ефект: Наставникот знае точно ЗОШТО учениците грешат**

```typescript
// При секое quiz submission (InteractiveQuizPlayer, MaturaPracticeView):
// ако wrongAnswer → Gemini: "Анализирај зошто ученик би одговорил X наместо Y.
// Даде ги можните misconceptions (максимум 3), секоја со correctionStrategy."
// Зачувај во quiz_results.misconceptions[]
// TeacherAnalyticsView: нов таб "Misconceptions" → heatmap по концепт × тип грешка
```

---

### AI7 — AI Lesson Planning Assistant (S34)
**Приоритет: ВИСОК · Ефект: Наставникот не започнува од нула**

```
LessonPlanEditorView: нов „AI Assistant" panel (слично на RefineGenerationChat):
  Наставникот: "Сакам да предадам Питагорова теорема на 8. одделение,
                имам 45 мин, класот е мешан (3 силни, 20 просечни, 7 слаби)"
  AI: генерира целосен lesson plan со:
    - временски распоред (5 мин → воведување, 15 мин → примери, 20 мин → пракса, 5 мин → exit ticket)
    - диференцирани активности по ниво
    - предложени прашања за секоја фаза
    - links до постоечки Gamma Mode слајди за истата тема
```

---

### AI8 — Predictive Content Recommendations (S34)
**Приоритет: УМЕРЕН**

```typescript
// usePersonalizedRecommendations.ts веќе постои но е thin
// Елевација: Gemini анализира:
// - Кои концепти ученикот ги изучувал во последните 14 дена
// - Каде mu e mastery < 70%
// - Кои задачи ги решил погрешно (misconceptions)
// → „Следен оптимален концепт за учење" (Vygotsky ZPD)
// → „Задача специфично за твојата грешка" (targeted practice)
// Прикажи во StudentProgressView и HomeView
```

---

## ДЕЛ IV — ПЕДАГОШКИ ФУНКЦИИ

### П1 — Student Response System (SRS) без Gamma Live (S33)
**Приоритет: ВИСОК · Ефект: Live polling без целосна презентација**

```
Наставникот може да испрати прашање директно до учениците во класот:
HomeView → [Испрати прашање до класот] → избира класа → внесува прашање (или избира од банката)
→ учениците добиваат push notification → отвораат StudentPlayView → одговараат
→ наставникот гледа real-time distribution

Ова е поедноставена верзија на Gamma Live — не бара презентациски mode
```

---

### П2 — Диференцирано домашно по ученик (S34)
**Приоритет: ВИСОК · Ефект: Персонализирано учење надвор од час**

```typescript
// AssignDialog.tsx → нов режим „Адаптивно":
// 1. Системот ги гледа quiz_results на секој ученик во класот
// 2. За секој ученик → генерира различна верзија на домашната:
//    mastery < 60%: support ниво (DoK 1-2, step hints)
//    mastery 60-80%: standard (DoK 2-3)
//    mastery > 80%: challenge (DoK 3-4, extended thinking)
// 3. Секој ученик ја добива НЕГОВАТА верзија → StudentPlayView
// 4. Резултатите назад → TeacherAnalyticsView по ученик
```

---

### П3 — Forum Push Notifications — затвори го P2 (S33)
**Приоритет: ВИСОК · Тековна состојба: PARTIAL (backend deployed, live replay неверифициран)**

```
Верифицирај дека:
1. Firebase Cloud Function е активна на prod
2. Нова порака во thread → FCM push до сите participantUids
3. Browser notification се прикажува ≤5 секунди
4. Ако не работи: debug Cloud Function logs → fix → redeploy
5. Додади vitest mock за pushService.ts (сега нема)
```

---

### П4 — Колаборативно планирање во реалтајм (S35)
**Приоритет: УМЕРЕН · Тековна состојба: useCollabPlan.ts постои (119 линии)**

```
Два наставници можат истовремено да уредуваат ист lesson plan:
→ Firestore onSnapshot за live updates (постои)
→ Optimistic updates + conflict resolution (last-write-wins или OT)
→ „X уредува..." индикатор (присуство → Firestore presence pattern)
→ Cursor tracking (по аналогија со Google Docs)
Ова е природна надградба на useCollabPlan.ts
```

---

### П5 — Parent Portal елевација (S34)
**Приоритет: УМЕРЕН · Тековна состојба: ParentPortalView 352 линии, thin**

```
Тековно: само прогрес читање
Треба:
1. Родителот добива weekly summary email/push:
   "Вашето дете оваа недела реши 23 задачи, мастери 2 нови концепти,
    но има тешкотии со: Дропки (35% успешност)"
2. Родителот може да постави reminder за ученикот ("Реши 5 задачи пред 20:00")
3. Chat линија до наставникот (директно преку ForumThread со тип='parent-teacher')
4. Графикон: mastery по тема → визуелно разбирлив за нематематичари
```

---

### П6 — Multiplayer Canvas (S37)
**Приоритет: СТРАТЕШКИ ДОЛГОРОЧНО · Тековна состојба: S19-P4 OPEN**

```
Архитектура:
→ WebSocket сервер (Cloudflare Workers Durable Objects или Supabase Realtime)
→ YJS CRDT за документ синхронизација
→ Cursor presence (боја по корисник)
→ Whiteboard: draw, shapes, LaTeX input, image paste
→ Интеграција со Gamma Mode (слајдовите стануваат whiteboard после Edge)
→ Firebase Storage за snapshot при затворање
```

---

## ДЕЛ V — ПЛАТФОРМСКА ИНФРАСТРУКТУРА

### Инф1 — i18n: EN / AL / TR покриеност (S33–S34)
**Приоритет: СТРАТЕШКИ · Тековна состојба: MK 100%, AL/TR/EN ~5%**

```
Стратегија (Gemini batch):
1. Извлечи сите uninstrumented strings (51 views × просечно 20 strings = ~1,020 keys)
2. geminiService.translateUI(strings[], targetLang) → batch Gemini translation
3. Ревизија од native speaker (Albanian/Turkish teacher)
4. Интеграција во i18n/translations.ts
5. E2E тест: секој main view во AL → screenshot → visual regression

Редослед: AL прво (Albanian ученици се втора по голем заедница во МК)
          TR втора
          EN трета (за international reach)
```

---

### Инф2 — LTI 1.3 Basic (S35)
**Приоритет: ВИСОК · Ефект: Интеграција со Google Classroom, Microsoft Teams, Moodle**

```
LTI 1.3 Basic:
  /api/lti-launch — OIDC login init
  /api/lti-callback — JWT validation → create/link user → redirect
  iframe embed: /lti/quiz/{id} → StudentPlayView без sidebar

Ова отвора:
  → Google Classroom teachers можат да додадат задачи директно
  → Microsoft Teams Education integration
  → Мк училишта кои веќе имаат Moodle
```

---

### Инф3 — Firestore Security Audit Round 2 (S33)
**Приоритет: ВИСОК**

```
S26 додаде правила за matura_exams/matura_questions/matura_ai_grades.
Нови колекции создадени по S26 кои треба правила:
  → live_gamma/{pin}/responses  → само studentId == request.auth.uid
  → student_matura_profiles     → само owner + school_admin
  → users/{uid}/maturaResults   → само owner
  → users/{uid}/maturaMissions  → само owner

Алатка: Firebase Emulator + Rules Unit Tests (Firebase Test SDK)
```

---

### Инф4 — Performance Monitoring → Real User Metrics (S33)
**Приоритет: УМЕРЕН · Тековна состојба: Web Vitals beacon постои (S26), SLO tracker постои**

```
Додади:
1. Per-route LCP tracking:
   ConceptDetailView → среден LCP < 2.5s
   MaturaLibraryView → среден LCP < 3.0s (голем view)
2. Gemini latency per-tier tracking во SLODashboard
3. Real error rate алерт: ако 5xx > 2% за 10 мин → Sentry alert + Slack webhook
4. Bundle size regression: CI job → ако chunk > 300 kB gzip → fail build
```

---

### Инф5 — End-to-End тестирање елевација (S33)
**Приоритет: УМЕРЕН · Тековна состојба: 16 E2E spec files, visual regression 5 рути**

```
Критични рути без E2E тестови:
1. TeacherForumView (1,237 линии, никогаш тестиран)
2. ParentPortalView
3. StudentLiveQuizView (кога се имплементира)
4. GammaModeModal (keyboard nav, annotation, PPTX export)
5. ExtractionHubView (drag-drop, chunked extraction progress)

Visual regression expansion: 5 → 20 рути
```

---

### Инф6 — Voice Input (`useVoice.ts` е 11 линии — stub) (S34)
**Приоритет: УМЕРЕН**

```typescript
// Web Speech API → AssistantView + MathInput
// SpeechRecognition интеграција:
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'mk-MK'; // Macedonian
recognition.onresult = (e) => setTranscript(e.results[0][0].transcript);

// MathInput: voice → Gemini → LaTeX (напр. "икс на квадрат плус пет" → "$x^2 + 5$")
// AssistantView: voice → текст → AI chat
// GammaMode: voice → "следен слајд", "прикажи решение", "зголеми" commands
```

---

### Инф7 — Offline Queue за AI генерирање (S34)
**Приоритет: УМЕРЕН**

```typescript
// Тековно: ако offline при AI генерирање → error
// Треба: optimistic queue
const offlineQueue: GenerationRequest[] = [];
// При offline: додај во queue (localStorage/IndexedDB)
// При online: процесирај ред → покажи notification "3 генерирања завршиле"
// useNetworkStatus() + useOfflineQueue() hooks (сега нема)
```

---

## ДЕЛ VI — UX / UI ЕЛЕВАЦИЈА

### UX1 — Command Palette елевација (S33)
**Приоритет: УМЕРЕН · Тековна состојба: CommandPalette.tsx постои**

```
Тековно: basic search
Треба:
  Cmd+K → отвори palette
  → "нов тест за алгебра 8. одд" → MaterialsGeneratorView со prefill
  → "матура 2024 јуни" → MaturaLibraryView со filter
  → "покажи слаби концепти на Ана" → TeacherAnalyticsView → student
  → "гама презентација тригонометрија" → Gamma генерирање
  → "Питагорова теорема" → ConceptDetailView
  Fuzzy search + AI intent routing (intentRouter.ts постои!)
```

---

### UX2 — Global Notification Center (S33)
**Приоритет: УМЕРЕН · Тековна состојба: NotificationContext постои, нема inbox UI**

```
Header bell icon → dropdown inbox:
  → "Ана Петрова заврши квиз: 87%" (5 мин)
  → "Нова порака во форум: Питагорова теорема" (12 мин)
  → "Gamma сесија: 18/22 ученици одговориле" (1 час)
  → "AI генерирање завршено офлајн: Тест за дропки" (3 часа)
Mark as read / Clear all
Firestore: users/{uid}/notifications (веќе постои колекцијата)
```

---

### UX3 — FavoritesView елевација (S33)
**Приоритет: НИЗОk · Тековна состојба: 85 линии — само список**

```
Тековно: thin list view
Треба: истата богата ContentLibraryView UX но само за favorites
→ Folder организација (наставникот прави "Алгебра", "Геометрија" folders)
→ Quick-play директно од favorites
→ Share favorites collection (делиба со колеги)
```

---

### UX4 — Onboarding Tour елевација (S34)
**Приоритет: УМЕРЕН · Тековна состојба: react-joyride GlobalTour.tsx**

```
Тековно: статичен joyride tour
Треба:
→ Интерактивен first-use wizard (не само tooltip пасиви)
→ "Создади прв тест" → guided flow низ MaterialsGeneratorView
→ "Постави прва задача" → guided AssignDialog
→ Progress checkpoints: 1/5 завршено → XP reward
→ Може да се реиграе: Settings → "Рестартирај водич"
```

---

### UX5 — Math Scratchpad → Global Persistent (S33)
**Приоритет: УМЕРЕН · Тековна состојба: DigitalScratchpad.tsx постои**

```
Тековно: scratchpad е per-view, состојбата се губи при навигација
Треба:
→ Scratchpad е global (Zustand или localStorage)
→ Достапна од FAB (floating action button) насекаде
→ История на scratch работа по сесија
→ Извоз во PNG / LaTeX
→ Директно paste во AssistantView чат
```

---

## ДЕЛ VII — МATURA ПЛАТФОРМА ПРОДОЛЖУВАЊЕ

### М1 — Vocational3/2 Matura JSON фајлови (S33)
**Приоритет: УМЕРЕН · Тековна состојба: само gymnasium + vocational4 economics/IT**

```
Следен редослед за мatura база:
  → vocational4 economics: 2019-2021 (3 испити)
  → vocational4 IT: 2019-2021 (3 испити)
  → vocational3 (стручно 3-год): завршен испит 2020-2024 (ако постои)
  → vocational2 (стручно 2-год): завршен испит 2020-2024 (ако постои)
  → gymnasium 2014-2016: порани испити за поширока банка
```

---

### М2 — Матура AI Тутор (S34)
**Приоритет: ВИСОК · Ефект: Ученикот добива персонализирана матурска припрема**

```
MaturaPortalView → [Старт AI Тутор сесија]
→ AI ги гледа StudentMaturaProfile (weak topics, streak, examDate)
→ Генерира „ден-по-ден" план за наредните N дена до испитот
→ Секој ден: 3 прашања по weak topic → AI feedback → XP
→ При грешка: Socratic hint (веќе постои во InteractiveQuizPlayer)
→ Weekly report: "Оваа недела подобривме Алгебра за 18%"
→ Интеграција со 7-Day Mission (MissionPanel веќе постои)
```

---

### М3 — Матура Community Solutions (S34)
**Приоритет: УМЕРЕН · Ефект: Учениците учат еден од друг**

```
На секое матурско прашање во MaturaPracticeView:
→ [Прикажи community решенија] (само ако aiSolution не постои)
→ Ученик може да постави свое решение (текст + LaTeX + слика)
→ Другите ученици: 👍 / 👎 glasanje
→ Модерација: наставник/admin може да пинира најдоброто

Firestore: matura_questions/{id}/community_solutions/{uid}
Security: allow write: if request.auth != null && solution.length > 10
```

---

## ДЕЛ VIII — СТРАТЕШКИ (S38+)

### С1 — IRT (Item Response Theory) (S40+)
**Приоритет: ДОЛГОРОЧНО · Услов: ≥ 1,000 одговори по прашање**

```
Кога ќе се акумулираат доволно одговори:
→ 3-параметарски IRT модел (discrimination + difficulty + guessing)
→ Секое прашање добива реален difficulty_irt (наместо AI-pretpostavena)
→ Adaptive testing: следното прашање се избира врз основа на IRT
→ Стандардизирани резултати (z-score, percentile) наспроти национален benchmark
```

---

### С2 — Olympic Training Center (S38+)
**Приоритет: ДОЛГОРОЧНО · Голема content работа**

```
Засебна секција за математичка олимпијада (МК државна + MEMO + IMO):
→ Задачи по категорија: algebra, number_theory, combinatorics, geometry
→ AI хинтови по Socratic метод (не директно решение)
→ Proof checker: LaTeX → AI верификација на исправноста
→ Leaderboard: регионален / национален / IMO
→ Training camps: 12-недела программа со AI coach
```

---

### С3 — Formal Proof Assistant (S39+)
**Приоритет: R&D · Ефект: За напредни гимназисти и студенти**

```
→ Lean4 / Coq lite interface за формални докази
→ AI проверка дали доказот е валиден
→ Автоматски completion suggestions (как GitHub Copilot но за докази)
→ Поврзан со proof слајд типот во Gamma Mode
```

---

### С4 — Global Reach — AI Content Localization Engine (S36+)
**Приоритет: СТРАТЕШКИ**

```
Откако MK/AL/TR се 100% покриени:
→ BG (Бугарија): ист curriculum framework, блиски стандарди
→ SR (Србија): НПРО (Национален просветни развој) curriculum
→ HR (Хрватска): MZOS curriculum
→ BA (БиХ): Федерација + РС curriculum

Архитектура:
→ Curriculum data layer по земја (data/countries/bg/, data/countries/sr/)
→ AI generation со country-specific curriculum context
→ Ист платформ, различни curriculum бази
```

---

## ПРИОРИТИЗИРАН SPRINT ПЛАН

| Sprint | Главни теми | Effort |
|---|---|---|
| **S33** | К1-К6 (критични fixes) · А1-А2 (split) · Г1-Г3 (touch/zoom/thumbnails) · П3 (FCM) · Инф1-AL · AI4 (auto-translation) | 5 дена |
| **S34** | Г4 (Presenter Mode) · Г5 (PPTX charts) · Г9-Г10 (exit ticket/handout) · AI7 (lesson assistant) · П1 (SRS) · П5 (parents) · Инф3-Инф4 | 5 дена |
| **S35** | Г7 (Gamma Live) · AI1 (Vector RAG) · AI2 (Vimeo OAuth) · AI3 (large PDF) · Инф2 (LTI 1.3) · М2 (Matura AI Tutor) | 7 дена |
| **S36** | Г8 (adaptive branching) · AI5 (Socratic Gamma) · AI6 (misconception auto-detect) · П2 (differentiated HW) · UX1 (Command Palette) | 5 дена |
| **S37** | П4 (collab planning) · П6 (multiplayer canvas) · Г11 (recording) · С4 (global localization start) | 7 дена |
| **S38+** | С1 (IRT) · С2 (Olympic) · С3 (Proof Assistant) | Research |

---

## МЕТРИКИ — Цел по S37

| Метрика | Сега (S32) | Цел (S37) |
|---|---|---|
| TSC грешки | 0 | 0 |
| Unit tests | 689 | ≥ 900 |
| E2E routes покриени | 5/63 | 20/63 |
| i18n покриеност | MK 100%, AL 5%, TR 5% | MK/AL/TR/EN 95% |
| Bundle initial parse | ~132 kB gzip | < 100 kB gzip |
| Slide типови Gamma | 12 | 14+ |
| Live студенти per Gamma сесија | 0 | ≤ 60 real-time |
| Matura прашања | ~400 | ≥ 800 |
| Few-shot RAG примери | 6 (exact match) | 8 (semantic/vector) |
| LCP p75 | < 2.5s | < 1.5s |

---

## ДОКУМЕНТАЦИЈА — Линкови

| Документ | Содржина |
|---|---|
| `S30_PLAN.md` | Extraction Engine аудит + YouTube fix + chunked PDF |
| `S32_PLAN.md` | RAG Elevation + DOCX Vision Mode |
| `STRATEGIC_ROADMAP.md` | Целосна историја на сите спринтови |
| `NATIONAL_STRATEGY.md` | Национална стратегија за едукација |
| `MASTER_ACTION_PLAN.md` | **Овој документ** — сеопфатен план |

---

*Последно ажурирање: 18.04.2026 · Верзија: 1.0 · По аудит на 63 views, 150+ components, 43 hooks, 22 services, 14 API endpoints*
