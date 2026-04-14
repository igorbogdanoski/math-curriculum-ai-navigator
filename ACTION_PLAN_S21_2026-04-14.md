# Акционен план S21 — Secondary Integration + Matura Feature Layer
**Датум:** 14.04.2026  
**Статус:** АКТИВЕН  
**Принцип:** Нула компромиси. Ако нешто може подобро — го правиме подобро. Тестови каде е потребно.

---

## НЕПРЕГОВАРАЧКИ ПРАВИЛА

```
1. tsc --noEmit → 0 грешки ПРЕД секој commit
2. npm run build → PASS ПРЕД секој commit
3. Нема as any, @ts-ignore без документирана причина
4. Секоја нова функционалност носи unit тест
5. Секој AI prompt носи fallback
6. Mobile + Desktop UX проверен
```

---

## БЛОК A — Secondary Integration (Technical Debt, P1–P6)

### A1 · P1 — parseInt(grade?.id) BUG ⏳
**Фајл:** `views/TeacherAnalyticsView.tsx:187`  
**Проблем:** `parseInt(grade?.id)` — `Grade.id` е `string` ("gym-grade-10"), не број.  
**Fix:** `grade?.level` (number field, постои на Grade type)  
**Тест:** Unit тест за `computeReadinessPath` со secondary grade  
**Effort:** 15 мин

---

### A2 · P6 — Grade.weeklyHours поле ⏳
**Фајл:** `types.ts` + сите secondary data фајлови  
**Проблем:** `Grade` type нема `weeklyHours` поле. Secondary програми имаат 2/3/4 часа/неделно.  
**Fix:** Додај `weeklyHours?: number` на `Grade` interface + пополни во сите 5 track фајлови  
**Effort:** 30 мин

---

### A3 · P2 — getSecondaryTrackContext() во Gemini ⏳
**Фајл:** `services/gemini/core.ts`  
**Проблем:** AI промптите не знаат дека ученикот е на стручна програма → генерички одговори  
**Fix:** Функција која враќа context string ("Ученикот е на 4-год стручна програма, 3 часа/нед, модул: Економија") → inject во сите AI calls  
**Effort:** 1 час

---

### A4 · P3 — AnnualPlan default grade за secondary ⏳
**Фајл:** `hooks/useGeneratorState.ts`  
**Проблем:** При secondary track, default grade е неправилен  
**Fix:** Детект track → default на соодветен grade level  
**Effort:** 30 мин

---

### A5 · P4 — Secondary assessmentStandards ⏳
**Фајл:** `hooks/useCurriculum.ts`  
**Проблем:** `allNationalStandards` не ги вклучува secondary assessment standards  
**Fix:** Merge secondary standards во aggegate hook  
**Effort:** 30 мин

---

### A6 · P5 — SECONDARY_TRACK_TO_MATURA_TRACKS mapping ⏳
**Фајли:** `types.ts` + `MaturaLibraryView.tsx`  
**Проблем:** Нема mapping vocational-it → dim-vocational4-it-*, итн.  
**Fix:** Константа за mapping + употреба во MaturaLibraryView filter  
**Special:** `vocational-unified` alias за gymnasium 2025 испити (важат и за стручни по новиот правилник)  
**Effort:** 45 мин

---

## БЛОК B — Matura Feature Layer (N1–N3)

### B1 · N2 — ConceptDetailView: Матурски прашања блок ⏳
**Фајл:** `views/ConceptDetailView.tsx`  
**Функционалност:** Нов collapsed блок "Матурски прашања" при дно на ConceptDetail.  
- Бара прашања по `conceptIds` низ сите `data/matura/raw/*.json` → lazy load  
- Прикажува: тип (MC/отворено), session (DIM/Училишна), година, DoK badge  
- Click → expand прашање + точен одговор  
**Effort:** 2 часа

---

### B2 · N1 — MaturaLibraryView: "Училишна матура" таб ⏳
**Фајл:** `views/MaturaLibraryView.tsx`  
**Функционалност:** Нов таб покрај "DIM".  
- Прикажува 219 прашања со filter: топик, DoK ниво, conceptId, тип  
- Пагинирано (20 прашања/страна)  
**Effort:** 2 часа

---

### B3 · N3 — Генерирај вежбовен тест ⏳
**Функционалност:** "Вежбај за интерна матура" button во новиот таб.  
- Ученик: random 15 MC + 4 отворени → quiz mode (постоечки QuizView)  
- Наставник: custom select по тема/DoK → assign на клас или PDF export  
- Резултати во `quiz_results` + `concept_mastery` (постоечка инфраструктура)  
**Effort:** 3 часа

---

## ПРИОРИТИЗИРАН РЕДОСЛЕД

| # | Задача | Effort | Impact | Ризик |
|---|--------|--------|--------|-------|
| 1 | A1 · P1 бaг fix | 15 мин | 🔴 High | None |
| 2 | A2 · P6 weeklyHours | 30 мин | Medium | Low |
| 3 | A3 · P2 Gemini context | 1 ч | 🔴 High | Low |
| 4 | A4 · P3 AnnualPlan | 30 мин | Medium | Low |
| 5 | A5 · P4 assessmentStandards | 30 мин | Medium | Low |
| 6 | A6 · P5 MATURA_TRACKS | 45 мин | High | Low |
| 7 | B1 · N2 ConceptDetail | 2 ч | 🔴 High | Low |
| 8 | B2 · N1 Matura таб | 2 ч | High | Low |
| 9 | B3 · N3 Test generator | 3 ч | 🔴 High | Medium |

**Вкупно:** ~10.5 часа

---

## Definition of Done (секоја задача)

```
✅ tsc --noEmit → 0 грешки
✅ npm run build → PASS
✅ Unit тест (каде е применливо)
✅ Mobile + Desktop проверено
✅ Edge cases (null, empty, offline)
✅ Commit со описна порака
```
