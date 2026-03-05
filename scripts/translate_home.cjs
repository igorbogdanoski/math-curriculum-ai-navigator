const fs = require('fs');

let tContent = fs.readFileSync('i18n/translations.ts', 'utf8');

// Add home dashboard translations if not already added
if (!tContent.includes("'home.quick.generator': 'AI Генератор'")) {
    const mkHome = `
    'home.quick.generator': 'AI Генератор',
    'home.quick.generatorDesc': 'Генерирај материјал',
    'home.quick.planner': 'Планер',
    'home.quick.plannerDesc': 'Распоред на часови',
    'home.quick.analytics': 'Аналитика',
    'home.quick.analyticsDesc': 'Резултати на ученици',
    'home.quick.mylessons': 'Мои подготовки',
    'home.quick.mylessonsDesc': 'Наставни планови',
    'home.quick.livequiz': 'Квиз во живо',
    'home.quick.livequizDesc': 'Пушти на час',
    
    'home.tabs.activity': 'Месечна Активност',
    'home.tabs.topics': 'Покриеност на Теми',
    
    'home.hero.greeting': 'Доброутро',
    'home.hero.greetingAfternoon': 'Добар ден',
    'home.hero.greetingEvening': 'Добра вечер',
    
    'home.hero.noLesson': 'Денес немате закажани часови.',
    'home.hero.nextLesson': 'Следно: ',
    'home.hero.studentsWait': 'Учениците очекуваат материјали за ',
    'home.hero.generateMaterial': 'Генерирај за следен час',
    
    'home.ai.title': 'AI Препораки',
    'home.ai.seeAll': 'Види ги сите',
    'home.ai.emptyTitle': 'Нема нови препораки во моментов.',
    'home.ai.emptyDesc': 'Користете ги алатките почесто за да добиете персонализирани препораки.',
    'home.ai.suggestActivityTitle': 'Предлог Aктивност: ',
    `;
    
    const sqHome = `
    'home.quick.generator': 'Gjeneratori AI',
    'home.quick.generatorDesc': 'Gjenero material',
    'home.quick.planner': 'Planifikuesi',
    'home.quick.plannerDesc': 'Orari i mësimeve',
    'home.quick.analytics': 'Analitika',
    'home.quick.analyticsDesc': 'Rezultatet e nxënësve',
    'home.quick.mylessons': 'Përgatitjet e mia',
    'home.quick.mylessonsDesc': 'Planet mësimore',
    'home.quick.livequiz': 'Kuiz i drejtpërdrejtë',
    'home.quick.livequizDesc': 'Lësho në klasë',
    
    'home.tabs.activity': 'Aktiviteti Mujor',
    'home.tabs.topics': 'Mbulimi i Temave',
    
    'home.hero.greeting': 'Mirëmëngjes',
    'home.hero.greetingAfternoon': 'Mirëdita',
    'home.hero.greetingEvening': 'Mirëmbrëma',
    
    'home.hero.noLesson': 'Sot nuk keni orë të caktuara.',
    'home.hero.nextLesson': 'Radhazi: ',
    'home.hero.studentsWait': 'Nxënësit presin materiale për ',
    'home.hero.generateMaterial': 'Gjenero për orën tjetër',
    
    'home.ai.title': 'Rekomandime nga AI',
    'home.ai.seeAll': 'Shiko te gjitha',
    'home.ai.emptyTitle': 'Momentalisht nuk ka rekomandime të reja.',
    'home.ai.emptyDesc': 'Përdorni mjetet më shpesh për të marrë rekomandime të personalizuara.',
    'home.ai.suggestActivityTitle': 'Aktivitet i Sugjeruar: ',
    `;
    
    const trHome = `
    'home.quick.generator': 'Yapay Zeka (AI) Üretici',
    'home.quick.generatorDesc': 'Materyal üret',
    'home.quick.planner': 'Planlayıcı',
    'home.quick.plannerDesc': 'Ders programı',
    'home.quick.analytics': 'Analitik',
    'home.quick.analyticsDesc': 'Öğrenci sonuçları',
    'home.quick.mylessons': 'Hazırlıklarım',
    'home.quick.mylessonsDesc': 'Ders planları',
    'home.quick.livequiz': 'Canlı Quiz',
    'home.quick.livequizDesc': 'Sınıfta başlat',
    
    'home.tabs.activity': 'Aylık Aktivite',
    'home.tabs.topics': 'Konu Kapsamı',
    
    'home.hero.greeting': 'Günaydın',
    'home.hero.greetingAfternoon': 'İyi günler',
    'home.hero.greetingEvening': 'İyi akşamlar',
    
    'home.hero.noLesson': 'Bugün planlanmış dersiniz yok.',
    'home.hero.nextLesson': 'Sıradaki: ',
    'home.hero.studentsWait': 'Öğrenciler materyal bekliyor ',
    'home.hero.generateMaterial': 'Sonraki ders için üret',
    
    'home.ai.title': 'AI Önerileri',
    'home.ai.seeAll': 'Hepsini gör',
    'home.ai.emptyTitle': 'Şu anda yeni öneri yok.',
    'home.ai.emptyDesc': 'Kişiselleştirilmiş öneriler almak için araçları daha sık kullanın.',
    'home.ai.suggestActivityTitle': 'Önerilen Etkinlik: ',
    `;

    tContent = tContent.replace("const mk: Record<string, string> = {", "const mk: Record<string, string> = {" + mkHome);
    tContent = tContent.replace("const sq: Record<string, string> = {", "const sq: Record<string, string> = {" + sqHome);
    tContent = tContent.replace("const tr: Record<string, string> = {", "const tr: Record<string, string> = {" + trHome);
    fs.writeFileSync('i18n/translations.ts', tContent, 'utf8');
}

// Update HomeView.tsx
let hContent = fs.readFileSync('views/HomeView.tsx', 'utf8');

if (!hContent.includes('useLanguage()')) {
    hContent = hContent.replace(
        "import { ICONS } from '../constants';", 
        "import { ICONS } from '../constants';\nimport { useLanguage } from '../i18n/LanguageContext';"
    );
}

// Modify ChartTabs component to use hook if not passed or just pass 't'
if (!hContent.includes('const { t } = useLanguage();') && !hContent.includes('const HomeView =')) {
    // Actually we can just add `const { t } = useLanguage();` inside `ChartTabs` and `HomeView`
    hContent = hContent.replace(
        "const [activeTab, setActiveTab] = useState<'activity' | 'topics'>('activity');",
        "const { t } = useLanguage();\n    const [activeTab, setActiveTab] = useState<'activity' | 'topics'>('activity');"
    );
    
    hContent = hContent.replace(
        "const { navigate } = useNavigation();",
        "const { navigate } = useNavigation();\n  const { t } = useLanguage();"
    );
}

// Make QUICK_ACTIONS dynamic by returning a function or calling t inside rendering
// Let's redefine QUICK_ACTIONS inside the component, or just replace strings directly.
hContent = hContent.replace(
    /const QUICK_ACTIONS = \[\s*\{ label: 'AI Генератор', desc: 'Генерирај материјал', icon: Sparkles, color: 'bg-indigo-600 hover:bg-indigo-700', action: 'generator' \},\s*\{ label: 'Планер', desc: 'Распоред на часови', icon: CalendarDays, color: 'bg-blue-600 hover:bg-blue-700', action: 'planner' \},\s*\{ label: 'Аналитика', desc: 'Резултати на ученици', icon: BarChart2, color: 'bg-violet-600 hover:bg-violet-700', action: 'analytics' \},\s*\{ label: 'Мои подготовки', desc: 'Наставни планови', icon: Library, color: 'bg-emerald-600 hover:bg-emerald-700', action: 'my-lessons' \},\s*\{ label: 'Квиз во живо', desc: 'Пушти на час', icon: Radio, color: 'bg-rose-600 hover:bg-rose-700', action: 'live' \},\s*\] as const;/g,
    `const getQuickActions = (t: any) => [
  { label: t('home.quick.generator'), desc: t('home.quick.generatorDesc'), icon: Sparkles, color: 'bg-indigo-600 hover:bg-indigo-700', action: 'generator' },
  { label: t('home.quick.planner'), desc: t('home.quick.plannerDesc'), icon: CalendarDays, color: 'bg-blue-600 hover:bg-blue-700', action: 'planner' },
  { label: t('home.quick.analytics'), desc: t('home.quick.analyticsDesc'), icon: BarChart2, color: 'bg-violet-600 hover:bg-violet-700', action: 'analytics' },
  { label: t('home.quick.mylessons'), desc: t('home.quick.mylessonsDesc'), icon: Library, color: 'bg-emerald-600 hover:bg-emerald-700', action: 'my-lessons' },
  { label: t('home.quick.livequiz'), desc: t('home.quick.livequizDesc'), icon: Radio, color: 'bg-rose-600 hover:bg-rose-700', action: 'live' },
];`
);

hContent = hContent.replace(
    /QUICK_ACTIONS\.map/g,
    "getQuickActions(t).map"
);

hContent = hContent.replace("Месечна Активност", "{t('home.tabs.activity')}");
hContent = hContent.replace("Покриеност на Теми", "{t('home.tabs.topics')}");
hContent = hContent.replace("Доброутро", "{t('home.hero.greeting')}");
hContent = hContent.replace("Добар ден", "{t('home.hero.greetingAfternoon')}");
hContent = hContent.replace("Добра вечер", "{t('home.hero.greetingEvening')}");
hContent = hContent.replace("Следно: <span", "{t('home.hero.nextLesson')}<span");
hContent = hContent.replace("Учениците очекуваат материјали за", "{t('home.hero.studentsWait')}");
hContent = hContent.replace("Генерирај за следен час", "{t('home.hero.generateMaterial')}");
hContent = hContent.replace("Денес немате закажани часови.", "{t('home.hero.noLesson')}");
hContent = hContent.replace(">AI Препораки</", ">{t('home.ai.title')}</");
hContent = hContent.replace("Види ги сите &rarr;", "{t('home.ai.seeAll')} &rarr;");
hContent = hContent.replace("Нема нови препораки во моментов.", "{t('home.ai.emptyTitle')}");
hContent = hContent.replace("Користете ги алатките почесто за да добиете персонализирани препораки.", "{t('home.ai.emptyDesc')}");

hContent = hContent.replace("Предлог Aктивност: ", "{t('home.ai.suggestActivityTitle')}");

fs.writeFileSync('views/HomeView.tsx', hContent, 'utf8');
