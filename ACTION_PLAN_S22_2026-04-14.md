# Акционен план S22 — Quality, Matura Completion + Recovery Features
**Датум:** 14.04.2026
**Статус:** АКТИВЕН
**Принцип:** Нула компромиси. 574 тестови треба да останат зелени. Ако нешто се открие — веднаш се поправа.

---

## НЕПРЕГОВАРАЧКИ ПРАВИЛА

```
1. tsc --noEmit → 0 грешки ПРЕД секој commit
2. npm run build → PASS ПРЕД секој commit
3. vitest run → 574+ passing (не смее да опаѓа)
4. Нема as any, @ts-ignore без документирана причина
5. Секоја нова функционалност носи unit тест
6. Mobile + Desktop UX проверен
```

---

## БЛОК C — Критични исправки (мора прво)

### C1 · КРИТИЧНО — concept_mastery update по internal matura practice
**Фајл:** `views/MaturaLibraryView.tsx` — `InternalMaturaTab.finishPractice()`
**Проблем:** Кога ученикот завршува вежба преку Училишна матура таб, само `quiz_results` се зачувува. `concept_mastery` (која ги движи analytics, readiness path, SpacedRepetition) НЕ се ажурира. Ова значи дека вежбата нема педагошки трага.
**Fix:** По `firestoreService.saveQuizResult(...)`, за секој concept во практиката:
```ts
// За секој уникатен conceptId во practiceQs
const conceptIds = [...new Set(practiceQs.flatMap(q => q.conceptIds))];
conceptIds.forEach(cid => {
  firestoreService.updateConceptMastery(firebaseUser.uid, cid, pct, 'internal-matura');
});
```
**Тест:** Unit тест — `finishPractice` со mock на firestoreService → verify updateConceptMastery calls
**Effort:** 45 мин

---

### C2 · КРИТИЧНО — Teacher side B3: custom select → PDF export
**Фајл:** `views/MaturaLibraryView.tsx` — нов `TeacherTestBuilder` компонента
**Функционалност:**
- Само за role=teacher/admin (hide за ученици)
- Custom select: филтрирај по тема + DoK → choose N прашања
- "Генерирај PDF" → print-friendly HTML → `window.print()` (постоечки pattern)
- "Додели на клас" → `firestoreService.createAssignment(classId, questions[])` → учениците го гледаат во assignments tab
**Effort:** 2.5 часа

---

### C3 · КРИТИЧНО — Recovery Worksheets (post-quiz PDF)
**Фајл:** нова `views/RecoveryWorksheetView.tsx` + button во `views/QuizResultView.tsx` (ако постои) или `components/student/QuizResultPanel.tsx`
**Функционалност:**
- По секој квиз: ако score < 70% → покажи "📄 Генерирај работен лист за слабите концепти"
- Земи ги weakConcepts од `concept_mastery` Firestore за тој ученик
- `callGeminiProxy` со prompt: дај 5 вежби per слаб концепт, LaTeX форматирани
- HTML print layout (постоечки `PrintableHomework` компонент може да служи)
- Fire-and-forget save во `cached_ai_materials` за ре-употреба
**Effort:** 3 часа

---

## БЛОК D — Квалитет и полирање

### D1 — console.log → logger масовна замена
**Фајлови:** 147 `console.*` повики во production код
**Fix:** Batch замена — `console.log` → `logger.debug`, `console.error` → `logger.error`
**Зошто:** Risk на sensitive data во production logs; logger сервисот веќе постои во `utils/logger.ts`
**Approach:** `grep -rn "console\." views/ hooks/ services/ components/` → sed замена по фајл
**Effort:** 1 час

### D2 — AlgebraTiles A1.8: zero-pair анимација
**Фајл:** `components/AlgebraTilesCanvas.tsx`
**Проблем:** `zeroPairs` се детектираат при поставување (+x врз -x) но нема визуелен feedback
**Fix:** CSS `animate-ping` на двете tiles при детекција → исчезнуваат после 600ms
**Effort:** 30 мин

### D3 — Shareable URLs: AlgebraTiles + Shape3D
**Фајлови:** `components/AlgebraTilesCanvas.tsx`, `components/Shape3DViewer.tsx`
**Fix:**
```
?tiles=x2_3x_2  → parse при mount → presetExpression='x^2+3x+2'
?shape=cylinder → parse при mount → initialShape='cylinder'
```
URL params via `useSearchParams` или hash params
**Effort:** 1 час

### D4 — Adaptive DoK Scaffolding (rule-based)
**Фајл:** `views/ConceptDetailView.tsx` или `hooks/useCurriculum.ts`
**Логика:** Ако `concept_mastery.percentage < 60` AND последното `dokLevel >= 3` → прикажи suggestion card: "Препорачуваме да почнете со DoK 1–2 прашања за овој концепт"
**Effort:** 2 часа

---

## БЛОК E — Стратешки (за глобален reach)

### E1 — English i18n JSON (HIGH STRATEGIC IMPACT)
**Фајл:** нов `i18n/en.json` (постоечкиот `t()` систем веќе работи)
**Обем:** ~400 translation keys (навигација, UI labels, error messages)
**Approach:** `grep -r "t('" src/ | extract keys` → Gemini batch translate → review
**Effort:** 4 часа (мал технички, голем content обем)
**Impact:** Отвора глобален market; прв чекор кон меѓународна употреба

### E2 — DIM стручна матура 2025 (по излегувањето)
**Зависност:** Испитите се оваа година (јуни/август 2026) — нема данок
**Акција сега:** Подготви upload script за кога ќе излезат резултатите
**JSON шаблон:** `docs/VOCATIONAL_CURRICULUM_EXTRACTION_TEMPLATE.md` — веќе постои

### E3 — DIM стручна матура: Electro/Mechanical/Health/Civil/Art (историски)
**Статус:** IT + Economics покриени (2022–2024). Останати 5 профила немаат JSON.
**Effort:** ~1 час per профил per година ако постојат PDF-ови
**Акција:** Потребни PDF-ови од ДИЦ → `data/matura/raw/dim-vocational4-[профил]-[год]-[сесија]-mk.json`

---

## ПРИОРИТИЗИРАН РЕДОСЛЕД

| # | Задача | Effort | Impact | Ризик |
|---|--------|--------|--------|-------|
| 1 | **C1** concept_mastery по internal practice | 45 мин | 🔴 Критично | Low |
| 2 | **C2** Teacher B3: PDF + assign | 2.5 ч | 🔴 High | Low |
| 3 | **C3** Recovery Worksheets | 3 ч | 🔴 High | Low |
| 4 | **D1** console.log → logger | 1 ч | Quality | Low |
| 5 | **D2** AlgebraTiles zero-pair анимација | 30 мин | Medium | None |
| 6 | **D3** Shareable URLs | 1 ч | Medium | Low |
| 7 | **D4** Adaptive DoK Scaffolding | 2 ч | Medium | Low |
| 8 | **E1** English i18n | 4 ч | 🔴 Strategic | Low |

**Вкупно:** ~15 часа

---

## Definition of Done (секоја задача)

```
✅ tsc --noEmit → 0 грешки
✅ npm run build → PASS
✅ vitest run → ≥574 passing
✅ Unit тест (каде е применливо)
✅ Mobile + Desktop проверено
✅ Edge cases (null, empty, offline, no firebaseUser)
✅ Commit со описна порака
```

---

## Контекст за следна сесија

По S21, апликацијата е во следна состојба:
- **77 views, 154 компоненти, 44 hooks, 36 сервиси**
- **574/574 тестови** · **0 TSC грешки** · **2 `as any` (легитимни)**
- **Bundle:** `index.js` 2MB/391KB gzip · `vendor-BHgumyTF.js` 1.4MB/519KB гzip (Firebase ecosystem)
- **Мatura:** гимназиско 100% покриено · стручно IT+Economics покриено · останати профили без историски данок

**Главната состојба на Internal Matura Tab (за C1):**
Функцијата `finishPractice()` е во `views/MaturaLibraryView.tsx`, класата `InternalMaturaTab`.
Тековно: само `firestoreService.saveQuizResult({...})` се повикува.
Треба да се додаде: loop преку `practiceQs.flatMap(q => q.conceptIds)` → `firestoreService.updateConceptMastery(...)`.

**Потребна проверка пред C2:** Провери дали `firestoreService.updateConceptMastery` постои и кои параметри прима — можно е да се вика поинаку во постоечкиот код.
