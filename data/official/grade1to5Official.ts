/**
 * Official Primary Mathematics Curriculum — Grades 1 to 5 (First & Second Cycle)
 * Source: Наставна програма — Математика (прв и втор циклус), МОН на Република Македонија
 * 5 hours/week × 36 weeks = 180 hours total per grade
 * Lesson duration: 40 minutes
 *
 * Note: Formal national standard codes (I-А.X, II-А.X) for the first and second cycle
 * are not yet published as official МОН mathematical competency codes.
 * Assessment standards here reflect descriptive learning outcomes from the grade data.
 */

export interface PrimaryOfficialSubtopic {
  themeId: string;
  themeName: string;
  subtopicName: string;
  hours: number;
  concepts: string[];
  assessmentStandards: string[];
  bloomLevels: number[];
}

export interface PrimaryOfficialGrade {
  grade: number;
  gradeTitle: string;
  weeklyHours: number;
  lessonMinutes: number;
  totalHours: number;
  cycle: 'first' | 'second';
  subtopics: PrimaryOfficialSubtopic[];
}

// ── GRADE 1 (180ч) ─────────────────────────────────────────────────────────

const grade1Subtopics: PrimaryOfficialSubtopic[] = [
  {
    themeId: 'g1-off-1',
    themeName: 'Геометрија',
    subtopicName: 'Местоположба, движење и насока',
    hours: 8,
    concepts: ['Просторни поими: горе/долу, лево/десно, пред/зад, блиску/далеку', 'Насоки: лево/десно', 'Движење и насока на движење'],
    assessmentStandards: ['Го опишува положбата на предмети со просторни поими.', 'Го опишува движењето со соодветни поими за насока.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g1-off-1',
    themeName: 'Геометрија',
    subtopicName: '2Д форми',
    hours: 12,
    concepts: ['Квадрат, правоаголник, триаголник, круг — препознавање и именување', 'Карактеристики: страни, агли, темиња', 'Цртање и конструкција со линијар'],
    assessmentStandards: ['Препознава и именува основни 2Д форми.', 'Брои страни и агли на фигури.', 'Цртање основни форми.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g1-off-1',
    themeName: 'Геометрија',
    subtopicName: '3Д форми',
    hours: 8,
    concepts: ['Коцка, правоаголна призма, сфера, цилиндар — препознавање', 'Поврзување со секојдневни предмети', 'Рамни и заоблени површини'],
    assessmentStandards: ['Именува основни 3Д форми.', 'Ги поврзува 3Д форми со секојдневни предмети.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g1-off-1',
    themeName: 'Геометрија',
    subtopicName: 'Симетрија',
    hours: 7,
    concepts: ['Оска на симетрија — препознавање', 'Симетрични фигури', 'Пресовување — практична активност'],
    assessmentStandards: ['Препознава симетрична фигура.', 'Наоѓа оска на симетрија.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g1-off-2',
    themeName: 'Броеви и броење',
    subtopicName: 'Броеви до 30',
    hours: 30,
    concepts: ['Броење до 30 — ред, редослед', 'Читање и запишување броеви до 30', 'Споредување: поголем/помал/еднаков', 'Претходник и следбеник', 'Десетица — поим'],
    assessmentStandards: ['Брои до 30 нанапред и наназад.', 'Чита, запишува и споредува броеви до 30.', 'Одредува претходник и следбеник.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g1-off-2',
    themeName: 'Броеви и броење',
    subtopicName: 'Парни и непарни броеви',
    hours: 10,
    concepts: ['Парни броеви (0,2,4...) и непарни (1,3,5...)', 'Групирање во парови', 'Препознавање по последната цифра'],
    assessmentStandards: ['Разликува парни и непарни броеви.', 'Групира предмети во парови.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g1-off-3',
    themeName: 'Операции со броеви',
    subtopicName: 'Собирање и одземање до 10',
    hours: 25,
    concepts: ['Поим за собирање — споjување множества', 'Поим за одземање — разлика', 'Таблица на собирање и одземање до 10', 'Задачи со зборови — едноставни'],
    assessmentStandards: ['Собира и одзема броеви до 10 автоматски.', 'Решава едноставни задачи со зборови.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g1-off-3',
    themeName: 'Операции со броеви',
    subtopicName: 'Собирање и одземање до 20',
    hours: 30,
    concepts: ['Собирање со премин и без премин преку 10', 'Одземање со позајмување', 'Претставување со апарат и броевна права'],
    assessmentStandards: ['Собира и одзема броеви до 20 со и без премин.', 'Контролира резултат со спротивна операција.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g1-off-3',
    themeName: 'Операции со броеви',
    subtopicName: 'Удвојување и преполовување',
    hours: 10,
    concepts: ['Удвојување: 2×n', 'Преполовување: n÷2', 'Поврзаност на удвојување и преполовување'],
    assessmentStandards: ['Удвојува и преполовува броеви до 20.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g1-off-4',
    themeName: 'Мерење',
    subtopicName: 'Мерење должина, маса, волумен и пари',
    hours: 30,
    concepts: ['Мерење должина: cm, m', 'Мерење маса: kg', 'Мерење волумен: l', 'Пари — монети и банкноти', 'Мерење со неформални единици'],
    assessmentStandards: ['Мери должина, маса и волумен со соодветни алатки.', 'Препознава и брои пари.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g1-off-4',
    themeName: 'Мерење',
    subtopicName: 'Мерење на времето',
    hours: 10,
    concepts: ['Денови во неделата, месеци', 'Часовникот — час и половина', 'Редослед на настани'],
    assessmentStandards: ['Именува денови и месеци.', 'Чита часовникот на цели и полу-часови.'],
    bloomLevels: [1, 2],
  },
];

// ── GRADE 2 (180ч) ─────────────────────────────────────────────────────────

const grade2Subtopics: PrimaryOfficialSubtopic[] = [
  {
    themeId: 'g2-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Броеви до 100',
    hours: 25,
    concepts: ['Читање и запишување до 100', 'Десетичен систем — десетици и единици', 'Споредување и подредување', 'Претходник и следбеник на двоцифрени броеви'],
    assessmentStandards: ['Чита, запишува и споредува броеви до 100.', 'Ги одредува десетиците и единиците.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g2-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Броеви до 1000 (воведно)',
    hours: 15,
    concepts: ['Стотица — поим и броење', 'Запишување троцифрени броеви', 'Месна вредност: стотици, десетици, единици'],
    assessmentStandards: ['Брои до 1000.', 'Запишува и чита троцифрени броеви.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g2-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Собирање и одземање до 100',
    hours: 50,
    concepts: ['Собирање до 100 без и со премин', 'Одземање до 100 без и со позајмување', 'Собирање со три и повеќе собироци', 'Задачи со зборови — еден и два чекора'],
    assessmentStandards: ['Собира и одзема до 100 сигурно и точно.', 'Решава задачи со зборови со 1-2 чекори.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g2-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Множење — воведно',
    hours: 25,
    concepts: ['Множење — повторено собирање', 'Таблица за множење до 5', 'Комутативност на множење'],
    assessmentStandards: ['Ги учи наизуст таблиците до 5.', 'Применува множење во задачи.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g2-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Делење — воведно',
    hours: 20,
    concepts: ['Делење — рамна поделба', 'Врска помеѓу множење и делење', 'Делење без остаток'],
    assessmentStandards: ['Дели едноставни броеви.', 'Го разбира односот множење–делење.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g2-off-3',
    themeName: 'Геометрија',
    subtopicName: '2Д и 3Д форми — повторување и продолжување',
    hours: 20,
    concepts: ['Линија — права, крива, скршена', 'Паралелни и вертикални прави', 'Периметар — броење единици'],
    assessmentStandards: ['Препознава видови линии.', 'Пресметува периметар на едноставни фигури.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g2-off-4',
    themeName: 'Мерење',
    subtopicName: 'Мерење — продолжување',
    hours: 25,
    concepts: ['cm и m — конверзија', 'kg и g — конверзија', 'l и dl — конверзија', 'Пари — сметање до 100 ден.', 'Мерење времето — четврт час'],
    assessmentStandards: ['Конвертира мерни единици.', 'Чита часовникот на четврт-часови.'],
    bloomLevels: [1, 2, 3],
  },
];

// ── GRADE 3 (180ч) ─────────────────────────────────────────────────────────

const grade3Subtopics: PrimaryOfficialSubtopic[] = [
  {
    themeId: 'g3-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Броеви до 10 000',
    hours: 25,
    concepts: ['Четирицифрени броеви — запишување и читање', 'Месна вредност: илјадници, стотици, десетици, единици', 'Споредување и подредување', 'Заокружување на стотица и илјадница'],
    assessmentStandards: ['Чита и запишува броеви до 10 000.', 'Споредува и подредува.', 'Заокружува броеви.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g3-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Собирање и одземање до 1000',
    hours: 35,
    concepts: ['Собирање со премин до 1000', 'Одземање со позајмување до 1000', 'Поврзаност на операциите', 'Задачи со повеќе чекори'],
    assessmentStandards: ['Собира и одзема точно до 1000.', 'Решава задачи со 2-3 чекори.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g3-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Таблица за множење до 10',
    hours: 40,
    concepts: ['Таблица за множење 1-10 — наизустување', 'Множење двоцифрен × едноцифрен', 'Делење со остаток (воведно)', 'Врска множење–делење'],
    assessmentStandards: ['Ги знае наизуст сите таблици до 10.', 'Множи двоцифрен со едноцифрен.', 'Дели со остаток.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g3-off-3',
    themeName: 'Геометрија',
    subtopicName: 'Периметар и плоштина — воведно',
    hours: 30,
    concepts: ['Периметар — формула за правоаголник и квадрат', 'Плоштина — броење единици на квадратна мрежа', 'Единица за плоштина: cm²', 'Конструкции: правоаголник, квадрат'],
    assessmentStandards: ['Пресметува периметар на правоаголник и квадрат.', 'Ги брои единиците плоштина.'],
    bloomLevels: [2, 3],
  },
  {
    themeId: 'g3-off-4',
    themeName: 'Мерење',
    subtopicName: 'Мерење — продолжување',
    hours: 30,
    concepts: ['km и m — конверзија, растојание', 't и kg — конверзија', 'Часовник — минута', 'Пресметување со мерни единици'],
    assessmentStandards: ['Конвертира km↔m, t↔kg.', 'Чита часовникот точно.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g3-off-5',
    themeName: 'Работа со податоци',
    subtopicName: 'Табели и столбести дијаграми',
    hours: 20,
    concepts: ['Читање табели', 'Столбест дијаграм — читање и цртање', 'Прибирање податоци — тура, анкета'],
    assessmentStandards: ['Чита и толкува табели.', 'Цртa столбест дијаграм.'],
    bloomLevels: [1, 2, 3],
  },
];

// ── GRADE 4 (180ч) ─────────────────────────────────────────────────────────

const grade4Subtopics: PrimaryOfficialSubtopic[] = [
  {
    themeId: 'g4-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Броеви до 1 000 000',
    hours: 20,
    concepts: ['Шестоцифрени броеви — читање и запишување', 'Месна вредност до илјадница', 'Sporedba i ureduvanje', 'Заокружување на десетица, стотица, илјадница'],
    assessmentStandards: ['Чита и запишува броеви до 1 000 000.', 'Заокружува на соодветна вредност.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g4-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Вообичаени дропки — воведно',
    hours: 20,
    concepts: ['Дропка — броевник и именувач', 'Правилни, неправилни, мешани дропки', 'Споредување на дропки со ист именувач', 'Еквивалентни дропки'],
    assessmentStandards: ['Запишува и чита дропки.', 'Споредува дропки со ист именувач.'],
    bloomLevels: [1, 2],
  },
  {
    themeId: 'g4-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Четири операции со поголеми броеви',
    hours: 60,
    concepts: ['Собирање и одземање до 1 000 000', 'Множење повеќецифрен × едноцифрен и двоцифрен', 'Делење со едноцифрен делител', 'Редослед на операции — загради'],
    assessmentStandards: ['Точно изведува четири операции.', 'Применува редослед на операции.', 'Решава задачи со повеќе чекори.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g4-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Операции со дропки',
    hours: 20,
    concepts: ['Собирање и одземање дропки со ист именувач', 'Множење дропка × природен број'],
    assessmentStandards: ['Собира и одзема дропки со ист именувач.', 'Множи дропка со природен број.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g4-off-3',
    themeName: 'Геометрија',
    subtopicName: 'Конструкции и плоштина',
    hours: 35,
    concepts: ['Конструкција на паралелни и нормални прави', 'Агли — видови (прав, остар, тап)', 'Плоштина на правоаголник и квадрат — формула', 'Волумен (воведно) — броење коцки'],
    assessmentStandards: ['Конструира паралелни и нормални прави.', 'Пресметува плоштина со формула.'],
    bloomLevels: [2, 3],
  },
  {
    themeId: 'g4-off-4',
    themeName: 'Мерење',
    subtopicName: 'Мерење — напредно',
    hours: 25,
    concepts: ['Единици за должина — mm, cm, dm, m, km', 'Единици за маса — mg, g, kg, t', 'Единици за волумен — ml, dl, l', 'Пресметување пари до 1000 ден.'],
    assessmentStandards: ['Конвертира меѓу сите мерни единици.', 'Решава задачи со мерење.'],
    bloomLevels: [1, 2, 3],
  },
];

// ── GRADE 5 (180ч) ─────────────────────────────────────────────────────────

const grade5Subtopics: PrimaryOfficialSubtopic[] = [
  {
    themeId: 'g5-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Природни броеви до 1 000 000 и негативни броеви',
    hours: 20,
    concepts: ['Броеви до 1 000 000 — повторување и надградба', 'Негативни броеви — поим, примери, бројна права', 'Цели броеви — Z', 'Споредување и подредување'],
    assessmentStandards: ['Ракува со природни броеви до 1 000 000.', 'Употребува негативни броеви во контекст (температура, долг).'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g5-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Дропки и децимални броеви',
    hours: 30,
    concepts: ['Дропки — операции со различен именувач', 'НЗС и НЗД', 'Децимален запис — десетини, стотини, илјадини', 'Конверзија дропка ↔ децимал', 'Споредување и подредување'],
    assessmentStandards: ['Собира и одзема дропки со различен именувач.', 'Конвертира меѓу дропки и децимали.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g5-off-1',
    themeName: 'Броеви и броење',
    subtopicName: 'Проценти',
    hours: 15,
    concepts: ['Процент — поим, врска со дропка и децимал', 'Пресметување: дел, цел, процент', 'Зголемување/намалување за процент', 'Практична примена'],
    assessmentStandards: ['Пресметува проценти во практични ситуации.', 'Претвора помеѓу процент, дропка и децимал.'],
    bloomLevels: [2, 3, 4],
  },
  {
    themeId: 'g5-off-2',
    themeName: 'Операции со броеви',
    subtopicName: 'Четири операции со сите видови броеви',
    hours: 50,
    concepts: ['Четири операции со дропки', 'Четири операции со децимали', 'Редослед на операции — загради, степен', 'Задачи со 3-4 чекори'],
    assessmentStandards: ['Точно изведува операции со дропки и децимали.', 'Применува редослед на операции.', 'Решава сложени задачи со зборови.'],
    bloomLevels: [1, 2, 3, 4],
  },
  {
    themeId: 'g5-off-3',
    themeName: 'Геометрија',
    subtopicName: 'Прави, агли и 2Д форми',
    hours: 30,
    concepts: ['Агли — мерење со протрактор', 'Триаголник — збир на агли 180°', 'Четириаголници — видови и карактеристики', 'Кружница — радиус, диjаметар', 'Правилни многуаголници'],
    assessmentStandards: ['Мери агли со протрактор.', 'Класифицира триаголници и четириаголници.', 'Цртa кружница со шестар.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g5-off-3',
    themeName: 'Геометрија',
    subtopicName: '3Д форми и координати',
    hours: 20,
    concepts: ['Мрежа на куб и правоаголна призма', 'Координатен систем — I квадрант', 'Означување точки во координатна рамнина'],
    assessmentStandards: ['Цртa мрежа на куб.', 'Ги означува и чита координати.'],
    bloomLevels: [1, 2, 3],
  },
  {
    themeId: 'g5-off-4',
    themeName: 'Мерење',
    subtopicName: 'Плоштина, периметар и волумен',
    hours: 15,
    concepts: ['Плоштина на триаголник (формула)', 'Плоштина и обем на кружница — π', 'Волумен на куб и правоаголна призма'],
    assessmentStandards: ['Пресметува плоштина на триаголник и кружница.', 'Пресметува волумен на куб и призма.'],
    bloomLevels: [2, 3],
  },
];

// ── Exported grade objects ────────────────────────────────────────────────────

export const GRADE1_PRIMARY_OFFICIAL: PrimaryOfficialGrade = {
  grade: 1,
  gradeTitle: 'I (прво) Одделение',
  weeklyHours: 5,
  lessonMinutes: 40,
  totalHours: 180,
  cycle: 'first',
  subtopics: grade1Subtopics,
};

export const GRADE2_PRIMARY_OFFICIAL: PrimaryOfficialGrade = {
  grade: 2,
  gradeTitle: 'II (второ) Одделение',
  weeklyHours: 5,
  lessonMinutes: 40,
  totalHours: 180,
  cycle: 'first',
  subtopics: grade2Subtopics,
};

export const GRADE3_PRIMARY_OFFICIAL: PrimaryOfficialGrade = {
  grade: 3,
  gradeTitle: 'III (трето) Одделение',
  weeklyHours: 5,
  lessonMinutes: 40,
  totalHours: 180,
  cycle: 'first',
  subtopics: grade3Subtopics,
};

export const GRADE4_PRIMARY_OFFICIAL: PrimaryOfficialGrade = {
  grade: 4,
  gradeTitle: 'IV (четврто) Одделение',
  weeklyHours: 5,
  lessonMinutes: 40,
  totalHours: 180,
  cycle: 'second',
  subtopics: grade4Subtopics,
};

export const GRADE5_PRIMARY_OFFICIAL: PrimaryOfficialGrade = {
  grade: 5,
  gradeTitle: 'V (петто) Одделение',
  weeklyHours: 5,
  lessonMinutes: 40,
  totalHours: 180,
  cycle: 'second',
  subtopics: grade5Subtopics,
};

export const PRIMARY_OFFICIAL_BY_GRADE: Record<number, PrimaryOfficialGrade> = {
  1: GRADE1_PRIMARY_OFFICIAL,
  2: GRADE2_PRIMARY_OFFICIAL,
  3: GRADE3_PRIMARY_OFFICIAL,
  4: GRADE4_PRIMARY_OFFICIAL,
  5: GRADE5_PRIMARY_OFFICIAL,
};

/** Build AI context string for a primary grade (matching grade6 helper format). */
export function buildPrimaryContext(grade: PrimaryOfficialGrade): string {
  const themes = new Map<string, PrimaryOfficialSubtopic[]>();
  for (const s of grade.subtopics) {
    if (!themes.has(s.themeName)) themes.set(s.themeName, []);
    themes.get(s.themeName)!.push(s);
  }
  let ctx = `Одделение: ${grade.gradeTitle} | ${grade.weeklyHours}ч/нед × 36 нед = ${grade.totalHours}ч | ${grade.lessonMinutes}мин/час`;
  for (const [theme, subs] of themes) {
    const totalHours = subs.reduce((acc, s) => acc + s.hours, 0);
    ctx += `\n▪ ${theme} (вкупно ${totalHours}ч)`;
    for (const s of subs) {
      ctx += `\n  – ${s.subtopicName} (${s.hours}ч): ${s.concepts.slice(0, 2).join('; ')}`;
    }
  }
  return ctx;
}
