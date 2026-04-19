# AI1 — Vector RAG: Семантичко пребарување на курикулум

**Статус**: ИМПЛЕМЕНТИРАНО — ЧЕКА ИНДЕКСИРАЊЕ + STAGING ВЕРИФИКАЦИЈА ПРЕД PROD  
**Последна ревизија**: 19 Apr 2026

---

## 1. Тековна состојба

`services/ragService.ts` — `searchSimilarContext()` постои но е **mock**:
- `getMockCurriculumEmbeddings()` враќа `Math.random()` вектори
- Нема вистински Firestore вектори
- `callGeminiEmbed` работи коректно (`gemini-embedding-2-preview`, 768d)
- `cached_ai_materials` docs веќе ги чуваат `embedding: number[]` при зачувување на материјали (фиrestoreService.materials.ts:151–169)
- `fetchFewShotExamples()` е единствениот активен RAG повик (assessment.ts:4) — враќа hard-coded примери

**Проблем**: AI-от добива само title/description на концептот, не и семантички слични прашања/материјали.

---

## 2. Цел

Кога учителот генерира квиз/материјал за концепт X:
1. Query → Gemini Embedding → 768-dim вектор
2. Firestore KNN → топ-5 слични концепти
3. Нивните `assessmentStandards` + `activities` → систем промпт

Резултат: AI пишува задачи кои точно таргетираат курикуларните стандарди наместо генерички содржини.

---

## 3. Два пристапа — анализа

### Опција А: Client-side cosine (без Firebase upgrade) ← ПРЕПОРАЧАНА за MVP

```
Embedding index: concept_embeddings/{conceptId}
  { vector: number[], text: string, updatedAt: Timestamp }

Query flow:
  1. callGeminiEmbed(queryText) → queryVector (client)
  2. getDocs(collection('concept_embeddings')) → сите вектори (~500 docs)
  3. cosineSimilarity(queryVector, each) → sort → top-5
  4. Batch fetch concept details → inject into prompt
```

**Предности**:
- Нема Firebase SDK upgrade → нула ризик од prod регресија
- Работи на Spark plan (бесплатен)
- `ragService.ts` само го заменуваме mock-от — без промени на останат код
- 500 docs × 768 floats × 8 bytes ≈ 3 MB read per query (прифатливо)

**Недостатоци**:
- Бавно при >1000 концепти (не проблем до 2027)
- Нема offline поддршка (мора да чита Firestore)

### Опција Б: Firestore Native Vector Search (KNN)

```typescript
// Бара @firebase/firestore ≥ 11.2.0 (BREAKING upgrade)
import { findNearest, VectorQuery } from 'firebase/firestore';
const results = await getDocs(
  findNearest(collection(db, 'concept_embeddings'), 'vector', queryVector,
    { limit: 5, distanceMeasure: 'COSINE' })
);
```

**Предности**: Сервер-страна KNN → побрзо, масштабира до милиони вектори

**Ризици** (затоа го одложуваме):
- `@firebase/firestore` upgrade: 10 → 11 — breaking changes во BatchWrite, Transaction API
- Бара Firebase Blaze plan + рачно креирање на векторски индекс во Console
- Бара тестирање на сите Firestore операции (quiz_results, live_sessions, matura...) по upgrade
- Индексот одзема 24–48h за build на постоечките docs

---

## 4. Имплементационен план (Опција А)

### Фаза 0 — Индексирање на курикулум (еднократно, offline script)

```typescript
// scripts/index-curriculum-embeddings.mjs
// За секој concept во fullCurriculumData:
//   text = `${concept.title}\n${concept.description}\n${concept.assessmentStandards.join(' ')}`
//   vector = await callGeminiEmbed(text)  // преку /api/embed
//   setDoc(doc(db, 'concept_embeddings', concept.id), { vector, text, updatedAt: serverTimestamp() })
// Batch: 10 concepts / second (rate limit buffer)
// Estimat: ~500 concepts × 0.1s = ~50s
```

**Firestore структура**:
```
concept_embeddings/{conceptId}
  vector: number[]        // 768 floats
  text: string            // indexable snippet
  updatedAt: Timestamp
```

**Firestore security rule** (додај):
```
match /concept_embeddings/{id} {
  allow read: if request.auth != null;
  allow write: if false;  // само admin script
}
```

### Фаза 1 — ragService.ts refactor

```typescript
// Замени getMockCurriculumEmbeddings() со реален Firestore read:

public async searchSimilarContext(
  queryText: string,
  topK = 5,
): Promise<RagResult[]> {
  // 1. Generate query embedding
  const { embeddings } = await callGeminiEmbed({
    model: 'gemini-embedding-2-preview',
    contents: [{ text: queryText }],
  });
  const queryVector = embeddings.values;

  // 2. Fetch all concept embeddings from Firestore
  const snap = await getDocs(collection(db, 'concept_embeddings'));
  
  // 3. Cosine similarity + sort + top-K
  const results = snap.docs
    .map(d => {
      const data = d.data() as { vector: number[]; text: string };
      return {
        conceptId: d.id,
        context: data.text,
        similarity: cosineSimilarity(queryVector, data.vector),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter(r => r.similarity > 0.7);  // similarity threshold

  return results;
}
```

### Фаза 2 — Интеграција во prompt pipeline

Во `services/gemini/assessment.ts` и `services/gemini/core.ts`:
```typescript
// Пред генерирање на квиз/материјал:
const ragContext = await ragService.searchSimilarContext(
  `${topic.title} ${concept.title} ${concept.description}`
);
// Inject во systemInstruction:
// "Релевантни курикуларни стандарди:\n" + ragContext.map(r => r.context).join('\n')
```

### Фаза 3 — Кеширање (опционален оптимизатор)

- Cache concept_embeddings во `sessionStorage` (JSON, ~3MB, 30min TTL)
- При следен query → skip Firestore read
- Клучен за мобилни корисници на бавна мрежа

---

## 5. Тест план

### Unit тестови (нови)
```typescript
// __tests__/ragService.test.ts
describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors')
  it('returns 0.0 for orthogonal vectors')
  it('returns ~0.9 for similar vectors')
})
describe('searchSimilarContext', () => {
  it('filters below threshold 0.7')
  it('returns max topK results')
  it('gracefully returns [] on Firestore error')
})
```

### Интеграциски тест (рачен, пред prod)
1. Индексирај 10 концепти локално
2. Query: "Питагорова теорема" → assert similarity > 0.85 со `геометрија-питагора` концепт
3. Query: "интеграл" → assert similarity < 0.4 со `геометрија-питагора`
4. Измери latency: target < 1500ms (embed + Firestore read)

---

## 6. Rollout стратегија

```
[script] → index ~500 concepts → concept_embeddings (Firestore)
[dev]    → ragService refactor + unit tests → npx tsc && vitest
[staging]→ VITE_ENABLE_VECTOR_RAG=true (feature flag в localStorage)
         → 3 дена рачно тестирање со реален квиз генератор
[prod]   → само ако staging го поминува
```

**Feature flag во ragService**:
```typescript
const VECTOR_RAG_ENABLED = localStorage.getItem('VITE_ENABLE_VECTOR_RAG') === 'true';
if (!VECTOR_RAG_ENABLED) return []; // graceful no-op
```

---

## 7. Rollback план

- Feature flag → `localStorage.removeItem('VITE_ENABLE_VECTOR_RAG')` → моментален rollback
- `concept_embeddings` collection е read-only од апликацијата → бришењето е безбедно во секое време
- Нема промени на постоечки collections → нула prod ризик

---

## 8. Опција Б (Firestore KNN) — кога да се разгледа

Активирај ја Опција Б само кога:
- [ ] Концептите > 2000 (performance boundary за client cosine)
- [ ] Firebase SDK е стабилизирана на v11+ во еко-системот (check Q3 2026)
- [ ] Имаме staging environment со Blaze план
- [ ] Сите Firestore операции имаат интеграциски тестови (не само unit)

**Процедура за Опција Б (NE ПРАВИ СЕГА)**:
```bash
# 1. Upgrade во посебен branch
npm install @firebase/firestore@^11 firebase@^11

# 2. Провери breaking changes:
# - WriteBatch.commit() return type
# - Transaction.get() async/await промени
# - onSnapshot error handling

# 3. Run full test suite — мора 0 грешки

# 4. Тест на Firestore KNN во Firebase Emulator Suite
# firebase emulators:start --only firestore

# 5. Creирај векторски индекс:
# Firebase Console → Firestore → Indexes → Vector index
# Collection: concept_embeddings, Field: vector, Dimensions: 768, Measure: COSINE

# 6. Чекај 24-48h за index build на production

# 7. Deploy само по 72h мониторинг на staging
```

---

## 9. Блокири за пуштање (checklist)

- [x] Сите 700+ unit тестови минуваат со новиот ragService — **717/717 ✅**
- [x] Phase 1: ragService.ts — Firestore read + sessionStorage cache + cosine similarity
- [x] Phase 2: buildDynamicSystemInstruction() + assessment.ts — vectorRagQuery injection
- [x] Latency logging: embed / fetch / total ms + hits count во logger.debug
- [x] Deduplication: current conceptId исклучен од similar results (тестирано)
- [x] Fallback верификуван: try/catch → graceful empty array → AI продолжува без RAG
- [x] concept_embeddings + matura_community_solutions security rules
- [x] scripts/index-curriculum-embeddings.ts — еднократен индексер (npx tsx)
- [ ] **PENDING**: Изврши `npx tsx scripts/index-curriculum-embeddings.ts` (потребен .env)
- [ ] **PENDING**: Staging: `localStorage.setItem('VITE_ENABLE_VECTOR_RAG', 'true')`
- [ ] **PENDING**: Верифицирај 50 реални квиз генерирања со RAG enabled
- [ ] **PENDING**: Latency p95 < 2000ms (измери од logger.debug logs)
- [ ] **PENDING**: Similarity threshold fine-tuning (провери дали 0.70 дава relevantни резултати)
- [ ] **PENDING**: Deploy firestore.rules (firebase deploy --only firestore:rules)

**Само кога сите PENDING се ✅ → активирај во prod.**

### Активирање (кога сите checks се завршени)

```typescript
// Dev console или Settings панел:
localStorage.setItem('VITE_ENABLE_VECTOR_RAG', 'true');
// Деактивирање (rollback):
localStorage.removeItem('VITE_ENABLE_VECTOR_RAG');
```
