/**
 * Проверува дали два математички изрази се еквивалентни.
 * Работи за дропки (пр. 2/4 == 1/2 == 0.5) и основни алгебарски изрази (x+x == 2x).
 */
export const checkMathEquivalence = (studentAnswer: string, correctAnswer: string): boolean => {
  if (!studentAnswer || !correctAnswer) return false;

  const normStudent = normalize(studentAnswer);
  const normCorrect = normalize(correctAnswer);

  // 1. Точно совпаѓање (најбрзо)
  if (normStudent === normCorrect) return true;

  // 2) Нумеричка евалуација (дропки/децимали)
  const evalStudent = safeEvalNumeric(normStudent);
  const evalCorrect = safeEvalNumeric(normCorrect);
  if (evalStudent !== null && evalCorrect !== null && nearlyEqual(evalStudent, evalCorrect)) {
    return true;
  }

  // 3) Основна алгебарска проверка за изрази со x преку повеќе sample точки.
  if (containsOnlyXVariable(normStudent) && containsOnlyXVariable(normCorrect)) {
    if (equivalentBySampling(normStudent, normCorrect)) {
      return true;
    }
  }

  return false;
};

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/−/g, '-')
    .replace(/,/g, '.');

const nearlyEqual = (a: number, b: number, eps = 1e-7): boolean => Math.abs(a - b) < eps;

const safeEvalNumeric = (expr: string): number | null => {
  if (!expr) return null;
  if (!/^[0-9+\-*/().\s^]+$/.test(expr)) return null;

  const prepared = expr.replace(/\^/g, '**');
  try {
    const result = Function(`"use strict"; return (${prepared});`)();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

const containsOnlyXVariable = (expr: string): boolean => {
  const vars = expr.match(/[a-z]+/g);
  if (!vars) return false;
  return vars.every((v) => v === 'x');
};

const prepareXExpression = (expr: string): string => {
  // Поддршка за имплицитно множење: 2x, x(, )x, )( -> 2*x, x*(, )*x, )*(
  return expr
    .replace(/\s+/g, '')
    .replace(/\^/g, '**')
    .replace(/(\d)(x)/g, '$1*$2')
    .replace(/(x)(\d)/g, '$1*$2')
    .replace(/(x)\(/g, '$1*(')
    .replace(/\)(x)/g, ')*$1')
    .replace(/\)\(/g, ')*(');
};

const safeEvalWithX = (expr: string, x: number): number | null => {
  if (!/^[0-9x+\-*/().\s^]+$/.test(expr)) return null;

  const prepared = prepareXExpression(expr).replace(/x/g, `(${x})`);
  try {
    const result = Function(`"use strict"; return (${prepared});`)();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

const equivalentBySampling = (leftExpr: string, rightExpr: string): boolean => {
  const samples = [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3];
  let comparablePoints = 0;

  for (const x of samples) {
    const l = safeEvalWithX(leftExpr, x);
    const r = safeEvalWithX(rightExpr, x);
    if (l === null || r === null) continue;
    comparablePoints++;
    if (!nearlyEqual(l, r, 1e-6)) return false;
  }

  return comparablePoints >= 3;
};
