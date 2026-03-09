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
];
