const fs = require('fs');

const run = () => {
    let content = fs.readFileSync('components/Sidebar.tsx', 'utf8');

    const r = [
        ['label="Почетна"', 'label={t("nav.home")}'],
        ['label="AI Генератор"', 'label={t("nav.generator")}'],
        ['label="Планер"', 'label={t("nav.planner")}'],
        ['label="Аналитика"', 'label={t("nav.analytics")}'],
        ['label="Мои подготовки"', 'label={t("nav.mylessons")}'],
        ['label="Библиотека"', 'label={t("nav.library")}'],
        ['label="Училиште"', 'label={t("nav.schooladmin")}'],
        ['label="Поставки"', 'label={t("nav.settings")}'],
        ['label="Истражи програма"', 'label={t("nav.explore")}'],
        ['label="Интерактивен Граф"', 'label={t("nav.graph")}'],
        ['label="Патна Мапа"', 'label={t("nav.roadmap")}'],
        ['label="AI Асистент"', 'label={t("nav.assistant")}'],
        ['label="Генератор на Тестови"', 'label={t("nav.testgenerator")}'],
        ['label="Анализа на покриеност"', 'label={t("nav.coverage")}'],
        ['label="Омилени"', 'label={t("nav.favorites")}'],
        ['label="Галерија"', 'label={t("nav.gallery")}']
    ];

    r.forEach(([search, replace]) => {
        content = content.replace(search, replace);
    });

    content = "import { useLanguage } from '../i18n/LanguageContext';\n" + content;
    content = content.replace("const { navigate } = useNavigation();", "const { navigate } = useNavigation();\n  const { t } = useLanguage();");

    fs.writeFileSync('components/Sidebar.tsx', content, 'utf8');
};

run();
