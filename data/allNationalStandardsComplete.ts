/**
 * Национални стандарди за постигањата на учениците на крајот од основното образование
 * Сите 8 подрачја — 252 стандарди (знаења/вештини + ставови/вредности)
 *
 * Извор: Биро за развој на образованието (БРО) / МОН на Република Македонија
 * Официјален документ: „Национални стандарди за постигањата на учениците
 *   на крајот од основното образование" — важат за крај на 9. одделение
 *
 * Структура: 8 подрачја × (знаења_и_вештини + ставови_и_вредности)
 * Шифри: I-A.x / I-Б.x (Јазична), II-A.x / II-Б.x (Странски јазик),
 *         III-А.x (Математика, x=1-27) / III-A.x (Природни науки, x=28-38+) / III-Б.x
 *         IV-A.x / IV-Б.x (Дигитална), V-A.x / V-Б.x (Личен/социјален),
 *         VI-А.x / VI-Б.x (Општество), VII-A.x / VII-Б.x (Техника),
 *         VIII-A.x / VIII-Б.x (Уметност)
 *
 * Cross-curricular mapping: Математиката поврзува со сите 8 подрачја —
 * вградено во MathCrossLinks за секој стандард.
 */

export type StandardCategory = 'knowledge' | 'attitude';
export type SubjectArea =
  | 'language'       // I  — Јазична писменост
  | 'foreign_lang'   // II — Користење други јазици
  | 'math_science'   // III — Математика и природни науки
  | 'digital'        // IV — Дигитална писменост
  | 'personal'       // V  — Личен и социјален развој
  | 'society'        // VI — Општество и демократска култура
  | 'technology'     // VII — Техника, технологија и претприемништво
  | 'arts';          // VIII — Уметничко изразување и култура

export interface NationalStandardComplete {
  code: string;              // e.g. "III-А.12", "I-A.3"
  area: SubjectArea;
  areaLabel: string;         // Full МАК name
  areaNum: number;           // 1-8
  category: StandardCategory;
  description: string;       // МАК description
  /** Math concepts or topics that directly connect to this standard */
  mathBridge?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// I. ЈАЗИЧНА ПИСМЕНОСТ (19 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_I: NationalStandardComplete[] = [
  { code: 'I-A.1',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да ги изразува и пренесува своите мисли, чувства, информации и ставови во различни комуникациски ситуации на својот мајчин јазик преку различни медиуми и за различни цели',
    mathBridge: ['Усна одбрана на математичко решение', 'Образложување на математичка постапка'] },
  { code: 'I-A.2',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да познава и да користи различни форми на писмено изразување: литературни и нелитературни (тематски есеј, известување, барање, соопштение, реклама и др.)' },
  { code: 'I-A.3',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да води критички и конструктивен дијалог, аргументирано искажувајќи ги своите ставови',
    mathBridge: ['Математичка дебата', 'Аргументирање на математичко решение', 'Критичко вреднување на статистички тврдења'] },
  { code: 'I-A.4',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да го користи стандардизираниот јазик со почитување на граматичките и правописните правила при усно и писмено изразување' },
  { code: 'I-A.5',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да подготви и одржи говор со различна содржина и за различна цел, имајќи го предвид аудиториумот',
    mathBridge: ['Презентација на математички истражувачки проект', 'Феинман предавање'] },
  { code: 'I-A.6',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да ги идентификува основните карактеристики на мајчиниот јазик (азбука, историја, дијалекти) и сличностите и разликите со други јазици' },
  { code: 'I-A.7',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да ги идентификува најзначајните автори и дела од литературата на мајчин јазик' },
  { code: 'I-A.8',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да разбира содржини на аудиопораки: да може да ги издвои, анализира, оценува и резимира информациите' },
  { code: 'I-A.9',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да разбира содржини на пишан текст: да може да ги издвои, анализира, оценува и резимира информациите' },
  { code: 'I-A.10', area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да разбира визуелно прикажани содржини (дијаграми, табели и графикони, илустрации, анимации): да може да ги издвои, анализира, оценува и резимира',
    mathBridge: ['Читање и толкување статистички графикони', 'Интерпретација на функциски графикони', 'Анализа на дијаграми во работа со податоци'] },
  { code: 'I-A.11', area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да ги идентификува и анализира пораките и стилските и естетските елементи на литературните дела' },
  { code: 'I-A.12', area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'knowledge',
    description: 'да користи информации од различни извори и медиуми и критички да пристапува кон нив, земајќи ги предвид изворот, контекстот, целта и веродостојноста',
    mathBridge: ['Критичко оценување на статистички тврдења', 'Медиумска писменост — графикони во медиуми'] },
  { code: 'I-Б.1',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'преку изучување на мајчиниот јазик се развива сопствениот јазичен и културен идентитет' },
  { code: 'I-Б.2',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'со употребата на јазикот во различни контексти и средини се овозможува ефикасна комуникација и интеракција' },
  { code: 'I-Б.3',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'преку читање текстови со различна содржина и структура се развива писменоста, се формира поширок поглед за себе и за светот' },
  { code: 'I-Б.4',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'содржината и начинот на изразување на сопственото мислење можат да придонесат за одржување и подобрување на комуникацијата' },
  { code: 'I-Б.5',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'читањето и изразувањето на мајчин јазик се важни за развојот и поттикнувањето на креативноста и критичкото мислење',
    mathBridge: ['Математичко раскажување (задачи во контекст)', 'Пишување на математичко образложение'] },
  { code: 'I-Б.6',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'познавањето на мајчиниот јазик е темел на учењето и стекнувањето на знаења од сите други области' },
  { code: 'I-Б.7',  area: 'language', areaLabel: 'I. Јазична писменост', areaNum: 1, category: 'attitude',
    description: 'познавањето на мајчиниот јазик е еден од најважните столбови на етничкиот идентитет' },
];

// ─────────────────────────────────────────────────────────────────────────────
// II. КОРИСТЕЊЕ ДРУГИ ЈАЗИЦИ (23 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_II: NationalStandardComplete[] = [
  { code: 'II-A.1',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да разбере реченици и често употребувани фрази кои се однесуваат на области од најнепосредното опкружување' },
  { code: 'II-A.2',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да ја извлече главната поента во јасни, едноставни пораки, соопштенија, упатства, молби и предупредувања' },
  { code: 'II-A.3',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да прочита и разбере едноставни текстови од различни видови, на позната и помалку позната тематика' },
  { code: 'II-A.4',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да најде конкретни информации во текстови во реални материјали (реклами, проспекти, менија, термометри, распоред)' },
  { code: 'II-A.5',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да комуницира во конкретни и секојдневни ситуации кога се бара едноставна и директна размена на информации' },
  { code: 'II-A.6',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да ги изговара јасно и правилно сите гласови и гласовни групи, почитувајќи ги правилата за интонација' },
  { code: 'II-A.7',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да користи најчесто употребувани искази и реченици кои произлегуваат од непосредното искуство' },
  { code: 'II-A.8',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да ги пишува зборовите и изразите со релативна точност, применувајќи ги правописните правила за усвоените структури' },
  { code: 'II-A.9',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да ги почитува основните граматички правила и исклучоците при писмено и усно изразување' },
  { code: 'II-A.10', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да изрази и аргументира чувство и мислење во врска со нешта од непосреден интерес' },
  { code: 'II-A.11', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да користи низа од искази и реченици за да напише порака, писмо, белешка, разгледница' },
  { code: 'II-А.12', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да разбере фрази и најчесто употребуван вокабулар кој се однесува на области од најнепосредното опкружување',
    mathBridge: ['Математичка терминологија на странски јазик (EN: equation, function, probability)'] },
  { code: 'II-А.13', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да ја сфати главната поента во куси, јасни, едноставни пораки и соопштенија' },
  { code: 'II-А.14', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да чита куси, едноставни текстови и да разбере куси, едноставни пораки во рамки на позната тематика' },
  { code: 'II-А.15', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да најде конкретни информации во едноставни секојдневни материјали (реклами, проспекти, менија, распоред)' },
  { code: 'II-А.16', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да комуницира во едноставни и рутински ситуации кои бараат едноставна и директна размена на информации' },
  { code: 'II-А.17', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да иницира и да учествува во куси конверзации на позната тематика' },
  { code: 'II-А.18', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да користи низа од фрази и реченици за да ги опише со едноставни зборови семејството и другите луѓе' },
  { code: 'II-А.19', area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'knowledge', description: 'да напише куси, едноставни белешки и пораки кои произлегуваат од секојдневната потреба' },
  { code: 'II-Б.1',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'attitude', description: 'преку изучување на друг јазик се олеснува учењето на повеќе јазици и се зголемува можноста за комуникација' },
  { code: 'II-Б.2',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'attitude', description: 'со познавањето на повеќе јазици се олеснува пристапот до ресурси кои се корисни за совладување на различни предизвици' },
  { code: 'II-Б.3',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'attitude', description: 'преку изучувањето на други јазици се развива интерес и почит за различни јазици и култури' },
  { code: 'II-Б.4',  area: 'foreign_lang', areaLabel: 'II. Користење други јазици', areaNum: 2, category: 'attitude', description: 'преку изучувањето на други јазици се развива почитување за другите култури и се подобруваат интеркултурните компетенции' },
];

// ─────────────────────────────────────────────────────────────────────────────
// III. МАТЕМАТИКА И ПРИРОДНИ НАУКИ (76 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_III: NationalStandardComplete[] = [
  // МАТЕМАТИКА — III-А.1 до III-А.27
  { code: 'III-А.1',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да користи редослед на операции со цели броеви, дропки и децимални броеви, вклучувајќи и загради' },
  { code: 'III-А.2',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да заокружува броеви до одреден степен на прецизност' },
  { code: 'III-А.3',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да испитува намалување или зголемување во проценти, вклучувајќи едноставни проблеми поврзани со личните или домашните финансии (камата, попуст, добивка, загуба и данок)' },
  { code: 'III-А.4',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да одлучува кога да примени дропка или проценти за да се споредат различни количини' },
  { code: 'III-А.5',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да препорачува/применува размер во различни контексти од секојдневниот живот' },
  { code: 'III-А.6',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да донесува заклучоци кога две величини се правопропорционални и да користи пропорционалност за решавање проблеми' },
  { code: 'III-А.7',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да користи степени со степенов показател: нула, позитивен или негативен цел број и да применува правила за работа со степени' },
  { code: 'III-А.8',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да упростува или трансформира алгебарски изрази и да собира и одзема едноставни алгебарски изрази' },
  { code: 'III-А.9',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да составува израз за да го опише n-тиот член на аритметичка низа' },
  { code: 'III-А.10', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да составува, решава и графички да го интерпретира решението на линеарни равенки со коефициенти кои се цели броеви или дропки' },
  { code: 'III-А.11', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да проценува и проверува приближни решенија на квадратни равенки' },
  { code: 'III-А.12', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да открива својства на агли, прави што се сечат, триаголници, други многуаголници и кружница и да ги употребува своjствата при решавање задачи' },
  { code: 'III-А.13', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да анализира 3Д-форми преку мрежи и проекции' },
  { code: 'III-А.14', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да изнаоѓа соодветни начини за решавање на проблеми со примена на Питагорова теорема' },
  { code: 'III-А.15', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да трансформира 2Д-форми комбинирајќи: транслација, ротација, осна симетрија и сличност' },
  { code: 'III-А.16', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да изработува и користи цртежи во размер и да толкува мапи' },
  { code: 'III-А.17', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да наоѓа геометриско место на точки на одредено растојание од дадена точка или од дадена права' },
  { code: 'III-А.18', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги користи мерните единици (должина, маса, зафатнина, плоштина и волумен) во различен контекст и да конвертира меѓу нив' },
  { code: 'III-А.19', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да пресметува периметар и плоштина на 2Д-форми' },
  { code: 'III-А.20', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да пресметува плоштина и волумен на 3Д-форми' },
  { code: 'III-А.21', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да собира, средува дискретни и континуирани податоци и да избира соодветни, еднакви класни интервали за хистограм' },
  { code: 'III-А.22', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да претставува дискретни и континуирани податоци со: линиски графикон за временски период, стебло-лист дијаграм, хистограм и кружен дијаграм' },
  { code: 'III-А.23', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да толкува табели, графикони и дијаграми, да споредува резултати и да носи заклучоци за тоа дали претставувањето е адекватно' },
  { code: 'III-А.24', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да проценува настан, веројатност на настан, релативна фреквенција и да донесува заклучоци врз основа на теоретска и статистичка веројатност' },
  { code: 'III-А.25', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да одлучува како да ги провери резултатите и да размислува дали одговорот е разумен во контекстот на проблемот' },
  { code: 'III-А.26', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ја оценува ефикасноста на различни пристапи на решавање на проблемот и да ја подобрува стратегијата' },
  { code: 'III-А.27', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да користи математички апликации за решавање на различни проблемски ситуации и за проверување на резултатите' },
  // ПРИРОДНИ НАУКИ — III-A.28+
  { code: 'III-A.28', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги користи основните научни сознанија за да го објаснува природниот свет', mathBridge: ['Математички модели за природни феномени', 'Научна нотација за мерења'] },
  { code: 'III-A.29', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да разгледува и одбира идеи, набљудува, предвидува и поставува претпоставки, собира и анализира податоци, изведува заклучоци', mathBridge: ['Статистичко истражување', 'Анализа на вистински податоци', 'Моделирање со математика'] },
  { code: 'III-A.30', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да организира и претставува квантитативни податоци табеларно, графички, со дијаграм и скица', mathBridge: ['Работа со податоци', 'Хистограм', 'Графичко претставување на функции'] },
  { code: 'III-A.31', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да изведува едноставни експерименти, користејќи соодветен лабораториски прибор и хемикалии, при тоа почитувајќи ги безбедносните мерки' },
  { code: 'III-A.32', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да проценува ризици и опасности во лабораторија и да ги познава и применува мерките за претпазливост' },
  { code: 'III-A.33', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да истражува и да дискутира за влијанието на науката, технологијата и активностите на човекот врз животната средина и одржливоста' },
  { code: 'III-A.34', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да разликува и класифицира супстанции и да го поврзува нивниот состав со нивните својства' },
  { code: 'III-A.35', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава градбените единки на супстанциите и да прави врска меѓу составот на супстанциите и нивните карактеристики' },
  { code: 'III-A.36', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да разликува физички од хемиски промени и да идентификува и демонстрира различни видови физички и хемиски промени' },
  { code: 'III-A.37', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да го толкува и употребува периодниот систем на елементите' },
  { code: 'III-A.38', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава хемиските симболи на поважните хемиски елементи и да пишува хемиски формули' },
  { code: 'III-A.39', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните структурни единки и функции на живите организми' },
  { code: 'III-A.40', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава принципите на наследувањето и да разбира основни поими на генетиката' },
  { code: 'III-A.41', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните биолошки процеси: фотосинтеза, дишење, исхрана, раст и размножување' },
  { code: 'III-A.42', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да го разбира и применува поимот сила и механизмот на различни видови сили', mathBridge: ['Векторска математика (воведно)', 'Примена на мерење и единици'] },
  { code: 'III-A.43', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира поимите за притисок, температура, топлина и да ги решава проблеми поврзани со нив', mathBridge: ['Формули и пропорционалност', 'Единици за температура и конверзија'] },
  { code: 'III-A.44', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира основните поими за светлина, звук, електрицитет и магнетизам' },
  { code: 'III-A.45', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните особини на Земјата, Сончевиот систем и Вселената' },
  { code: 'III-A.46', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира причините и последиците од природните непогоди и хуманитарни катастрофи' },
  { code: 'III-A.47', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава видовите на почви, нивниот состав, значење и улога во екосистемите' },
  { code: 'III-A.48', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира основните принципи на одржлив развој' },
  { code: 'III-A.49', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да знае да применува основни мерки на прва помош' },
  { code: 'III-A.50', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава последиците и влијанието на луѓето и природата врз промените во животната средина' },
  { code: 'III-A.51', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните принципи на природните циклуси (вода, јаглерод, азот)' },
  { code: 'III-A.52', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира основните принципи на хигиена и здравје' },
  { code: 'III-A.53', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава биолошките основи на репродукцијата и сексуалното здравје' },
  { code: 'III-A.54', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните болести, нивните причинители и начини на превенција' },
  { code: 'III-A.55', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира влијанијата на стресот, исхраната и физичката активност врз здравјето' },
  { code: 'III-A.56', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да разбира поими поврзани со одржливост на животната средина и биодиверзитетот' },
  { code: 'III-A.57', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните видови природни ресурси и да разбира важноста на нивното рационално користење' },
  { code: 'III-A.58', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира ефектите на климатските промени и нивното влијание врз живиот свет' },
  { code: 'III-A.59', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги разбира основните принципи на физичката географија и нивната поврзаност со животната средина' },
  { code: 'III-A.60', area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'knowledge', description: 'да ги познава основните принципи на геологијата и еволуцијата на Земјата' },
  { code: 'III-Б.1',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'математиката и природните науки ги поттикнуваат критичкото мислење, точноста и аналитичкиот пристап кон решавање проблеми' },
  { code: 'III-Б.2',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'науката и технологијата имаат клучна улога во развојот на општеството и решавањето на глобалните предизвици' },
  { code: 'III-Б.3',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'одговорниот однос кон природата и животната средина е одраз на разбирањето на научните принципи' },
  { code: 'III-Б.4',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'математичките модели и природно-научните сознанија помагаат во разбирањето на сложените системи' },
  { code: 'III-Б.5',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'истражувачкиот дух и љубопитноста се темелни вредности на науката' },
  { code: 'III-Б.6',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'математиката е универзален јазик кој овозможува прецизна комуникација меѓу луѓето' },
  { code: 'III-Б.7',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'трудот, упорноста и систематичноста се клучни за успехот во математиката и природните науки' },
  { code: 'III-Б.8',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'соработката и размената на идеи придонесуваат за подобро разбирање на математичките концепти' },
  { code: 'III-Б.9',  area: 'math_science', areaLabel: 'III. Математика и природни науки', areaNum: 3, category: 'attitude', description: 'математичката убавина — симетрија, шеми, елеганција на докази — поттикнува естетска чувствителност' },
];

// ─────────────────────────────────────────────────────────────────────────────
// IV. ДИГИТАЛНА ПИСМЕНОСТ (20 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_IV: NationalStandardComplete[] = [
  { code: 'IV-A.1',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги разбира и применува основните концепти на дигиталните технологии и нивната употреба во секојдневниот живот', mathBridge: ['Употреба на Geogebra, Desmos за визуализација', 'Математички апликации (III-А.27)'] },
  { code: 'IV-A.2',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да создава, обработува и претставува информации и содржини со помош на дигитални алатки', mathBridge: ['Создавање табели и графикони во spreadsheet', 'Дигитална презентација на математичко истражување'] },
  { code: 'IV-A.3',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да пребарува, оценува и критички да ги анализира информациите пронајдени на интернет', mathBridge: ['Критичка анализа на статистички податоци онлајн', 'Проверување на математички извори'] },
  { code: 'IV-A.4',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги познава и применува основните правила за дигитална безбедност, приватност и одговорно онлајн однесување' },
  { code: 'IV-A.5',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги разбира основните принципи на програмирање и да може да создава едноставни алгоритми', mathBridge: ['Алгоритамско мислење во математика', 'Логички исказни форми', 'Низи и рекурзија'] },
  { code: 'IV-A.6',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги користи дигиталните алатки за соработка, комуникација и учење' },
  { code: 'IV-A.7',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги разбира основните концепти на вештачката интелигенција и нејзиното влијание врз општеството', mathBridge: ['Статистика и машинско учење (воведно)', 'Математика зад AI'] },
  { code: 'IV-A.8',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги разбира правата и одговорностите во дигиталниот свет (авторски права, лиценци)' },
  { code: 'IV-A.9',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги разбира основните принципи на заштита на личните податоци и приватноста' },
  { code: 'IV-A.10', area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да ги препознава и избегнува дигиталните закани (фишинг, малвер, кибер-малтретирање)' },
  { code: 'IV-A.11', area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да користи дигитални алатки за решавање на практични проблеми', mathBridge: ['Решавање математички проблеми со Wolfram Alpha, Geogebra', 'Симулации и динамична геометрија'] },
  { code: 'IV-A.12', area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да разбира и применува основни концепти на бинарен систем и кодирање на информации', mathBridge: ['Бројни системи — бинарен, хексадецимален', 'Математика на кодирање'] },
  { code: 'IV-A.13', area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'knowledge', description: 'да применува дигитални алатки за обработка и визуализација на податоци', mathBridge: ['Статистичка визуализација', 'Работа со табели и графикони'] },
  { code: 'IV-Б.1',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'дигиталните технологии се алатки кои треба да се користат одговорно и критички' },
  { code: 'IV-Б.2',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'дигиталната писменост е основна компетенција за 21. век и за активно учество во општеството' },
  { code: 'IV-Б.3',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'технологијата треба да служи за поддршка на учењето и развојот, а не само за забава' },
  { code: 'IV-Б.4',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'одговорното користење на технологијата вклучува почитување на туѓите права и приватноста' },
  { code: 'IV-Б.5',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'критичкото мислење и дигиталната писменост се неопходни за да се справиме со дезинформациите' },
  { code: 'IV-Б.6',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'иновативноста и креативноста се важни аспекти на дигиталната компетенција' },
  { code: 'IV-Б.7',  area: 'digital', areaLabel: 'IV. Дигитална писменост', areaNum: 4, category: 'attitude', description: 'соработката онлајн бара исти вредности на почит и одговорност како и офлајн соработката' },
];

// ─────────────────────────────────────────────────────────────────────────────
// V. ЛИЧЕН И СОЦИЈАЛЕН РАЗВОЈ (31 стандард)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_V: NationalStandardComplete[] = [
  { code: 'V-A.1',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги препознава и именува своите емоции и да разбира нивното влијание врз однесувањето' },
  { code: 'V-A.2',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да управува со своите емоции и стресот на здрав и конструктивен начин', mathBridge: ['Толеранција на фрустрација при математичка задача', 'Стратегии за совладување на тешки задачи'] },
  { code: 'V-A.3',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основите на самоодредувањето и да поставува реалистични цели и планови за нивно постигнување', mathBridge: ['Поставување цели за математичко совладување', 'Планирање учење'] },
  { code: 'V-A.4',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги препознава своите јаки страни, слабости и интереси и да ги поврзува со можности за личен развој' },
  { code: 'V-A.5',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да применува стратегии за ефикасно учење и да го организира своето учење', mathBridge: ['Метакогниција во математика', 'Спейсд репетиција (SRS)', 'Феинман техника'] },
  { code: 'V-A.6',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основните принципи на здравиот живот (исхрана, физичка активност, одмор, хигиена)' },
  { code: 'V-A.7',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги препознава и избегнува ризичните однесувања (употреба на дроги, алкохол, тутун)' },
  { code: 'V-A.8',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основните принципи на родовата рамноправност и да поддржува рамноправно учество на сите' },
  { code: 'V-A.9',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира и применува принципите на ненасилна комуникација и мирно решавање конфликти', mathBridge: ['Математичка дебата со аргументи', 'Конструктивна критика на математичко решение'] },
  { code: 'V-A.10',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да работи ефикасно во тим и да придонесува за постигнување на заеднички цели', mathBridge: ['Групна работа на математичка задача', 'Кооперативно учење во математика'] },
  { code: 'V-A.11',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основите на финансиската писменост (буџет, заштеда, камата, инвестиции)', mathBridge: ['Пресметување камата (III-А.3)', 'Финансиска математика — проценти, попусти', 'Статистика на личен буџет'] },
  { code: 'V-A.12',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги препознава симптомите на дискриминација, стереотипи и предрасуди и да реагира против нив' },
  { code: 'V-A.13',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основите на критичкото мислење и да ги применува во секојдневни ситуации', mathBridge: ['Критичко мислење во математичко решавање', 'Евалуација на стратегии (III-А.26)'] },
  { code: 'V-A.14',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира правата и одговорностите на децата и граѓаните' },
  { code: 'V-A.15',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги познава механизмите за заштита на правата на детето' },
  { code: 'V-A.16',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира поимите за самопочит, самодоверба и лична вредност' },
  { code: 'V-A.17',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги познава основните институции и организации кои ги штитат правата на граѓаните' },
  { code: 'V-A.18',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основните принципи на инклузивноста и различноста' },
  { code: 'V-A.19',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги познава механизмите за справување со стрес и одржување на менталното здравје' },
  { code: 'V-A.20',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира основните вредности на демократијата, правдата и еднаквоста' },
  { code: 'V-A.21',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'knowledge', description: 'да ги разбира поимите поврзани со претприемништвото и иновативноста' },
  { code: 'V-Б.1',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'секоја личност е одговорна за своите постапки и нивните последици врз другите и врз општеството' },
  { code: 'V-Б.2',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'почитувањето на себе и другите е предуслов за здрава комуникација и соработка' },
  { code: 'V-Б.3',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'трудот и истрајноста се темели на постигнувањата', mathBridge: ['Growth mindset во математика', 'Истрајност при тешка задача'] },
  { code: 'V-Б.4',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'соработката и меѓусебното почитување создаваат поволна средина за учење и развој' },
  { code: 'V-Б.5',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'иницијативноста и подготвеноста за преземање одговорност се важни за личниот и општествениот напредок' },
  { code: 'V-Б.6',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'различноста на луѓето (различни способности, потреби, култури) е богатство за заедницата' },
  { code: 'V-Б.7',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'личното здравје и добросостојба зависат и од индивидуалните избори и однесувања' },
  { code: 'V-Б.8',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'емпатијата и способноста за разбирање на перспективите на другите е основа за мирна соработка' },
  { code: 'V-Б.9',   area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'образованието е право и одговорност на секое дете и е клучно за личниот развој' },
  { code: 'V-Б.10',  area: 'personal', areaLabel: 'V. Личен и социјален развој', areaNum: 5, category: 'attitude', description: 'одговорноста кон семејството и заедницата е важен аспект на општественото однесување' },
];

// ─────────────────────────────────────────────────────────────────────────────
// VI. ОПШТЕСТВО И ДЕМОКРАТСКА КУЛТУРА (47 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_VI: NationalStandardComplete[] = [
  { code: 'VI-А.1',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните принципи и вредности на демократијата и да ги разбира нивните практични импликации' },
  { code: 'VI-А.2',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните институции и механизми на демократската власт во Република Македонија' },
  { code: 'VI-А.3',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира правата и обврските на граѓаните во демократско општество' },
  { code: 'VI-А.4',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните принципи на правната држава и владеењето на правото' },
  { code: 'VI-А.5',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи на економијата и пазарот', mathBridge: ['Математика на пазар: понуда, побарувачка, цена', 'Пресметување профит/загуба, данок (III-А.3)'] },
  { code: 'VI-А.6',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основите на семејниот и јавниот буџет', mathBridge: ['Финансиска математика — буџетирање', 'Проценти и пресметки со пари'] },
  { code: 'VI-А.7',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да го разбира значењето на даноците и јавните расходи за функционирање на општеството', mathBridge: ['Пресметување данок (%)'] },
  { code: 'VI-А.8',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните поими на историјата на Македонија и светот' },
  { code: 'VI-А.9',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира причинско-последичните врски во историските настани' },
  { code: 'VI-А.10', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги идентификува клучните историски личности и нивниот придонес' },
  { code: 'VI-А.11', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните географски поими: релјеф, клима, реки, население' },
  { code: 'VI-А.12', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да чита и толкува географски карти и тематски прикази', mathBridge: ['Размер на карти (III-А.16)', 'Координатен систем'] },
  { code: 'VI-А.13', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните демографски показатели и да ги толкува', mathBridge: ['Статистика на население — средна вредност, дијаграми (III-А.21–23)'] },
  { code: 'VI-А.14', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира причините и последиците на миграциите' },
  { code: 'VI-А.15', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните принципи на одржливиот развој и го разбира нивното значење за иднината' },
  { code: 'VI-А.16', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира поимите за глобализација и меѓународна соработка' },
  { code: 'VI-А.17', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните меѓународни организации и нивните функции' },
  { code: 'VI-А.18', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основите на мултикултурализмот и интеркултурниот дијалог' },
  { code: 'VI-А.19', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги препознава и анализира различни форми на дискриминација и нееднаквост' },
  { code: 'VI-А.20', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи на верска толеранција и соживот' },
  { code: 'VI-А.21', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги препознава и избегнува говорот на омраза и дезинформациите' },
  { code: 'VI-А.22', area: 'society', areaLabel: 'VI. Општество и демократскаултура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи на медиумската писменост' },
  { code: 'VI-А.23', area: 'society', areaLabel: 'VI. Општество и демократскаултура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основите на семејниот живот и различните форми на семејство во општеството' },
  { code: 'VI-А.24', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава и применува принципите за заштита на животната средина' },
  { code: 'VI-А.25', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи за управување со отпад и рециклирање', mathBridge: ['Статистика за отпад', 'Пресметки за рециклирање и одржливост'] },
  { code: 'VI-А.26', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги знае основните принципи на потрошувачкото право и пазарот' },
  { code: 'VI-А.27', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи на претприемништвото' },
  { code: 'VI-А.28', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги препознава и разбира разните форми на корупција и нивните последици' },
  { code: 'VI-А.29', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи на граѓанскиот активизам и учеството во заедницата' },
  { code: 'VI-А.30', area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните принципи на меѓународното хуманитарно право' },
  { code: 'VI-А.31', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира поимите поврзани со безбедноста (лична и колективна) и нивна примена' },
  { code: 'VI-А.32', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните поими за работни права и законодавство' },
  { code: 'VI-А.33', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги познава основните принципи на заштита на потрошувачите' },
  { code: 'VI-А.34', area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'knowledge', description: 'да ги разбира основните принципи на интернационализацијата на образованието' },
  { code: 'VI-Б.1',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'attitude', description: 'демократијата и правдата се темелни вредности на општеството' },
  { code: 'VI-Б.2',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'attitude', description: 'секој граѓанин има одговорност за функционирање на демократијата и заедницата' },
  { code: 'VI-Б.3',  area: 'society', areaLabel: 'VI. Општество и демократскаултура', areaNum: 6, category: 'attitude', description: 'мирот и ненасилството се основни услови за развој на здраво општество' },
  { code: 'VI-Б.4',  area: 'society', areaLabel: 'VI. Општество и демократска култура', areaNum: 6, category: 'attitude', description: 'разновидноста на историски настани, личности и изворите е темел за критичко разбирање на историјата' },
  { code: 'VI-Б.5',  area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'природата и животната средина се добра на сите и нивната заштита е одговорност на секој' },
  { code: 'VI-Б.6',  area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'глобалната соработка е неопходна за решавање на светските предизвици' },
  { code: 'VI-Б.7',  area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'медиумската писменост и критичкиот однос кон информациите се предуслови за информирано граѓанство' },
  { code: 'VI-Б.8',  area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'рамноправноста меѓу луѓето — без разлика на пол, етничка припадност, религија — е темелна вредност' },
  { code: 'VI-Б.9',  area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'претприемачкиот дух и иновативноста придонесуваат за просперитет на заедницата' },
  { code: 'VI-Б.10', area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'одговорноста кон идните генерации бара одржлив однос кон ресурсите' },
  { code: 'VI-Б.11', area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'заедничкото живеење бара почит, толеранција и соработка' },
  { code: 'VI-Б.12', area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'активното граѓанство е одговорност и привилегија на секоја личност' },
  { code: 'VI-Б.13', area: 'society', areaLabel: 'VI. Општество и демократска культура', areaNum: 6, category: 'attitude', description: 'социјалната правда и еднаквите можности за развој се предуслов за просперитетно општество' },
];

// ─────────────────────────────────────────────────────────────────────────────
// VII. ТЕХНИКА, ТЕХНОЛОГИЈА И ПРЕТПРИЕМНИШТВО (18 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_VII: NationalStandardComplete[] = [
  { code: 'VII-A.1',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги познава основните принципи и поими на техниката и технологијата', mathBridge: ['Математика во инженерство — мерење, пропорции', 'Геометриски форми во дизајн'] },
  { code: 'VII-A.2',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да применува основни технички вештини: мерење, цртање технички цртежи', mathBridge: ['Мерење и единици (III-А.18)', 'Геометриски конструкции', 'Размер (III-А.16)'] },
  { code: 'VII-A.3',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги познава основните видови на технолошки процеси и нивните производи' },
  { code: 'VII-A.4',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да разбира и применува основните принципи на алгоритмите и структурите на податоци', mathBridge: ['Алгоритамско размислување', 'Низи и рекурзија', 'Комбинаторика'] },
  { code: 'VII-A.5',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да создава едноставни технички решенија за практични проблеми', mathBridge: ['Применета математика — проектна задача', 'Геометрија во дизајн'] },
  { code: 'VII-A.6',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги познава основните принципи на претприемништвото и бизнис-планирањето', mathBridge: ['Финансиска математика', 'Буџет и трошоци', 'Профит, загуба, камата'] },
  { code: 'VII-A.7',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги разбира принципите на одржливата технологија и нејзиното влијание врз животната средина' },
  { code: 'VII-A.8',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги разбира основните принципи на роботиката и автоматизацијата', mathBridge: ['Геометрија на движење', 'Тригонометрија во роботика (воведно)'] },
  { code: 'VII-A.9',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да применува основни технолошки алатки за решавање на практични задачи' },
  { code: 'VII-A.10', area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги разбира основните принципи на 3Д моделирање и печатење', mathBridge: ['3Д форми и нивни мрежи (III-А.13)', 'Волумен и плоштина (III-А.20)'] },
  { code: 'VII-A.11', area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги познава основните принципи на обновливите извори на енергија', mathBridge: ['Пресметување на ефикасност (%), статистика на енергија'] },
  { code: 'VII-A.12', area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да го разбира влијанието на дигиталната трансформација врз општеството и пазарот на труд' },
  { code: 'VII-A.13', area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'knowledge', description: 'да ги разбира основните принципи на управување со проекти', mathBridge: ['Временски распоред, Gantt', 'Пресметување трошоци и ресурси'] },
  { code: 'VII-Б.1',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'attitude', description: 'технолошкиот развој треба да биде во служба на луѓето и природата' },
  { code: 'VII-Б.2',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'attitude', description: 'иновативноста и претприемачкиот дух се клучни за личен и општествен просперитет' },
  { code: 'VII-Б.3',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'attitude', description: 'одговорниот однос кон технологијата подразбира свест за последиците од нејзиното користење' },
  { code: 'VII-Б.4',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'attitude', description: 'точноста, прецизноста и систематичноста се вредности важни за техничката работа', mathBridge: ['Прецизност во математичките пресметки', 'Заокружување и точност (III-А.2)'] },
  { code: 'VII-Б.5',  area: 'technology', areaLabel: 'VII. Техника, технологија и претприемништво', areaNum: 7, category: 'attitude', description: 'соработката и поделбата на задачи се суштински за успехот на технолошките проекти' },
];

// ─────────────────────────────────────────────────────────────────────────────
// VIII. УМЕТНИЧКО ИЗРАЗУВАЊЕ И КУЛТУРА (18 стандарди)
// ─────────────────────────────────────────────────────────────────────────────

const AREA_VIII: NationalStandardComplete[] = [
  { code: 'VIII-A.1',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги разбира и применува основните принципи на ликовните уметности (боја, форма, линија, текстура, композиција)', mathBridge: ['Геометриска форма во уметноста', 'Симетрија и трансформации (III-А.15)', 'Пропорции во уметноста (златен пресек)'] },
  { code: 'VIII-A.2',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги разбира и применува основните принципи на музиката (ритам, мелодија, хармонија)', mathBridge: ['Математика на ритам и фракции', 'Броење и временски потписи'] },
  { code: 'VIII-A.3',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да создава уметнички дела (ликовни, музички, драмски, дигитални) и да ги применува стекнатите вештини' },
  { code: 'VIII-A.4',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги анализира и вреднува уметнички дела и уметнички изрази' },
  { code: 'VIII-A.5',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги познава значајните уметници и уметнички движења во македонската и светската уметност' },
  { code: 'VIII-A.6',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги разбира различните форми на сценска уметност: театар, танц, опера' },
  { code: 'VIII-A.7',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги познава основите на архитектурата и поврзаноста со другите уметности', mathBridge: ['Геометрија и мерење во архитектура', 'Симетрија, пропорции', 'Размер'] },
  { code: 'VIII-A.8',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги разбира основните принципи на дизајнот и визуелната комуникација', mathBridge: ['Геометриски форми во дизајн', 'Пропорции и размер'] },
  { code: 'VIII-A.9',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги препознава и анализира мозаичните паттерни и симетриите во традиционалната уметност', mathBridge: ['Математика на мозаик и тесилација (Escher)', 'Симетрии и трансформации (III-А.15)', 'Правилни многуаголници'] },
  { code: 'VIII-A.10', area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги познава основите на фотографијата и дигиталните уметности' },
  { code: 'VIII-A.11', area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да го разбира и применува поимот на перспективата во визуелните уметности', mathBridge: ['Геометрија на перспективa', 'Слична триаголници и проекции (III-А.15)'] },
  { code: 'VIII-A.12', area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'knowledge', description: 'да ги разбира основните принципи на дигиталната музика и аудиовизуелните медиуми' },
  { code: 'VIII-Б.1',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'attitude', description: 'уметноста е начин на изразување на емоции, идеи и вредности и збогатување на животот', mathBridge: ['Убавината на математиката — симетрија, фракталност, елеганција на доказот'] },
  { code: 'VIII-Б.2',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'attitude', description: 'почитувањето на различните уметнички традиции и изрази е темел на интеркултурниот дијалог' },
  { code: 'VIII-Б.3',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'attitude', description: 'креативноста и имагинацијата се важни компетенции за 21. век', mathBridge: ['Математичка креативност — нови решенија', 'Конструкции со шестар и линијар'] },
  { code: 'VIII-Б.4',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'attitude', description: 'уметничкото изразување поттикнува самоприфаќање, самодоверба и личен развој' },
  { code: 'VIII-Б.5',  area: 'arts', areaLabel: 'VIII. Уметничко изразување иултура', areaNum: 8, category: 'attitude', description: 'уметноста ги поврзува луѓето преку универзални пораки и вредности' },
  { code: 'VIII-Б.6',  area: 'arts', areaLabel: 'VIII. Уметничко изразување и култура', areaNum: 8, category: 'attitude', description: 'сочувањето на културното наследство е заедничка одговорност' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_NATIONAL_STANDARDS: NationalStandardComplete[] = [
  ...AREA_I, ...AREA_II, ...AREA_III, ...AREA_IV,
  ...AREA_V, ...AREA_VI, ...AREA_VII, ...AREA_VIII,
];

export const AREA_LABELS: Record<SubjectArea, string> = {
  language:     'I. Јазична писменост',
  foreign_lang: 'II. Користење други јазици',
  math_science: 'III. Математика и природни науки',
  digital:      'IV. Дигитална писменост',
  personal:     'V. Личен и социјален развој',
  society:      'VI. Општество и демократска култура',
  technology:   'VII. Техника, технологија и претприемништво',
  arts:         'VIII. Уметничко изразување и култура',
};

export const AREA_ICONS: Record<SubjectArea, string> = {
  language:     '📖',
  foreign_lang: '🌍',
  math_science: '🔢',
  digital:      '💻',
  personal:     '🤝',
  society:      '🏛️',
  technology:   '⚙️',
  arts:         '🎨',
};

export const AREA_COLORS: Record<SubjectArea, { bg: string; border: string; text: string; dot: string }> = {
  language:     { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  foreign_lang: { bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  math_science: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  digital:      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  personal:     { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500' },
  society:      { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  technology:   { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  arts:         { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   dot: 'bg-rose-500' },
};

/** Math-specific standards (III-А.1 to III-А.27) */
export const MATH_STANDARDS = ALL_NATIONAL_STANDARDS.filter(
  s => s.area === 'math_science' && /^III-А\.\d+$/.test(s.code),
);

/** Cross-curricular standards (non-math) that have mathBridge connections */
export const CROSS_CURRICULAR_WITH_MATH = ALL_NATIONAL_STANDARDS.filter(
  s => s.area !== 'math_science' && s.mathBridge && s.mathBridge.length > 0,
);

/** Get all standards for a specific area */
export const getStandardsByArea = (area: SubjectArea) =>
  ALL_NATIONAL_STANDARDS.filter(s => s.area === area);

/** Get standards that connect math to a specific other area */
export const getMathBridgeTo = (area: SubjectArea) =>
  ALL_NATIONAL_STANDARDS.filter(s => s.area === area && s.mathBridge && s.mathBridge.length > 0);
