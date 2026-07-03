import { type LabExEntry, type LabExercise, shufflePool } from '../../types/labTypes';

// POOL1 — Основно (VII одделение)
const GEO3D_POOL1: LabExEntry[] = [
  { question: 'Колку лица има куба?', type: 'numeric', correctAnswer: '6',
    hint: 'Куба = хексаедар = 6 квадратни лица', explanation: 'Куба има 6 лица', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Колку темиња има тетраедар?', type: 'numeric', correctAnswer: '4',
    hint: 'Тетра- = 4; 4 триаголни лица → 4 темиња', explanation: '4 темиња', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'V − E + F = ? (Ојлер)', type: 'numeric', correctAnswer: '2',
    hint: 'Ојлерова формула важи за сите конвексни полиедри', explanation: 'V − E + F = 2 (Ојлер)', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Куба: V=8, F=6. E = ?', type: 'numeric', correctAnswer: '12',
    hint: 'V−E+F=2 → 8−E+6=2 → E=12', explanation: '8 − E + 6 = 2 → E = 12', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Волуменот на куба со страна a=3: V = ?', type: 'numeric', correctAnswer: '27',
    hint: 'V = a³ = 3³ = 27', explanation: 'V = 3³ = 27', difficulty: 1, curriculumRef: 'МОН VII' },
  { question: 'Тетраедарот е...', type: 'multiple_choice',
    options: ['Платонско тело', 'Архимедско тело', 'Призма', 'Антипризма'],
    correctAnswer: 'Платонско тело', hint: '5-те Платонски тела се: тетра, куба, окта, додека, икоса',
    explanation: 'Тетраедарот е едно од 5-те Платонски тела.', difficulty: 1, curriculumRef: 'МОН VII' },
];

// POOL2 — Средно (IX одделение / Гимназија I)
const GEO3D_POOL2: LabExEntry[] = [
  { question: 'Октаедар: V=6, E=12. F = ?', type: 'numeric', correctAnswer: '8',
    hint: 'V−E+F=2 → 6−12+F=2 → F=8', explanation: '6 − 12 + F = 2 → F = 8', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Призма со n=5: колку F (лица)?', type: 'numeric', correctAnswer: '7',
    hint: '2 бази + 5 бочни = 7 лица', explanation: 'n+2 = 5+2 = 7 лица', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Четириаголна пирамида: V = a²h/3, a=3, h=4. V = ?', type: 'numeric', correctAnswer: '12',
    hint: 'V = (9 × 4) / 3 = 36/3 = 12', explanation: 'V = 3²·4/3 = 12', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Дуален полиедар на кубата е?', type: 'multiple_choice',
    options: ['Октаедар', 'Тетраедар', 'Икосаедар', 'Додекаедар'],
    correctAnswer: 'Октаедар', hint: 'Замени V↔F: куба (8V,12E,6F) ↔ окта (6V,12E,8F)',
    explanation: 'Кубата и октаедарот се дуални.', difficulty: 2, curriculumRef: 'Гимн. I год.' },
  { question: 'Цилиндар r=2, h=5: V = ?', type: 'multiple_choice',
    options: ['20π', '10π', '4π', '40π'],
    correctAnswer: '20π', hint: 'V = πr²h = π·4·5 = 20π',
    explanation: 'V = π·2²·5 = 20π', difficulty: 2, curriculumRef: 'МОН IX' },
  { question: 'Икосаедарот има колку триаголни лица?', type: 'numeric', correctAnswer: '20',
    hint: 'Икоса- = 20; сите лица се еднакви страноеднакви триаголници',
    explanation: '20 триаголни лица', difficulty: 2, curriculumRef: 'МОН IX' },
];

// POOL3 — Напредно (Гимназија XI–XII)
const GEO3D_POOL3: LabExEntry[] = [
  { question: 'Ојлер χ(сфера) = V−E+F = ? (Платонски ↔ сфера)', type: 'numeric', correctAnswer: '2',
    hint: 'Сите конвексни полиедри тополошки ≅ сфера → χ=2',
    explanation: 'Ојлерова карактеристика χ = 2 за сфера', difficulty: 3, curriculumRef: 'Гимн. XI изборен' },
  { question: 'Додекаедарот и икосаедарот се дуали. Ако додека: V=20,E=30,F=12, тогаш икоса: V=?', type: 'numeric', correctAnswer: '12',
    hint: 'При дуалност V↔F: икосаедар V = додека F = 12',
    explanation: 'Икосаедар: V=12, E=30, F=20', difficulty: 3, curriculumRef: 'Гимн. XI изборен' },
  { question: 'Сфера r=3: S = ?', type: 'multiple_choice',
    options: ['36π', '12π', '9π', '18π'],
    correctAnswer: '36π', hint: 'S = 4πr² = 4π·9 = 36π',
    explanation: 'S = 4π·3² = 36π', difficulty: 3, curriculumRef: 'Гимн. I год.' },
  { question: 'Конус r=3, h=4: изводница l = ?', type: 'numeric', correctAnswer: '5',
    hint: 'l = √(r²+h²) = √(9+16) = √25 = 5',
    explanation: 'l = √(9+16) = 5 (Питагорова тројка 3-4-5)', difficulty: 3, curriculumRef: 'Гимн. I год.' },
  { question: 'Хоризонтален пресек на конус = ? (отсекок под аголот на конусот)', type: 'multiple_choice',
    options: ['Круг', 'Елипса', 'Парабола', 'Хипербола'],
    correctAnswer: 'Круг', hint: 'Хоризонталниот пресек е паралелен со основата → секогаш круг',
    explanation: 'Хоризонтален пресек на конус = круг', difficulty: 3, curriculumRef: 'Гимн. II год.' },
  { question: 'Колку правилни полиедри (Платонски тела) постојат?', type: 'numeric', correctAnswer: '5',
    hint: 'Докажано од Ојлер: точно 5 — тетра, куба, окта, додека, икоса',
    explanation: '5 Платонски тела — докажано дека постојат точно 5', difficulty: 3, curriculumRef: 'Гимн. XI изборен' },
];

export function generateGeo3DSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const pool = difficulty === 1 ? GEO3D_POOL1 : difficulty === 2 ? GEO3D_POOL2 : GEO3D_POOL3;
  return shufflePool(pool).slice(0, count).map((e, i) => ({ id: `geo3d-${difficulty}-${i}`, ...e }));
}
