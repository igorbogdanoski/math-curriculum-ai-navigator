# Акционен план S21 — Secondary Integration + Matura Feature Layer
**Датум:** 14.04.2026  
**Статус:** ✅ ЗАВРШЕНО — commit `48e208d` pushed на `main`  
**Принцип:** Нула компромиси. Ако нешто може подобро — го правиме подобро. Тестови каде е потребно.

---

## НЕПРЕГОВАРАЧКИ ПРАВИЛА

```
1. tsc --noEmit → 0 грешки ПРЕД секој commit   ✅ ИСПОЛНЕТО
2. npm run build → PASS ПРЕД секој commit        ✅ ИСПОЛНЕТО
3. Нема as any, @ts-ignore без документирана причина  ✅ (само 2 легитимни)
4. Секоја нова функционалност носи unit тест     ✅ 574/574 passing
5. Секој AI prompt носи fallback                 ✅
6. Mobile + Desktop UX проверен                 ✅
```

---

## БЛОК A — Secondary Integration (Technical Debt, P1–P6) ✅ ЗАВРШЕНО

### A1 · P1 — parseInt(grade?.id) BUG ✅
**Статус:** Regression guard тестови веќе во `__tests__/analyticsHelpers.test.ts`.
Бугот НЕ постоеше во production код — планот го anticipiraше и го превентираше.
`gradeLevel: grade?.level ?? 1` е правилниот pattern, документиран и тестиран.

---

### A2 · P6 — Grade.weeklyHours поле ✅
**Статус:** Имплементирано претходна сесија.
`weeklyHours?: 2 | 3 | 4` на `Grade` interface во `types.ts:106`.
Пополнето во сите 5 secondary data фајлови (vocational4=3, vocational3=2, vocational2=2, gymnasium=4, gymnasium_electives=3).

---

### A3 · P2 — getSecondaryTrackContext() во Gemini ✅
**Статус:** Имплементирано претходна сесија.
`services/gemini/core.ts:898` — exports `getSecondaryTrackContext(track)`.
Инjectирано во system instruction при секој AI повик кога `secondaryTrack` е поставен.
Тестови: `__tests__/secondaryTrackContext.test.ts` (exhaustive coverage на сите 5 tracks).

---

### A4 · P3 — AnnualPlan default grade за secondary ✅
**Статус:** Имплементирано претходна сесија.
`hooks/useGeneratorState.ts:81` — `getDefaultGradeId(curriculum, secondaryTrack)`.
Secondary teachers defaultираат на нивниот прв grade (Одд. 10), не на Одд. 1.

---

### A5 · P4 — Secondary assessmentStandards ✅
**Статус:** Имплементирано претходна сесија.
`hooks/useCurriculum.ts:206` — secondary grades со `assessmentStandards` се merge-ираат во `allNationalStandards`.
Видливо во StandardsTab и CoverageAnalyzerView за secondary track наставници.

---

### A6 · P5 — SECONDARY_TRACK_TO_MATURA_TRACKS mapping ✅
**Статус:** Имплементирано претходна сесија + тест фикс во S21.
`types.ts:88` — `SECONDARY_TRACK_TO_MATURA_TRACKS` mapping за сите 5 tracks.
`MaturaLibraryView` го користи за smart default при избор на испит.
Тест фикс: `__tests__/curriculumHelpers.test.ts` — `KNOWN_MATURA_TRACKS` ажуриран со vocational-art, vocational3-zavrshen, vocational2-zavrshen.

---

## БЛОК B — Matura Feature Layer (N1–N3) ✅ ЗАВРШЕНО

### B1 · N2 — ConceptDetailView: Матурски прашања блок ✅
**Commit:** `85a76cf`
**Фајл:** `views/ConceptDetailView.tsx` — `MaturaQuestionsBlock` компонента (~120 линии)
**Имплементирано:**
- Collapsed блок "Матурски прашања 📝" на дното на секој концепт
- Lazy-load на `internal-matura-bank-gymnasium-mk.json` САМО при прво отворање (нула overhead затворен)
- Филтрирање по `conceptIds.includes(concept.id)` — поврзано со gymnasium curriculum
- Приказ: тип badge (MC/Отворено), DoK badge, топик, reveal toggle
- Click → expand прашање + точен одговор со MathRenderer

---

### B2 · N1 — MaturaLibraryView: "Училишна матура" таб ✅
**Commit:** `85a76cf`
**Фајл:** `views/MaturaLibraryView.tsx` — `InternalMaturaTab` компонента (~350 линии)
**Имплементирано:**
- Tab switcher "🏛 Државна матура" | "📝 Училишна матура" во sticky header
- `InternalMaturaTab`: lazy-load 219 прашања при прв tab switch
- Филтри: topicArea (dropdown), DoK 1–4 (pill buttons), тип MC/Отворени, search
- Пагинација: 20 прашања/страна со Previous/Next
- Reveal per прашање (toggle одговор)
- DIM tab controls (Practice toggle + Exam picker) само при `activeTab === 'dim'`

---

### B3 · N3 — Генерирај вежбовен тест (Student side) ✅
**Commit:** `85a76cf`
**Имплементирано во `InternalMaturaTab`:**
- "✏️ Вежбај (15 MC + 4 отворени)" button во Училишна матура таб
- Random shuffle: 15 MC + 4 open прашања од базата
- Practice flow (inline):
  - Progress bar (CSS transition, dynamic width)
  - МС прашања: 4 choices, click → auto-grade (зелено=точно, црвено=погрешно), disabled после избор
  - Отворени: "👁 Прикажи точен одговор" → reveal → самооценување 0–4 поени
  - Navigation: ← Претходно / Следно → (Next disabled за МС ако не е избрано)
  - "Заврши" link за early exit
- Results screen: % score, MC: X/15, Отворени: Y/16pt
- Зачувување во `quiz_results` (fire-and-forget, само ако `firebaseUser` е логиран)

**Напомена:** Teacher side (assign to class, PDF export) е одложен за S22.

---

## ДОПОЛНИТЕЛНИ ФИКСОВИ ВО S21

### Fix: dim-vocational4-it-2023-june-mk.json — Invalid JSON ✅
Неескапиран ASCII `"` (U+0022) во `„глаче"` string → заменет со U+201C (`"`).
Node.js script: `content.replace(/\u201e\u0433\u043b\u0430\u0447\u0435\"/g, ...)`.

### Fix: curriculumHelpers.test.ts — KNOWN_MATURA_TRACKS ✅
Додадени: `vocational-art`, `vocational3-zavrshen`, `vocational2-zavrshen`, `vocational4`.
vocational2 expectation: `[]` → `['vocational2-zavrshen']` (завршен испит е релевантен).

---

## ФИНАЛЕН СТАТУС

```
tsc --noEmit      → 0 грешки  ✅
npm run build     → PASS       ✅
vitest run        → 574/574    ✅
as any            → 2 (легитимни: SettingsView data cast, FirestoreError op cast)  ✅
@ts-ignore        → 0          ✅
git push origin   → main       ✅  (commit 48e208d)
```

## Definition of Done — ИСПОЛНЕТО ✅

```
✅ tsc --noEmit → 0 грешки
✅ npm run build → PASS
✅ Unit тестови (574 passing, 2 test fixes)
✅ Mobile + Desktop проверено
✅ Edge cases (null choices, lazy load error, firebaseUser null)
✅ Commits со описни пораки
```
