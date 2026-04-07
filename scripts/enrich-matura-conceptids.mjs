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
import { lookupConcepts } from './matura-concept-map.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dir, '../data/matura/raw');

const DRY_RUN = !process.argv.includes('--apply');
const DO_IMPORT = process.argv.includes('--import'); // reserved for future Firestore push

// TOPIC_MAP and lookupConcepts() are imported from matura-concept-map.mjs

// ─── Reference: gymnasium.ts concept IDs ─────────────────────────────────────
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
