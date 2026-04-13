# B3-3 — i18n Инструментација Sprint Plan
**Статус:** 🔒 Одложено — посебен спринт (S22+)  
**Проценка:** 5 работни дена  
**Принцип:** Не брза автоматизација — квалитетни педагошки преводи

---

## Тековна состојба (13.04.2026)

### Инфраструктура — ГОТОВА ✅
- `i18n/LanguageContext.tsx` — `LanguageProvider` + `useLanguage()` + `t(key)` fallback chain
- `i18n/translations.ts` — **~370 клучеви × 4 јазика** (MK / SQ / TR / EN)
- `t()` fallback: `lang → MK → key` (безбедно, никогаш не крашира)
- `i18n/index.ts` — `Language` тип, `LANGUAGES` array, `getLanguagePreference()`

### Coverage
```
61 views вкупно
10 views  → useLanguage() / t() веќе инструментирани ✅
51 views  → хардкодиран македонски текст
```

### Views кои VЕЌ користат t()
```
views/HomeView.tsx
views/AnnualPlanGeneratorView.tsx
views/ContentReviewView.tsx
views/MaterialsGeneratorView.tsx
views/PlannerView.tsx
views/StudentPlayView.tsx
views/StudentProgressView.tsx
views/StudentTutorView.tsx
views/TeacherAnalyticsView.tsx
views/analytics/ (5 tab views)
```

### Views кои НЕ користат t() — 51 вкупно (приоритизирани)
**Tier 1 — најмногу корисници (~70% сесии):**
```
views/ExploreView.tsx
views/ConceptDetailView.tsx
views/MaturaLibraryView.tsx
views/MaturaAnalyticsView.tsx
views/MaturaPracticeView.tsx
views/MaturaSimulationView.tsx
views/TeacherForumView.tsx
views/AssistantView.tsx
```

**Tier 2 — редовно користени:**
```
views/LessonPlanEditorView.tsx
views/LessonPlanDetailView.tsx
views/LessonPlanLibraryView.tsx
views/ContentLibraryView.tsx
views/CoverageAnalyzerView.tsx
views/RoadmapView.tsx
views/CurriculumGraphView.tsx
views/GradeBookView.tsx
views/HostLiveQuizView.tsx
views/AcademyView.tsx
views/AcademyLessonView.tsx
views/FavoritesView.tsx
```

**Tier 3 — специјализирани / admin:**
```
views/SystemAdminView.tsx
views/SchoolAdminView.tsx
views/CurriculumEditorView.tsx
views/AIVisionGraderView.tsx
views/DataVizStudioView.tsx
views/WrittenTestReviewView.tsx
views/NationalLibraryView.tsx
views/DataVizStudioView.tsx
... (останатите 30)
```

---

## Имплементациски план (5 дена)

### Ден 1 — Tier 1 инструментација (8 views)
**Задача:** За секој Tier 1 view:
1. `grep` за сите хардкодирани MK strings
2. Замени со `t('namespace.key')`
3. Додај нови клучеви во `translations.ts` → MK блок
4. TSC check по секој view

**Клучни namespace конвенции:**
```
explore.*     → ExploreView
concept.*     → ConceptDetailView
matura.*      → Matura* views (library/analytics/practice/sim)
forum.*       → TeacherForumView
assistant.*   → AssistantView
```

### Ден 2 — Tier 2 инструментација (12 views)
Ист процес. Фокус: `lesson.*`, `library.*`, `roadmap.*`, `graph.*`, `gradebook.*`

### Ден 3 — Tier 3 + компоненти
- Останатите views
- Shared components: `Card`, `Modal`, `QuickToolsPanel`, `ForumCTA`, итн.
- Components кои рендерираат text директно

### Ден 4 — Gemini batch превод
```bash
# scripts/batch-translate.mjs
# 1. Извади ги сите нови MK клучеви додадени во Ден 1-3
# 2. Gemini batch: translateKeys(newKeys, ['sq', 'tr', 'en'])
# 3. Merge во translations.ts → sq/tr/en блокови
# 4. ~800-1200 нови клучеви × 3 јазика ≈ $0.80 Gemini
```

**Gemini prompt за педагошки термини:**
```
Преведи ги следните UI лабели за образовна платформа за математика.
Контекст: наставници, македонско средно и основно образование.
Внимавај на педагошки термини:
- "подготовка" = "përgatitje" (не "preparation" директно)
- "матура" = "matura" (не "graduation exam")
- "одделение" = "klasë" / "sınıf"
- "наставна програма" = "kurrikula" / "müfredat"
Јазик: {sq|tr|en}
```

### Ден 5 — QA + commit
- Рачна ревизија на 50 random SQ клучеви (особено педагошки термини)
- Рачна ревизија на 20 TR + 20 EN клучеви
- `tsc --noEmit` → 0
- `vitest` → сите pass
- Manual test: префрли на SQ → прегледај Explore + Matura views
- Manual test: префрли на EN → прегледај Home + Generator

---

## Ризици и митигации

| Ризик | Веројатност | Митигација |
|-------|-------------|------------|
| Gemini машинска буквалност на педагошки термини | Висока | Glossary во prompt + рачен QA ден 5 |
| Keys со динамичен текст (`t('grade', {n: 5})`) | Средна | Одбегнувај interpolation — користи конкатенација |
| Регресија во MK (погрешно rewrap) | Ниска | Секој view commit → immediate TSC + browser check |
| 51 views се повеќе od 5 дена | Средна | Tier 3 може да почека S23 — Tier 1+2 се доволни за 80% корисници |

---

## Definition of Done за B3-3

```
✅ Tier 1 (8 views) — 100% t() инструментирани
✅ Tier 2 (12 views) — 100% t() инструментирани
✅ Tier 3 (31 views) — ≥50% инструментирани (останатото S23)
✅ translations.ts — SQ/TR/EN ≥95% coverage на нови клучеви
✅ Manual QA — 50 SQ + 20 TR + 20 EN клучеви прегледани
✅ tsc --noEmit → 0
✅ vitest → сите pass
✅ Префрлање на SQ → UI не покажува macedonian fallback на Tier 1 views
```

---

## Напомени за идната сесија

- Почни со `ExploreView.tsx` — највисок трафик, релативно едноставен
- `MaturaAnalyticsView.tsx` — комплексен, но критичен за SQ/TR корисници
- **НЕ инструментирај** AI-генерирана содржина (quiz прашања, AI одговори) — тие остануваат на MK
- Shared components кои рендерираат text треба посебно внимание (се рендерираат на повеќе views)
- `dashboard_*` и `nav.*` клучеви веќе постојат — провери пред да додаваш дупликати
