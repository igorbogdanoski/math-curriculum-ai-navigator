export interface GradeInfo {
  grade: 1 | 2 | 3 | 4 | 5;
  label: string;      // 'Одличен', 'Многу добар', 'Добар', 'Задоволителен', 'Недоволен'
  bgClass: string;    // Tailwind bg-*
  textClass: string;  // Tailwind text-*
}

/**
 * Converts a percentage score to a Macedonian school grade (1–5).
 * Standard MK scale: 5≥90% | 4=75–89% | 3=60–74% | 2=50–59% | 1<50%
 */
export function pctToGrade(pct: number): GradeInfo {
  if (pct >= 90) return { grade: 5, label: 'Одличен',       bgClass: 'bg-green-100',  textClass: 'text-green-800'  };
  if (pct >= 75) return { grade: 4, label: 'Многу добар',   bgClass: 'bg-blue-100',   textClass: 'text-blue-800'   };
  if (pct >= 60) return { grade: 3, label: 'Добар',         bgClass: 'bg-yellow-100', textClass: 'text-yellow-800' };
  if (pct >= 50) return { grade: 2, label: 'Задоволителен', bgClass: 'bg-orange-100', textClass: 'text-orange-800' };
  return           { grade: 1, label: 'Недоволен',          bgClass: 'bg-red-100',    textClass: 'text-red-800'    };
}
