export interface Specialization {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  borderColor: string;
  badgeColor: string;
  lessonIds: string[];
  certificateLabel: string;
  /** When true, earning this specialization only requires quizzing every
   *  lessonId — no matching appliedLessons entry. Defaults to false (existing
   *  behavior) when omitted. Used for content with no "applied in the
   *  classroom" analog, like the AI-literacy reference chapters. */
  quizOnly?: boolean;
}

export const SPECIALIZATIONS: Specialization[] = [
  {
    id: 'inclusive-teacher',
    title: 'Инклузивен Наставник',
    subtitle: 'Настава прилагодена за секој ученик — UDL, диференцијација и соработка',
    emoji: '🌿',
    color: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-500',
    certificateLabel: 'Сертификат за инклузивна настава',
    lessonIds: [
      'model-udl',
      'focus-diferencijacija-i-personalizacija',
      'focus-sorabotka-i-timska-rabota',
      'tone-praktichen-i-hands-on',
      'focus-konceptualno-razbiranje',
    ],
  },
  {
    id: 'digital-innovator',
    title: 'Дигитален Иноватор',
    subtitle: 'Технологија која трансформира — SAMR, Flipped Classroom и дигитални алатки',
    emoji: '🚀',
    color: 'bg-blue-50 text-blue-700',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-500',
    certificateLabel: 'Сертификат за дигитална иновација',
    lessonIds: [
      'model-samr',
      'model-flipped-classroom',
      'focus-integracija-na-tehnologija',
      'model-pbl',
      'tone-istrazhuvachki-i-eksperimentalen',
    ],
  },
  {
    id: 'assessment-master',
    title: 'Мајстор на Оценување',
    subtitle: 'Формативно, сумативно и DoK-балансирано оценување за вистинско учење',
    emoji: '📊',
    color: 'bg-rose-50 text-rose-700',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-500',
    certificateLabel: 'Сертификат за напредно оценување',
    lessonIds: [
      'assessment-mastery-learning',
      'assessment-sbg',
      'formative-exit-tickets',
      'formative-traffic-light',
      'formative-feedback',
      'dok-test-design',
    ],
  },
  {
    id: 'cooperative-master',
    title: 'Мајстор на Кооперативно учење',
    subtitle: 'Jigsaw, TPS, Gallery Walk и структурирана взаемна зависност',
    emoji: '🤝',
    color: 'bg-amber-50 text-amber-700',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500',
    certificateLabel: 'Сертификат за кооперативно учење',
    lessonIds: [
      'focus-sorabotka-i-timska-rabota',
      'cooperative-jigsaw',
      'cooperative-think-pair-share',
      'cooperative-gallery-walk',
      'formative-traffic-light',
    ],
  },
  {
    id: 'ai-literate-teacher',
    title: 'AI-Писмен Наставник',
    subtitle: 'Одговорна и ефективна употреба на AI во наставата',
    emoji: '🤖',
    color: 'bg-violet-50 text-violet-700',
    borderColor: 'border-violet-200',
    badgeColor: 'bg-violet-500',
    certificateLabel: 'Сертификат за AI писменост',
    quizOnly: true,
    lessonIds: [
      'ch-01-intro',
      'ch-02-literacy',
      'ch-03-what-is-ai',
      'ch-04-types',
      'ch-06-applications',
      'ch-07-prompt-engineering',
      'ch-09-architecture',
      'ch-14-limitations',
      'ch-16-mk-schools',
      'ch-17-integrity',
    ],
  },
  {
    id: 'ai-responsible-manager',
    title: 'AI Управување и Влијание',
    subtitle: 'Кога да делегирате на AI, избор на алатки и проценка на резултати',
    emoji: '🧭',
    color: 'bg-teal-50 text-teal-700',
    borderColor: 'border-teal-200',
    badgeColor: 'bg-teal-500',
    certificateLabel: 'Сертификат за одговорно управување со AI',
    quizOnly: true,
    lessonIds: [
      'ch-18-when-to-use-ai',
      'ch-19-choosing-tools',
      'ch-12-performance',
      'ch-20-ai-impact',
      'ch-21-bias-fairness',
      'ch-22-evaluating-outputs',
    ],
  },
];
