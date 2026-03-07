const fs = require('fs');

const run = () => {
    let content = fs.readFileSync('views/PlannerView.tsx', 'utf8');

    // Make sure we have the useLanguage hook
    if (!content.includes('import { useLanguage } from')) {
        content = content.replace("import React, { useState, useMemo, useEffect } from 'react';", "import React, { useState, useMemo, useEffect } from 'react';\nimport { useLanguage } from '../i18n/LanguageContext';");
    }
    
    if (!content.includes('const { t } = useLanguage();')) {
        content = content.replace("export const PlannerView: React.FC = () => {", "export const PlannerView: React.FC = () => {\n  const { t } = useLanguage();");
    }

    const replacements = [
        ["nextLabel: 'Следно'", "nextLabel: t('planner.tour.next')"],
        ["prevLabel: 'Претходно'", "prevLabel: t('planner.tour.prev')"],
        ["doneLabel: 'Готово'", "doneLabel: t('planner.tour.done')"],
        ["const weekDays = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед'];", "const weekDays = [t('planner.days.mon'), t('planner.days.tue'), t('planner.days.wed'), t('planner.days.thu'), t('planner.days.fri'), t('planner.days.sat'), t('planner.days.sun')];"],
        ["addNotification('Немате лекции во планот за анализа.', 'error');", "addNotification(t('planner.notifications.noLessons'), 'error');"],
        ["addNotification('Грешка при генерирање предлози.', 'error');", "addNotification(t('planner.notifications.errorGener'), 'error');"],
        ["addNotification(`„${s.title}\" додадена во планот за ${dateStr}!`, 'success');", "addNotification(t('planner.notifications.added').replace('{title}', s.title).replace('{date}', dateStr), 'success');"],
        ["addNotification('Грешка при генерирање на линк.', 'error');", "addNotification(t('planner.notifications.errorLink'), 'error');"],
        ["addNotification('Линкот за споделување на годишниот план е копиран!', 'success');", "addNotification(t('planner.notifications.linkCopied'), 'success');"],
        ["addNotification('Грешка при копирање на линкот.', 'error');", "addNotification(t('planner.notifications.errorCopy'), 'error');"],
        ["return `Недела: ${start.toLocaleDateString('mk-MK')} - ${end.toLocaleDateString('mk-MK')}`;", "return `${t('planner.week')}: ${start.toLocaleDateString('mk-MK')} - ${end.toLocaleDateString('mk-MK')}`;"],
        ["<h1 className=\"text-4xl font-bold text-brand-primary\">Дигитален планер</h1>", "<h1 className=\"text-4xl font-bold text-brand-primary\">{t('planner.title')}</h1>"],
        [">Месечен преглед</TabButton>", ">{t('planner.view.month')}</TabButton>"],
        [">Неделен преглед (Агенда)</TabButton>", ">{t('planner.view.agenda')}</TabButton>"],
        ["Имате <span className=\"font-bold\">{unscheduledPlansCount}</span> нераспоредени подготовки.", "{t('planner.unscheduled.part1')} <span className=\"font-bold\">{unscheduledPlansCount}</span> {t('planner.unscheduled.part2')}"],
        [">Закажи ги сега<", ">{t('planner.scheduleNow')}<"],
        ["Сподели годишен план", "{t('planner.shareAnnual')}"],
        [">Нова подготовка<", ">{t('planner.newLesson')}<"],
        [">Нов настан<", ">{t('planner.newEvent')}<"],
        ["<span>Генерирај со AI</span>", "<span>{t('planner.aiGenerate')}</span>"],
        [">Тематски план<", ">{t('planner.thematicPlan')}<"],
        [">Годишен план<", ">{t('planner.annualPlan')}<"],
        [">Предложи следна лекција<", ">{t('planner.suggestNext')}<"],
        [">Предлози за следната недела<", ">{t('planner.suggestionsWeek')}<"],
        ["aria-label=\"Затвори\"", "aria-label={t('common.close')}"],
        [">Генерирам предлози...<", ">{t('planner.generating')}<"],
        [">Немаше доволно лекции за анализа.<", ">{t('planner.notEnoughLessons')}<"],
        [">Додај<", ">{t('common.add')}<"],
        ["aria-label=\"Претходен период\"", "aria-label={t('planner.prevPeriod')}"],
        ["aria-label=\"Следен период\"", "aria-label={t('planner.nextPeriod')}"],
        ["title=\"Планерот е празен\"", "title={t('planner.empty.title')}"],
        ["message=\"Започнете со организација со додавање на ваш прв час, настан или празник.\"", "message={t('planner.empty.message')}"],
        [">Додади прв настан<", ">{t('planner.addFirstEvent')}<"],
        [">Генерирај со AI<", ">{t('planner.aiGenerate')}<"],
        ["placeholder=\"Пребарајте часови или настани...\"", "placeholder={t('planner.searchPlaceholder')}"]
    ];

    replacements.forEach(([search, replace]) => {
        content = content.replace(search, replace);
    });

    fs.writeFileSync('views/PlannerView.tsx', content, 'utf8');
};

run();
