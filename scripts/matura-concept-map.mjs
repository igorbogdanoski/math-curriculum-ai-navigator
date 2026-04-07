/**
 * scripts/matura-concept-map.mjs
 * Shared TOPIC_MAP + lookupConcepts() used by both:
 *   - import-matura.mjs       (auto-populate conceptIds on import)
 *   - enrich-matura-conceptids.mjs  (batch-enrich existing raw JSON files)
 *
 * Mapping: topic string (МК or SQ) → gymnasium.ts conceptId(s)
 */

/** topic string (exact or partial match) → conceptId(s) */
export const TOPIC_MAP = [
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

  // ── Апсолутна вредност / Деливост ────────────────────────────────────────
  { match: ['Апсолутна вредност', 'Апсолутна вредност на реален број',
            'Деливост', 'Деливост во N', 'НЗС и НЗД'],                       ids: ['gym10-c1-2'] },

  // ── Рационални равенки ────────────────────────────────────────────────────
  { match: ['Рационални равенки', 'Дробно рационални равенки',
            'Равенки со дропки'],                                              ids: ['gym10-c2-3', 'gym11-c3-2'] },

  // ── Плоштина на рамнински фигури / Кружница ───────────────────────────────
  { match: ['Плоштина на рамнински фигури', 'Плоштина на рамнина',
            'Плоштина на многуаголници'],                                      ids: ['gym11-c6-1', 'gym10-c5-1'] },
  { match: ['Кружница и круг', 'Кружница', 'Круг',
            'Делови од круг', 'Кружен исечок', 'Кружен отсечок'],            ids: ['gym10-c5-1', 'gym11-c6-1'] },

  // ── Трансформации во рамнина ──────────────────────────────────────────────
  { match: ['Трансформации во рамнина', 'Геометриски трансформации',
            'Симетрија', 'Транслација', 'Ротација', 'Хомотетија'],           ids: ['gym10-c4-3', 'gym10-c4-4'] },

  // ── Прогресии (генерички) ─────────────────────────────────────────────────
  { match: ['Прогресии', 'Прогресија', 'Аритметичка и геометриска прогресија',
            'Низи и прогресии'],                                               ids: ['gym13-c1-2', 'gym13-c1-3'] },

  // ── Квадратни ──────────────────────────────────────────────────────────────
  { match: ['Квадратна равенка', 'Квадратни равенки',
            'Квадратни равенки (Виетови формули)',
            'Квадратни равенки и дискриминанта',
            'Текстуални задачи со квадратни равенки',
            'Равенки (текстуална задача)'],                                    ids: ['gym11-c3-1'] },
  { match: ['Квадратни неравенки'],                                            ids: ['gym11-c4-1'] },
  { match: ['Квадратна функција', 'Квадратни функции'],                        ids: ['gym11-c4-1'] },
  { match: ['Комплексни броеви'],                                              ids: ['gym11-c2-1'] },

  // ── Искази / Logika ───────────────────────────────────────────────────────
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

  // ── Sequences & Analysis (gym13) ─────────────────────────────────────────
  { match: ['Низи', 'Аритметичка прогресија'],                                ids: ['gym13-c1-2'] },
  { match: ['Геометриска прогресија'],                                         ids: ['gym13-c1-3'] },
  { match: ['Граница на низа', 'Гранична вредност'],                          ids: ['gym13-c1-4'] },
  { match: ['Функција и својства', 'Реална функција'],                        ids: ['gym13-c2-1'] },
  { match: ['Извод', 'Изводи'],                                               ids: ['gym13-c3-1'] },
  { match: ['Примена на изводи', 'Примена на извод'],                         ids: ['gym13-c3-2'] },

  // ── Statistics & Probability ──────────────────────────────────────────────
  { match: ['Веројатност', 'Комбинаторика и веројатност'],                    ids: ['gym10-c6-1'] },
  { match: ['Статистика', 'Статистика и веројатност'],                        ids: ['gym10-c6-2'] },
  { match: ['Комбинаторика'],                                                  ids: ['gym12-c3-1'] },
  { match: ['Веројатност (напредно)'],                                         ids: ['gym12-c3-2'] },

  // ── Analytic geometry (gym12) ─────────────────────────────────────────────
  { match: ['Аналитичка геометрија', 'Точка во рамнина'],                     ids: ['gym12-c4-1'] },
  { match: ['Права во рамнина'],                                               ids: ['gym12-c4-2'] },
  { match: ['Криви од втор ред', 'Елипса', 'Хипербола', 'Парабола'],         ids: ['gym12-c4-3'] },

  // ── Exponential / Logarithmic (gym12) ────────────────────────────────────
  { match: ['Експоненцијална функција'],                                       ids: ['gym12-c1-1'] },
  { match: ['Експоненцијална равенка'],                                        ids: ['gym12-c1-2'] },
  { match: ['Логаритам', 'Логаритамска функција'],                             ids: ['gym12-c1-3', 'gym12-c1-4'] },

  // ── Advanced Trig (gym12) ─────────────────────────────────────────────────
  { match: ['Тригонометриски функции'],                                        ids: ['gym12-c2-1'] },
  { match: ['График на тригонометриски функции',
            'График на сложени тригонометриски функции'],                      ids: ['gym12-c2-4'] },
  { match: ['Решавање на произволен триаголник'],                              ids: ['gym12-c2-5'] },

  // ── Дополнителни теми (enrich round 2) ───────────────────────────────────
  { match: ['Алгебарски изрази', 'Трансформација на изрази'],                  ids: ['gym10-c2-2', 'gym10-c2-3'] },
  { match: ['Рационални алгебарски изрази'],                                   ids: ['gym10-c2-3'] },
  { match: ['Функции и изрази', 'Дефинициона област'],                         ids: ['gym13-c2-1'] },
  { match: ['Бројни интервали'],                                               ids: ['gym10-c1-2'] },
  { match: ['Аритметичка средина'],                                            ids: ['gym10-c6-2', 'gym11-c8-1'] },
  { match: ['Равенка на права'],                                               ids: ['gym12-c4-2'] },
  { match: ['Нормалност на прави', 'Паралелност и нормалност'],               ids: ['gym10-c4-3', 'gym12-c4-2'] },
  { match: ['Планиметрија - Делтоид', 'Планиметрија - Квадрат',
            'Планиметрија - Паралелограм'],                                    ids: ['gym10-c5-1', 'gym10-c4-3'] },
  { match: ['Проблемски задачи со системи'],                                   ids: ['gym10-c3-4'] },
  { match: ['Проблемски задачи'],                                              ids: ['gym10-c3-3'] },
  { match: ['Стереометрија - Конус', 'Конус',
            'Стереометрија - Ротациони тела', 'Ротациони тела',
            'Конус и тригонометрија', 'Ротациони тела и тригонометрија',
            'Стереометрија и тригонометрија', 'Сфера'],                       ids: ['gym10-c5-2', 'gym11-c7-1'] },
  { match: ['Тригонометриски равенки'],                                        ids: ['gym12-c2-4'] },

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

/** Normalise topic string for matching */
function normTopic(s) {
  return (s ?? '').toLowerCase().trim();
}

/**
 * Return conceptIds for a given topic string.
 * Tries exact match first, then partial/fuzzy match.
 * Returns [] if no match found.
 */
export function lookupConcepts(topic) {
  const n = normTopic(topic);
  if (!n) return [];
  // Exact match
  for (const row of TOPIC_MAP) {
    for (const m of row.match) {
      if (normTopic(m) === n) return row.ids;
    }
  }
  // Fuzzy: one side contains the other
  for (const row of TOPIC_MAP) {
    for (const m of row.match) {
      const nm = normTopic(m);
      if (n.includes(nm) || nm.includes(n)) return row.ids;
    }
  }
  return [];
}
