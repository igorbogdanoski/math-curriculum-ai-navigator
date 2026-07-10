// Pure math utilities for the Fractions lab (bar model, circle model, number line)
import type { LabExercise } from '../../types/labTypes';
import { gcd } from './numberTheoryMath';

export interface Fraction {
  num: number;
  den: number;
}

/** Reduces a fraction to lowest terms. den must be > 0. */
export function simplifyFraction(f: Fraction): Fraction {
  if (f.num === 0) return { num: 0, den: 1 };
  const g = gcd(Math.abs(f.num), Math.abs(f.den));
  return { num: f.num / g, den: f.den / g };
}

export function toDecimal(f: Fraction): number {
  return f.num / f.den;
}

export function fractionToString(f: Fraction): string {
  return `${f.num}/${f.den}`;
}

/** -1 if a < b, 0 if equal, 1 if a > b (compares via cross-multiplication, no float rounding). */
export function compareFractions(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const left = a.num * b.den;
  const right = b.num * a.den;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Adds two fractions (any denominators) and simplifies the result. */
export function addFractions(a: Fraction, b: Fraction): Fraction {
  return simplifyFraction({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
}

/** Converts an improper fraction to a mixed-number pair (whole, remainder-as-Fraction). */
export function toMixedNumber(f: Fraction): { whole: number; remainder: Fraction } {
  const whole = Math.floor(f.num / f.den);
  return { whole, remainder: simplifyFraction({ num: f.num - whole * f.den, den: f.den }) };
}

/** Converts a mixed number back to an improper fraction. */
export function fromMixedNumber(whole: number, remainder: Fraction): Fraction {
  return { num: whole * remainder.den + remainder.num, den: remainder.den };
}

// ─── Grade bands ────────────────────────────────────────────────────────────

export type FractionGradeRange = 'g3' | 'g4' | 'g5' | 'g6';

export interface FractionGradeConfig {
  label: string;
  maxDenominator: number;
  allowMixed: boolean;
  curriculumRef: string;
  description: string;
}

export const GRADE_CONFIGS: Record<FractionGradeRange, FractionGradeConfig> = {
  g3: { label: 'III одд.', maxDenominator: 4,  allowMixed: false, curriculumRef: 'МОН III одд.', description: 'Запознавање со дропки (половина, третина, четвртина)' },
  g4: { label: 'IV одд.',  maxDenominator: 6,  allowMixed: false, curriculumRef: 'МОН IV одд.',  description: 'Читање, запишување и споредба на дропки' },
  g5: { label: 'V одд.',   maxDenominator: 10, allowMixed: false, curriculumRef: 'МОН V одд.',   description: 'Собирање дропки со ист именител, скратување' },
  g6: { label: 'VI одд.',  maxDenominator: 12, allowMixed: true,  curriculumRef: 'МОН VI одд.',  description: 'Мешани броеви, различни именители, децимален запис' },
};

function fRand(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Random proper fraction (0 < num < den) with den in [2, maxDen]. */
export function randomProperFraction(maxDen: number): Fraction {
  const den = fRand(2, maxDen);
  const num = fRand(1, den - 1);
  return { num, den };
}

// ─── Lab exercise generator ───────────────────────────────────────────────────

/** Generates fraction exercises for use with useLabSession. */
export function generateFractionsSet(
  grade: FractionGradeRange,
  difficulty: 1 | 2 | 3,
  count = 6,
): LabExercise[] {
  const cfg = GRADE_CONFIGS[grade];
  const cur = cfg.curriculumRef;
  const exs: LabExercise[] = [];

  for (let i = 0; i < count; i++) {
    const id = `fr-${grade}-${difficulty}-${i}`;
    const qType = i % 3;

    if (difficulty === 1) {
      if (qType === 0) {
        // Identify the fraction shown by a shaded bar/circle
        const f = randomProperFraction(cfg.maxDenominator);
        const distractors = new Set<string>([fractionToString(f)]);
        while (distractors.size < 4) {
          const alt = randomProperFraction(cfg.maxDenominator);
          distractors.add(fractionToString(alt));
        }
        exs.push({
          id,
          question: `Правоаголникот е поделен на ${f.den} еднакви делови и ${f.num} се засенчени. Која дропка го прикажува засенчениот дел?`,
          type: 'multiple_choice',
          options: [...distractors].sort(() => Math.random() - 0.5),
          correctAnswer: fractionToString(f),
          hint: `Бројот на засенчени делови е броителот, вкупниот број делови е именителот.`,
          explanation: `${f.num} од ${f.den} делови = ${fractionToString(f)}`,
          difficulty: 1, curriculumRef: cur,
        });
      } else if (qType === 1) {
        // Equivalent fraction (multiply num/den by the same factor)
        const base = randomProperFraction(Math.min(cfg.maxDenominator, 6));
        const factor = fRand(2, 3);
        const equiv: Fraction = { num: base.num * factor, den: base.den * factor };
        const wrong1: Fraction = { num: base.num * factor + 1, den: base.den * factor };
        const wrong2: Fraction = { num: base.num, den: base.den * factor };
        const options = [equiv, wrong1, wrong2].map(fractionToString).filter((o, idx, a) => a.indexOf(o) === idx);
        if (!options.includes(fractionToString(equiv))) options[0] = fractionToString(equiv);
        exs.push({
          id,
          question: `Која дропка е еднаква на ${fractionToString(base)}?`,
          type: 'multiple_choice',
          options: [...options].sort(() => Math.random() - 0.5),
          correctAnswer: fractionToString(equiv),
          hint: `Помножи го и броителот и именителот со истиот број.`,
          explanation: `${fractionToString(base)} = ${base.num}×${factor} / ${base.den}×${factor} = ${fractionToString(equiv)}`,
          difficulty: 1, curriculumRef: cur,
        });
      } else {
        // Simplify to lowest terms
        const factor = fRand(2, 3);
        const simplified = randomProperFraction(Math.min(cfg.maxDenominator, 5));
        const unsimplified: Fraction = { num: simplified.num * factor, den: simplified.den * factor };
        exs.push({
          id,
          question: `Скрати ја дропката ${fractionToString(unsimplified)} до најмала можна форма.`,
          type: 'fill_blank',
          correctAnswer: fractionToString(simplified),
          hint: `Најди го НЗД на ${unsimplified.num} и ${unsimplified.den}, па подели ги двата.`,
          explanation: `${fractionToString(unsimplified)} = ${fractionToString(simplified)}`,
          difficulty: 1, curriculumRef: cur,
        });
      }
    } else if (difficulty === 2) {
      if (qType === 0) {
        // Compare two fractions
        const a = randomProperFraction(cfg.maxDenominator);
        const b = randomProperFraction(cfg.maxDenominator);
        const cmp = compareFractions(a, b);
        const symbol = cmp < 0 ? '<' : cmp > 0 ? '>' : '=';
        exs.push({
          id,
          question: `Спореди: ${fractionToString(a)} __ ${fractionToString(b)}`,
          type: 'multiple_choice',
          options: ['<', '>', '='],
          correctAnswer: symbol,
          hint: `Доведи ги на заеднички именител или спореди ги decimalните вредности.`,
          explanation: `${fractionToString(a)} = ${toDecimal(a).toFixed(2)}, ${fractionToString(b)} = ${toDecimal(b).toFixed(2)} → ${fractionToString(a)} ${symbol} ${fractionToString(b)}`,
          difficulty: 2, curriculumRef: cur,
        });
      } else if (qType === 1) {
        // Add two same-denominator fractions
        const den = fRand(3, cfg.maxDenominator);
        const numA = fRand(1, den - 1);
        const numB = fRand(1, den - numA);
        const sum = simplifyFraction({ num: numA + numB, den });
        exs.push({
          id,
          question: `${numA}/${den} + ${numB}/${den} = ?`,
          type: 'fill_blank',
          correctAnswer: fractionToString(sum),
          hint: `Собери ги броителите, именителот останува ист.`,
          explanation: `${numA}/${den} + ${numB}/${den} = ${numA + numB}/${den} = ${fractionToString(sum)}`,
          difficulty: 2, curriculumRef: cur,
        });
      } else {
        // Fraction → decimal
        const denPool = [2, 4, 5, 10];
        const den = denPool[fRand(0, denPool.length - 1)];
        const num = fRand(1, den - 1);
        const f: Fraction = { num, den };
        const dec = toDecimal(f);
        exs.push({
          id,
          question: `Колку изнесува ${fractionToString(f)} како децимален број?`,
          type: 'numeric',
          correctAnswer: String(dec),
          hint: `Подели: ${num} ÷ ${den}`,
          explanation: `${fractionToString(f)} = ${num} ÷ ${den} = ${dec}`,
          difficulty: 2, curriculumRef: cur,
        });
      }
    } else {
      // difficulty 3
      if (qType === 0 && cfg.allowMixed) {
        // Mixed number → improper fraction
        const den = fRand(2, cfg.maxDenominator);
        const whole = fRand(1, 3);
        const rem: Fraction = { num: fRand(1, den - 1), den };
        const improper = fromMixedNumber(whole, rem);
        exs.push({
          id,
          question: `Претвори го мешаниот број ${whole} ${fractionToString(rem)} во неправилна дропка.`,
          type: 'fill_blank',
          correctAnswer: fractionToString(improper),
          hint: `Помножи го целиот број со именителот и додај го броителот: ${whole}×${den} + ${rem.num}`,
          explanation: `${whole} ${fractionToString(rem)} = (${whole}×${den} + ${rem.num})/${den} = ${fractionToString(improper)}`,
          difficulty: 3, curriculumRef: cur,
        });
      } else if (qType === 0) {
        // Simplify a harder fraction (grades without mixed numbers yet)
        const factor = fRand(2, 4);
        const simplified = randomProperFraction(Math.min(cfg.maxDenominator, 5));
        const unsimplified: Fraction = { num: simplified.num * factor, den: simplified.den * factor };
        exs.push({
          id,
          question: `Скрати ја дропката ${fractionToString(unsimplified)} до најмала можна форма.`,
          type: 'fill_blank',
          correctAnswer: fractionToString(simplified),
          hint: `Најди го НЗД на ${unsimplified.num} и ${unsimplified.den}.`,
          explanation: `${fractionToString(unsimplified)} = ${fractionToString(simplified)}`,
          difficulty: 3, curriculumRef: cur,
        });
      } else if (qType === 1) {
        // Add two fractions where one denominator divides the other
        const smallDen = fRand(2, Math.max(2, Math.floor(cfg.maxDenominator / 2)));
        const bigDen = smallDen * fRand(2, 3);
        const a: Fraction = { num: fRand(1, smallDen - 1), den: smallDen };
        const b: Fraction = { num: fRand(1, bigDen - 1), den: bigDen };
        const sum = addFractions(a, b);
        exs.push({
          id,
          question: `${fractionToString(a)} + ${fractionToString(b)} = ?`,
          type: 'fill_blank',
          correctAnswer: fractionToString(sum),
          hint: `Доведи ги на заеднички именител ${bigDen} пред да собереш.`,
          explanation: `${fractionToString(a)} = ${a.num * (bigDen / smallDen)}/${bigDen}. Собери: (${a.num * (bigDen / smallDen)} + ${b.num})/${bigDen} = ${fractionToString(sum)}`,
          difficulty: 3, curriculumRef: cur,
        });
      } else {
        // Fraction → decimal (harder denominators)
        const denPool = [5, 8, 10, 20, 25];
        const den = denPool[fRand(0, denPool.length - 1)];
        const num = fRand(1, den - 1);
        const f: Fraction = { num, den };
        const dec = toDecimal(f);
        exs.push({
          id,
          question: `Колку изнесува ${fractionToString(f)} како децимален број?`,
          type: 'numeric',
          correctAnswer: String(dec),
          hint: `Подели: ${num} ÷ ${den}`,
          explanation: `${fractionToString(f)} = ${num} ÷ ${den} = ${dec}`,
          difficulty: 3, curriculumRef: cur,
        });
      }
    }
  }
  return exs;
}
