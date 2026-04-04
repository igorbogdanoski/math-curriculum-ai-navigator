# S17 — Државна Матура Question Bank (ДИМ Integration)

**Датум старт:** 04.04.2026  
**Статус:** ПЛАНИРАЊЕ → АКТИВНО  
**Извор на содржина:** Државен испитен центар (ДИЦ) — јавно објавени тестови

---

## 1) Цел на S17

Да се изгради **светска математичка matura платформа** интегрирана со официјалната МОН наставна програма:

- Целосна база на ДИМ тестови (2006–2025, МК + АЛ + ТР јазик)
- Ученикот може да вежба по тема, да симулира цел тест, да учествува во live испит
- Наставникот може да хостира Live Exam со официјален тест
- Секоја задача е поврзана со наставната програма (concept → topic → grade)
- AI-генерирани чекор-по-чекор решенија со hint chain

---

## 2) Архитектура — засебна колекција, силни врски со куррикулумот

```
matura_questions          ← засебна Firestore колекција (не во cached_ai_materials)
    │
    ├── conceptIds[]      → врска со data/secondary/gymnasium.ts concepts
    ├── topicArea         → врска со nastavna-programa.json tematskiOblasti
    ├── gradeLevel        → 10 | 11 | 12 | 13 (gymnasium)
    └── curriculumLink[]  → { gradeId, topicId, conceptId } за секоја врска

matura_exams              ← metadata per paper (година, сесија, track, јазик)
    └── questions[]       → array of matura_question IDs (не embed, само ref)

matura_results            ← per-student резултати (постои: MaturaResult тип)
```

**Зошто засебна колекција:**
- ДИМ задачите имаат свој извор (ДИЦ), сопствена структура (3 дела, поени 1-3), официјален клуч
- Не се мешаат со teacher-generated materials
- Лесно се филтрираат, пагинираат и се поврзуваат со програмата независно

**Врска со куррикулумот (мост):**
- `conceptIds[]` → постоечки concept IDs од `data/secondary/gymnasium.ts`
- `topicArea` → ID од `data/nastavna-programa.json tematskiOblasti`
- При генерирање Recovery Worksheet (E2) → се земаат и matura прашања за слабите концепти

---

## 3) Структура на тестот (официјален ДИМ формат)

**Вкупно:** 180 минути | 3 дела | 20 прашања

| Дел | Тип | Прашања | Поени по пр. | Вкупно |
| --- | --- | --- | --- | --- |
| Прв | Multiple choice (А/Б/В/Г) | 10 | 1 | 10 |
| Втор | Multiple choice (А/Б/В/Г) | 5 | 2 | 10 |
| Трет | Multiple choice (А/Б/В/Г) | 5 | 3 | 15 |
| **Вкупно** | | **20** | | **35 поени** |

**Јазици:** МК (мај./август) | АЛ (истовремено) | ТР (некои сесии)  
**Официјален клуч:** 1 клуч важи за сите јазични верзии  
**Слики:** некои задачи имаат геометриски фигури / графици

---

## 4) Проширен тип — `MaturaQuestion` (надградба на постоечкиот)

Постоечкиот тип (`types.ts:104`) се надградува без breaking change:

```typescript
// Додатни полиња на постоечкиот MaturaQuestion
interface MaturaQuestionExtended extends MaturaQuestion {
  // Curriculum links
  conceptIds: string[];              // врска со gymnasium.ts
  topicArea: string;                 // ID од nastavna-programa.json
  curriculumLinks: {
    gradeId: string;
    topicId: string;
    conceptId: string;
  }[];

  // Source metadata
  examId: string;                    // back-reference
  part: 1 | 2 | 3;                  // кој дел од тестот
  language: 'mk' | 'al' | 'tr';
  questionGroupId: string;           // поврзува МК+АЛ+ТР верзии на иста задача

  // Assets
  imageUrls?: string[];              // Firebase Storage URLs
  imageCaptions?: string[];          // alt-text за accessibility

  // AI enrichment (cached, не се генерира live)
  aiSolution?: string;               // LaTeX чекор-по-чекор (Gemini, cached)
  hints?: string[];                  // hint chain: [совет1, совет2, целото решение]
  dokLevel?: 1 | 2 | 3 | 4;         // auto-tagged при import

  // Difficulty signal
  successRatePercent?: number;       // агрегирано од matura_results
}

// Проширен MaturaExam
interface MaturaExamExtended extends MaturaExam {
  session: 'june' | 'august' | 'demo';
  languages: ('mk' | 'al' | 'tr')[];
  hasOfficialKey: boolean;
  sourceUrl?: string;                // URL на ДИЦ (опционален)
  importedAt: string;                // ISO timestamp
}
```

---

## 5) Формат за внесување — JSON

Секој тест paper = 1 JSON фајл. Задачите се во LaTeX за математички изрази.

```json
{
  "exam": {
    "id": "dim-gymnasium-2025-june-mk",
    "year": 2025,
    "session": "june",
    "track": "gymnasium",
    "gradeLevel": 13,
    "language": "mk",
    "durationMinutes": 180,
    "title": "Државна матура — Гимназиско — Јуни 2025",
    "hasOfficialKey": true
  },
  "questions": [
    {
      "questionNumber": 1,
      "part": 1,
      "points": 1,
      "questionText": "Ако $f(x) = 3x^2 - 2x + 1$, тогаш $f'(1)$ е еднакво на:",
      "choices": {
        "А": "$2$",
        "Б": "$4$",
        "В": "$6$",
        "Г": "$8$"
      },
      "correctAnswer": "Б",
      "topic": "Деривати",
      "topicArea": "analiza",
      "conceptIds": ["gym13-c-derivati"],
      "imageUrls": [],
      "dokLevel": 2
    }
  ]
}
```

**За слики во задачите:**
- Опција A (препорачана): PDF → рачно извлечи PNG → качи на Firebase Storage → запиши URL
- Опција B: Прикачи PDF во репото под `data/matura/pdfs/` → скрипта автоматски извлекува со `pdfimages` / `pdf2image`

**Препорака: Опција A за прв тест, потоа одлучуваме дали Опција B**

---

## 6) Import pipeline

```bash
# Валидирај JSON пред import
npm run matura:validate -- --input data/matura/raw/2025-june-mk.json

# Импортирај во Firestore
npm run matura:import -- --input data/matura/raw/2025-june-mk.json --dry-run
npm run matura:import -- --input data/matura/raw/2025-june-mk.json

# AI-обогатување (генерирај hints + aiSolution за секоја задача)
npm run matura:enrich -- --examId dim-gymnasium-2025-june-mk
```

---

## 7) Фази на имплементација

### ФАЗА M — Matura Core (приоритет)

| ID | Задача | KPI | Статус |
| --- | --- | --- | --- |
| M1 | Проширување на типови + Firestore schema + `scripts/import-matura.mjs` | Import на 1 тест < 5 мин | ⬜ |
| M2 | `MaturaLibraryView` — browse/filter по год/сесија/тема/јазик/дел | Пагинација + KaTeX preview | ⬜ |
| M3 | `MaturaPracticeView` — избери тема + број задачи → adaptive pull | Uses постоечки `adaptiveDifficulty.ts` | ⬜ |
| M4 | `MaturaExamSimView` — цел тест, тајмер 180 мин, 3 дела, auto-grade | Score + official-key review | ⬜ |
| M5 | Live Exam Mode — наставник хостира, ученици се приклучуваат по PIN | Надградба на `live_sessions` | ⬜ |
| M6 | AI hint chain — 3 нивоа (совет → насока → целото решение) | Cached `aiSolution` + `hints[]` | ⬜ |
| M7 | Curriculum bridge — поврзи секоја задача со concept во програмата | `conceptIds[]` auto-tagged при AI enrich | ⬜ |

### ФАЗА I — Import Content (паралелно со M1)

| Приоритет | Тестови | Забелешка |
| --- | --- | --- |
| 1 | 2025 јуни + август (МК + АЛ) | Прв реален content |
| 2 | 2024, 2023, 2022 | По 2 сесии годишно |
| 3 | 2021, 2020 | 2020 = само 1 сесија |
| 4 | 2019–2006 | Историска база (background) |

### ФАЗА Q — Quality Signals

| ID | Задача | KPI |
| --- | --- | --- |
| Q1 | `successRatePercent` агрегација по задача | Видливо во MaturaLibrary |
| Q2 | Врска со `concept_mastery` — при решавање matura задача → ажурирај mastery record | Analytics pipeline |
| Q3 | Recovery Worksheet (E2) вклучи matura задачи за слаби концепти | Побогат remedial flow |

---

## 8) Светско искуство — инкорпорирано

| Карактеристика | Инспирација | Реализација во S17 |
| --- | --- | --- |
| Hint chain (3 нивоа) | Khan Academy | `hints[]` array + progressive reveal UI |
| Timed simulation | Magoosh / SAT prep | `MaturaExamSimView` со per-part тајмер |
| Topic-gated practice | Brilliant | `MaturaPracticeView` → filter по `topicArea` |
| Community discussion | Art of Problem Solving | Forum thread per задача (`questionId` tag) |
| Adaptive difficulty | IXL | Постоечки `adaptiveDifficulty.ts` → pull DoK 1→4 |
| Official key review | Matura.hr / Maturs.lv | После тест: прикажи официјален клуч + AI решение |
| Multilingual native | Cambridge IGCSE | МК/АЛ/ТР toggle per задача, ист официјален клуч |

---

## 9) Execution log (S17)

| Датум | Акција | Commit | Резултат |
| --- | --- | --- | --- |
| 2026-04-04 | F1-F5 code quality fixes (S16 bridge) | 422290d | TSC 0 errors, 420/420 tests ✅ |
| 2026-04-04 | S17 план запишан | — | овој документ |

---

## 10) Definition of Done (S17)

1. Најмалку 4 тест papers импортирани (2025 јуни/август МК+АЛ)
2. `MaturaLibraryView` live со filter + KaTeX preview
3. `MaturaPracticeView` — адаптивен pull по тема работи
4. `MaturaExamSimView` — цел тест со тајмер и auto-grade
5. Curriculum bridge: секоја задача има ≥ 1 `conceptId` врска
6. TSC 0 errors | Tests green | Perf budget green на секој M-commit
