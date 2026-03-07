const fs = require('fs');

const run = () => {
    let content = fs.readFileSync('views/MaterialsGeneratorView.tsx', 'utf8');

    // Make sure we have the useLanguage hook
    if (!content.includes("import { useLanguage } from '../i18n/LanguageContext';")) {
        content = content.replace("import React, { useState, useEffect, useRef, useMemo } from 'react';", "import React, { useState, useEffect, useRef, useMemo } from 'react';\nimport { useLanguage } from '../i18n/LanguageContext';");
    }
    
    if (!content.includes('const { t } = useLanguage();')) {
        content = content.replace("export const MaterialsGeneratorView: React.FC = () => {", "export const MaterialsGeneratorView: React.FC = () => {\n  const { t } = useLanguage();");
    }

    const replacements = [
        ["{ id: 'SCENARIO', label: 'Сценарио/Идеи', icon: 'lightbulb' }", "{ id: 'SCENARIO', label: t('generator.types.scenario'), icon: 'lightbulb' }"],
        ["{ id: 'LEARNING_PATH', label: 'Патека за учење', icon: 'mindmap' }", "{ id: 'LEARNING_PATH', label: t('generator.types.path'), icon: 'mindmap' }"],
        ["{ id: 'ASSESSMENT', label: 'Тест/Лист', icon: 'generator' }", "{ id: 'ASSESSMENT', label: t('generator.types.assessment'), icon: 'generator' }"],
        ["{ id: 'RUBRIC', label: 'Рубрика', icon: 'edit' }", "{ id: 'RUBRIC', label: t('generator.types.rubric'), icon: 'edit' }"],
        ["{ id: 'FLASHCARDS', label: 'Флеш-картички', icon: 'flashcards' }", "{ id: 'FLASHCARDS', label: t('generator.types.flashcards'), icon: 'flashcards' }"],
        ["{ id: 'QUIZ', label: 'Квиз', icon: 'quiz' }", "{ id: 'QUIZ', label: t('generator.types.quiz'), icon: 'quiz' }"],
        ["{ id: 'EXIT_TICKET', label: 'Излезна картичка', icon: 'quiz' }", "{ id: 'EXIT_TICKET', label: t('generator.types.exitTicket'), icon: 'quiz' }"],
        ["{ id: 'ILLUSTRATION', label: 'Илустрација', icon: 'gallery' }", "{ id: 'ILLUSTRATION', label: t('generator.types.illustration'), icon: 'gallery' }"],
        
        ["<h1 className=\"text-4xl font-bold text-brand-primary mb-2\">AI Генератор на материјали</h1>", "<h1 className=\"text-4xl font-bold text-brand-primary mb-2\">{t('generator.title')}</h1>"],
        ["<p className=\"text-gray-600\">Креирајте персонализирани наставни материјали, активности и тестови со помош на вештачка интелигенција.</p>", "<p className=\"text-gray-600\">{t('generator.subtitle')}</p>"],
        ["<h2 className=\"text-xl font-bold text-brand-primary\">{t('generator.title')}</h2>", "<h2 className=\"text-xl font-bold text-brand-primary\">{t('generator.title')}</h2>"],
        
        ["title=\"Нов материјал\"", "title={t('generator.newMaterial')}"],
        ["title=\"Зачувани\"", "title={t('generator.saved')}"],
        [">Генерирај<", ">{t('generator.generateBtn')}<"],
        [">Генерирам...<", ">{t('generator.generatingBtn')}<"],
        [">Идеја<", ">{t('generator.ideaTab')}<"],

        ["addNotification('Формата е ресетирана.', 'info');", "addNotification(t('generator.notifications.reset'), 'info');"],
        ["title: 'Ресетирање',", "title: t('generator.resetTitle'),"],
        ["message: 'Дали сте сигурни дека сакате да ги ресетирате сите полиња?',", "message: t('generator.resetConfirm'),"],
        ["confirmLabel: 'Да, ресетирај',", "confirmLabel: t('generator.resetBtn'),"],
        [">Зачувај во планер<", ">{t('generator.saveToPlanner')}<"],
        
        ["{h}ч {m}мин", "{h}{t('common.hours')} {m}{t('common.mins')}"],
        ["{m}мин", "{m}{t('common.mins')}"],

        ["Изберете одделение", "{t('generator.selectGrade')}"],
        ["Изберете предлог", "{t('generator.selectSuggestion')}"],
        ["Времетраење", "{t('generator.duration')}"],
        ["минути", "{t('common.minsLong')}"],
        ["Дополнителни насоки (опционално)", "{t('generator.extraInstructions')}"],
        
        // Context selection labels
        ["Поврзи со курикулум", "{t('generator.context.curriculum')}"],
        ["Поврзи со национален стандард", "{t('generator.context.standard')}"],
        ["Слободна идеја", "{t('generator.context.freeIdea')}"],
        
        [">Вашиот сопствен текст или идеја<", ">{t('generator.context.freeIdeaDesc')}<"],
        ["Внесете ја вашата идеја...", "{t('generator.context.ideaPlaceholder')}"],
        ["Објаснете што сакате да генерирате...", "{t('generator.context.freeIdeaDesc')}"]
    ];

    replacements.forEach(([search, replace]) => {
        content = content.replace(search, replace);
    });

    fs.writeFileSync('views/MaterialsGeneratorView.tsx', content, 'utf8');
};

run();
