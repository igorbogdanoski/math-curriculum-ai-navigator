# NotebookLM — Шаблон за извлекување задачи од ДИМ тестови

**Намена:** Овој шаблон го користиш во NotebookLM за да го извлечеш содржината  
од PDF на државна матура и да генерираш структуриран JSON за import во апликацијата.

---

## ЧЕКОР 1 — Прикачи ги изворите во NotebookLM

Прикачи во еден NotebookLM проект:
1. PDF на тестот (МК верзија)
2. PDF на официјалниот клуч за тој тест
3. PDF на АЛ верзија (ако постои)
4. Овој шаблон документ (за референца)

---

## ЧЕКОР 2 — Праша го NotebookLM со следниот prompt

Копирај го точно овој prompt и прилагоди ги `[плејсхолдерите]`:

---

### PROMPT A — Извлечи ги задачите (МК верзија)

```
Анализирај го прикачениот PDF тест на државна матура по математика.

Контекст:
- Година: [2025]
- Сесија: [јуни / август]
- Јазик: македонски (mk)
- Track: gymnasium
- Формат: 3 дела — Прв дел (задачи 1-10, по 1 поен), Втор дел (11-15, по 2 поени), Трет дел (16-20, по 3 поени)
- Вкупно: 20 задачи, 35 поени, 180 минути

За СЕКОЈА задача извлечи:
1. questionNumber (1-20)
2. part (1, 2 или 3 — во зависност од кој дел е)
3. points (1, 2 или 3 — во зависност од делот)
4. questionText — целосниот текст на прашањето. Математичките изрази запиши ги во LaTeX, обвиткани со $ за inline и $$ за display. Пример: "Пресметај $\\int_0^1 x^2\\,dx$"
5. choices — четирите одговори А, Б, В, Г (исто LaTeX за математика)
6. correctAnswer — А, Б, В или Г (земи го од официјалниот клуч)
7. topic — темата на задачата на македонски (пр. "Деривати", "Интеграли", "Матрици", "Тригонометрија")
8. topicArea — еден од: "analiza" | "algebra" | "geometrija" | "statistika" | "kombinatorika" | "trigonometrija" | "matrici-vektori"
9. hasImage — true ако задачата содржи слика/фигура, false ако не
10. imageDescription — ако hasImage=true, опиши ја сликата накратко на МК (пр. "Правоаголен триаголник ABC со означени страни")
11. dokLevel — 1, 2, 3 или 4 (1=Recall/директна примена, 2=Skills/концепти, 3=Стратешко размислување, 4=Проширено размислување)

Врати го резултатот САМО како валиден JSON во следниот формат (без дополнителен текст):

{
  "exam": {
    "id": "dim-gymnasium-[YEAR]-[SESSION]-mk",
    "year": [YEAR],
    "session": "[june|august]",
    "track": "gymnasium",
    "gradeLevel": 13,
    "language": "mk",
    "durationMinutes": 180,
    "title": "Државна матура — Гимназиско — [МЕСЕЦ YEAR]",
    "hasOfficialKey": true
  },
  "questions": [
    {
      "questionNumber": 1,
      "part": 1,
      "points": 1,
      "questionText": "...",
      "choices": { "А": "...", "Б": "...", "В": "...", "Г": "..." },
      "correctAnswer": "А",
      "topic": "...",
      "topicArea": "...",
      "conceptIds": [],
      "imageUrls": [],
      "hasImage": false,
      "imageDescription": null,
      "dokLevel": 2
    }
  ]
}
```

---

### PROMPT B — Верификација

```
Провери го генерираниот JSON:
1. Дали сите 20 задачи се присутни (questionNumber 1-20)?
2. Дали part=1 за задачи 1-10, part=2 за 11-15, part=3 за 16-20?
3. Дали points=1/2/3 одговара на делот?
4. Дали correctAnswer е земен од официјалниот клуч (не се претпоставува)?
5. Дали сите математички изрази се во LaTeX синтакса?
6. Дали hasImage=true за задачите кои навистина имаат слика?

Ако има грешки, поправи ги и врати го коригираниот JSON.
```

---

### PROMPT C — АЛ верзија (cross-reference)

```
Анализирај ја прикачената Albanian (АЛ) верзија на истиот тест.

За СЕКОЈА задача:
1. Потврди дека структурата (choices А/Б/В/Г, correctAnswer) е иста со МК верзијата
2. Извлечи го questionText и choices НА АЛБАНСКИ
3. Врати JSON со истиот формат, но "language": "al" и "id": "dim-gymnasium-[YEAR]-[SESSION]-al"

Напомена: correctAnswer е ист за МК и АЛ верзија — само јазикот на текстот е различен.
```

---

## ЧЕКОР 3 — Обработи ги сликите

За задачи каде `hasImage: true`:

1. Отвори го оригиналниот PDF
2. За секоја задача со слика:
   - Направи screenshot / извлечи страница
   - Зачувај како `q{N}-fig{I}.png` (пр. `q07-fig1.png`)
   - Качи на Firebase Storage под патека: `matura-images/{year}/{session}/q{N}-fig{I}.png`
   - Запиши го URL во `imageUrls[]` полето во JSON

**Алатки за извлекување слики од PDF:**
- Windows: Adobe Acrobat Reader → Snapshot Tool (Shift+Ctrl+G)
- Или: `pdfimages -png input.pdf output-prefix` (poppler tools)
- Или: Drag the PDF page into Paint / Snipping Tool → Crop → Save as PNG

---

## ЧЕКОР 4 — Валидирај и импортирај

```bash
# Зачувај го JSON фајлот во:
data/matura/raw/dim-gymnasium-2025-june-mk.json

# Валидирај
npm run matura:validate -- --input data/matura/raw/dim-gymnasium-2025-june-mk.json

# Dry-run (само прикажи, не пишува во Firestore)
npm run matura:import -- --input data/matura/raw/dim-gymnasium-2025-june-mk.json --dry-run

# Вистински import
npm run matura:import -- --input data/matura/raw/dim-gymnasium-2025-june-mk.json

# AI обогатување (hints + aiSolution + auto-tag conceptIds)
npm run matura:enrich -- --examId dim-gymnasium-2025-june-mk
```

---

## ЧЕКОР 5 — Именување на фајловите

Конвенција за имиња:

| Тест | Фајл |
| --- | --- |
| 2025 јуни МК | `dim-gymnasium-2025-june-mk.json` |
| 2025 јуни АЛ | `dim-gymnasium-2025-june-al.json` |
| 2025 август МК | `dim-gymnasium-2025-august-mk.json` |
| 2024 јуни МК | `dim-gymnasium-2024-june-mk.json` |
| 2020 јуни МК | `dim-gymnasium-2020-june-mk.json` |

Слики: `matura-images/2025/june/q07-fig1.png`

---

## ЧЕКОР 6 — Наредба за кориснички приоритет на внесување

```
Сесија 1:  2025 јуни   (МК + АЛ)   ← ПРВО
Сесија 2:  2025 август (МК + АЛ)
Сесија 3:  2024 јуни   (МК + АЛ)
Сесија 4:  2024 август (МК + АЛ)
...
Сесија N:  2020 јуни   (само 1 тест)
Историски: 2019 → 2006 (background, по потреба)
```

---

## ЗАБЕЛЕШКИ

- **LaTeX синтакса:** Во JSON стрингови, backslash се двојува: `\\frac`, `\\int`, `\\sqrt`
- **Кирилица:** JSON е UTF-8, кирилицата оди директно без escaping
- **Официјален клуч:** СЕКОГАШ верификувај correctAnswer наспроти официјалниот клуч — не претпоставувај
- **topicArea вредности:** `analiza` | `algebra` | `geometrija` | `statistika` | `kombinatorika` | `trigonometrija` | `matrici-vektori` | `broevi`
- **Трет дел:** Некои задачи во третиот дел може да имаат повеќе слики — запиши ги сите во `imageUrls[]`
