/**
 * Golden-set spot-check for the 2026-07-04 correctAnswer backfill
 * (scripts/backfill-matura-correct-answers.mjs).
 *
 * This is the one correctness-sensitive item in the whole matura backfill —
 * a wrong extracted answer would silently mis-grade real student practice.
 * The extraction is deterministic (regex on an explicit ∴/\therefore marker,
 * no AI call), and this golden set hand-verifies the actual mathematics of
 * a diverse sample (algebra, geometry, trigonometry, numbers) drawn from
 * data/matura/raw/internal-matura-bank-gymnasium-mk.json before trusting the
 * unattended extraction across all 188 candidates.
 */
import { describe, it, expect } from 'vitest';
import { extractFinalAnswer } from '../backfill-matura-correct-answers.mjs';

describe('extractFinalAnswer — golden set (hand-verified math)', () => {
  const cases: { name: string; solution: string; expected: string }[] = [
    {
      name: 'rectangle perimeter from ratio + area',
      solution: 'Чекор 1: $a=3k, b=7k$.\nЧекор 2: $756=21k^2 \\Rightarrow k=6$.\nЧекор 3: $a=18, b=42$.\n∴ $L = 120\\,cm$',
      expected: '$L = 120\\,cm$',
    },
    {
      name: 'cube volume',
      solution: 'Чекор 1: $V = a^3$.\nЧекор 2: $V = 3^3 = 27$.\n∴ $V = 27\\text{ cm}^3$',
      expected: '$V = 27\\text{ cm}^3$',
    },
    {
      name: 'power simplification (a^10)',
      solution: 'Чекор 1: $(a \\cdot a^3)^4 = a^{16}$.\nЧекор 2: $a^{16} / a^6 = a^{10}$.\n∴ $a^{10}$',
      expected: '$a^{10}$',
    },
    {
      name: 'parameter for no-solution linear equation',
      solution: 'Чекор 1: $(m-2)x=4$ нема решение кога $m-2=0$.\n∴ $m = 2$',
      expected: '$m = 2$',
    },
    {
      name: 'cone axial section perimeter + lateral area (two-part answer)',
      solution: 'Чекор 1: слант $l=\\sqrt{5^2+12^2}=13$.\nЧекор 2: периметар $=10+2\\cdot13=36$.\nЧекор 3: бочна плоштина $=\\pi \\cdot 5 \\cdot 13=65\\pi$.\n∴ а) $36\\,cm$; б) $65\\pi\\,cm^2$.',
      expected: 'а) $36\\,cm$; б) $65\\pi\\,cm^2$.',
    },
    {
      name: 'trig identity using complementary angles (cos23=sin67)',
      solution: 'Чекор 1: $\\cos 23° = \\sin 67°$.\nЧекор 2: $(3s-s)/(5s+3s) = 2s/8s$.\n∴ Вредноста на изразот е $0,25$.',
      expected: 'Вредноста на изразот е $0,25$.',
    },
    {
      name: 'rational fraction simplification',
      solution: 'Чекор 1: $x^3-4x = x(x-2)(x+2)$.\nЧекор 2: $x^2-x-6=(x-3)(x+2)$.\n∴ $\\frac{x^2 - 2x}{x - 3}$',
      expected: '$\\frac{x^2 - 2x}{x - 3}$',
    },
    {
      name: 'x/y intercepts of a linear function (multi-part with \\therefore)',
      solution: 'Чекор 1: $y=0 \\Rightarrow x=2$.\nЧекор 2: $x=0 \\Rightarrow y=-8$.\n$\\therefore$ А. $M(2, 0)$; Б. $N(0, -8)$.',
      expected: 'А. $M(2, 0)$; Б. $N(0, -8)$.',
    },
    {
      name: 'mixed-number arithmetic',
      solution: 'Чекор 1: $5/6 + 11/8 = 20/24 + 33/24 = 53/24$.\n∴ $2\\frac{5}{24}$ (или $\\frac{53}{24}$)',
      expected: '$2\\frac{5}{24}$ (или $\\frac{53}{24}$)',
    },
    {
      name: 'numeric evaluation of nested fraction',
      solution: 'Чекор 1: броител $=3.75$.\nЧекор 2: именител $=0.15$.\n∴ 25',
      expected: '25',
    },
  ];

  it.each(cases)('$name', ({ solution, expected }) => {
    expect(extractFinalAnswer(solution)).toBe(expected);
  });

  it('returns null when no ∴/therefore marker is present (does not guess)', () => {
    const truncated = 'Чекор 1: нека $a=3k$.\nЧекор 2: составуваме равенка... $y - y_M = k(x - x';
    expect(extractFinalAnswer(truncated)).toBeNull();
  });

  it('returns null for empty/missing solutions', () => {
    expect(extractFinalAnswer('')).toBeNull();
    expect(extractFinalAnswer(null as unknown as string)).toBeNull();
  });
});
