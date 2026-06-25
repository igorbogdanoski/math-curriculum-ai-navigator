import { ICONS } from '../constants';

export type BadgeVariant = 'ai' | 'new' | 'live' | 'cop' | 'hub' | 'ops';

export type DynamicBadge = 'forumUnread' | 'maturaStreak';

export type NavItemConfig = {
  type?: 'item';
  i18nKey: string;
  path: string;
  iconKey: keyof typeof ICONS;
  badge?: BadgeVariant;
  dynamicBadge?: DynamicBadge;
};

export type NavHubConfig = {
  type: 'hub';
  hubId: string;
  i18nKey: string;
  iconKey: keyof typeof ICONS;
  badge?: BadgeVariant;
  paths: string[];
  items: NavItemConfig[];
};

export type NavGroupItem = NavItemConfig | NavHubConfig;

export function isHub(item: NavGroupItem): item is NavHubConfig {
  return item.type === 'hub';
}

export type NavGroupConfig = {
  sectionI18nKey: string;
  items: NavGroupItem[];
};

export const SECONDARY_NAV_GROUPS: NavGroupConfig[] = [
  {
    sectionI18nKey: 'sidebar.sec.planning',
    items: [
      { i18nKey: 'nav.planner',       path: '/planner',        iconKey: 'planner' },
      { i18nKey: 'nav.annualPlanner', path: '/annual-planner', iconKey: 'planner',  badge: 'ai' },
      { i18nKey: 'nav.annualGallery', path: '/annual-gallery', iconKey: 'database', badge: 'cop' },
      { i18nKey: 'nav.weeklyPlan',    path: '/weekly-plan',    iconKey: 'calendar' },
    ],
  },
  {
    sectionI18nKey: 'sidebar.sec.programme',
    items: [
      { i18nKey: 'nav.explore', path: '/explore', iconKey: 'bookOpen' },
      { i18nKey: 'nav.graph',   path: '/graph',   iconKey: 'share' },
      { i18nKey: 'nav.roadmap', path: '/roadmap', iconKey: 'mindmap' },
    ],
  },
  {
    sectionI18nKey: 'sidebar.sec.aitools',
    items: [
      { i18nKey: 'nav.assistant',        path: '/assistant',         iconKey: 'assistant' },
      { i18nKey: 'nav.visionAssessment', path: '/vision-assessment', iconKey: 'camera',    badge: 'new' },
      { i18nKey: 'nav.testgenerator',    path: '/test-generator',    iconKey: 'assessment' },
      { i18nKey: 'nav.gradeBook',        path: '/grade-book',        iconKey: 'gradeBook',  badge: 'new' },
      {
        type: 'hub',
        hubId: 'matura',
        i18nKey: 'nav.maturaHub',
        iconKey: 'education',
        badge: 'hub',
        paths: ['/matura-portal', '/matura-library', '/matura-practice', '/matura', '/matura-stats'],
        items: [
          { i18nKey: 'nav.maturaPortal',     path: '/matura-portal',   iconKey: 'education',  badge: 'hub' },
          { i18nKey: 'nav.maturaLibrary',    path: '/matura-library',  iconKey: 'education' },
          { i18nKey: 'nav.maturaPractice',   path: '/matura-practice', iconKey: 'assessment', badge: 'ai' },
          { i18nKey: 'nav.maturaSimulation', path: '/matura',          iconKey: 'assessment' },
          { i18nKey: 'nav.maturaStats',      path: '/matura-stats',    iconKey: 'analytics',  dynamicBadge: 'maturaStreak' },
        ],
      },
      { i18nKey: 'nav.testReview',  path: '/test-review', iconKey: 'camera',     badge: 'new' },
      { i18nKey: 'nav.digitalExam', path: '/exam/build',  iconKey: 'assessment' },
      { i18nKey: 'nav.dataViz',     path: '/data-viz',    iconKey: 'chart',      badge: 'new' },
      { i18nKey: 'nav.mathEditor',  path: '/math-editor', iconKey: 'sparkles' },
      {
        type: 'hub',
        hubId: 'live',
        i18nKey: 'nav.liveHub',
        iconKey: 'live',
        badge: 'live',
        paths: ['/live', '/kahoot'],
        items: [
          { i18nKey: 'nav.liveClass',   path: '/live/host',   iconKey: 'live', badge: 'live' },
          { i18nKey: 'nav.kahootMaker', path: '/kahoot/make', iconKey: 'live', badge: 'new' },
        ],
      },
      {
        type: 'hub',
        hubId: 'dugga',
        i18nKey: 'nav.duggaHub',
        iconKey: 'assessment',
        badge: 'new',
        paths: ['/dugga'],
        items: [
          { i18nKey: 'nav.duggaBuilder', path: '/dugga/build', iconKey: 'assessment', badge: 'new' },
          { i18nKey: 'nav.duggaPlay',    path: '/dugga/play',  iconKey: 'education',  badge: 'new' },
          { i18nKey: 'nav.duggaLibrary', path: '/dugga',       iconKey: 'analytics' },
        ],
      },
    ],
  },
  {
    sectionI18nKey: 'sidebar.sec.development',
    items: [
      { i18nKey: 'nav.academy',       path: '/academy',     iconKey: 'education', badge: 'new' },
      { i18nKey: 'nav.profDev',       path: '/pro-dev',     iconKey: 'sparkles',  badge: 'new' },
      { i18nKey: 'nav.myProfile',     path: '/my-profile',  iconKey: 'profile',   badge: 'new' },
      { i18nKey: 'nav.myProgress',    path: '/my-progress', iconKey: 'analytics' },
      { i18nKey: 'nav.portfolio',     path: '/portfolio',   iconKey: 'star',      badge: 'new' },
      { i18nKey: 'nav.studentPortal', path: '/student',     iconKey: 'education' },
    ],
  },
  {
    sectionI18nKey: 'sidebar.sec.resources',
    items: [
      { i18nKey: 'nav.nationalLibrary', path: '/national-library', iconKey: 'bookOpen' },
      { i18nKey: 'nav.olympiad',        path: '/olympiad',          iconKey: 'star' },
      { i18nKey: 'nav.gallery',         path: '/gallery',           iconKey: 'gallery' },
      { i18nKey: 'nav.favorites',       path: '/favorites',         iconKey: 'star' },
      { i18nKey: 'nav.coverage',        path: '/reports/coverage',  iconKey: 'chart' },
    ],
  },
];
