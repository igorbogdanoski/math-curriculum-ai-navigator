# MASTERPLAN S117 — Длабочина + Geometry3D Excellence

> ✅ ЗАВРШЕН — сите 4 спринта имплементирани и push-нати на `origin/main`.
> Датум: 2026-07-03 · TSC 0 · LOC ≤750/file
> Commit base: `269ae5e` (рефакторирање завршено)
> Приоритет: Д > А > Б > В

---

## ПРЕГЛЕД НА НАСОКИ

| Насока | Опис | Нови файлови | Приоритет |
|--------|------|-------------|-----------|
| **Д** | Geometry3DLab — светска класа | 2 нови | ⭐⭐⭐ |
| **А** | Адаптивност — лабот те "чита" | 0 нови (само hooks) | ⭐⭐⭐ |
| **Б** | Континуитет — ученикот не почнува од нула | 1 нов | ⭐⭐ |
| **В** | Значење — резултати → МОН стандарди | 0 нови (промени во постоечки) | ⭐⭐ |

---

## НАСОКА Д — Geometry3DLab: НАЈДОБРА МОЖНА ВЕРЗИЈА

### Тековна состојба (5 таба)

| Таб | Содржина | Недостатоци |
|-----|----------|-------------|
| 🧊 Истражувач | 18 полиедри, 3D SVG рендер, Ојлер | Нема сфера/конус/цилиндар; нема В/П формули во истражувачот |
| 📐 Планови | 3 ортогонални погледи, ротација | Само полиедри, нема заоблени тела |
| 📄 Мрежи | 5 мрежи + печатење | Само 5 — нема конус, цилиндар; нема анимирано виткање |
| ✂️ Пресеци | Сфера/куба/пирамида/конус/цилиндар, slider | Нема пресмета за некружни пресеци кај конус (елипса/парабола/хипербола) |
| ⬡ Призма/Пирамида | n-страни, slider, V + П | Нема сфера/конус/цилиндар |

### Она што недостасува за "светска класа"

1. **✏️ Вежбај таб** — нема `quiz_results` интеграција
2. **⚫ Заоблени тела** — Сфера, Конус, Цилиндар немаат посебен таб (само во CrossSections)
3. **🔗 Дуалност** — куба↔октаедар, додека↔икосаедар не е покажано
4. **🎬 Авто-ротација** — постои drag но нема play/pause auto-spin
5. **Вистинска пресметка на конусни пресеци** — само гледаме форма, нема a/b за елипса

---

### Д.1 — Таб "⚫ Заоблени тела" (Сфера · Конус · Цилиндар)

**Нов компонент во `geometry3dPanels.tsx`:** `RoundSolidsPanel`

**Содржина:**
```
- Три копчиња: Сфера | Конус | Цилиндар
- Слајдер за r (полупречник) · h (висина, само конус и цилиндар)
- SVG 2D "пресек" приказ (страничен профил со размери)
- Пресметки во реално време:
    Сфера:    V = (4/3)πr³  · S = 4πr²
    Конус:    V = (1/3)πr²h · S = πr(r + l) каде l = √(r²+h²)
    Цилиндар: V = πr²h      · S = 2πr(r + h)
- "Знаеш ли?" факти (Земјата, вселенски купол, конзерви)
- МОН / Гимназија бадги
```

**Промени во `Geometry3DLab.tsx`:**
```typescript
type GeoTab = 'explorer' | 'plans' | 'nets' | 'cross' | 'prispyram' | 'rounded' | 'exercises';
// Додај: { id: 'rounded', label: '⚫ Заоблени тела' }
// Додај: { id: 'exercises', label: '✏️ Вежбај' }
```

---

### Д.2 — Таб "🔗 Дуалност" (Dual Solids)

**Во `PolyhedraExplorer`** (без нов таб — вграден во Explorer):

```
Под V/E/F grid: нов ред "Дуален на:"
  куба       → "Октаедар (замени V↔F)"
  октаедар   → "Куба"
  додекаедар → "Икосаедар"
  икосаедар  → "Додекаедар"
  тетраедар  → "Тетраедар (само-дуален)"
  призми     → "Антипризми"
```

**Бутон "Прикажи дуал"** → selId се менува на дуалниот solid.

**Во `geometry3dMath.ts` додај:**
```typescript
export const DUAL_MAP: Record<string, string> = {
  cube: 'octa', octa: 'cube',
  dodeca: 'icosa', icosa: 'dodeca',
  tetra: 'tetra',
  triprism: 'triantiprism', triantiprism: 'triprism',
  quadprism: 'squareantiprism', squareantiprism: 'quadprism',
};
```

---

### Д.3 — Авто-ротација во PolyhedraExplorer

**Во `PolyhedraExplorer` компонентот:**
```typescript
const [autoSpin, setAutoSpin] = useState(false);
const animRef = useRef<number>();

useEffect(() => {
  if (!autoSpin) { cancelAnimationFrame(animRef.current!); return; }
  const tick = () => {
    setAngleY(a => a + 0.008);
    animRef.current = requestAnimationFrame(tick);
  };
  animRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(animRef.current!);
}, [autoSpin]);
```

**Бутон:** `▶ Ротирај` / `⏸ Пауза` — во toolbar покрај "Жичен модел".

Исто додај и во `PrismPyramidCalculator` (истата логика).

---

### Д.4 — Конусни пресеци: реални мерки за елипса

**Во `CrossSections`** — ажурирај логиката за конус:

Моментално: само r (радиус) без а/b за елипса/парабола.

```typescript
// Нов тип за пресек:
type CSResult =
  | { shape: 'circle';    r: number; area: number; perim: number }
  | { shape: 'ellipse';   a: number; b: number; area: number; perim: number }
  | { shape: 'parabola';  p: number }
  | { shape: 'hyperbola'; a: number; b: number }
  | { shape: 'point' }
  | { shape: 'square';    side: number; area: number; perim: number };

// За конус со наклон θ на рамнината:
// θ = 0 → круг; 0<θ<α → елипса (α = полу-агол на конусот)
// θ = α → парабола; θ > α → хипербола
```

**Додај слајдер "Агол на рамнината θ"** покрај height slider.
**SVG** во десниот панел да покажува точна елипса со a/b.

---

### Д.5 — ✏️ Вежбај таб (ГЛАВНА РАБОТА — Firestore интеграција)

**Нов файл:** `components/dataviz/geometry3dExerciseMath.ts`

#### POOL1 — Основно (VII одделение)

```typescript
const GEO3D_POOL1: LabExEntry[] = [
  { question: 'Колку лица има куба?', type: 'numeric', correctAnswer: '6',
    hint: 'Куба = хексаедар = 6 квадратни лица', explanation: 'Куба има 6 лица', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Колку темиња има тетраедар?', type: 'numeric', correctAnswer: '4',
    hint: 'Тетра- = 4; 4 триаголни лица → 4 темиња', explanation: '4 темиња', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'V − E + F = ? (Ојлер)', type: 'numeric', correctAnswer: '2',
    hint: 'Ојлерова формула важи за сите конвексни полиедри', explanation: 'V − E + F = 2 (Ојлер)', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Куба: V=8, F=6. E = ?', type: 'numeric', correctAnswer: '12',
    hint: 'V−E+F=2 → 8−E+6=2 → E=12', explanation: '8 − E + 6 = 2 → E = 12', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Волуменот на куба со страна a=3: V = ?', type: 'numeric', correctAnswer: '27',
    hint: 'V = a³ = 3³ = 27', explanation: 'V = 3³ = 27', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Тетраедарот е...',  type: 'multiple_choice',
    options: ['Платонско тело', 'Архимедско тело', 'Призма', 'Антипризма'],
    correctAnswer: 'Платонско тело', hint: '5-те Платонски тела се: тетра, куба, окта, додека, икоса',
    explanation: 'Тетраедарот е едно од 5-те Платонски тела.', difficulty: 1, curriculumRef: 'МОН VII' },
];
```

#### POOL2 — Средно (IX одделение / Гимназија I)

```typescript
const GEO3D_POOL2: LabExEntry[] = [
  { question: 'Октаедар: V=6, E=12. F = ?', type: 'numeric', correctAnswer: '8',
    hint: 'V−E+F=2 → 6−12+F=2 → F=8', explanation: '6 − 12 + F = 2 → F = 8', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Призма со n=5: колку F (лица)?', type: 'numeric', correctAnswer: '7',
    hint: '2 бази + 5 бочни = 7 лица', explanation: 'n+2 = 5+2 = 7 лица', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Четириаголна пирамида: V = a²h/3, a=3, h=4. V = ?', type: 'numeric', correctAnswer: '12',
    hint: 'V = (9 × 4) / 3 = 36/3 = 12', explanation: 'V = 3²·4/3 = 12', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Дуален полиедар на кубата е?', type: 'multiple_choice',
    options: ['Октаедар', 'Тетраедар', 'Икосаедар', 'Додекаедар'],
    correctAnswer: 'Октаедар', hint: 'Замени V↔F: куба (8V,12E,6F) ↔ окта (6V,12E,8F)',
    explanation: 'Кубата и октаедарот се дуални.', difficulty: 2, curriculumRef: 'Гимн. I год.' },
  { question: 'Цилиндар r=2, h=5: V = ?', type: 'multiple_choice',
    options: ['20π', '10π', '4π', '40π'],
    correctAnswer: '20π', hint: 'V = πr²h = π·4·5 = 20π',
    explanation: 'V = π·2²·5 = 20π', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Икосаедарот има колку триаголни лица?', type: 'numeric', correctAnswer: '20',
    hint: 'Икоса- = 20; сите лица се еднакви страноеднакви триаголници',
    explanation: '20 триаголни лица', difficulty: 2, curriculumRef: 'МОН IX' },
];
```

#### POOL3 — Напредно (Гимназија XI–XII)

```typescript
const GEO3D_POOL3: LabExEntry[] = [
  { question: 'Ојлер χ(сфера) = V−E+F = ? (Платонски ↔ сфера)', type: 'numeric', correctAnswer: '2',
    hint: 'Сите конвексни полиедри тополошки ≅ сфера → χ=2',
    explanation: 'Ојлерова карактеристика χ = 2 за сфера', difficulty: 3, curriculumRef: 'Гимн. XI изборен' },
  { question: 'Додекаедарот и икосаедарот се дуали. Ако додека: V=20,E=30,F=12, тогаш икоса: V=?', type: 'numeric', correctAnswer: '12',
    hint: 'При дуалност V↔F: икосаедар V = додека F = 12',
    explanation: 'Икосаедар: V=12, E=30, F=20', difficulty: 3, curriculumRef: 'Гимн. XI изборен' },
  { question: 'Сфера r=3: S = ?', type: 'multiple_choice',
    options: ['36π', '12π', '9π', '18π'],
    correctAnswer: '36π', hint: 'S = 4πr² = 4π·9 = 36π',
    explanation: 'S = 4π·3² = 36π', difficulty: 3, curriculumRef: 'Гимн. I год.' },
  { question: 'Конус r=3, h=4: изводница l = ?', type: 'numeric', correctAnswer: '5',
    hint: 'l = √(r²+h²) = √(9+16) = √25 = 5',
    explanation: 'l = √(9+16) = 5 (Питагорова тројка 3-4-5)', difficulty: 3, curriculumRef: 'Гимн. I год.' },
  { question: 'Хоризонтален пресек на конус = ? (отсекок под аголот на конусот)', type: 'multiple_choice',
    options: ['Круг', 'Елипса', 'Парабола', 'Хипербола'],
    correctAnswer: 'Круг', hint: 'Хоризонталниот пресек е паралелен со основата → секогаш круг',
    explanation: 'Хоризонтален пресек на конус = круг', difficulty: 3, curriculumRef: 'Гимн. II год.' },
  { question: 'Колку правилни полиедри (Платонски тела) постојат?', type: 'numeric', correctAnswer: '5',
    hint: 'Докажано од Ојлер: точно 5 — тетра, куба, окта, додека, икоса',
    explanation: '5 Платонски тела — докажано дека постојат точно 5', difficulty: 3, curriculumRef: 'Гимн. XI изборен' },
];

export function generateGeo3DSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const pool = difficulty === 1 ? GEO3D_POOL1 : difficulty === 2 ? GEO3D_POOL2 : GEO3D_POOL3;
  return shufflePool(pool).slice(0, count).map((e, i) => ({ id: `geo3d-${difficulty}-${i}`, ...e }));
}
```

**Нов суб-компонент во `Geometry3DLab.tsx`:**
```typescript
function Geo3DExercisesTab() {
  const session = useLabSession('geometry-3d', '3D Геометрија');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateGeo3DSet(level));
  }, [difficulty, loadExercises]);
  return <LabExercisePanel session={session} onNewSet={loadSet}
           difficulty={difficulty} onDifficultyChange={setDifficulty} />;
}
```

---

### Д.6 — Конусни пресеци со апликативна врска

**Во `CrossSections`** — додај info box кој ја поврзува со `ConicSectionsLab`:

```tsx
{solid === 'cone' && (
  <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-900">
    <strong>Конусни пресеци → ConicSectionsLab!</strong><br/>
    Пресекот на конус со рамнина дава: Круг · Елипса · Парабола · Хипербола
    — истите криви кои ги проучуваш во
    <a href="#/data-viz?lab=conic" className="underline font-bold ml-1">Конусни Пресеци →</a>
  </div>
)}
```

---

### Д — РЕДОСЛЕД НА ИМПЛЕМЕНТАЦИЈА

**Commit 1:** ✅ `76a0e32` `feat(geo3d-d5): Вежбај таб + geometry3dExerciseMath.ts`
- Нов файл: `geometry3dExerciseMath.ts` (POOL1+2+3, generateGeo3DSet)
- Ажурирај: `Geometry3DLab.tsx` (+exercises tab, +Geo3DExercisesTab)
- Import: useLabSession, LabExercisePanel, generateGeo3DSet

**Commit 2:** ✅ `42f5953` `feat(geo3d-d3+d2): авто-ротација + дуалност`
- `PolyhedraExplorer` → autoSpin state + RAF loop + play/pause бутон
- `PrismPyramidCalculator` → autoSpin (иста логика)
- `geometry3dMath.ts` → DUAL_MAP
- `PolyhedraExplorer` → "Дуален на" ред + "Прикажи дуал" бутон

**Commit 3:** ✅ `83c4650` `feat(geo3d-d1): RoundSolidsPanel (Сфера/Конус/Цилиндар)`
- `geometry3dPanels.tsx` → RoundSolidsPanel компонент
- `Geometry3DLab.tsx` → нов таб '⚫ Заоблени тела'

**Commit 4:** ✅ `7c49ea2` `feat(geo3d-d4+d6): конусни пресеци θ-агол + ConicSectionsLab линк`
- `CrossSections` → θ slider + a/b пресметка + точна SVG елипса
- `CrossSections` → info box со линк кон ConicSectionsLab

**Дополнително (надвор од оригиналниот план):**
- ✅ `5b3965e` `refactor(geo3d): split RoundSolidsPanel + PrismPyramidCalculator into geometry3dSolidPanels.tsx` — LOC ≤750/file
- ✅ `1e4f97f` `fix(geo3d): extract computeConeCrossSection + fix critical-angle mislabel; add tests` — конусниот пресек го означуваше θ=α (~26.6°) наместо вистинскиот 90°−α (~63.4°) како граница парабола/хипербола; и θ=0 секогаш прикажуваше "Елипса" наместо "Круг"

---

## НАСОКА А — Адаптивност (лабот те "чита")

### Тековна состојба

`useLabSession.ts` веќе пресметува:
```typescript
difficultyStreak: { correct: number; wrong: number }
```
...но никогаш не дејствува. Ова е мртва метрика.

### А.1 — Авто-промена на ниво во LabExercisePanel

**Во `LabExercisePanel.tsx`** — по секој `submitAnswer`, провери streak:

```typescript
// Во ExerciseScreen — по прикажување на резултат, пред "Следно":
const { difficultyStreak } = session;

// 2 точни по ред + не сме на max → понуди upgrade
const canUpgrade = difficultyStreak.correct >= 2 && difficulty < 3;
// 2 грешки по ред + не сме на min → понуди downgrade
const canDowngrade = difficultyStreak.wrong >= 2 && difficulty > 1;
```

**UI промена:**
```tsx
{canUpgrade && submitted && correct && (
  <button type="button" onClick={() => onDifficultyChange(difficulty + 1 as 1|2|3)}
    className="w-full py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-300">
    ⬆ 2 точни по ред — оди на ниво {difficulty + 1}?
  </button>
)}
{canDowngrade && submitted && !correct && (
  <button type="button" onClick={() => onDifficultyChange(difficulty - 1 as 1|2|3)}
    className="w-full py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold border border-amber-300">
    ⬇ Пробај на ниво {difficulty - 1} прво
  </button>
)}
```

### А.2 — Post-session слаби точки

**Во `SessionDoneScreen`** — по зачувување, прикажи:

```typescript
// Пресметај кои прашања беа погрешни:
const weakQuestions = exercises.filter((_, i) => !sessionCorrectMap[i]);
```

```tsx
{weakQuestions.length > 0 && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
    <p className="font-bold text-amber-800 mb-1">Области за понатамошна работа:</p>
    {weakQuestions.slice(0, 3).map((q, i) => (
      <p key={i} className="text-amber-700 truncate">· {q.question}</p>
    ))}
  </div>
)}
```

**Имплементација:** Додај `correctHistory: boolean[]` во `useLabSession` state — `submitAnswer` да push-ува.

---

## НАСОКА Б — Континуитет

### Б.1 — Запомни го последното ниво (localStorage)

**Во секој `XExercisesTab` компонент:**

```typescript
// При mount — врати последното ниво:
const [difficulty, setDifficulty] = useState<1|2|3>(() => {
  const saved = localStorage.getItem(`lab_diff_${labId}`);
  return (saved === '1' || saved === '2' || saved === '3') ? +saved as 1|2|3 : 1;
});

// При промена — зачувај:
const handleDiffChange = (d: 1|2|3) => {
  setDifficulty(d);
  localStorage.setItem(`lab_diff_${labId}`, String(d));
};
```

**Нов hook:** `hooks/useLabDifficulty.ts`

```typescript
export function useLabDifficulty(labId: string) {
  const [difficulty, setDifficulty] = useState<1|2|3>(() => {
    try {
      const s = localStorage.getItem(`lab_diff_${labId}`);
      return (s === '1' || s === '2' || s === '3') ? +s as 1|2|3 : 1;
    } catch { return 1; }
  });
  const setAndPersist = useCallback((d: 1|2|3) => {
    setDifficulty(d);
    try { localStorage.setItem(`lab_diff_${labId}`, String(d)); } catch { /* incognito */ }
  }, [labId]);
  return [difficulty, setAndPersist] as const;
}
```

**Примени го во сите 10 ExercisesTab компоненти** — замени `useState<1|2|3>(1)` со `useLabDifficulty(labId)`.

### Б.2 — "Продолжи" порака при нов пристап

**Во `LabExercisePanel`** — при mount (кога exercises е празна):

```typescript
// Последна сесија за овој lab:
const { data: lastSession } = useQuery({
  queryKey: ['lastLabSession', labId],
  queryFn: () => fetchLastLabSession(labId),
  staleTime: 5 * 60 * 1000,
  enabled: exercises.length === 0,
});
```

```tsx
{exercises.length === 0 && lastSession && (
  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-800 mb-3">
    Минатиот пат: <strong>{lastSession.score}/{lastSession.totalQuestions}</strong> на
    ниво <strong>{lastSession.difficulty}</strong> ·
    <span className={getScoreColor(lastSession.percentage)}> {lastSession.percentage}%</span>
  </div>
)}
```

**Нова Firestore функција:** `firestoreService.fetchLastLabSession(labId, studentName?)` — query на `quiz_results` со `quizType==='lab'` и `conceptId===labId`, limit(1), orderBy playedAt desc.

---

## НАСОКА В — Значење (резултати → МОН стандарди)

### В.1 — curriculumRef → реален стандард

**Во `LabExercise`** — `curriculumRef` е string, но треба mapping:

```typescript
// Во labTypes.ts — додај:
export const CURRICULUM_STANDARD_MAP: Record<string, string> = {
  'МОН VII': 'Простори фигури — VII одделение',
  'Гимн. X':  'Функции — X гимназија',
  'Гимн. XI': 'Аналитичка геометрија — XI гимназија',
  // ...
};
```

### В.2 — Post-session стандардна покриеност

**Во `SessionDoneScreen`** — по зачувување:

```tsx
const coveredStandards = [...new Set(exercises.map(e => e.curriculumRef))];
{coveredStandards.length > 0 && (
  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs">
    <p className="font-bold text-indigo-700 mb-1">Покриени наставни единици:</p>
    <div className="flex flex-wrap gap-1">
      {coveredStandards.map(s => (
        <span key={s} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-semibold">{s}</span>
      ))}
    </div>
  </div>
)}
```

---

## РЕДОСЛЕД НА ИМПЛЕМЕНТАЦИЈА (целокупен)

### ✅ Спринт 1 — Geometry3D Excellence (commit 1–4, ~4ч)

```
✅ Д.5  geometry3dExerciseMath.ts + Вежбај таб            — 76a0e32
✅ Д.3  Авто-ротација (PolyhedraExplorer + PrismPyramidCalculator) — 42f5953
✅ Д.2  DUAL_MAP + "Дуален на" + бутон                     — 42f5953
✅ Д.1  RoundSolidsPanel (Сфера/Конус/Цилиндар)            — 83c4650
✅ Д.4  CrossSections θ-агол + a/b за елипса                — 7c49ea2
✅ Д.6  ConicSectionsLab линк во CrossSections              — 7c49ea2
```

### ✅ Спринт 2 — Адаптивност (commit 5, ~2ч)

```
✅ А.1  difficultyStreak → upgrade/downgrade UI во LabExercisePanel — e6e720c
✅ А.2  correctHistory во useLabSession + post-session слаби точки  — e6e720c
```

### ✅ Спринт 3 — Континуитет (commit 6–7, ~2ч)

```
✅ Б.1  useLabDifficulty.ts + примени во сите 10 ExercisesTab — caece1d
✅ Б.2  fetchLastLabSession + "Продолжи" UI                  — 6602f56
```

### ✅ Спринт 4 — Значење (commit 8, ~1ч)

```
✅ В.1  CURRICULUM_STANDARD_MAP во labTypes.ts     — a67f244
✅ В.2  coveredStandards во SessionDoneScreen      — a67f244
```

---

## ВЕРИФИКАЦИЈА

По секој спринт:
```
npx tsc --noEmit    → 0 грешки
```

Рачна верификација — Спринт 1 (⚠️ потврдено преку код/тестови, НЕ преку рачно кликање во браузер):

- [x] Вежбај таб во Geometry3DLab → `Geo3DExercisesTab` постои, wire-нат на `useLabSession`/`quiz_results`
- [x] PolyhedraExplorer → `autoSpin` state + RAF loop + ▶/⏸ бутон потврдени во кодот
- [x] Куба → `DUAL_MAP['cube'] = 'octa'` потврдено во `geometry3dMath.ts`
- [x] Таб "⚫ Заоблени тела" → `RoundSolidsPanel` постои во `geometry3dSolidPanels.tsx`
- [x] CrossSections Конус → линк кон ConicSectionsLab потврден во кодот
- [x] Cone cross-section математика — тестирана и поправена (bug fix `1e4f97f`, тестови во `geometry3dMath.test.ts`)

Рачна верификација — Спринт 2 (⚠️ потврдено преку код, НЕ преку рачно кликање):

- [x] `LabExercisePanel` → ⬆/⬇ upgrade/downgrade бутони по 2-streak потврдени во кодот
- [x] `SessionDoneScreen` → "слаби точки" листа по зачувување потврдена во кодот

**Забелешка**: горниве се потврдени преку читање на изворниот код и постоечките unit тестови
(213 тестови од labs test-coverage спринтот), НЕ преку рачно click-through во живо во браузер.
Ако сакаш вистинска UI верификација, треба да се стартува dev серверот и рачно да се провери.

---

## РЕЗИМЕ НА ПРОМЕНИ

| Нови файлови | LOC (приближно) |
|---|---|
| `components/dataviz/geometry3dExerciseMath.ts` | ~80 |
| `hooks/useLabDifficulty.ts` | ~25 |

| Изменети файлови | Главна промена |
|---|---|
| `components/dataviz/Geometry3DLab.tsx` | +exercises tab, +rounded tab, +autoSpin, +Geo3DExercisesTab |
| `components/dataviz/geometry3dPanels.tsx` | +RoundSolidsPanel, +CrossSections θ-агол, +ConicSections линк |
| `components/dataviz/geometry3dMath.ts` | +DUAL_MAP |
| `components/labs/LabExercisePanel.tsx` | +upgrade/downgrade UI, +слаби точки post-session |
| `hooks/useLabSession.ts` | +correctHistory: boolean[] |
| `types/labTypes.ts` | +CURRICULUM_STANDARD_MAP |
| Сите 10 ExercisesTab компоненти | useState(1) → useLabDifficulty(labId) |

**Вкупно: 2 нови файлови · ~8 изменети · TSC 0 · LOC 0 нарушувања**

---

> ✅ ЗАВРШЕН 2026-07-03 — сите 4 спринта, сите commit-и на `main`/`origin/main`.
> Проверено 2026-07-03 (нова сесија): планот беше untracked без ✅ ознаки и заведе на погрешен
> заклучок дека работата не е направена — работата всушност беше завршена и push-ната претходно,
> само овој следен-документ никогаш не бил ажуриран/committed. Види [[project_s116_s117_labs]] за
> целосна историја. Следна работа (ако се бара): рачна UI-верификација во браузер (не е направена
> оваа сесија), или SCENARIO_SLOT_RESERVE тунирање (неповрзано со S117, види
> [[plan_deploy_rag_embed_function]]).
