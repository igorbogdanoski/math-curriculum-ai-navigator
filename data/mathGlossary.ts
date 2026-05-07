/**
 * Mathematical glossary (T4.5) — Macedonian-language definitions for terms
 * that appear in matura questions. Used by `MaturaQuestionCard` to render
 * hover popovers and by the AI tutor for definitional grounding.
 */

export interface GlossaryEntry {
  /** Canonical Macedonian term (lowercase head form). */
  term: string;
  /** Optional surface aliases (declensions, synonyms, English). */
  aliases?: string[];
  /** Short definition in Macedonian. */
  definition: string;
  /** Optional worked example (LaTeX-friendly). */
  example?: string;
  /** Topic group for grouping/filtering. */
  topic: 'algebra' | 'geometrija' | 'analiza' | 'kombinatorika' | 'trigonometrija' | 'opsto';
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'дискриминанта',
    aliases: ['дискриминантата'],
    definition:
      'Изразот D = b² − 4ac кај квадратната равенка ax² + bx + c = 0; неговиот знак го одредува бројот на реални решенија.',
    example: 'За x² − 5x + 6 = 0 имаме D = 25 − 24 = 1 > 0, па постојат две различни реални решенија.',
    topic: 'algebra',
  },
  {
    term: 'квадратна равенка',
    aliases: ['квадратната равенка', 'квадратни равенки'],
    definition: 'Полиномска равенка од втор степен од обликот ax² + bx + c = 0, каде a ≠ 0.',
    topic: 'algebra',
  },
  {
    term: 'полином',
    aliases: ['полиномот', 'полиноми'],
    definition: 'Алгебарски израз од обликот aₙxⁿ + … + a₁x + a₀ со конечен број членови.',
    topic: 'algebra',
  },
  {
    term: 'логаритам',
    aliases: ['логаритамот', 'логаритми', 'log', 'ln'],
    definition: 'logₐ(b) = c значи aᶜ = b. Природниот логаритам ln има основа e.',
    example: 'log₂(8) = 3 бидејќи 2³ = 8.',
    topic: 'algebra',
  },
  {
    term: 'експонента',
    aliases: ['експонент', 'степенување'],
    definition: 'Број што покажува колку пати основата се множи сама со себе: aⁿ.',
    topic: 'algebra',
  },
  {
    term: 'апсолутна вредност',
    aliases: ['апсолутната вредност'],
    definition: 'Растојанието на бројот од нулата на бројната права: |x| = x ако x ≥ 0, инаку −x.',
    topic: 'algebra',
  },
  {
    term: 'неравенка',
    aliases: ['неравенки', 'неравенство'],
    definition: 'Математичка тврдина со релација <, ≤, > или ≥ помеѓу два израза.',
    topic: 'algebra',
  },
  {
    term: 'функција',
    aliases: ['функцијата', 'функции'],
    definition: 'Правило што на секој елемент од доменот му придружува точно еден елемент од кодоменот.',
    topic: 'analiza',
  },
  {
    term: 'домен',
    aliases: ['доменот', 'дефинициско подрачје'],
    definition: 'Множеството од сите дозволени влезни вредности на функцијата.',
    topic: 'analiza',
  },
  {
    term: 'извод',
    aliases: ['изводот', 'диференцијал', "f'(x)"],
    definition:
      'Граничната вредност на коефициентот на промена; геометриски — наклонот на тангентата во точка.',
    example: "Ако f(x) = x², тогаш f'(x) = 2x.",
    topic: 'analiza',
  },
  {
    term: 'интеграл',
    aliases: ['интегралот', 'интегрирање'],
    definition:
      'Спротивна операција на изводот; определен интеграл ∫ₐᵇ f(x) dx ја мери површината под графикот на [a, b].',
    topic: 'analiza',
  },
  {
    term: 'граница',
    aliases: ['лимес', 'lim'],
    definition: 'Вредноста кон која се приближува f(x) кога x се приближува кон дадена точка.',
    topic: 'analiza',
  },
  {
    term: 'асимптота',
    aliases: ['асимптотата', 'асимптоти'],
    definition:
      'Права на која графикот на функцијата неограничено се приближува (вертикална, хоризонтална или коса).',
    topic: 'analiza',
  },
  {
    term: 'синус',
    aliases: ['sin'],
    definition: 'Тригонометриска функција: однос на спротивната катета и хипотенузата во правоаголен триаголник.',
    topic: 'trigonometrija',
  },
  {
    term: 'косинус',
    aliases: ['cos'],
    definition: 'Тригонометриска функција: однос на прилежната катета и хипотенузата.',
    topic: 'trigonometrija',
  },
  {
    term: 'тангенс',
    aliases: ['tg', 'tan'],
    definition: 'Однос на синусот и косинусот: tan(x) = sin(x) / cos(x).',
    topic: 'trigonometrija',
  },
  {
    term: 'радијан',
    aliases: ['радијани'],
    definition: 'Аголна мерка: 180° = π радијани.',
    topic: 'trigonometrija',
  },
  {
    term: 'хипотенуза',
    aliases: ['хипотенузата'],
    definition: 'Најдолгата страна на правоаголен триаголник, спротивна на правиот агол.',
    topic: 'geometrija',
  },
  {
    term: 'катета',
    aliases: ['катетата', 'катети'],
    definition: 'Една од двете страни што го градат правиот агол во правоаголен триаголник.',
    topic: 'geometrija',
  },
  {
    term: 'питагорова теорема',
    aliases: ['Питагорова теорема', 'Питагора'],
    definition: 'Во правоаголен триаголник: a² + b² = c², каде c е хипотенуза.',
    topic: 'geometrija',
  },
  {
    term: 'елипса',
    aliases: ['елипсата'],
    definition: 'Затворена крива; геометриско место на точки со постојан збир на растојанија до две фокални точки.',
    topic: 'geometrija',
  },
  {
    term: 'парабола',
    aliases: ['параболата'],
    definition: 'Геометриско место на точки еднакво оддалечени од дадена точка (фокус) и права (директриса).',
    topic: 'geometrija',
  },
  {
    term: 'хипербола',
    aliases: ['хиперболата'],
    definition: 'Крива со две гранки; геометриско место на точки со постојана разлика на растојанија до две фокални точки.',
    topic: 'geometrija',
  },
  {
    term: 'кружница',
    aliases: ['кружницата'],
    definition: 'Множество точки во рамнина на еднакво растојание (радиус) од дадена точка (центар).',
    topic: 'geometrija',
  },
  {
    term: 'вектор',
    aliases: ['векторот', 'вектори'],
    definition: 'Насочена големина определена со интензитет, правец и насока.',
    topic: 'geometrija',
  },
  {
    term: 'веројатност',
    aliases: ['веројатноста'],
    definition: 'Број меѓу 0 и 1 што мери колку е возможен даден настан: P(A) = бр. поволни / бр. вкупни.',
    topic: 'kombinatorika',
  },
  {
    term: 'комбинација',
    aliases: ['комбинации', 'C(n,k)'],
    definition: 'Број на начини за избор на k елементи од n без редослед: C(n, k) = n! / (k!(n − k)!).',
    topic: 'kombinatorika',
  },
  {
    term: 'пермутација',
    aliases: ['пермутации'],
    definition: 'Подредување на сите елементи од множество во низа; n различни елементи имаат n! пермутации.',
    topic: 'kombinatorika',
  },
  {
    term: 'факториел',
    aliases: ['n!'],
    definition: 'Производ на сите природни броеви до n: n! = 1·2·…·n; по дефиниција 0! = 1.',
    topic: 'kombinatorika',
  },
  {
    term: 'матрица',
    aliases: ['матрицата', 'матрици'],
    definition: 'Правоаголна шема од броеви распоредени во редови и колони.',
    topic: 'algebra',
  },
  {
    term: 'детерминанта',
    aliases: ['детерминантата'],
    definition: 'Скаларна вредност асоцирана со квадратна матрица; det(A) = 0 значи матрицата не е инвертибилна.',
    topic: 'algebra',
  },
];

// ─── Lookup ──────────────────────────────────────────────────────────────────

export interface FoundTerm {
  entry: GlossaryEntry;
  /** First match index in the source text (in NFC code-point units). */
  index: number;
  /** Surface form actually matched (preserving case). */
  surface: string;
}

/** Lowercases & normalises Cyrillic / Latin for case-insensitive matching. */
function norm(s: string): string {
  return s.toLowerCase();
}

/**
 * Strip math segments (between $...$) so we don't tag Cyrillic letters that
 * appear inside formulas (rare but defensive).
 */
function stripMath(text: string): string {
  return text.replace(/\$[^$]*\$/g, ' ');
}

/**
 * Find all glossary terms appearing in `text`. Each term is reported once
 * (deduplicated by canonical entry), preserving the order of first occurrence.
 * Longest aliases are preferred to avoid sub-word collisions.
 */
export function findTermsInText(text: string, glossary: GlossaryEntry[] = GLOSSARY): FoundTerm[] {
  if (!text) return [];
  const haystack = stripMath(text);
  const lower = norm(haystack);

  // Build candidate list: { entry, surface, length }, sorted by length desc.
  const candidates: { entry: GlossaryEntry; surface: string }[] = [];
  for (const e of glossary) {
    candidates.push({ entry: e, surface: e.term });
    for (const a of e.aliases ?? []) candidates.push({ entry: e, surface: a });
  }
  candidates.sort((a, b) => b.surface.length - a.surface.length);

  const found = new Map<string, FoundTerm>();
  for (const { entry, surface } of candidates) {
    if (found.has(entry.term)) continue;
    const idx = lower.indexOf(norm(surface));
    if (idx === -1) continue;
    found.set(entry.term, {
      entry,
      index: idx,
      surface: haystack.slice(idx, idx + surface.length),
    });
  }
  return Array.from(found.values()).sort((a, b) => a.index - b.index);
}

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  const n = norm(term);
  return GLOSSARY.find(
    (e) => norm(e.term) === n || (e.aliases ?? []).some((a) => norm(a) === n),
  );
}
