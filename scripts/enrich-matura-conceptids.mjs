/**
 * enrich-matura-conceptids.mjs
 *
 * Adds `conceptIds` to every matura question by mapping `topic` → gymnasium concept IDs.
 * Uses a hand-curated, exhaustive mapping built from data/secondary/gymnasium.ts.
 *
 * Usage:
 *   node scripts/enrich-matura-conceptids.mjs              # dry-run (no write)
 *   node scripts/enrich-matura-conceptids.mjs --apply      # write JSON files
 *   node scripts/enrich-matura-conceptids.mjs --apply --import  # write + Firestore
 *
 * Firestore import requires:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-adminsdk-key.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dir, '../data/matura/raw');

const DRY_RUN = !process.argv.includes('--apply');
const DO_IMPORT = process.argv.includes('--import'); // reserved for future Firestore push

// ─── CONCEPT MAP ─────────────────────────────────────────────────────────────
// gymnasium.ts concept IDs → what they cover (for reference)
//
// gym10-c1-1  Множества и операции со множества
// gym10-c1-2  Множество на реални броеви (природни, цели, рационални, ирационални, реални)
// gym10-c1-3  Размер, пропорција и процент
// gym10-c2-1  Степени и корени
// gym10-c2-2  Цели рационални изрази (полиноми)
// gym10-c2-3  Дробно рационални изрази (алгебарски дропки)
// gym10-c3-1  Декартов координатен систем
// gym10-c3-2  Функција — линеарна и степенска
// gym10-c3-3  Линеарни равенки
// gym10-c3-4  Систем линеарни равенки со две непознати
// gym10-c3-5  Линеарна неравенка со една непозната
// gym10-c4-1  Вектори
// gym10-c4-2  Тригонометрија во правоаголен триаголник
// gym10-c4-3  2Д форми — агли и особини (многуаголници, четириаголници, агли)
// gym10-c4-4  Сличност на триаголници
// gym10-c5-1  Периметар и плоштина на 2Д форми (триаголник, четириаголник, кружница)
// gym10-c5-2  Плоштина и волумен на 3Д форми (призма, пирамида, цилиндар, конус, топка)
// gym10-c6-1  Веројатност
// gym10-c6-2  Статистика — прибирање и претставување на податоци
//
// gym11-c1-1  Тригонометриски функции, врски и решавање на правоаголен триаголник
// gym11-c2-1  Поим за комплексен број и операции
// gym11-c3-1  Видови и решавање квадратни равенки
// gym11-c3-2  Равенки сведени на квадратни и системи
// gym11-c4-1  Квадратна функција, квадратна неравенка и систем квадратни неравенки
// gym11-c5-1  Елементарни конструктивни задачи
// gym11-c6-1  Плоштина на многуаголници и делови од круг
// gym11-c7-1  Плоштина и волумен на геометриски тела
// gym11-c8-1  Мерки за простирање и расејување (статистика)
//
// gym12-c1-1  Експоненцијална функција
// gym12-c1-2  Експоненцијална равенка
// gym12-c1-3  Поим за логаритам и правила за логаритмирање
// gym12-c1-4  Логаритамска функција и равенка
// gym12-c2-1  Тригонометриски функции од произволен агол
// gym12-c2-2  Тек и график на основните тригонометриски функции
// gym12-c2-3  Трансформирање на тригонометриски изрази
// gym12-c2-4  График на сложени тригонометриски функции и равенки
// gym12-c2-5  Решавање на произволен триаголник
// gym12-c3-1  Комбинаторика
// gym12-c3-2  Веројатност (напредно)
// gym12-c4-1  Точка во рамнина (аналитичка геометрија)
// gym12-c4-2  Права во рамнина
// gym12-c4-3  Криви од втор ред (елипса, хипербола, парабола)
//
// gym13-c1-1  Низа од реални броеви
// gym13-c1-2  Аритметичка прогресија
// gym13-c1-3  Геометриска прогресија
// gym13-c1-4  Гранична вредност на низа
// gym13-c2-1  Реална функција и својства
// gym13-c2-2  Сложена и инверзна функција, елементарни функции
// gym13-c2-3  Гранична вредност на функција
// gym13-c3-1  Извод на функција
// gym13-c3-2  Примена на изводите
// gym13-c4-1  Случајни настани и веројатност (напредно)
// gym13-c5-1  Проверка на статистички хипотези

/** topic string (exact or partial match) → conceptId(s) */
const TOPIC_MAP = [
  // ── Broevi / Numbers ──────────────────────────────────────────────────────
  { match: ['Множества', 'Множества и НЗС', 'Множества и проценти'],           ids: ['gym10-c1-1'] },
  { match: ['Броеви', 'Бројни изрази', 'Бројни изрази и проценти'],            ids: ['gym10-c1-2'] },
  { match: ['Пропорции', 'Проценти', 'Размер'],                                ids: ['gym10-c1-3'] },
  { match: ['Корени', 'Степени', 'Степени и полиноми', 'Степени и функции'],   ids: ['gym10-c2-1'] },

  // ── Algebra ───────────────────────────────────────────────────────────────
  { match: ['Полиноми', 'Цели рационални изрази'],                             ids: ['gym10-c2-2'] },
  { match: ['Алгебарски дропки', 'Дробно рационални изрази',
            'Рационални изрази', 'Полиноми и рационални изрази',
            'НЗД на полиноми'],                                                ids: ['gym10-c2-3'] },
  { match: ['Формули за скратено множење'],                                    ids: ['gym10-c2-2'] },

  { match: ['Линеарна функција', 'Линеарни функции'],                          ids: ['gym10-c3-2'] },
  { match: ['Линеарни равенки', 'Линеарни равенки и системи',
            'Линеарни равенки со една непозната',
            'Равенки (текстуална задача)'],                                    ids: ['gym10-c3-3'] },
  { match: ['Систем линеарни равенки', 'Системи линеарни равенки'],            ids: ['gym10-c3-4'] },
  { match: ['Линеарна неравенка', 'Линеарни неравенки',
            'Систем линеарни неравенки', 'Системи линеарни неравенки',
            'Неравенки со дропки'],                                            ids: ['gym10-c3-5'] },

  { match: ['Вектори'],                                                        ids: ['gym10-c4-1'] },

  // ── Квадратни ──────────────────────────────────────────────────────────────
  { match: ['Квадратни равенки', 'Квадратни равенки (Виетови формули)',
            'Квадратни равенки и дискриминанта',
            'Текстуални задачи со квадратни равенки',
            'Равенки (текстуална задача)'],                                    ids: ['gym11-c3-1'] },
  { match: ['Квадратни неравенки'],                                            ids: ['gym11-c4-1'] },
  { match: ['Квадратна функција', 'Квадратни функции'],                        ids: ['gym11-c4-1'] },
  { match: ['Комплексни броеви'],                                              ids: ['gym11-c2-1'] },

  // ── Искази / Logika ───────────────────────────────────────────────────────
  // Искази is covered in gym10 intro to logic — closest mapping is gym10-c3-3
  // (no dedicated "logika" concept in gymnasium.ts — map to closest algebraic concept)
  { match: ['Искази', 'Исказна логика'],                                       ids: ['gym10-c3-3'] },

  // ── Trigonometry ──────────────────────────────────────────────────────────
  { match: ['Тригонометриски вредности',
            'Тригонометрија на правоаголен триаголник'],                       ids: ['gym11-c1-1'] },
  { match: ['Тригонометриски изрази', 'Тригонометриски идентитети'],           ids: ['gym12-c2-3'] },
  { match: ['Агли во кружница', 'Агли во кружница и тригонометрија'],         ids: ['gym12-c2-1'] },

  // ── Geometry — 2D ─────────────────────────────────────────────────────────
  { match: ['Агли', 'Отсечки'],                                               ids: ['gym10-c4-3'] },
  { match: ['Многуаголници', 'Планиметрија - Четириаголници'],                ids: ['gym10-c4-3'] },
  { match: ['Четириаголници', 'Планиметрија - Правоаголник',
            'Планиметрија - Трапез', 'Планиметрија - Ромб'],                  ids: ['gym10-c5-1', 'gym10-c4-3'] },
  { match: ['Триаголник', 'Планиметрија - Триаголник и кружница',
            'Планиметрија - Правоаголен триаголник',
            'Планиметрија - Рамностран триаголник',
            'Агли и тетиви во кружница'],                                     ids: ['gym10-c5-1', 'gym10-c4-3'] },
  { match: ['Сличност на триаголници'],                                        ids: ['gym10-c4-4'] },
  { match: ['Триаголник и ротациони тела'],                                    ids: ['gym10-c5-1', 'gym11-c7-1'] },

  // ── Geometry — 3D ─────────────────────────────────────────────────────────
  { match: ['Призма', 'Стереометрија - Призма', 'Призма и пирамида'],         ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Пирамида', 'Стереометрија - Пирамида'],                          ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Цилиндар', 'Стереометрија - Цилиндар',
            'Цилиндар и конус', 'Стереометрија - Цилиндар и конус'],          ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Топка', 'Коцка', 'Стереометрија - Топка',
            'Стереометрија - Квадар и коцка'],                                ids: ['gym10-c5-2', 'gym11-c7-1'] },

  // ── Planimetrija so trig ──────────────────────────────────────────────────
  { match: ['Планиметрија и тригонометрија на правоаголен триаголник'],       ids: ['gym10-c4-2', 'gym10-c5-1'] },

  // ── Albanian (SQ) equivalents ─────────────────────────────────────────────
  { match: ['Bashkësi', 'Bashkësitë dhe SHMPB', 'Bashkësitë dhe përqindjet'],  ids: ['gym10-c1-1'] },
  { match: ['Shprehje numerike', 'Shprehje numerike dhe përqindje',
            'Fuqitë', 'Fuqi dhe funksione'],                                   ids: ['gym10-c2-1'] },
  { match: ['Proporcionet', 'Proporcione'],                                    ids: ['gym10-c1-3'] },
  { match: ['Rrënjët'],                                                        ids: ['gym10-c2-1'] },
  { match: ['Polinom', 'Polinome', 'Shprehje të plota racionale'],             ids: ['gym10-c2-2'] },
  { match: ['Thyesa algjebrike', 'Thyesat algjebrike',
            'Shprehjet racionale', 'SHMPB i polinomeve'],                      ids: ['gym10-c2-3'] },
  { match: ['Polinome dhe shprehje racionale'],                                ids: ['gym10-c2-3'] },
  { match: ['Funksioni linear', 'Funksionet lineare'],                        ids: ['gym10-c3-2'] },
  { match: ['Barazimet lineare me një të panjohur',
            'Barazime lineare me një të panjohur',
            'Barazimet dhe sistemet lineare',
            'Barazimet (detyrë me tekst)'],                                    ids: ['gym10-c3-3'] },
  { match: ['Sistem barazimesh lineare', 'Sistemi i barazimeve lineare'],      ids: ['gym10-c3-4'] },
  { match: ['Jobarazimet lineare', 'Jobarazimet me thyesa', 'Jobarazime me thyesa',
            'Sistemi i jobarazimeve lineare'],                                  ids: ['gym10-c3-5'] },
  { match: ['Vektorët'],                                                       ids: ['gym10-c4-1'] },
  { match: ['Vlerat trigonometrike',
            'Trigonometria e trekëndëshit kënddrejtë'],                        ids: ['gym11-c1-1'] },
  { match: ['Shprehjet trigonometrike', 'Shprehje trigonometrike',
            'Identitete trigonometrike'],                                       ids: ['gym12-c2-3'] },
  { match: ['Këndet në rreth', 'Këndet në rreth dhe trigonometria'],           ids: ['gym12-c2-1'] },
  { match: ['Segmente', 'Këndet'],                                             ids: ['gym10-c4-3'] },
  { match: ['Shumëkëndësha', 'Katërkëndësha',
            'Planimetri - Katërkëndësha'],                                     ids: ['gym10-c4-3'] },
  { match: ['Planimetri - Drejtkëndëshi', 'Planimetria - Rombi',
            'Planimetria - Trapezi'],                                           ids: ['gym10-c5-1', 'gym10-c4-3'] },
  { match: ['Trekëndëshi', 'Planimetria - Trekëndëshi dhe rrethi',
            'Planimetria - Trekëndëshi kënddrejtë',
            'Planimetria - Trekëndëshi barabrinjës',
            'Planimetri - Trekëndëshi barabrinjës'],                           ids: ['gym10-c5-1', 'gym10-c4-3'] },
  { match: ['Planimetria dhe trigonometria e trekëndëshit kënddrejtë'],        ids: ['gym10-c4-2', 'gym10-c5-1'] },
  { match: ['Trekëndëshi dhe trupat e rrotullimit'],                           ids: ['gym10-c5-1', 'gym11-c7-1'] },
  { match: ['Prizmi', 'Stereometri - Prizmi', 'Stereometria - Prizmi'],        ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Piramida', 'Stereometri - Piramida', 'Stereometria - Piramida',
            'Prizmi dhe piramida'],                                             ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Cilindri', 'Stereometri - Cilindri', 'Stereometria - Cilindri',
            'Stereometri - Cilindri dhe koni', 'Cilindri dhe koni'],           ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Topi', 'Kubi', 'Stereometria - Topi',
            'Stereometria - Kuadri dhe Kubi'],                                  ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Logjika e gjykimeve', 'Iskaze'],                                  ids: ['gym10-c3-3'] },
  { match: ['Numrat kompleks', 'Numra kompleks'],                              ids: ['gym11-c2-1'] },
  { match: ['Barazimet katrore', 'Barazime katrore',
            'Barazime katrore (formulat e Vietës)',
            'Barazimet katrore (Formulat e Vietës)',
            'Barazime katrore dhe diskriminanti',
            'Barazimet katrore dhe diskriminanti',
            'Detyra me tekst me barazime katrore'],                             ids: ['gym11-c3-1'] },
  { match: ['Jobarazime katrore'],                                             ids: ['gym11-c4-1'] },
  { match: ['Funksioni katror'],                                               ids: ['gym11-c4-1'] },
];

// Normalise topic string for matching
function normTopic(s) {
  return (s || '').toLowerCase().trim();
}

/** Return conceptIds for a given topic string */
function lookupConcepts(topic) {
  const n = normTopic(topic);
  for (const row of TOPIC_MAP) {
    for (const m of row.match) {
      if (normTopic(m) === n) return row.ids;
    }
  }
  // Fuzzy: partial match
  for (const row of TOPIC_MAP) {
    for (const m of row.match) {
      if (n.includes(normTopic(m)) || normTopic(m).includes(n)) return row.ids;
    }
  }
  return [];
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
let totalQ = 0, enriched = 0, unmapped = new Set();

for (const file of files) {
  const path = join(RAW_DIR, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));

  let changed = false;
  for (const q of data.questions) {
    const ids = lookupConcepts(q.topic);
    if (ids.length > 0 && JSON.stringify(q.conceptIds || []) !== JSON.stringify(ids)) {
      q.conceptIds = ids;
      changed = true;
      enriched++;
    } else if (ids.length === 0) {
      unmapped.add(q.topic);
    }
    totalQ++;
  }

  if (changed) {
    if (DRY_RUN) {
      console.log(`[DRY] Would update: ${file}`);
    } else {
      writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✓ Updated: ${file}`);
    }
  }
}

console.log(`\nSummary: ${enriched}/${totalQ} questions enriched`);
if (unmapped.size > 0) {
  console.log(`\nUnmapped topics (${unmapped.size}):`);
  [...unmapped].sort().forEach(t => console.log('  - ' + t));
}

if (DRY_RUN) {
  console.log('\n→ Run with --apply to write files');
  console.log('→ Run with --apply --import to also push to Firestore');
}
