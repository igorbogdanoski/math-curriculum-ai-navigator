# Акционен план S20+ — Доградување до врв
**Датум:** 13.04.2026  
**Статус:** АКТИВЕН — задолжително запазување  
**Принцип:** Секој чекор поминува низ квалитетен gate пред да се затвори. Нема `as any`, нема `@ts-ignore`, нема хардкодирање, нема половично завршени функционалности.

---

## НЕПРЕГОВАРАЧКИ ПРАВИЛА (важат за секоја линија код)

```
1. tsc --noEmit → 0 грешки ПРЕД секој commit
2. npm run build → PASS ПРЕД секој commit (husky го спроведува)
3. Нема as any, @ts-ignore, eslint-disable без документирана причина
4. Секоја нова функционалност носи најмалку 1 unit тест
5. Секој нов Firestore read/write носи security rule + error handling
6. Секој нов AI prompt носи fallback (timeout, empty response, quota)
7. Секоја UI промена е responsive (мобилен + десктоп)
8. Секоја промена на bundle/chunk носи build size check
9. Evidence log во STRATEGIC_ROADMAP.md се ажурира во истата сесија
10. Ако нешто може да се направи подобро — СЕ ПРАВИ ПОДОБРО, не се оставаsh за "подоцна"
```

---

## ПРИОРИТЕТИ — Редослед по импакт

```
БЛОК 1 — Технички долг (денес)
БЛОК 2 — Педагошки длабочина (оваа недела)  
БЛОК 3 — UI/UX подобрување (оваа недела)
БЛОК 4 — Содржина (тековно, паралелно)
БЛОК 5 — Напредни функционалности (следната недела)
```

---

## БЛОК 1 — Технички долг (висок импакт, мала ризичност)

### B1-1: Lazy-load на secondary curriculum data ⏳ СЛЕДНО

**Проблем:** `index.js` = 2.04 MB. Причина: `secondaryCurriculumByTrack` (~394KB source) е статичен import во `useCurriculum.ts` и `ExploreView.tsx` → тече во главниот chunk.

**Решение:** Динамичен import, само за корисници со `secondaryTrack`.

```ts
// hooks/useCurriculum.ts — СЕГА (статичен, секогаш bundled):
import { secondaryCurriculumByTrack } from '../data/secondaryCurriculum';

// ПОСЛЕ (динамичен, само кога треба):
const [secondaryData, setSecondaryData] = useState<typeof import('../data/secondaryCurriculum') | null>(null);
useEffect(() => {
  if (isAdmin || secondaryTrack) {
    import('../data/secondaryCurriculum').then(setSecondaryData);
  }
}, [isAdmin, secondaryTrack]);
```

**Очекувано подобрување:** index.js −150-200KB (gzip), initial load −0.5-0.8s на мобилен.

**Quality gate:**
- [ ] tsc: 0 грешки
- [ ] vitest: 535/535
- [ ] `npm run build` → index.js < 1.85 MB
- [ ] Primary наставник (без track) не вчитува secondary data
- [ ] Secondary наставник гледа свои grades нормално

---

### B1-2: Чистење на stale root фајлови ⏳ СЛЕДНО

```bash
# Во root постојат непотребни фајлови:
# =, --outputs, ## ФАЗА (грешки од терминал), temp outputs
git rm -f = --outputs "## ФАЗА" 2>/dev/null || true
```

**Проверка:**
```bash
ls -la | grep -v "^d\|node_modules\|dist\|^-r\|\.md\|\.ts\|\.js\|\.json\|\.config\|\.env\|\.git"
```

---

### B1-3: Console.log → централен logger ⏳

Во production, `console.log` е noise. Централен logger со Sentry integration:

```ts
// utils/logger.ts — НОВА АЛАТКА
export const logger = {
  info: (msg: string, ctx?: object) => { if (isDev) console.info(msg, ctx); },
  warn: (msg: string, ctx?: object) => { console.warn(msg, ctx); Sentry.captureMessage(msg, 'warning'); },
  error: (msg: string, err?: Error, ctx?: object) => { console.error(msg, err); Sentry.captureException(err ?? new Error(msg), { extra: ctx }); },
};
```

**Scope:** Замени `console.log` во сите services/* и hooks/* (не views — тоа е debug).

---

## БЛОК 2 — Педагошка длабочина

### B2-1: Spaced Repetition Loop 🔴 ВИСОК ПРИОРИТЕТ

**Зошто:** `spaced_rep` Firestore колекцијата веќе постои. `concept_mastery` постои. Само треба SM-2 логика + daily trigger.

**Архитектура:**
```
concept_mastery (слаби концепти)
    ↓ SM-2 алгоритам (intervalDays, easeFactor, repetitions)
spaced_rep/{uid}/{conceptId} (due date, interval, ease)
    ↓ DailyReviewWidget во HomeView
"Имаш 5 концепти за прегледување денес" → auto-generate 5 прашања
    ↓ Quiz резултат → ажурира SM-2 параметри
```

**SM-2 формула (чиста математика, без external library):**
```ts
function nextInterval(quality: 0|1|2|3|4|5, prevInterval: number, easeFactor: number) {
  if (quality < 3) return 1; // again tomorrow
  if (prevInterval === 0) return 1;
  if (prevInterval === 1) return 6;
  return Math.round(prevInterval * easeFactor);
}
```

**Implementation steps:**
1. `utils/spacedRepetition.ts` — SM-2 pure functions + unit tests
2. `services/firestoreService.spacedRep.ts` — CRUD за `spaced_rep` колекцијата
3. `hooks/useSpacedRep.ts` — today's due concepts
4. `components/DailyReviewWidget.tsx` — HomeView widget
5. Integration во `MaterialsGeneratorView` — auto-generate по due concepts

**Quality gate:**
- [ ] SM-2 unit tests: 10+ тест случаи (edge cases: quality=0, long intervals, ease decay)
- [ ] Firestore security rule: `allow read, write: if request.auth.uid == resource.data.uid`
- [ ] DailyReviewWidget: graceful empty state (нема due → "Одлично! Нема ништо за повторување")
- [ ] Performance: Firestore query indexing по `dueDate` поле

---

### B2-2: Misconception Detection во AI feedback

**Проблем:** AI кажува "неточно, точниот одговор е X". Не кажува *зошто* ученикот направил таа грешка.

**Решение:** База на типични misconceptions по тема + Gemini ги препознава:

```ts
// data/misconceptions.ts
export const MISCONCEPTIONS: Record<string, string[]> = {
  'Деривати': [
    'Мислат дека d/dx(f·g) = f\'·g\' (заборавање на правилото за производ)',
    'Мешање на d/dx(xⁿ) = nxⁿ со d/dx(aˣ) = aˣ·ln(a)',
  ],
  'Интеграли': [
    'Заборавање на +C кај неодреден интеграл',
    'Замена на горни/долни граници кај определен интеграл',
  ],
  // ...
};
```

Инјектирај во AI грading промптот: ако `topic` е познат, додај `MISCONCEPTIONS[topic]` за context-aware feedback.

---

### B2-3: Dynamic Learning Path (Патека кон матура)

**Визија:** Ученик отвора → апликацијата му кажува: "До матурата имаш 47 дена. Треба уште: Деривати (слаб), Интеграли (непокриен). Препорачано: 1 тема/нед."

**Имплементација:**
```ts
// hooks/useMaturaReadinessPath.ts
function computeReadinessPath(
  weakConcepts: string[],         // од concept_mastery
  maturaConceptIds: string[],      // од испитите кои ученикот избрал
  daysUntilExam: number,
): PathStep[]
```

**Поврзување:**
- `MaturaAnalyticsView` → "Препорачана патека" tab
- `HomeView` → "Следен чекор" widget

---

## БЛОК 3 — UI/UX Подобрување

### B3-1: Mobile Bottom Navigation 🔴 КРИТИЧНО

**Проблем:** Сидебарот на мобилен е неупотреблив. 25%+ корисници се на мобилен.

**Решение:** `MobileBottomNav` компонент — само 5 клучни акции:

```tsx
// components/navigation/MobileBottomNav.tsx
const NAV_ITEMS = [
  { icon: '🏠', label: 'Почетна', path: '/' },
  { icon: '📚', label: 'Програма', path: '/explore' },
  { icon: '✏️', label: 'Генерирај', path: '/generator' },
  { icon: '🎓', label: 'Матура', path: '/matura-library' },
  { icon: '📊', label: 'Аналитика', path: '/analytics' },
];
```

Активирај само на `window.innerWidth < 768px` со `useMediaQuery` hook.

**Quality gate:**
- [ ] Не се рендерира на десктоп (waste на простор)
- [ ] Active state по тековна рута
- [ ] Safe area insets за iPhone X+ (CSS `env(safe-area-inset-bottom)`)
- [ ] Не пречи со постоечки floating buttons (FAB, ForumCTA)

---

### B3-2: Onboarding Wizard за нови наставници

**Проблем:** Нов наставник отвора 61 view → паника → ододат.

**3-чекорен wizard (само при прва посета):**

```
Чекор 1: "Кое одделение предаваш?" → setProfile.gradeLevel
Чекор 2: "Имаш ли матурска класа?" → setProfile.secondaryTrack  
Чекор 3: "Генерирај го твојот прв материјал сега" → /generator
```

**Trigger:** `localStorage.getItem('onboarding_completed') === null` + автентициран корисник.

**Quality gate:**
- [ ] Не се прикажува за admin корисници
- [ ] Не се прикажува ако профилот веќе е комплетен
- [ ] "Прескокни" опција секаде

---

### B3-3: EN/AL/TR batch translations 🟡 ВАЖНО

**Метод:** Gemini batch превод на сите `t()` клучеви:

```ts
// scripts/batch-translate.mjs
const keys = extractAllTranslationKeys('./src'); // ~800 клучеви
const translations = await batchTranslate(keys, ['al', 'tr', 'en']);
fs.writeFileSync('./src/locales/al.json', JSON.stringify(translations.al));
```

**Scope:** Само UI labels (не AI генерирана содржина). ~800 клучеви × 3 јазика = 2400 преводи = ~$0.50 Gemini.

**Quality gate:**
- [ ] Прегледај 50 random клучеви рачно (AL особено — Gemini добро го знае)
- [ ] Нема машинска буквалност за педагошки термини
- [ ] Мета (homework=домашна работа, not "домашна задача")

---

### B3-4: RoadmapView — скриј secondary grades за primary наставници

**Проблем:** Primary наставник гледа dropdown со `X — Стручно 4-год` — конфузно.

```tsx
// views/RoadmapView.tsx — во grade selector:
{curriculum?.grades
  .filter((grade: Grade) => !grade.secondaryTrack || !!user?.secondaryTrack)
  .map((grade: Grade) => (...))}
```

Мал fix, голем UX gain.

---

## БЛОК 4 — Содржина (паралелно со останатото)

### B4-1: Vocational Matura испити — Content Sprint

**Тековна состојба:** 57 gymnasium испити ✅. Стручни = 0.

**Редослед по импакт:**
1. `vocational-economics` — 2022, 2023, 2024 (јуни + август, MK)
2. `vocational-it` — иста временска рамка
3. `vocational-electro` — ист pipeline
4. `vocational-mechanical`, `vocational-health`, `vocational-civil`

**JSON конвенција:**
```json
{
  "exam": {
    "id": "dim-vocational-economics-2023-june-mk",
    "track": "vocational-economics",
    "year": 2023, "session": "june", "language": "mk",
    "gradeLevel": 12, "durationMinutes": 120
  }
}
```

**Pipeline:**
```bash
# За секој нов испит:
node scripts/import-matura.mjs --input path/to/file.json
node scripts/matura-concept-map.mjs  # auto conceptIds
node scripts/validate-matura.mjs     # валидација
git add data/matura/raw/ && git commit -m "content-matura-vocational-economics-2023-june-mk"
```

---

### B4-2: aiSolution за матурски прашања

**Полето постои** — `MaturaQuestion.aiSolution?: string` — но е null на повеќето прашања.

**Batch генерација:**
```ts
// scripts/generate-solutions.mjs
// За секое прашање без aiSolution:
// callGemini(getSecondaryTrackContext('gymnasium') + прашање + "дај чекор-по-чекор решение во LaTeX")
// → сними во raw JSON фајл → git commit
```

**Cache strategy:** Сочувај во raw JSON (static, за сите) + Firestore cache (за on-demand генерација во апп).

---

## БЛОК 5 — Напредни функционалности

### B5-1: Forum FCM Push — Финален DONE close

**Тековна состојба:** Backend работи, `successCount:0` поради stale browser token.

**Потребно за DONE:**
1. Корисник А логира во производствена средина, регистрира FCM token
2. Корисник Б replies на неговa нишка
3. Корисник А добива push notification

**Validation:** `replayForumReplyNotification` со live browser token → `successCount: 1`.

---

### B5-2: Multiplayer Canvas (WebSocket) — S21

Не се дира додека не се затворат B1-B4. WebSocket инфраструктура бара:
- Vercel Edge Functions или Cloudflare Workers (не standard Functions)
- Session management (create/join/sync/leave)
- Conflict resolution (CRDT или server-authoritative)

**Проценка:** 3-4 недели реална работа. Пред тоа: докажи PoC со Firestore real-time (onSnapshot) наместо WebSocket.

---

## ИМПЛЕМЕНТАЦИСКА МАТРИЦА — Редослед

| # | Задача | Блок | Effort | Impact | Ризик | Статус |
|---|--------|------|--------|--------|-------|--------|
| 1 | B1-1: Lazy-load secondary | Техн. | 2ч | 🔴 High | Low | ⏳ |
| 2 | B1-2: Stale root files | Техн. | 15мин | Low | None | ⏳ |
| 3 | B3-4: RoadmapView grade filter | UX | 30мин | Medium | Low | ⏳ |
| 4 | B2-1: Spaced Repetition | Педаг. | 2 дена | 🔴 High | Medium | ⏳ |
| 5 | B3-1: Mobile Bottom Nav | UX | 1 ден | 🔴 High | Low | ⏳ |
| 6 | B3-3: EN/AL/TR translations | UX | 1 ден | High | Medium | ⏳ |
| 7 | B2-2: Misconception Detection | Педаг. | 1 ден | High | Low | ⏳ |
| 8 | B3-2: Onboarding Wizard | UX | 1 ден | High | Low | ⏳ |
| 9 | B2-3: Learning Path | Педаг. | 2 дена | High | Medium | ⏳ |
| 10 | B4-1: Vocational Matura | Содр. | ongoing | 🔴 High | None | ⏳ |
| 11 | B4-2: aiSolution batch | Содр. | 1 ден | High | Low | ⏳ |
| 12 | B1-3: Central logger | Техн. | 1 ден | Medium | Low | ⏳ |
| 13 | B5-1: FCM DONE close | Feat. | 2ч (token) | Medium | Low | ⏳ |
| 14 | B5-2: Multiplayer Canvas | Feat. | 3-4 нед | High | 🔴 High | 🔒 |

---

## DEFINITION OF DONE — за секоја задача

Задача се смета за DONE само ако:

```
✅ Функционалноста работи end-to-end (не само happy path)
✅ tsc --noEmit → 0 грешки
✅ npm run build → PASS (без нови chunk size regressions)
✅ vitest: сите постоечки тестови PASS + нови тестови за новата функционалност
✅ Edge cases се справени (offline, empty state, error state)
✅ Mobile + Desktop UX проверен
✅ Evidence log во STRATEGIC_ROADMAP.md ажуриран
✅ Commit со описна порака (без "fix", "update", "change" — конкретно ШТО и ЗОШТО)
```

---

## КВАЛИТЕТНИ ГАРДИ — Автоматски (husky pre-commit)

```bash
# .husky/pre-commit (веќе активен):
npx tsc --noEmit   # TypeScript
npx lint-staged    # ESLint + Prettier на staged фајлови
```

Доколку гардот пречи за легитимна причина — **документирај зошто**, не го bypass-ирај.

---

## МЕРЕЊЕ НА НАПРЕДОК — Weekly KPI

| Метрика | Сега | Цел S20 | Цел S21 |
|---------|------|---------|---------|
| index.js (minified) | 2.04 MB | < 1.7 MB | < 1.4 MB |
| Unit тестови | 535 | 600+ | 700+ |
| AL/TR UI покриеност | ~5% | 80% | 100% |
| Матурски испити (вкупно) | 57 gymnasium | +12 vocational | +30 vocational |
| Mobile Lighthouse Score | ~55 | 75+ | 85+ |
| Spaced Rep активни корисници | 0 | feature live | retention +20% |
| aiSolution покриеност | ~5% | 50% | 90% |

---

*Создаден: 13.04.2026 — Задолжително запазување. Секоја отстапка од правилата бара документирана причина.*
*Следна ревизија: по завршување на БЛОК 1 и БЛОК 2.*
