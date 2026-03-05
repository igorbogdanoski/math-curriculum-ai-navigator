import os
import re

dash_mappings = {
    # HomeView.tsx specific
    "'Здраво'": "t('dashboard_hello')",
    "'Денес:'": "t('dashboard_today')",
    "'Нема закажани лекции денес'": "t('dashboard_no_lessons_today')",
    "'додај во планерот'": "t('dashboard_add_to_planner')",
    "'AI Генератор'": "t('dashboard_ai_generator')",
    "'Нова подготовка'": "t('dashboard_new_preparation')",
    "'AI Препораки'": "t('dashboard_ai_recommendations')",
    "'Истражи сè'": "t('dashboard_explore_all')",
    "'Нема нови препораки за денес.'": "t('dashboard_no_recommendations')",
    "'Додај лекции во планерот за персонализирани предлози.'": "t('dashboard_add_lessons_for_suggestions')",

    "\"Здраво\"": "t('dashboard_hello')",
    "\"Денес:\"": "t('dashboard_today')",
    "\"Нема закажани лекции денес\"": "t('dashboard_no_lessons_today')",
    "\"додај во планерот\"": "t('dashboard_add_to_planner')",
    "\"AI Генератор\"": "t('dashboard_ai_generator')",
    "\"Нова подготовка\"": "t('dashboard_new_preparation')",
    "\"AI Препораки\"": "t('dashboard_ai_recommendations')",
    "\"Истражи сè\"": "t('dashboard_explore_all')",
    "\"Нема нови препораки за денес.\"": "t('dashboard_no_recommendations')",
    "\"Додај лекции во планерот за персонализирани предлози.\"": "t('dashboard_add_lessons_for_suggestions')",

    ">Здраво<": ">t('dashboard_hello')<",
    ">Денес:<": ">t('dashboard_today')<",
    ">Нема закажани лекции денес<": ">t('dashboard_no_lessons_today')<",
    ">додај во планерот<": ">t('dashboard_add_to_planner')<",
    ">AI Генератор<": ">t('dashboard_ai_generator')<",
    ">Нова подготовка<": ">t('dashboard_new_preparation')<",
    ">AI Препораки<": ">t('dashboard_ai_recommendations')<",
    ">Истражи сè<": ">t('dashboard_explore_all')<",
    ">Нема нови препораки за денес.<": ">t('dashboard_no_recommendations')<",
    ">Додај лекции во планерот за персонализирани предлози.<": ">t('dashboard_add_lessons_for_suggestions')<",

    # Dashboard subcomponents
    "\"Месечна Активност\"": "t('dash_monthly_activity')",
    "\"Покриеност на Теми\"": "t('dash_topic_coverage')",
    "\"Нема доволно податоци. Креирајте неколку подготовки за да се прикаже графикот.\"": "t('dash_no_data_chart')",
    "\"Вкупен Напредок\"": "t('dash_overall_progress')",
    "\"Вкупно подготовки\"": "t('dash_total_preps')",
    "\"Создај прва подготовка\"": "t('dash_create_first_prep')",
    "\"Пополнети рефлексии\"": "t('dash_completed_reflections')",
    "\"Додај рефлексија по час\"": "t('dash_add_reflection')",
    "\"Покриеност на стандарди\"": "t('dash_standards_coverage')",
    "\"Додај концепти во планерот\"": "t('dash_add_concepts_planner')",
    "\"Агенда\"": "t('dash_agenda')",
    "\"Види сè\"": "t('dash_see_all')",
    "\"Нема закажани активности за денес.\"": "t('dash_no_scheduled_activities')",
    "\"Крај на приказот за неделава\"": "t('dash_end_of_week')",
    "\"Национални Стандарди\"": "t('dash_national_standards')",
    "\"ПО ОДДЕЛЕНИЕ\"": "t('dash_by_grade')",
    "\"Врз основа на концепти мапирани во вашите подготовки.\"": "t('dash_based_on_mapped')",
    "\"Детална анализа на покриеност\"": "t('dash_detailed_coverage')",
    "\"Детекција на слаби точки\"": "t('dash_weak_points')",
    "\"Учениците покажуваат послаб резултат на следниве лекции врз основа на квизовите:\"": "t('dash_weak_performance_msg')",
    "\"Отвори детална аналитика\"": "t('dash_open_detailed_analytics')",
    "\"Брз AI Старт\"": "t('dash_quick_ai_start')",
    "\"Квиз за денес\"": "t('dash_quiz_for_today')",
    "\"Нов Тест\"": "t('dash_new_test')",
    "\"Генерирај проверка\"": "t('dash_generate_check')",
    "\"Идеја за утре\"": "t('dash_idea_for_tomorrow')",
    "\"Воведна активност\"": "t('dash_intro_activity')",
    "\"Нов План\"": "t('dash_new_plan')",
    "\"Креирај подготовка\"": "t('dash_create_prep')",
    "\"AI Асистент\"": "t('dash_ai_assistant')",
    "\"Разговарај\"": "t('dash_chat')",
    "\"Илустрација\"": "t('dash_illustration')",
    "\"Креирај визуел\"": "t('dash_create_visual')",
    "\"Продолжи каде што застана\"": "t('dash_continue_where_left')",
    "\"Продолжи со работа\"": "t('dash_continue_working')",
    "\"Истражи ја програмата\"": "t('dash_explore_program')",
    "\"Започнете со пребарување на теми и поими.\"": "t('dash_start_searching_topics')",

    ">Месечна Активност<": ">{t('dash_monthly_activity')}<",
    ">Покриеност на Теми<": ">{t('dash_topic_coverage')}<",
    ">Нема доволно податоци. Креирајте неколку подготовки за да се прикаже графикот.<": ">{t('dash_no_data_chart')}<",
    ">Вкупен Напредок<": ">{t('dash_overall_progress')}<",
    ">Вкупно подготовки<": ">{t('dash_total_preps')}<",
    ">Создај прва подготовка<": ">{t('dash_create_first_prep')}<",
    ">Пополнети рефлексии<": ">{t('dash_completed_reflections')}<",
    ">Додај рефлексија по час<": ">{t('dash_add_reflection')}<",
    ">Покриеност на стандарди<": ">{t('dash_standards_coverage')}<",
    ">Додај концепти во планерот<": ">{t('dash_add_concepts_planner')}<",
    ">Агенда<": ">{t('dash_agenda')}<",
    ">Види сè<": ">{t('dash_see_all')}<",
    ">Нема закажани активности за денес.<": ">{t('dash_no_scheduled_activities')}<",
    ">Крај на приказот за неделава<": ">{t('dash_end_of_week')}<",
    ">Национални Стандарди<": ">{t('dash_national_standards')}<",
    ">ПО ОДДЕЛЕНИЕ<": ">{t('dash_by_grade')}<",
    ">Врз основа на концепти мапирани во вашите подготовки.<": ">{t('dash_based_on_mapped')}<",
    ">Детална анализа на покриеност<": ">{t('dash_detailed_coverage')}<",
    ">Детекција на слаби точки<": ">{t('dash_weak_points')}<",
    ">Учениците покажуваат послаб резултат на следниве лекции врз основа на квизовите:<": ">{t('dash_weak_performance_msg')}<",
    ">Отвори детална аналитика<": ">{t('dash_open_detailed_analytics')}<",
    ">Брз AI Старт<": ">{t('dash_quick_ai_start')}<",
    ">Квиз за денес<": ">{t('dash_quiz_for_today')}<",
    ">Нов Тест<": ">{t('dash_new_test')}<",
    ">Генерирај проверка<": ">{t('dash_generate_check')}<",
    ">Идеја за утре<": ">{t('dash_idea_for_tomorrow')}<",
    ">Воведна активност<": ">{t('dash_intro_activity')}<",
    ">Нов План<": ">{t('dash_new_plan')}<",
    ">Креирај подготовка<": ">{t('dash_create_prep')}<",
    ">AI Асистент<": ">{t('dash_ai_assistant')}<",
    ">Разговарај<": ">{t('dash_chat')}<",
    ">Илустрација<": ">{t('dash_illustration')}<",
    ">Креирај визуел<": ">{t('dash_create_visual')}<",
    ">Продолжи каде што застана<": ">{t('dash_continue_where_left')}<",
    ">Продолжи со работа<": ">{t('dash_continue_working')}<",
    ">Истражи ја програмата<": ">{t('dash_explore_program')}<",
    ">Започнете со пребарување на теми и поими.<": ">{t('dash_start_searching_topics')}<",
    
    # Specific edge case: '-то одделение'
    "'-то одделение'": "t('dash_grade_label')",
    "\"-то одделение\"": "t('dash_grade_label')"
}

# The files that need context added: const { t } = useLanguage();
# Note: They may mock-need import { useLanguage } from '../../contexts/LanguageContext' 

files_to_process = [
    'views/HomeView.tsx',
    'components/dashboard/MonthlyActivityChart.tsx',
    'components/dashboard/StatCards.tsx',
    'components/dashboard/WeeklySchedule.tsx',
    'components/dashboard/StandardsCoverage.tsx',
    'components/dashboard/AITools.tsx',
    'components/dashboard/ContinueWork.tsx',
    'components/dashboard/ExploreProgram.tsx',
]

for file_path in files_to_process:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # check if we need to add import and hook
        needs_translation = False
        original_content = content
        
        for old, new in dash_mappings.items():
            if old in content:
                content = content.replace(old, new)
                needs_translation = True
                
        if needs_translation:
            if 'useLanguage' not in content:
                # Add import
                if 'views/HomeView.tsx' in file_path:
                    content = "import { useLanguage } from '../i18n/LanguageContext';\n" + content
                else: # components/dashboard/
                    if 'import { useLanguage }' not in content:
                        import_stmt = "import { useLanguage } from '../../i18n/LanguageContext';\n"
                        content = import_stmt + content

            if 'const { t } = useLanguage();' not in content:
                # Add hook inside the component function
                # Naive regex approach to find the first component definition
                content = re.sub(r'(const \w+(?:<[^>]+>)?\s*=\s*\([^)]*\)\s*(?::\s*React\.FC[^=]+)?\s*=>\s*\{)', r'\1\n  const { t } = useLanguage();\n', content, count=1)
                content = re.sub(r'(export function \w+\s*\([^)]*\)\s*\{)', r'\1\n  const { t } = useLanguage();\n', content, count=1)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
print("Files processed")
