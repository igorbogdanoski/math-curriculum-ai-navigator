/**
 * Professional Development — AI Literacy for Teachers
 *
 * Content adapted from AINOW-Society/edu (GPL v3, https://github.com/AINOW-Society/edu)
 * Original work by AINOW Society (Macedonian non-profit for AI research and education).
 * Adapted into TypeScript for MisMath AI Navigator.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChapterCategory = 'foundations' | 'practice' | 'reference';

export interface ProfDevChapter {
  id: string;
  category: ChapterCategory;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  keyPoints: string[];
  icon: string; // emoji
}

export type ToolCategory =
  | 'text'
  | 'research'
  | 'presentation'
  | 'visual'
  | 'multimedia'
  | 'planning'
  | 'assessment'
  | 'students'
  | 'math';

export type ToolPricing = 'free' | 'paid' | 'freemium';

export interface AITool {
  id: string;
  name: string;
  category: ToolCategory;
  pricing: ToolPricing;
  description: string;
  url?: string;
}

export type GlossaryCategory = 'ai' | 'tech' | 'prompts' | 'edu';

export interface GlossaryTerm {
  id: string;
  term: string;       // MK
  termEn: string;     // EN
  termSq: string;     // SQ
  fullForm?: string;  // expanded acronym
  description: string; // MK
  category: GlossaryCategory;
}

export type PromptGrade = 'primary_lower' | 'primary_upper' | 'secondary' | 'all';
export type PromptSubject =
  | 'math'
  | 'language'
  | 'science'
  | 'social'
  | 'arts'
  | 'pe'
  | 'ict'
  | 'admin'
  | 'general';

export interface TeacherPrompt {
  id: string;
  title: string;
  grade: PromptGrade;
  subject: PromptSubject;
  prompt: string;
}

// ── Chapters ─────────────────────────────────────────────────────────────────

export const CHAPTERS: ProfDevChapter[] = [
  // FOUNDATIONS
  {
    id: 'ch-01-intro',
    category: 'foundations',
    order: 1,
    title: 'Вовед — Зошто AI писменост?',
    subtitle: 'Релевантност за сите образовни чинители',
    description:
      'AI технологиите го трансформираат образованието побрзо отколку образовниот систем може да одговори. Наставниците кои разбираат AI можат да ги заштитат своите ученици и да ги опремат со вештини за 21 век.',
    keyPoints: [
      'AI веќе е во секојдневниот живот на учениците',
      'Наставниците не треба да бидат програмери — доволно е критичко разбирање',
      'AI писменоста штити од манипулација и дезинформации',
      'Можност: AI го намалува административниот товар на наставниците',
    ],
    icon: '🌐',
  },
  {
    id: 'ch-02-literacy',
    category: 'foundations',
    order: 2,
    title: 'AI Писменост',
    subtitle: 'Суштинско знаење, вештини и ставови',
    description:
      'AI писменоста не е само техничко знаење — таа вклучува способност критички да се проценува AI, да се разбере неговото влијание и да се донесуваат информирани одлуки за неговата употреба.',
    keyPoints: [
      'Знаење: Разбирање на основните принципи на AI',
      'Вештини: Ефективна употреба на AI алатки во наставата',
      'Ставови: Критичко мислење и етичка свесност',
      'AI не го заменува наставникот — ги засилува неговите можности',
    ],
    icon: '📚',
  },
  {
    id: 'ch-03-what-is-ai',
    category: 'foundations',
    order: 3,
    title: 'Што е ВИ (AI)?',
    subtitle: 'Дефиниции и класификации',
    description:
      'Вештачката интелигенција (ВИ/AI) е способноста на компјутерски системи да извршуваат задачи кои вообичаено бараат човечка интелигенција. Постојат три нивоа: тесна AI (ANI), општа AI (AGI) и суперинтелигенција (ASI).',
    keyPoints: [
      'ANI (Тесна AI): специјализирана за една задача — моментална состојба',
      'AGI (Општа AI): човечко ниво на разбирање — сè уште не постои',
      'ASI (Суперинтелигенција): теоретска, надминува човечки капацитети',
      'ChatGPT, Gemini, Claude се ANI — многу способни, но не "свесни"',
    ],
    icon: '🤖',
  },
  {
    id: 'ch-04-types',
    category: 'foundations',
    order: 4,
    title: 'Поделба на AI системи',
    subtitle: 'Функционални категории',
    description:
      'AI системите се класифицираат според нивната способност за меморија и учење: реактивни машини, системи со ограничена меморија, теорија на умот и самосвесни системи.',
    keyPoints: [
      'Реактивни машини: нема меморија, реагираат само на моментален влез (Deep Blue)',
      'Ограничена меморија: учат од минати искуства — сите модерни LLM',
      'Теорија на умот: разбирање на емоции и намери — истражувачка фаза',
      'Самосвесни системи: сè уште не постојат',
    ],
    icon: '🧠',
  },
  {
    id: 'ch-05-history',
    category: 'foundations',
    order: 5,
    title: 'Историја на AI',
    subtitle: 'Од Тјуринг до трансформери',
    description:
      'AI има 70+ години историја со периоди на еуфорија и "AI зими". Разбирањето на оваа историја помага да се постават реалистични очекувања за тековните технологии.',
    keyPoints: [
      '1950: Алан Тјуринг го поставува прашањето "Може ли машина да мисли?"',
      '1956: Дартмут конференција — раѓање на поимот "вештачка интелигенција"',
      '1970-80-ти, 1990-ти: Две "AI зими" — неисполнети очекувања',
      '2017: Трансформерска архитектура → ChatGPT, Gemini, Claude (2022–)',
    ],
    icon: '📜',
  },
  {
    id: 'ch-06-applications',
    category: 'foundations',
    order: 6,
    title: 'Примени во секојдневниот живот',
    subtitle: 'AI е насекаде — и вашите ученици тоа го знаат',
    description:
      'AI е вграден во алатките кои ги користиме секојдневно. Препознавањето на овие применувања ги прави концептите конкретни за учениците.',
    keyPoints: [
      'Здравство: дијагностика на слики, откривање на рак со поголема точност',
      'Транспорт: самовозечки возила, оптимизација на сообраќај',
      'Препорачувачки системи: Netflix, YouTube, Spotify, TikTok',
      'Образование: персонализирано учење, автоматско оценување',
    ],
    icon: '🌍',
  },

  // PRACTICE
  {
    id: 'ch-07-prompt-engineering',
    category: 'practice',
    order: 7,
    title: 'Инженерство на промптови',
    subtitle: 'CPTC рамка за ефективна комуникација со AI',
    description:
      'Квалитетот на излезот зависи директно од квалитетот на влезот. CPTC рамката (Контекст, Персона, Задача, Ограничувања) е практична структура за дизајнирање ефективни промптови.',
    keyPoints: [
      'Контекст: "Јас сум наставник по математика, 7 одделение, 25 ученици..."',
      'Персона: "Одговори како искусен педагог..."',
      'Задача: "Создај тест со 10 прашања за квадратни равенки..."',
      'Ограничувања: "На македонски, максимум 30 минути, ниво B1"',
    ],
    icon: '✍️',
  },
  {
    id: 'ch-08-ai-agents',
    category: 'practice',
    order: 8,
    title: 'ВИ Агенти',
    subtitle: 'Автономни системи кои преземаат акции',
    description:
      'AI агентите можат самостојно да планираат и извршуваат задачи преку циклусот: намера → извршување → набљудување → приспособување. Ова е клуч за разбирање на следната генерација AI алатки.',
    keyPoints: [
      'Агентот = AI + алатки + автономија',
      'Пример: AI кој самостојно пребарува, синтетизира и пишува извештај',
      'Ризик: агентите можат да направат грешки без човечка контрола',
      'Во образованието: агенти за персонализирано учење',
    ],
    icon: '🤝',
  },
  {
    id: 'ch-09-architecture',
    category: 'practice',
    order: 9,
    title: 'Архитектура и функционирање',
    subtitle: 'Како всушност работи генеративниот AI',
    description:
      'LLM (Large Language Models) статистички ги предвидуваат следните зборови врз основа на трилиони текстови. Тие НЕ „мислат" — оптимизираат математичка функција. Ова разбирање е клучно за критичка употреба.',
    keyPoints: [
      'Токенизација: текстот се дели на парчиња (токени)',
      'Невронска мрежа: слоеви кои ги трансформираат токените',
      'AI предвидува "статистички најверојатен" следен збор',
      'Ова е причината за халуцинации — уверливи но неточни одговори',
    ],
    icon: '⚙️',
  },
  {
    id: 'ch-10-advanced-prompts',
    category: 'practice',
    order: 10,
    title: 'Напредни обрасци на промптови',
    subtitle: 'Few-shot, Chain-of-Thought, Role-Based',
    description:
      'Напредните техники на промптирање значително го подобруваат квалитетот на излезот и се применливи директно во подготовката на наставни материјали.',
    keyPoints: [
      'Role-based: "Замисли дека си ученик кој прв пат учи дроби..."',
      'Few-shot: давање примери пред задачата подобрува точност за 30-50%',
      'Chain-of-thought: "Размисли чекор по чекор..."',
      'Iterative refinement: AI одговорот е почетна точка, не краен производ',
    ],
    icon: '🎯',
  },
  {
    id: 'ch-11-memory-rag',
    category: 'practice',
    order: 11,
    title: 'Меморија, RAG и алатки',
    subtitle: 'Зошто AI понекогаш "не знае" актуелни информации',
    description:
      'LLM имаат knowledge cutoff — не знаат за настани по нивното тренирање. RAG (Retrieval Augmented Generation) го решава ова со пребарување во надворешни извори пред генерирање.',
    keyPoints: [
      'Краткорочна меморија: контекстниот прозорец (32k–2M токени)',
      'Долгорочна меморија: Firestore, векторски бази',
      'RAG: пронаоѓање на релевантни документи → додавање во контекст → генерирање',
      'Практична примена: NotebookLM за анализа на наставни документи',
    ],
    icon: '🔍',
  },
  {
    id: 'ch-12-performance',
    category: 'practice',
    order: 12,
    title: 'Перформанси и системски дизајн',
    subtitle: 'Оптимизација и евалуација на AI системи',
    description:
      'За наставниците кои планираат систематска употреба на AI, разбирањето на основните концепти на перформанси помага во изборот на вистинска алатка за вистинска задача.',
    keyPoints: [
      'Температура: контролира случајност на одговорите (0 = детерминистичко)',
      'Контекстен прозорец: максимален влез — важно за долги документи',
      'Кеширање: исти прашања → помали трошоци',
      'Евалуација: не верувај слепо — секогаш верификувај фактички тврдења',
    ],
    icon: '📊',
  },
  {
    id: 'ch-13-agent-execution',
    category: 'practice',
    order: 13,
    title: 'Извршување на агенти и излези',
    subtitle: 'Формати на излез и системски промптови',
    description:
      'Разбирањето на форматите на излез (текст, JSON, markdown) и системските промптови ви дава контрола врз тоа како AI ги форматира и структурира одговорите.',
    keyPoints: [
      'Системски промпт: невидлива инструкција која го дефинира "карактерот" на AI',
      'JSON излез: структурирани податоци за программска обработка',
      'Markdown: форматирање за веб и документи',
      'Output validation: секогаш проверувај дали излезот е во очекуваниот формат',
    ],
    icon: '📤',
  },

  // REFERENCE
  {
    id: 'ch-14-limitations',
    category: 'reference',
    order: 14,
    title: 'Ограничувања и безбедност',
    subtitle: 'Халуцинации, пристрасности, ризици',
    description:
      'AI системите имаат суштински ограничувања кои мора да се разберат за безбедна и одговорна употреба во образовниот контекст.',
    keyPoints: [
      'Халуцинации: AI генерира уверливи но неточни факти — секогаш верификувај',
      'Пристрасност: тренирачките податоци ги рефлектираат општествените неправди',
      'Knowledge cutoff: нема информации по одредена дата',
      'Нема здрав разум: AI не "разбира" — статистички предвидува',
    ],
    icon: '⚠️',
  },
  {
    id: 'ch-15-future',
    category: 'reference',
    order: 15,
    title: 'Иднина и основни принципи',
    subtitle: 'Каде одиме — и зошто тоа е важно денес',
    description:
      'Разбирањето на насоката на развојот на AI помага на наставниците да подготват ученици за свет кој сè уште не постои.',
    keyPoints: [
      'Автономни агенти во позадина — AI ќе извршува задачи без надзор',
      'Локална деплојба — AI на уреди без интернет (приватност)',
      'Мултимодалност — текст + слика + звук + видео + 3D',
      'AI-native образование: персонализирани патеки на учење за секој ученик',
    ],
    icon: '🚀',
  },
  {
    id: 'ch-16-mk-schools',
    category: 'reference',
    order: 16,
    title: 'Училишта во Северна Македонија',
    subtitle: 'Локален контекст: мултијазичност, правичност, заштита на податоци',
    description:
      'Македонскиот образовен контекст има специфичности кои влијаат на начинот на употреба на AI: мултиетничност, неедноставен пристап до интернет, кирилица/латиница, GDPR.',
    keyPoints: [
      'Мултијазична средина: MK, SQ, TR — AI мора да поддржи сите јазици',
      'Дигитален јаз: рурални средини со ограничен интернет → офлајн решенија',
      'Кирилица + латиница: внимание при OCR и препознавање текст',
      'GDPR: забрана за обработка на лични податоци на малолетници без согласност',
    ],
    icon: '🇲🇰',
  },
  {
    id: 'ch-17-integrity',
    category: 'reference',
    order: 17,
    title: 'Академски интегритет и фер употреба',
    subtitle: 'Политики, оценување, етика',
    description:
      'Употребата на AI во образованието создава нови прашања за академскиот интегритет. Наставниците мора да дизајнираат оценување кое е отпорно на AI и да воспостават јасни политики.',
    keyPoints: [
      'Декларирање: учениците треба да наведат кога користат AI',
      'AI-отпорно оценување: усни испити, процес-ориентирани задачи, рефлексија',
      'Целокупна школска политика: конзистентни правила низ предметите',
      'Критичко мислење е антидот: никогаш не прифаќај AI одговор без верификација',
    ],
    icon: '⚖️',
  },
];

// ── AI Tools ──────────────────────────────────────────────────────────────────

export const AI_TOOLS: AITool[] = [
  // TEXT
  { id: 'chatgpt',    name: 'ChatGPT',           category: 'text',         pricing: 'freemium', description: 'Општа AI помош за планови, одговори, содржини. Најшироко користен.' },
  { id: 'claude',     name: 'Claude',             category: 'text',         pricing: 'freemium', description: 'Одличен за анализа на долги документи и детално пишување.' },
  { id: 'gemini',     name: 'Gemini',             category: 'text',         pricing: 'freemium', description: 'Google асистент, интегриран со Google Classroom, Docs и Gmail.' },
  { id: 'copilot',    name: 'Microsoft Copilot',  category: 'text',         pricing: 'freemium', description: 'Microsoft продуктивен асистент, интегриран во Office 365.' },
  { id: 'duck',       name: 'Duck.ai',            category: 'text',         pricing: 'free',     description: 'Приватен AI чат без следење на корисникот.' },
  { id: 'grammarly',  name: 'Grammarly',          category: 'text',         pricing: 'freemium', description: 'AI писмен асистент за граматика, јасност, тон.' },
  { id: 'quillbot',   name: 'QuillBot',           category: 'text',         pricing: 'freemium', description: 'Парафразирање, резимирање, подобрување на текст.' },
  { id: 'notion-ai',  name: 'Notion AI',          category: 'text',         pricing: 'paid',     description: 'AI белешки, документи и работен простор за знаење.' },
  { id: 'otter',      name: 'Otter.ai',           category: 'text',         pricing: 'freemium', description: 'Реалтајм транскрипција на предавања и состаноци.' },
  { id: 'speechify',  name: 'Speechify',          category: 'text',         pricing: 'freemium', description: 'Text-to-speech за документи и статии.' },
  // RESEARCH
  { id: 'perplexity', name: 'Perplexity',         category: 'research',     pricing: 'freemium', description: 'AI пребарувач со цитирани извори — поверливо отколку Google.' },
  { id: 'elicit',     name: 'Elicit',             category: 'research',     pricing: 'freemium', description: 'AI истражувачки асистент за научна литература.' },
  { id: 'consensus',  name: 'Consensus',          category: 'research',     pricing: 'free',     description: 'Засновани на докази одговори директно од научни трудови.' },
  { id: 'notebooklm', name: 'NotebookLM',         category: 'research',     pricing: 'free',     description: 'Конвертира ваши документи во резимеа и студиски водичи.' },
  { id: 'semantic',   name: 'Semantic Scholar',   category: 'research',     pricing: 'free',     description: 'AI-напојувано академско пребарување.' },
  // PRESENTATION
  { id: 'gamma',      name: 'Gamma',              category: 'presentation', pricing: 'freemium', description: 'Најбрз начин за создавање AI презентации — слајдови за минути.' },
  { id: 'classpoint',  name: 'ClassPoint AI',     category: 'presentation', pricing: 'freemium', description: 'Интерактивни PowerPoint слајдови и активности за класот.' },
  { id: 'tome',       name: 'Tome',               category: 'presentation', pricing: 'paid',     description: 'AI раскажување и нарациски презентации.' },
  // VISUAL
  { id: 'canva',      name: 'Canva Magic',        category: 'visual',       pricing: 'freemium', description: 'Magic Design за визуелни материјали за секунди.' },
  { id: 'dalle',      name: 'DALL-E 3',           category: 'visual',       pricing: 'paid',     description: 'Создавање реалистични или уметнички слики од текст.' },
  { id: 'midjourney', name: 'Midjourney',         category: 'visual',       pricing: 'paid',     description: 'Највисок квалитет на AI визуели за уметничко творење.' },
  // MULTIMEDIA
  { id: 'synthesia',  name: 'Synthesia',          category: 'multimedia',   pricing: 'paid',     description: 'Profesionalni AI видеа со реалистични аватари — идеален за видео лекции.' },
  { id: 'suno',       name: 'Suno AI',            category: 'multimedia',   pricing: 'freemium', description: 'Создавање оригинална музика и песни од текст.' },
  { id: 'pika',       name: 'Pika Labs',          category: 'multimedia',   pricing: 'freemium', description: 'Претворање слики или текст во анимирани видеа.' },
  { id: 'pictory',    name: 'Pictory',            category: 'multimedia',   pricing: 'paid',     description: 'Конвертирање текст/скрипти во ангажирачки видео содржини.' },
  { id: 'descript',   name: 'Descript',           category: 'multimedia',   pricing: 'freemium', description: 'AI аудио/видео уредување преку текстуален транскрипт.' },
  // PLANNING
  { id: 'curipod',    name: 'Curipod',            category: 'planning',     pricing: 'freemium', description: 'Интерактивна AI платформа за планирање на наставни часови.' },
  { id: 'brisk',      name: 'Brisk Teaching',     category: 'planning',     pricing: 'freemium', description: 'Chrome екстензија за оценување, повратни информации и планирање.' },
  { id: 'magicschool', name: 'MagicSchool',       category: 'planning',     pricing: 'freemium', description: 'Сè-во-едно AI платформа за наставници со 60+ алатки.' },
  { id: 'diffit',     name: 'Diffit',             category: 'planning',     pricing: 'free',     description: 'Создавање диференцирани материјали за читање.' },
  { id: 'eduaide',    name: 'Eduaide.AI',         category: 'planning',     pricing: 'freemium', description: 'Генерирање AI планови за часови и стратегии.' },
  { id: 'lessonplans', name: 'LessonPlans.ai',    category: 'planning',     pricing: 'paid',     description: 'Автоматизирано генерирање планови за часови.' },
  { id: 'schoolai',   name: 'SchoolAI',           category: 'planning',     pricing: 'freemium', description: 'AI асистент за управување со класот.' },
  // ASSESSMENT
  { id: 'quizizz',    name: 'Quizizz AI',         category: 'assessment',   pricing: 'freemium', description: 'AI-генерирани квизови и гамифицирано оценување.' },
  { id: 'formative',  name: 'Formative AI',       category: 'assessment',   pricing: 'freemium', description: 'Повратни информации во реалтајм и следење на напредок.' },
  { id: 'kahoot-ai',  name: 'Kahoot AI',          category: 'assessment',   pricing: 'freemium', description: 'AI квизови, анкети, интерактивни игри.' },
  { id: 'gradescope', name: 'Gradescope',         category: 'assessment',   pricing: 'freemium', description: 'AI-асистирано оценување со конзистентност.' },
  { id: 'socrative',  name: 'Socrative',          category: 'assessment',   pricing: 'freemium', description: 'Квизови и анкети во реалтајм во класот.' },
  // STUDENTS
  { id: 'khanmigo',   name: 'Khanmigo',           category: 'students',     pricing: 'free',     description: 'AI тутор и тренер од Khan Academy.' },
  { id: 'duolingo',   name: 'Duolingo Max',       category: 'students',     pricing: 'paid',     description: 'AI учење јазик со адаптивни вежби.' },
  { id: 'quizlet',    name: 'Quizlet',            category: 'students',     pricing: 'freemium', description: 'AI флешкарти, квизови, студиски сетови.' },
  { id: 'photomath',  name: 'Photomath',          category: 'students',     pricing: 'freemium', description: 'Чекор-по-чекор решавач на математички задачи.' },
  { id: 'socratic',   name: 'Socratic',           category: 'students',     pricing: 'free',     description: 'Помош со домашна задача со AI објаснувања.' },
  { id: 'brainly',    name: 'Brainly',            category: 'students',     pricing: 'freemium', description: 'AI-засилена заедница за помош со домашна задача.' },
  // MATH
  { id: 'wolfram',    name: 'Wolfram Alpha',      category: 'math',         pricing: 'freemium', description: 'Пресметковна машина за знаење — математика, наука, статистика.' },
  { id: 'symbolab',   name: 'Symbolab',           category: 'math',         pricing: 'freemium', description: 'Чекор-по-чекор решавач за алгебра и калкулус.' },
  { id: 'mathway',    name: 'Mathway',            category: 'math',         pricing: 'freemium', description: 'Моментален математички решавач за сите нивоа.' },
];

// ── Glossary ──────────────────────────────────────────────────────────────────

export const GLOSSARY: GlossaryTerm[] = [
  { id: 'ai',          term: 'Вештачка интелигенција (ВИ)', termEn: 'Artificial Intelligence (AI)', termSq: 'Inteligjenca Artificiale (IA)', fullForm: 'Artificial Intelligence', description: 'Способност на компјутерски системи да извршуваат задачи кои вообичаено бараат човечка интелигенција, вклучувајќи препознавање, учење, одлучување.', category: 'ai' },
  { id: 'agi',         term: 'Општа ВИ',             termEn: 'Artificial General Intelligence (AGI)', termSq: 'IA e Përgjithshme', fullForm: 'Artificial General Intelligence', description: 'Хипотетичка AI со когнитивни способности на човечко ниво — сè уште не постои.', category: 'ai' },
  { id: 'ani',         term: 'Тесна ВИ',             termEn: 'Artificial Narrow Intelligence (ANI)', termSq: 'IA e Ngushtë', fullForm: 'Artificial Narrow Intelligence', description: 'AI специјализирана за одредена задача. Сите тековни AI системи (ChatGPT, Gemini) се ANI.', category: 'ai' },
  { id: 'llm',         term: 'Јазичен модел',        termEn: 'Large Language Model (LLM)', termSq: 'Modeli i Madh Gjuhësor', fullForm: 'Large Language Model', description: 'AI модел тренiran на огромни количини текст кој генерира или разбира јазик. Пример: GPT-4, Claude, Gemini.', category: 'ai' },
  { id: 'hallucination', term: 'Халуцинација',       termEn: 'Hallucination',              termSq: 'Haluçinim', description: 'Кога AI генерира информации кои звучат убедливо но се неточни или измислени. Клучен ризик при образовна употреба.', category: 'ai' },
  { id: 'generative',  term: 'Генеративна ВИ',      termEn: 'Generative AI',              termSq: 'IA Gjeneruese', description: 'AI која создава нова содржина — текст, слики, видео, код, музика — наместо само класификација.', category: 'ai' },
  { id: 'neural-net',  term: 'Невронска мрежа',     termEn: 'Neural Network',             termSq: 'Rrjeti Nervor', description: 'Компјутерски систем инспириран од структурата на човечкиот мозок, составен од слоеви на математички функции.', category: 'ai' },
  { id: 'ml',          term: 'Машинско учење',      termEn: 'Machine Learning (ML)',       termSq: 'Mësimi i Makinës', fullForm: 'Machine Learning', description: 'Подобласт на AI каде системите учат од примери наместо да бидат експлицитно програмирани.', category: 'ai' },
  { id: 'dl',          term: 'Длабоко учење',       termEn: 'Deep Learning',              termSq: 'Mësimi i Thellë', description: 'Машинско учење со многу слоеви на невронски мрежи — основа на модерните LLM.', category: 'ai' },
  { id: 'nlp',         term: 'Обработка на природен јазик', termEn: 'Natural Language Processing (NLP)', termSq: 'Përpunimi i Gjuhës Natyrore', fullForm: 'Natural Language Processing', description: 'AI техники за разбирање и генерирање на човечки јазик.', category: 'ai' },
  { id: 'transformer', term: 'Трансформер',          termEn: 'Transformer',                termSq: 'Transformer', description: 'Архитектура на невронска мрежа (2017) која е основа на сите модерни LLM — GPT, BERT, Gemini.', category: 'ai' },
  { id: 'rag',         term: 'RAG',                  termEn: 'Retrieval Augmented Generation', termSq: 'Gjenerim i Zgjeruar me Rikthim', fullForm: 'Retrieval Augmented Generation', description: 'Техника каде AI пребарува во надворешни документи пред да генерира одговор, намалувајќи халуцинации.', category: 'ai' },
  { id: 'agent',       term: 'ВИ Агент',             termEn: 'AI Agent',                   termSq: 'Agjent IA', description: 'AI систем кој може самостојно да планира и извршува задачи преку циклус: намера → акција → набљудување.', category: 'ai' },
  { id: 'chatbot',     term: 'Чатбот',               termEn: 'Chatbot',                    termSq: 'Chatbot', description: 'Програма за симулација на разговор. Модерните чатботови (ChatGPT) се базирани на LLM.', category: 'ai' },
  { id: 'bias',        term: 'AI Пристрасност',      termEn: 'AI Bias',                    termSq: 'Paragjykimi i IA', description: 'Систематска грешка во AI одлуките која произлегува од пристрасност во тренирачките податоци.', category: 'ai' },
  { id: 'deepfake',    term: 'Длабоки лажни материјали', termEn: 'Deepfakes',             termSq: 'Deepfakes', description: 'Синтетички медиуми (видео, аудио, слики) создадени со AI кои лажно прикажуваат реални луѓе.', category: 'ai' },
  { id: 'rlhf',        term: 'Засилувачко учење', termEn: 'RLHF',                          termSq: 'RLHF', fullForm: 'Reinforcement Learning from Human Feedback', description: 'Техника за финотунирање на AI врз основа на човечки оценки на одговорите.', category: 'ai' },
  { id: 'multimodal',  term: 'Мултимодална ВИ',     termEn: 'Multimodal AI',              termSq: 'IA Multimodale', description: 'AI која обработува повеќе типови влез: текст, слики, аудио, видео истовремено.', category: 'ai' },
  // TECH
  { id: 'token',       term: 'Токен',                termEn: 'Token',                      termSq: 'Token', description: 'Единица на текст (зборови, делови од зборови, знаци) со кои LLM го обработува влезот.', category: 'tech' },
  { id: 'context',     term: 'Контекстен прозорец',  termEn: 'Context Window',             termSq: 'Dritare Konteksti', description: 'Максималната количина на текст која AI може да ја обработи во еден разговор (32k–2M токени).', category: 'tech' },
  { id: 'api',         term: 'API',                  termEn: 'Application Programming Interface', termSq: 'Ndërfaqe Programuese', fullForm: 'Application Programming Interface', description: 'Начин на комуникација меѓу програми. AI API-то дозволува интеграција на AI во сопствени апликации.', category: 'tech' },
  { id: 'embedding',   term: 'Вградување (Embedding)', termEn: 'Embedding',               termSq: 'Embedding', description: 'Нумерички претставување на текст кое ги фаќа семантичките односи — основа на семантичко пребарување.', category: 'tech' },
  { id: 'temperature', term: 'Температура',           termEn: 'Temperature',               termSq: 'Temperatura', description: 'Параметар кој ја контролира случајноста на AI одговорите. Ниска = детерминистично, Висока = креативно.', category: 'tech' },
  { id: 'pwa',         term: 'Прогресивна Веб Апликација', termEn: 'Progressive Web App (PWA)', termSq: 'Aplikacion Web Progresiv (PWA)', fullForm: 'Progressive Web App', description: 'Веб апликација која може да се инсталира и работи офлајн, слично на native апликација.', category: 'tech' },
  { id: 'ocr',         term: 'Оптичко препознавање', termEn: 'Optical Character Recognition (OCR)', termSq: 'Njohja Optike e Karaktereve (OCR)', fullForm: 'Optical Character Recognition', description: 'Технологија за препознавање на текст од слики и скенирани документи.', category: 'tech' },
  { id: 'automation',  term: 'Автоматизација',       termEn: 'Automation',                 termSq: 'Automatizim', description: 'Употреба на технологија за извршување на задачи без човечка интервенција.', category: 'tech' },
  // PROMPTS
  { id: 'prompt',      term: 'Промпт',               termEn: 'Prompt',                     termSq: 'Prompt', description: 'Инструкцијата или прашањето кое го давате на AI. Квалитетот на промптот директно влијае на квалитетот на одговорот.', category: 'prompts' },
  { id: 'prompt-eng',  term: 'Промпт инженеринг',   termEn: 'Prompt Engineering',         termSq: 'Inxhinieria e Prompteve', description: 'Уметноста и науката на дизајнирање ефективни инструкции за AI системи.', category: 'prompts' },
  { id: 'cptc',        term: 'CPTC Рамка',           termEn: 'CPTC Framework',             termSq: 'Kuadri CPTC', fullForm: 'Context, Persona, Task, Constraints', description: 'Рамка за промпт: Контекст + Персона + Задача + Ограничувања = квалитетен AI одговор.', category: 'prompts' },
  { id: 'few-shot',    term: 'Few-shot учење',       termEn: 'Few-shot Learning',          termSq: 'Mësimi Few-shot', description: 'Техника каде давате неколку примери во промптот за да го водите AI одговорот.', category: 'prompts' },
  { id: 'zero-shot',   term: 'Zero-shot учење',      termEn: 'Zero-shot Learning',         termSq: 'Mësimi Zero-shot', description: 'Кога AI извршува задача без претходни примери, само врз основа на инструкции.', category: 'prompts' },
  { id: 'cot',         term: 'Ланец на мислење',     termEn: 'Chain of Thought (CoT)',     termSq: 'Zinxhiri i Mendimit', fullForm: 'Chain of Thought', description: 'Промпт техника каде му кажувате на AI да размисли чекор по чекор — значително ги подобрува одговорите.', category: 'prompts' },
  // EDU
  { id: 'digital-lit', term: 'Дигитална писменост', termEn: 'Digital Literacy',           termSq: 'Alfabetizmi Dixhital', description: 'Способност за ефективно и критичко користење на дигитални технологии.', category: 'edu' },
  { id: 'iep',         term: 'ИОП',                  termEn: 'IEP',                        termSq: 'PIA', fullForm: 'Individuализирана образовна програма', description: 'Прилагоден план за образование на ученик со посебни образовни потреби.', category: 'edu' },
  { id: 'responsible-ai', term: 'Одговорна ВИ',     termEn: 'Responsible AI',             termSq: 'IA Përgjegjëse', description: 'Развој и употреба на AI која е фер, транспарентна, безбедна и почитувачка на правата.', category: 'edu' },
  { id: 'stem',        term: 'STEM',                 termEn: 'STEM',                       termSq: 'STEM', fullForm: 'Наука, Технологија, Инженерство, Математика', description: 'Интердисциплинарен образовен пристап кој ги интегрира четирите области.', category: 'edu' },
  { id: 'gdpr',        term: 'GDPR',                 termEn: 'GDPR',                       termSq: 'GDPR', fullForm: 'Општа регулатива за заштита на податоци', description: 'Европска регулатива за приватност на податоци. Задолжителна при употреба на AI алатки со ученичките податоци.', category: 'edu' },
  { id: 'mcq',         term: 'Прашање со понудени одговори', termEn: 'Multiple Choice Question (MCQ)', termSq: 'Pyetje me Zgjedhje të Shumëfishtë', fullForm: 'Multiple Choice Question', description: 'Тип на прашање со повеќе понудени одговори, широко употребуван во AI-генерирани тестови.', category: 'edu' },
];

// ── Teacher Prompts ───────────────────────────────────────────────────────────

export const TEACHER_PROMPTS: TeacherPrompt[] = [
  // MATH
  {
    id: 'T-013',
    title: 'Собирање со преминување — диференцирани задачи',
    grade: 'primary_lower',
    subject: 'math',
    prompt: 'Ти си искусен учител по математика за трето одделение. Создај три нивоа на задачи за собирање со преминување преку десетица:\n\nНиво 1 (основно): 5 задачи со едноцифрени броеви (пример: 8 + 5 = ?)\nНиво 2 (стандардно): 5 задачи со двоцифрени броеви (пример: 37 + 28 = ?)\nНиво 3 (напредно): 5 текстуални задачи кои бараат собирање со преминување\n\nЗа секое ниво вклучи кратко упатство за ученикот. Одговори на македонски јазик.',
  },
  {
    id: 'T-014',
    title: 'Табличното множење — план за утврдување',
    grade: 'primary_lower',
    subject: 'math',
    prompt: 'Создај детален план за час за утврдување на табличното множење (×6, ×7, ×8) за четврто одделение, 45 минути.\n\nВклучи:\n1. Мотивациска активност (5 мин) — игра или загатка\n2. Главна активност (25 мин) — со диференцирани задачи\n3. Проверка на разбирањето (10 мин) — формативно оценување\n4. Резиме (5 мин)\n\nОдговори на македонски.',
  },
  {
    id: 'T-015',
    title: 'Текстуални задачи — стратегии за решавање',
    grade: 'primary_lower',
    subject: 'math',
    prompt: 'Создај 8 текстуални задачи за трето одделение со прогресивна тежина. За секоја задача вклучи:\n- Задача (контекст од секојдневниот живот)\n- Стратегија за решавање (нацрт, табела или равенка)\n- Решение со образложение\n\nТемата да биде блиска до децата: купување, спорт, природа.\nОдговори на македонски јазик.',
  },
  {
    id: 'T-020',
    title: 'Дропки — визуелно воведување',
    grade: 'primary_upper',
    subject: 'math',
    prompt: 'Подготви план за воведен час по дропки за петто одделение (45 мин). Учениците прв пат се сретнуваат со концептот.\n\nВклучи:\n- Конкретна манипулативна активност (пица, ленти хартија)\n- Визуелни претставувања на дропките\n- Поим броевник/именител со јасни примери\n- 5 задачи за вежба со различни нивоа на тежина\n- 2 прашања за формативно оценување на крај\n\nОдговори на македонски.',
  },
  {
    id: 'T-021',
    title: 'Процент — животни ситуации',
    grade: 'primary_upper',
    subject: 'math',
    prompt: 'Создај 10 задачи за проценти за шесто одделение, сите базирани на реални животни ситуации (попусти, банки, статистики, спорт).\n\nЗа секоја задача:\n- Реален контекст (1-2 реченици)\n- Прашање\n- Чекор-по-чекор решение\n\nОдговори на македонски јазик.',
  },
  {
    id: 'T-022',
    title: 'Линеарни равенки — воведно предавање',
    grade: 'secondary',
    subject: 'math',
    prompt: 'Создај детален план за воведен час по линеарни равенки за прва година гимназија (7 одделение, 45 мин).\n\nВклучи:\n- Интуитивно воведување (вага со мерење)\n- Формален запис ax + b = c\n- 3 разработени примери со зголемена тежина\n- Метод на баланс и алгебарски метод\n- 5 задачи за домашна работа\n- Поврзување со реален свет\n\nОдговори на македонски.',
  },
  {
    id: 'T-023',
    title: 'Квадратни равенки — дискриминанта',
    grade: 'secondary',
    subject: 'math',
    prompt: 'Ти си наставник по математика за трета година гимназија. Подготви материјал за решавање квадратни равенки со дискриминанта.\n\nВклучи:\n- Изводење на формулата (со докази)\n- Табела: D>0, D=0, D<0 со примери\n- 8 задачи (2 без реши корен, 3 со едноставни корени, 3 со ирационални корени)\n- Поврзување со параболата y = ax² + bx + c\n\nОдговори на македонски.',
  },
  {
    id: 'T-024',
    title: 'Матури — подготовка за испит',
    grade: 'secondary',
    subject: 'math',
    prompt: 'Создај сет за подготовка за матура по математика — Гимназија ниво.\n\nВклучи:\n1. Пет области кои најчесто се тестираат (врз основа на архивите)\n2. По 3 задачи од секоја област со целосни решенија\n3. Стратегии за управување со времето на испитот\n4. Листа на формули кои мора да се знаат напамет\n\nОдговори на македонски јазик.',
  },
  {
    id: 'T-025',
    title: 'Тригонометрија — единечна кружница',
    grade: 'secondary',
    subject: 'math',
    prompt: 'Создај интерактивен план за час за воведување на тригонометриски функции преку единечната кружница, 45 минути, трета гимназија.\n\nВклучи:\n- Поврзување со Питагорова теорема\n- Дефиниции sin, cos, tan преку кружницата\n- Специјалните агли (0°, 30°, 45°, 60°, 90°) во табела\n- Задача: нацртај единечна кружница и означи 8 карактеристични точки\n- 5 задачи за пресметување вредности\n\nОдговори на македонски.',
  },
  {
    id: 'T-030',
    title: 'Диференцирани задачи — статистика',
    grade: 'primary_upper',
    subject: 'math',
    prompt: 'Создај диференцирани задачи по статистика за шесто одделение — три нивоа:\n\nНиво 1: Читање дадена табела и пресметување средна вредност\nНиво 2: Собирање сопствени податоци (анкета во класот) и претставување во табела и дијаграм\nНиво 3: Споредба на два набора на податоци, извлекување заклучоци\n\nОдговори на македонски јазик.',
  },
  // GENERAL / ADMIN
  {
    id: 'G-001',
    title: 'AI за подготовка на час — универзален промпт',
    grade: 'all',
    subject: 'general',
    prompt: 'Ти си искусен наставник по [ПРЕДМЕТ] за [ОДДЕЛЕНИЕ/ГОДИНА], во македонско основно/средно училиште.\n\nТема на часот: [ТЕМА]\nЦели на часот: [ЦЕЛ]\nТрање: 45 минути\nБрој ученици: [БРОЈ]\n\nПодготви:\n1. План за час со временска рамка\n2. Мотивациска активност (5 мин)\n3. Главна активност со диференцијација\n4. Формативно оценување\n5. Домашна задача (опционална)\n\nЈазик: Македонски.\n\n[Замени ги скаганите делови со вашите информации]',
  },
  {
    id: 'G-002',
    title: 'Создавање квиз — 10 прашања',
    grade: 'all',
    subject: 'general',
    prompt: 'Создај квиз со 10 прашања за темата [ТЕМА] за [ОДДЕЛЕНИЕ/ГОДИНА], предмет [ПРЕДМЕТ].\n\nЗа секое прашање:\n- Прашање (јасно и прецизно)\n- 4 понудени одговори (A, B, C, D)\n- Точен одговор\n- Кратко образложение зошто е точен тој одговор\n\nНивоа на тежина: 3 лесни, 5 средни, 2 тешки.\nЈазик: Македонски.',
  },
  {
    id: 'G-003',
    title: 'Комуникација со родители — напредок на ученик',
    grade: 'all',
    subject: 'admin',
    prompt: 'Напиши професионален имеил до родителите на ученикот [ИМЕ] за неговиот/нејзиниот напредок.\n\nСитуација: [Опиши ја ситуацијата — добар напредок / потреба за дополнителна помош / однесување]\n\nПорака треба да биде:\n- Позитивно интонирана (почни со позитивно)\n- Конкретна (со примери)\n- Со јасни следни чекори за родителот\n- Максимум 200 зборови\n\nЈазик: Македонски.',
  },
  {
    id: 'G-004',
    title: 'Рубрика за оценување — есеј/проект',
    grade: 'all',
    subject: 'admin',
    prompt: 'Создај детална рубрика за оценување на [ТИП НА ЗАДАЧА: есеј/проект/презентација] за [ОДДЕЛЕНИЕ/ГОДИНА], предмет [ПРЕДМЕТ].\n\nРубриката треба да вклучи:\n- 4-5 критериуми за оценување\n- 4 нивоа (Одличен/Добар/Задоволителен/Незадоволителен)\n- Јасни дескриптори за секое ниво\n- Тежинска вредност за секој критериум\n\nВкупно: 100 поени.\nЈазик: Македонски.',
  },
  {
    id: 'G-005',
    title: 'Аналогија за тежок концепт',
    grade: 'all',
    subject: 'general',
    prompt: 'Ти си педагошки експерт. Создај 3 различни аналогии за концептот [КОНЦЕПТ] прилагодени за ученици на возраст [ВОЗРАСТ].\n\nСекоја аналогија треба да:\n- Го поврзи апстрактниот концепт со секојдневно искуство\n- Биде разбирлива без претходно знаење\n- Да ги нагласи клучните аспекти на концептот\n- Да нагласи каде аналогијата е ограничена (за да не создаде погрешни концепции)\n\nЈазик: Македонски.',
  },
  {
    id: 'G-006',
    title: 'IEP прилагодување на задачи',
    grade: 'all',
    subject: 'general',
    prompt: 'Имам ученик со [ПОСЕБНА ОБРАЗОВНА ПОТРЕБА] во мојот клас. Подготви прилагодена верзија на следнава задача:\n\n[ВМЕТНИ ЈА ОРИГИНАЛНАТА ЗАДАЧА]\n\nПрилагодувањата треба да:\n- Го задржат образовниот исход\n- Го намалат когнитивниот/физичкиот/јазичниот товар\n- Обезбедат поддршки (визуелни, чекор-по-чекор, избор)\n- Дадат алтернативен начин на демонстрирање знаење\n\nЈазик: Македонски.',
  },
  {
    id: 'G-007',
    title: 'Феинманова техника — проверка на разбирање',
    grade: 'all',
    subject: 'general',
    prompt: 'Подготви сет за Феинманова техника за темата [ТЕМА], [ПРЕДМЕТ], [ОДДЕЛЕНИЕ].\n\nВклучи:\n1. Почетно прашање: "Објасни ја темата сè едноставно, сè едно да му ги објаснуваш на мало дете"\n2. 5 следни прашања кои ги таргетираат можните јазини во разбирањето\n3. Листа на вообичаени погрешни концепции за оваа тема\n4. Рубрика за оценување на квалитетот на објаснувањето (1-4)\n\nЈазик: Македонски.',
  },
  {
    id: 'G-008',
    title: 'Формативно оценување — exit ticket',
    grade: 'all',
    subject: 'general',
    prompt: 'Создај 5 различни exit ticket прашања за темата [ТЕМА], [ПРЕДМЕТ], [ОДДЕЛЕНИЕ].\n\nТипови на прашања:\n1. Едно прашање со кратко објаснување (разбирање на концептот)\n2. Едно прашање примена (реален пример)\n3. Едно прашање конфузија (Кое е нешто за кое сè уште сте конфузни?)\n4. Едно прашање врска (Поврзете ја темата со нешто друго)\n5. Едно рефлексивно прашање (Оцени го своето разбирање 1-5)\n\nЈазик: Македонски.',
  },
  {
    id: 'AI-001',
    title: 'Вовед во ChatGPT за ученици',
    grade: 'secondary',
    subject: 'ict',
    prompt: 'Ти си наставник по информатика. Создај план за час "Вовед во ChatGPT" за прва средна (15 ученици, 45 мин).\n\nЦел: Учениците да научат да комуницираат ефективно со AI и да го разберат концептот на промпт инженеринг.\n\nАктивности:\n1. Демо: добар vs лош промпт (5 мин)\n2. Практика во парови: подобрување на промптот (15 мин)\n3. Критичка анализа: кога AI греши? (10 мин)\n4. Дискусија: академски интегритет (10 мин)\n5. Exit ticket (5 мин)\n\nВклучи конкретни примери на промптови.\nОдговори на македонски.',
  },
  {
    id: 'AI-002',
    title: 'Критичко мислење за AI содржина',
    grade: 'all',
    subject: 'general',
    prompt: 'Создај листа со 10 критични прашања кои учениците треба да си ги постават кога добиваат AI-генерирана содржина.\n\nПрашањата треба да покријат:\n- Точност на информациите\n- Извори и верификација\n- Пристрасност и перспектива\n- Датум и актуелност\n- Цел и контекст\n\nПрилагоди ги прашањата за возраст [ВОЗРАСТ].\nФормат: Листа за печатење која учениците ја чуваат во тетратката.\nЈазик: Македонски.',
  },
];

// ── Category helpers ──────────────────────────────────────────────────────────

export const CHAPTER_CATEGORIES: Record<ChapterCategory, { label: string; color: string; bg: string }> = {
  foundations: { label: 'Основи',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  practice:    { label: 'Практика', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  reference:   { label: 'Референца', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
};

export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; icon: string }> = {
  text:         { label: 'Текст и пишување',    icon: '✍️' },
  research:     { label: 'Истражување',          icon: '🔍' },
  presentation: { label: 'Презентации',          icon: '📊' },
  visual:       { label: 'Визуелизации',         icon: '🎨' },
  multimedia:   { label: 'Мултимедија',          icon: '🎬' },
  planning:     { label: 'Планирање на часови',  icon: '📋' },
  assessment:   { label: 'Оценување',            icon: '✅' },
  students:     { label: 'За ученици',           icon: '🎓' },
  math:         { label: 'Математика',           icon: '🔢' },
};

export const GLOSSARY_CATEGORIES: Record<GlossaryCategory, { label: string; color: string }> = {
  ai:      { label: 'AI концепти', color: 'bg-indigo-100 text-indigo-700' },
  tech:    { label: 'Технологија', color: 'bg-cyan-100 text-cyan-700' },
  prompts: { label: 'Промптови',   color: 'bg-amber-100 text-amber-700' },
  edu:     { label: 'Образование', color: 'bg-emerald-100 text-emerald-700' },
};

export const PROMPT_SUBJECTS: Record<PromptSubject, string> = {
  math:     'Математика',
  language: 'Јазик',
  science:  'Природни науки',
  social:   'Општество',
  arts:     'Уметност',
  pe:       'Физичко',
  ict:      'Информатика',
  admin:    'Администрација',
  general:  'Општо',
};

export const PROMPT_GRADES: Record<PromptGrade, string> = {
  primary_lower: 'Основно I–IV',
  primary_upper: 'Основно V–IX',
  secondary:     'Средно',
  all:           'Сите нивоа',
};
