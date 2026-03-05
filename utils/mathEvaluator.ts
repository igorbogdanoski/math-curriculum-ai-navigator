import { evaluate, simplify } from 'mathjs';

/**
 * Проверува дали два математички изрази се еквивалентни.
 * Работи за дропки (пр. 2/4 == 1/2 == 0.5) и основни алгебарски изрази (x+x == 2x).
 */
export const checkMathEquivalence = (studentAnswer: string, correctAnswer: string): boolean => {
  if (!studentAnswer || !correctAnswer) return false;

  const normStudent = studentAnswer.trim().toLowerCase();
  const normCorrect = correctAnswer.trim().toLowerCase();

  // 1. Точно совпаѓање (најбрзо)
  if (normStudent === normCorrect) return true;

  try {
    // 2. Нумеричка евалуација (за дропки и децимали)
    // evaluate() ги пресметува изразите во бројки, пр: "1/2" -> 0.5
    const evalStudent = evaluate(normStudent);
    const evalCorrect = evaluate(normCorrect);

    if (typeof evalStudent === 'number' && typeof evalCorrect === 'number') {
      // Споредба со толеранција за floating-point грешки (пр. 0.3333333)
      if (Math.abs(evalStudent - evalCorrect) < 1e-7) {
        return true;
      }
    }
  } catch (error) {
    // Ако не може да се евалуира како број, продолжуваме кон алгебра
  }

  try {
    // 3. Алгебарско поедноставување (за изрази со променливи)
    // simplify() сведува изрази: "x + x" -> "2 * x"
    const simpStudent = simplify(normStudent).toString();
    const simpCorrect = simplify(normCorrect).toString();

    // Отстрануваме празни места за директна споредба на нормализираните стрингови
    if (simpStudent.replace(/\s+/g, '') === simpCorrect.replace(/\s+/g, '')) {
      return true;
    }
  } catch (error) {
     // Игнорираме грешки при парсирање (пр. некомплетни изрази)
  }

  return false;
};
