const fs = require('fs');

let tContent = fs.readFileSync('i18n/translations.ts', 'utf8');

// Add translation strings
if (!tContent.includes("'analytics.title': 'Аналитика на Квизови'")) {
    const mkAdd = `
    'analytics.title': 'Аналитика на Квизови',
    'analytics.subtitle': 'Преглед на резултатите на учениците — во реално време.',
    'analytics.exportCsv': 'Извези CSV',
    'analytics.refresh': 'Освежи',
    'analytics.noResultsTitle': 'Сè уште нема резултати',
    'analytics.noResultsDesc': 'Откако учениците ќе решат квизови преку делениот линк, нивните резултати ќе се прикажат тука.',
    'analytics.bulletin': 'Огласна Табла',
    'analytics.bulletinHint': '(Учениците ги гледаат во „Мој Прогрес“)',
    'analytics.bulletinPlaceholder': 'Напишете порака за учениците...',
    'analytics.post': 'Постави',
    'analytics.deleteAd': 'Избриши оглас',
    'analytics.noActiveAds': 'Нема активни огласи.',
    'analytics.tabs.overview': 'Преглед',
    'analytics.tabs.trend': 'Тренд',
    'analytics.tabs.students': 'По ученик',
    'analytics.tabs.grades': 'По одд.',
    'analytics.tabs.standards': 'Стандарди',
    'analytics.tabs.concepts': 'Концепти',
    'analytics.tabs.alerts': 'Внимание',
    'analytics.tabs.groups': 'Групи',
    'analytics.tabs.classes': 'Класи',
    'analytics.tabs.questionBank': 'Банка',
    'analytics.tabs.coverage': 'Покриеност',
    'analytics.tabs.assignments': 'Задачи',
    'analytics.tabs.league': 'Лига',
    'analytics.stat.totalAttempts': 'Вкупно обиди',
    'analytics.stat.refreshed': 'освежено ',
    'analytics.stat.avgResult': 'Просечен резултат',
    'analytics.stat.basedOn': 'врз основа на ',
    'analytics.stat.attemptPlural': 'обиди',
    'analytics.stat.attemptSingular': 'обид',
    'analytics.stat.passRate': 'Стапка на положување (≥70%)',
    'analytics.stat.from': ' од ',
    'analytics.stat.students': ' ученици',
    'analytics.stat.distinctQuizzes': 'Различни квизови',
    'analytics.stat.quizzesWithResults': 'квизови со резултати',
    'analytics.load.loading': 'Вчитувам...',
    'analytics.load.loadMore': 'Вчитај уште резултати',
    'analytics.load.shown': 'Прикажани се последните',
    'analytics.load.results': 'резултати',
    `;

    const sqAdd = `
    'analytics.title': 'Analitika e Kuizeve',
    'analytics.subtitle': 'Pasqyrë e rezultateve të nxënësve — në kohë reale.',
    'analytics.exportCsv': 'Eksporto CSV',
    'analytics.refresh': 'Rifresko',
    'analytics.noResultsTitle': 'Ende nuk ka rezultate',
    'analytics.noResultsDesc': 'Pasi nxënësit të zgjidhin kuizet përmes lidhjes së ndarë, rezultatet e tyre do të shfaqen këtu.',
    'analytics.bulletin': 'Tabela e njoftimeve',
    'analytics.bulletinHint': '(Nxënësit i shohin në "Progresi im")',
    'analytics.bulletinPlaceholder': 'Shkruani një mesazh për nxënësit...',
    'analytics.post': 'Publiko',
    'analytics.deleteAd': 'Fshije njoftimin',
    'analytics.noActiveAds': 'Nuk ka njoftime aktive.',
    'analytics.tabs.overview': 'Përmbledhje',
    'analytics.tabs.trend': 'Trendi',
    'analytics.tabs.students': 'Për nxënës',
    'analytics.tabs.grades': 'Për klasë',
    'analytics.tabs.standards': 'Standardet',
    'analytics.tabs.concepts': 'Konceptet',
    'analytics.tabs.alerts': 'Kujdes',
    'analytics.tabs.groups': 'Grupet',
    'analytics.tabs.classes': 'Klasat',
    'analytics.tabs.questionBank': 'Banka',
    'analytics.tabs.coverage': 'Mbulimi',
    'analytics.tabs.assignments': 'Detyrat',
    'analytics.tabs.league': 'Liga',
    'analytics.stat.totalAttempts': 'Total përpjekje',
    'analytics.stat.refreshed': 'rifreskuar në ',
    'analytics.stat.avgResult': 'Rezultati mesatar',
    'analytics.stat.basedOn': 'bazuar në ',
    'analytics.stat.attemptPlural': 'përpjekje',
    'analytics.stat.attemptSingular': 'përpjekje',
    'analytics.stat.passRate': 'Shkalla e kalueshmërisë (≥70%)',
    'analytics.stat.from': ' nga ',
    'analytics.stat.students': ' nxënës',
    'analytics.stat.distinctQuizzes': 'Kuize të ndryshme',
    'analytics.stat.quizzesWithResults': 'kuize me rezultate',
    'analytics.load.loading': 'Duke u ngarkuar...',
    'analytics.load.loadMore': 'Ngarko më shumë rezultate',
    'analytics.load.shown': 'Janë shfaqur të fundit',
    'analytics.load.results': 'rezultate',
    `;

    const trAdd = `
    'analytics.title': 'Sınav Analitiği',
    'analytics.subtitle': 'Öğrenci sonuçlarına genel bakış — gerçek zamanlı.',
    'analytics.exportCsv': 'CSV Aktar',
    'analytics.refresh': 'Yenile',
    'analytics.noResultsTitle': 'Henüz sonuç yok',
    'analytics.noResultsDesc': 'Öğrenciler paylaşılan bağlantı üzerinden sınavları çözdükten sonra sonuçları burada gösterilecektir.',
    'analytics.bulletin': 'Duyuru Panosu',
    'analytics.bulletinHint': '(Öğrenciler bunları "İlerlemem" bölümünde görür)',
    'analytics.bulletinPlaceholder': 'Öğrenciler için bir mesaj yazın...',
    'analytics.post': 'Yayınla',
    'analytics.deleteAd': 'Duyuruyu sil',
    'analytics.noActiveAds': 'Aktif duyuru yok.',
    'analytics.tabs.overview': 'Genel Bakış',
    'analytics.tabs.trend': 'Eğilim',
    'analytics.tabs.students': 'Öğrenci başına',
    'analytics.tabs.grades': 'Sınıf başına',
    'analytics.tabs.standards': 'Standartlar',
    'analytics.tabs.concepts': 'Kavramlar',
    'analytics.tabs.alerts': 'Dikkat',
    'analytics.tabs.groups': 'Gruplar',
    'analytics.tabs.classes': 'Sınıflar',
    'analytics.tabs.questionBank': 'Banka',
    'analytics.tabs.coverage': 'Kapsam',
    'analytics.tabs.assignments': 'Görevler',
    'analytics.tabs.league': 'Lig',
    'analytics.stat.totalAttempts': 'Toplam deneme',
    'analytics.stat.refreshed': 'yenilendi ',
    'analytics.stat.avgResult': 'Ortalama sonuç',
    'analytics.stat.basedOn': 'temelinde ',
    'analytics.stat.attemptPlural': 'deneme',
    'analytics.stat.attemptSingular': 'deneme',
    'analytics.stat.passRate': 'Geçme oranı (≥70%)',
    'analytics.stat.from': ' içinden ',
    'analytics.stat.students': ' öğrenci',
    'analytics.stat.distinctQuizzes': 'Farklı sınavlar',
    'analytics.stat.quizzesWithResults': 'sonuçlu sınavlar',
    'analytics.load.loading': 'Yükleniyor...',
    'analytics.load.loadMore': 'Daha fazla sonuç yükle',
    'analytics.load.shown': 'Son gösterilenler',
    'analytics.load.results': 'sonuç',
    `;

    tContent = tContent.replace("const mk: Record<string, string> = {", "const mk: Record<string, string> = {" + mkAdd);
    tContent = tContent.replace("const sq: Record<string, string> = {", "const sq: Record<string, string> = {" + sqAdd);
    tContent = tContent.replace("const tr: Record<string, string> = {", "const tr: Record<string, string> = {" + trAdd);
    fs.writeFileSync('i18n/translations.ts', tContent, 'utf8');
}

// Now replace in TeacherAnalyticsView.tsx
let hContent = fs.readFileSync('views/TeacherAnalyticsView.tsx', 'utf8');

if (!hContent.includes('useLanguage()')) {
    hContent = hContent.replace(
        "import { useAuth } from '../contexts/AuthContext';",
        "import { useAuth } from '../contexts/AuthContext';\nimport { useLanguage } from '../i18n/LanguageContext';"
    );
}

if (!hContent.includes('const { t } = useLanguage();')) {
    hContent = hContent.replace(
        "export const TeacherAnalyticsView: React.FC = () => {",
        "export const TeacherAnalyticsView: React.FC = () => {\n  const { t } = useLanguage();"
    );
}

// Perform simple string replacements
hContent = hContent.replace("Аналитика на Квизови", "{t('analytics.title')}");
hContent = hContent.replace("Преглед на резултатите на учениците — во реално време.", "{t('analytics.subtitle')}");
hContent = hContent.replace("Извези CSV", "{t('analytics.exportCsv')}");
hContent = hContent.replace(">Освежи<", ">{t('analytics.refresh')}<");
hContent = hContent.replace("Сè уште нема резултати", "{t('analytics.noResultsTitle')}");
hContent = hContent.replace("Откако учениците ќе решат квизови преку делениот линк, нивните резултати ќе се прикажат тука.", "{t('analytics.noResultsDesc')}");

hContent = hContent.replace(">Огласна Табла<", ">{t('analytics.bulletin')}<");
hContent = hContent.replace("(Учениците ги гледаат во „Мој Прогрес“)", "{t('analytics.bulletinHint')}");
hContent = hContent.replace('placeholder="Напишете порака за учениците..."', 'placeholder={t("analytics.bulletinPlaceholder")}');
hContent = hContent.replace(">Постави<", ">{t('analytics.post')}<");
hContent = hContent.replace('title="Избриши оглас"', 'title={t("analytics.deleteAd")}');
hContent = hContent.replace('aria-label="Избриши оглас"', 'aria-label={t("analytics.deleteAd")}');
hContent = hContent.replace(">Нема активни огласи.<", ">{t('analytics.noActiveAds')}<");

hContent = hContent.replace("label: 'Преглед'", "label: t('analytics.tabs.overview')");
hContent = hContent.replace("label: 'Тренд'", "label: t('analytics.tabs.trend')");
hContent = hContent.replace("label: 'По ученик'", "label: t('analytics.tabs.students')");
hContent = hContent.replace("label: 'По одд.'", "label: t('analytics.tabs.grades')");
hContent = hContent.replace("label: 'Стандарди'", "label: t('analytics.tabs.standards')");
hContent = hContent.replace("label: 'Концепти'", "label: t('analytics.tabs.concepts')");
hContent = hContent.replace("label: '⚠️ Внимание'", "label: '⚠️ ' + t('analytics.tabs.alerts')");
hContent = hContent.replace("label: '👥 Групи'", "label: '👥 ' + t('analytics.tabs.groups')");
hContent = hContent.replace("label: '🫂 Класи'", "label: '🫂 ' + t('analytics.tabs.classes')");
hContent = hContent.replace("label: '📚 Банка'", "label: '📚 ' + t('analytics.tabs.questionBank')");
hContent = hContent.replace("label: '📊 Покриеност'", "label: '📊 ' + t('analytics.tabs.coverage')");
hContent = hContent.replace("label: '📋 Задачи'", "label: '📋 ' + t('analytics.tabs.assignments')");
hContent = hContent.replace("label: '🏆 Лига'", "label: '🏆 ' + t('analytics.tabs.league')");

hContent = hContent.replace('label="Вкупно обиди"', 'label={t("analytics.stat.totalAttempts")}');
hContent = hContent.replace(/sub=\{`освежено \$\{lastRefresh/g, 'sub={`${t("analytics.stat.refreshed")} ${lastRefresh');
hContent = hContent.replace('label="Просечен резултат"', 'label={t("analytics.stat.avgResult")}');
hContent = hContent.replace(/sub=\{`врз основа на \$\{totalAttempts\} обид\$\{totalAttempts/g, "sub={`\\${t('analytics.stat.basedOn')} \\${totalAttempts} \\${totalAttempts");
hContent = hContent.replace(/ === 1 \? '' : 'и'\}`\}/g, " === 1 ? t('analytics.stat.attemptSingular') : t('analytics.stat.attemptPlural')}`}");

hContent = hContent.replace('label="Стапка на положување (≥70%)"', 'label={t("analytics.stat.passRate")}');
hContent = hContent.replace(/sub=\{`\$\{results\.filter\(r => r\.percentage >= 70\)\.length\} од \$\{totalAttempts\} ученици`\}/g, 'sub={`${results.filter(r => r.percentage >= 70).length} ${t("analytics.stat.from")} ${totalAttempts} ${t("analytics.stat.students")}`}');

hContent = hContent.replace('label="Различни квизови"', 'label={t("analytics.stat.distinctQuizzes")}');
hContent = hContent.replace('sub="квизови со резултати"', 'sub={t("analytics.stat.quizzesWithResults")}');

hContent = hContent.replace("> Вчитувам...<", "> {t('analytics.load.loading')}<");
hContent = hContent.replace("↓ Вчитај уште резултати (", "↓ {t('analytics.load.loadMore')} (");
hContent = hContent.replace(" вчитани)", "");
hContent = hContent.replace(">Прикажани се последните ", ">{t('analytics.load.shown')} ");
hContent = hContent.replace(" резултати<", " {t('analytics.load.results')}<");

fs.writeFileSync('views/TeacherAnalyticsView.tsx', hContent, 'utf8');
