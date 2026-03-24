# Quick Tools Panel — Имплементациски план
> Инспирирано од CK-12 „Teacher Tools for this Lesson" пристап  
> Датум: 24.03.2026 — Сесија 9

## Цел

Додај **контекстуален floating панел** кој е секогаш видлив кога наставникот browses curriculum (TopicView / ConceptDetailView). Панелот автоматски ги знае Grade + Topic + Concept и нуди 1-click пристап до сите генератори — без рачно селектирање.

## Зошто ова ја издигнува апликацијата

| Пред | По |
|------|----|
| Browse → изодди од browse → GeneratorView → рачно избери grade → рачно избери topic → генерирај | Browse → 1 клик → генерирај |
| 5-7 чекори | 1-2 чекори |
| Context се губи | Context е зачуван |

Истражувања покажуваат дека контекстуален пристап до алатки намалува friction за ~60% и е еден од главните фактори за teacher adoption во EdTech.

## Архитектура

### Постоечка инфраструктура (НЕ менуваме)
- `GeneratorPanelContext` + `openGeneratorPanel()` — веќе работи
- `MaterialsGeneratorView` прима `selectedGrade`, `selectedTopic`, `selectedConcepts`, `materialType` — веќе работи
- Browse flow: ExploreView → TopicView → ConceptDetailView — веќе постои

### Нова компонента: `QuickToolsPanel`

```
components/common/QuickToolsPanel.tsx
```

**Props:**
```typescript
interface QuickToolsPanelProps {
  gradeId: string;
  topicId: string;
  conceptIds?: string[];
  gradeName: string;
  topicName: string;
}
```

**Позиција:** Fixed bottom-right, collapsible  
**Стил:** Конзистентен со постоечката app palette (indigo/purple gradient)

### Quick Action Buttons (5)

| Иконка | Акција | materialType |
|--------|--------|-------------|
| ❓ | Квиз | QUIZ |
| 📄 | Тест | ASSESSMENT |
| 🎟️ | Exit Ticket | EXIT_TICKET |
| 🎭 | Наставен сценарио | SCENARIO |
| 🃏 | Флешкартички | FLASHCARDS |

### Интеграција

Додај `<QuickToolsPanel>` во:
1. `views/TopicView.tsx` — контекст: grade + topic + сите concepts во topic
2. `views/ConceptDetailView.tsx` — контекст: grade + topic + конкретен concept

## Имплементациски чекори

### Чекор 1 — QuickToolsPanel компонента
- Floating fixed position (bottom-right)
- Collapsible (toggle со Wand2 иконка)
- Context badge (grade name + topic name)
- 5 action buttons во grid
- Секое копче → `openGeneratorPanel({ materialType, selectedGrade, selectedTopic, selectedConcepts })`

### Чекор 2 — Интеграција во TopicView
- Читај `gradeId`, `topicId` од тековниот topic
- Собери сите concept IDs од topic
- Додај `<QuickToolsPanel>` на крај на JSX (над closing tag)

### Чекор 3 — Интеграција во ConceptDetailView
- Читај `gradeId`, `topicId`, `conceptId` од тековниот concept
- Додај `<QuickToolsPanel>` со конкретен conceptId

## Дизајн референца

```
┌─────────────────────────────────┐
│ ✨ Алатки за оваа тема    [ ˅ ] │  ← collapsible header
├─────────────────────────────────┤
│ VIII одд. › Геометрија          │  ← context badge
├──────┬──────┬──────┬────────────┤
│  ❓  │  📄  │  🎟️  │     🎭     │
│ Квиз │ Тест │ Exit │ Сценарио   │
├──────┴──────┴──────┴────────────┤
│           🃏 Флешкартички       │
└─────────────────────────────────┘
```

## Технички детали

### Collapsed state
- localStorage key: `quicktools_collapsed` (persist preference)
- Default: expanded

### Animation
- Slide-in од десно при mount
- Smooth collapse/expand

### Mobile
- На мобилен: bottom sheet наместо sidebar
- Breakpoint: `md` (768px)

## Очекуван резултат

**UX**: Наставникот никогаш не ја губи нитката — алатките се секогаш при рака  
**Adoption**: Директен пристап → повеќе генерирани материјали  
**Differentiator**: Само 2-3 EdTech платформи во регионот го имаат ова

## Статус

- [ ] Чекор 1: QuickToolsPanel компонента
- [ ] Чекор 2: Интеграција TopicView
- [ ] Чекор 3: Интеграција ConceptDetailView
- [ ] Тестирање + commit
