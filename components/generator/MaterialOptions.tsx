import React from 'react';
import type { GeneratorState, GeneratorAction } from '../../hooks/useGeneratorState';
import { QuestionType, type DifferentiationLevel, type TeachingProfile, type StudentProfile } from '../../types';

interface MaterialOptionsProps {
    state: GeneratorState;
    dispatch: React.Dispatch<GeneratorAction>;
    user: TeachingProfile | null;
}

const ScenarioOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
        <div>
            <label htmlFor="activity-focus" className="block text-sm font-medium text-gray-700">Фокус на активноста</label>
            <select id="activity-focus" value={state.activityFocus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'activityFocus', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                <option>Концептуално разбирање</option>
                <option>Вежбање вештини</option>
                <option>Решавање проблеми</option>
                <option>Истражувачко учење</option>
                <option>Соработка и тимска работа</option>
                <option>Примена во реален контекст</option>
                <option>Критичко размислување и анализа</option>
                <option>Интеграција на технологија</option>
                <option>Диференцијација и персонализација</option>
            </select>
        </div>
        <div>
            <label htmlFor="scenario-tone" className="block text-sm font-medium text-gray-700">Тон на сценариото</label>
            <select id="scenario-tone" value={state.scenarioTone} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'scenarioTone', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                <option>Креативно и ангажирачко</option>
                <option>Формално и структурирано</option>
                <option>Разиграно и базирано на игра</option>
                <option>Наративен (преку приказна)</option>
                <option>Натпреварувачки (гамификација)</option>
                <option>Истражувачки и експериментален</option>
                <option>Практичен и 'hands-on'</option>
            </select>
        </div>
        <div>
            <label htmlFor="learning-design" className="block text-sm font-medium text-gray-700">Педагошки модел</label>
            <select id="learning-design" value={state.learningDesignModel} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'learningDesignModel', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                <option value="Standard">Стандарден (креативен предлог)</option>
                <option value="5E Model">5Е Модел (Engage, Explore...)</option>
                <option value="Gagne's Nine Events">Gagné-ови 9 настани</option>
                <option value="UDL">Универзален дизајн за учење (УДУ)</option>
                <option value="PBL">Учење базирано на проблеми (УБП)</option>
                <option value="Flipped Classroom">Превртена училница</option>
                <option value="SAMR">SAMR модел (технолошка интеграција)</option>
            </select>
        </div>
    </div>
);

const AssessmentOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Типови на прашања</label>
            <div className="flex flex-wrap gap-3">{Object.entries({ [QuestionType.MULTIPLE_CHOICE]: 'Понудени одговори', [QuestionType.SHORT_ANSWER]: 'Краток одговор', [QuestionType.TRUE_FALSE]: 'Точно/Неточно', [QuestionType.ESSAY]: 'Есејско прашање', [QuestionType.FILL_IN_THE_BLANK]: 'Дополни реченица' }).map(([type, label]) => (<div key={type}><label htmlFor={`q-type-${type}`} className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${state.questionTypes.includes(type as QuestionType) ? 'bg-brand-primary text-white shadow' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}><input id={`q-type-${type}`} type="checkbox" checked={state.questionTypes.includes(type as QuestionType)} onChange={() => dispatch({ type: 'TOGGLE_QUESTION_TYPE', payload: type as QuestionType })} className="sr-only" />{label}</label></div>))}</div>
        </div>
        <div><label htmlFor="numQuestions" className="block text-sm font-medium text-gray-700">Број на прашања</label><input id="numQuestions" type="number" value={state.numQuestions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'numQuestions', value: Math.max(1, parseInt(e.target.value) || 1)}})} min="1" max="20" className="mt-1 block w-full p-2 border-gray-300 rounded-md" /></div>
        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Ниво на диференцијација</label><div className="flex items-center space-x-4 mt-2"><div className="flex items-center"><input id="diff-type-standard" name="diff-type" type="radio" checked={!state.useStudentProfiles} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'useStudentProfiles', value: false }})} className="h-4 w-4 text-brand-primary focus:ring-brand-secondary border-gray-300" /><label htmlFor="diff-type-standard" className="ml-2 block text-sm text-gray-900">Според ниво (поддршка/стандард/напредни)</label></div><div className="flex items-center"><input id="diff-type-profile" name="diff-type" type="radio" checked={state.useStudentProfiles} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'useStudentProfiles', value: true }})} className="h-4 w-4 text-brand-primary focus:ring-brand-secondary border-gray-300" disabled={!user?.studentProfiles || user.studentProfiles.length === 0}/><label htmlFor="diff-type-profile" className="ml-2 block text-sm text-gray-900">Според профили на ученици</label></div></div></div>
        <div className="md:col-span-2">{state.useStudentProfiles ? (<div className="animate-fade-in"><label htmlFor="student-profiles" className="block text-sm font-medium text-gray-700">Избери профили</label><select id="student-profiles" multiple value={state.selectedStudentProfileIds} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedStudentProfileIds', value: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value) }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md h-24">{user?.studentProfiles?.map((p: StudentProfile) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-xs text-gray-500 mt-1">Држете Ctrl (или Cmd) за да изберете повеќе профили.</p></div>) : (<div className="animate-fade-in"><div className="flex flex-col space-y-2 mt-2">{(['standard', 'support', 'advanced'] as DifferentiationLevel[]).map(level => { const labels: Record<DifferentiationLevel, string> = { standard: 'Стандардно', support: 'Верзија за поддршка', advanced: 'Верзија за напредни ученици', }; return (<div key={level} className="flex items-center"><input id={`diff-level-${level}`} name="differentiationLevel" type="radio" value={level} checked={state.differentiationLevel === level} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'differentiationLevel', value: level }})} className="h-4 w-4 text-brand-primary focus:ring-brand-secondary border-gray-300" /><label htmlFor={`diff-level-${level}`} className="ml-2 block text-sm text-gray-900">{labels[level]}</label></div>)})}</div></div>)}</div>
        <div className="md:col-span-2 pt-2 border-t mt-2">
             <div className="relative flex items-start">
                <div className="flex items-center h-5">
                    <input
                        id="includeSelfAssessment"
                        name="includeSelfAssessment"
                        type="checkbox"
                        checked={state.includeSelfAssessment}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'includeSelfAssessment', value: e.target.checked }})}
                        className="focus:ring-brand-secondary h-4 w-4 text-brand-primary border-gray-300 rounded"
                    />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="includeSelfAssessment" className="font-medium text-gray-700">Вклучи прашања за самооценување</label>
                    <p className="text-gray-500">Додава 2-3 метакогнитивни прашања на крајот од тестот.</p>
                </div>
            </div>
        </div>
    </div>
);

const ExitTicketOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
        <div>
            <label htmlFor="exit-ticket-q-count" className="block text-sm font-medium text-gray-700">Број на прашања</label>
            <input id="exit-ticket-q-count" type="number" value={state.exitTicketQuestions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'exitTicketQuestions', value: Math.max(1, Math.min(3, parseInt(e.target.value) || 1)) }})} min="1" max="3" className="mt-1 block w-full p-2 border-gray-300 rounded-md" />
        </div>
        <div>
            <label htmlFor="exit-ticket-focus" className="block text-sm font-medium text-gray-700">Фокус на прашањата</label>
            <select id="exit-ticket-focus" value={state.exitTicketFocus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'exitTicketFocus', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                <option>Проверка на разбирање</option>
                <option>Рефлексија на учењето</option>
                <option>Поврзување со претходно знаење</option>
            </select>
        </div>
    </div>
);

const RubricOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="space-y-4 my-4 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label htmlFor="activityTitle" className="block text-sm font-medium text-gray-700">Наслов на активноста за рубриката</label><input id="activityTitle" value={state.activityTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'activityTitle', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="пр. Проект: Питагорова теорема"/></div>
            <div><label htmlFor="activityType" className="block text-sm font-medium text-gray-700">Тип на активност</label><select id="activityType" value={state.activityType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'activityType', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md"><option>Проект</option><option>Тест</option><option>Работен лист</option><option>Квиз</option><option>Домашна работа</option></select></div>
        </div>
        <div><label htmlFor="criteriaHints" className="block text-sm font-medium text-gray-700">Клучни критериуми (опционално, одделени со запирка)</label><input id="criteriaHints" value={state.criteriaHints} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'criteriaHints', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="пр. Точност, Креативност, Презентација"/></div>
    </div>
);

const IllustrationOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="my-4 animate-fade-in">
        <div><label htmlFor="illustrationPrompt" className="block text-sm font-medium text-gray-700">Опис за илустрацијата</label><textarea id="illustrationPrompt" value={state.illustrationPrompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'illustrationPrompt', value: e.target.value }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="пр. Визуелен доказ за Питагорова теорема со квадрати над страните на триаголник" rows={3}></textarea><p className="text-xs text-gray-500 mt-1">Опишете ја визуелната идеја. Ако сте прикачиле слика, опишете какви промени сакате да направите на неа.</p></div>
    </div>
);

const LearningPathOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => (
    <div className="animate-fade-in">
        <label htmlFor="student-profiles-lp" className="block text-sm font-medium text-gray-700">Избери профили на ученици</label>
        <select id="student-profiles-lp" multiple value={state.selectedStudentProfileIds} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedStudentProfileIds', value: Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value) }})} className="mt-1 block w-full p-2 border-gray-300 rounded-md h-24">
            {user?.studentProfiles?.length ? (
                user.studentProfiles.map((p: StudentProfile) => <option key={p.id} value={p.id}>{p.name}</option>)
            ) : (
                <option disabled>Немате креирано профили. Одете во Поставки.</option>
            )}
        </select>
        <p className="text-xs text-gray-500 mt-1">Држете Ctrl (или Cmd) за да изберете повеќе профили. AI ќе генерира посебна патека за секој избран профил.</p>
    </div>
);


export const MaterialOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => {
    const { materialType } = state;
    
    if (!materialType) return null;

    if (['ASSESSMENT', 'FLASHCARDS', 'QUIZ'].includes(materialType)) {
        return <AssessmentOptions state={state} dispatch={dispatch} user={user} />;
    }
    if (materialType === 'SCENARIO') {
        return <ScenarioOptions state={state} dispatch={dispatch} />;
    }
    if (materialType === 'EXIT_TICKET') {
        return <ExitTicketOptions state={state} dispatch={dispatch} />;
    }
    if (materialType === 'RUBRIC') {
        return <RubricOptions state={state} dispatch={dispatch} />;
    }
    if (materialType === 'ILLUSTRATION') {
        return <IllustrationOptions state={state} dispatch={dispatch} />;
    }
     if (materialType === 'LEARNING_PATH') {
        return <LearningPathOptions state={state} dispatch={dispatch} user={user} />;
    }

    return null;
};