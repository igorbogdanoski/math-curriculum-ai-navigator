
import React, { useMemo, useEffect } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import { ICONS } from '../../constants';
import type { GeneratorState, GeneratorAction } from '../../hooks/useGeneratorState';
import type { GenerationContextType, Grade, Topic, Concept, NationalStandard } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

const CONTEXT_OPTIONS: { id: GenerationContextType | 'ACTIVITY'; label: string; icon: any; desc: string }[] = [
    { id: 'CONCEPT', label: 'Од Поим/Тема', icon: ICONS.bookOpen, desc: 'Избери од наставната програма' },
    { id: 'ACTIVITY', label: 'Од Активност', icon: ICONS.activity, desc: 'Започни со конкретна активност' },
    { id: 'STANDARD', label: 'Според Стандард', icon: ICONS.target, desc: 'Национални стандарди и цели' },
    { id: 'SCENARIO', label: 'По твоја идеја', icon: ICONS.lightbulb, desc: 'Внеси слободен текст/сценарио' },
];

interface ImageUploaderProps {
    imageFile: GeneratorState['imageFile'];
    dispatch: React.Dispatch<GeneratorAction>;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

const ImageUploader: React.FC<ImageUploaderProps> = ({ imageFile, dispatch }) => {
    const { addNotification } = useNotification();
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                const payload = { file, base64, previewUrl: URL.createObjectURL(file) };
                dispatch({ type: 'SET_FIELD', payload: { field: 'imageFile', value: payload } });
            } catch (error) {
                addNotification('Грешка при процесирање на сликата.', 'error');
            }
        }
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800">Додади слика како контекст (опционално)</h2>
            <div className="mt-4">
                {imageFile ? (
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-md border">
                        <img src={imageFile.previewUrl} alt="Preview" className="w-24 h-24 object-cover rounded-md border"/>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{imageFile.file.name}</p>
                            <p className="text-xs text-gray-500">{(imageFile.file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button type="button" onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'imageFile', value: null }})} className="p-2 rounded-full hover:bg-red-100 text-red-600"><ICONS.trash className="w-5 h-5"/></button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-100">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <ICONS.gallery className="w-8 h-8 mb-2 text-gray-500" />
                                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Кликни за да прикачиш</span> или повлечи слика</p>
                                <p className="text-xs text-gray-500">PNG, JPG, WEBP (Max 4MB)</p>
                            </div>
                            <input id="image-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                        </label>
                    </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Прикачете слика од задача, дијаграм, или било што друго што сакате AI да го анализира, објасни или измени.</p>
            </div>
        </div>
    );
};


interface GenerationContextFormProps {
    state: GeneratorState;
    dispatch: React.Dispatch<GeneratorAction>;
}

export const GenerationContextForm: React.FC<GenerationContextFormProps> = ({ state, dispatch }) => {
    const { curriculum, allNationalStandards } = useCurriculum();
    const { contextType, selectedGrade, selectedTopic, selectedConcepts, selectedActivity, selectedStandard, scenarioText, imageFile, materialType } = state;

    const filteredTopics = useMemo(() => curriculum?.grades.find((g: Grade) => g.id === selectedGrade)?.topics || [], [curriculum, selectedGrade]);
    const filteredConcepts = useMemo(() => filteredTopics.find((t: Topic) => t.id === selectedTopic)?.concepts || [], [filteredTopics, selectedTopic]);

    const activitiesForContext = useMemo(() => {
        // If specific concepts are selected, show only their activities
        if (selectedConcepts.length > 0) {
            return filteredConcepts
                .filter((c: Concept) => selectedConcepts.includes(c.id))
                .flatMap((c: Concept) => c.activities || []);
        }
        // If no concepts are selected but a topic is, show all activities for that topic
        if (selectedTopic) {
            return filteredConcepts.flatMap((c: Concept) => c.activities || []);
        }
        return [];
    }, [selectedConcepts, selectedTopic, filteredConcepts]);

    // Effect to auto-select the first activity when the list changes
    useEffect(() => {
        if (contextType === 'ACTIVITY') {
            const firstActivity = activitiesForContext[0];
            if (firstActivity && selectedActivity !== firstActivity) {
                dispatch({ type: 'SET_FIELD', payload: { field: 'selectedActivity', value: firstActivity } });
            } else if (activitiesForContext.length === 0) {
                dispatch({ type: 'SET_FIELD', payload: { field: 'selectedActivity', value: '' } });
            }
        }
    }, [activitiesForContext, contextType, dispatch, selectedActivity]);

    const handleConceptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
        dispatch({ type: 'SET_FIELD', payload: { field: 'selectedConcepts', value: selectedOptions } });
    };

    const shouldShowImageUpload = useMemo(() => materialType !== 'RUBRIC', [materialType]);

    const toggleConcept = (conceptId: string) => {
        const newConcepts = selectedConcepts.includes(conceptId)
            ? selectedConcepts.filter((id: string) => id !== conceptId)
            : [...selectedConcepts, conceptId];
        dispatch({ type: 'SET_FIELD', payload: { field: 'selectedConcepts', value: newConcepts } });
    };

    return (
        <fieldset data-tour="generator-step-2" className="p-6 border border-gray-100 rounded-2xl bg-white shadow-sm mt-4">
            <div className="mb-6">
                <legend className="text-xl font-bold text-gray-800">2. Изберете почетна точка (Контекст)</legend>
                <p className="text-sm text-gray-500 mt-1">Врз основа на што сакате да го креирате овој материјал?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {CONTEXT_OPTIONS.map(({ id, label, icon: Icon, desc }) => {
                    const isActive = contextType === id;
                    return (
                        <button
                            type="button"
                            key={id}
                            onClick={() => dispatch({ type: 'SET_CONTEXT_TYPE', payload: id as GenerationContextType | 'ACTIVITY' })}
                            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left group ${
                                isActive 
                                ? 'border-brand-primary bg-brand-primary/5 shadow-sm' 
                                : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <Icon className={`w-6 h-6 mb-3 ${isActive ? 'text-brand-primary' : 'text-gray-400 group-hover:text-gray-600'}`} />
                            <span className={`font-bold text-sm mb-1 ${isActive ? 'text-brand-primary' : 'text-gray-700'}`}>{label}</span>
                            <span className="text-xs text-gray-500">{desc}</span>
                        </button>
                    );
                })}
            </div>
            
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
                {(contextType === 'CONCEPT' || contextType === 'ACTIVITY') && (
                    <div className="flex flex-col gap-6 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                    Одделение
                                </label>
                                <select value={selectedGrade} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_GRADE', payload: e.target.value })} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                                    {curriculum?.grades.map((g: Grade) => <option key={g.id} value={g.id}>{g.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                    Тема
                                </label>
                                <select value={selectedTopic} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_TOPIC', payload: e.target.value })} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!selectedGrade}>
                                    <option value="">-- Избери тема --</option>
                                    {filteredTopics.map((t: Topic) => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </select>
                            </div>
                        </div>

                        {contextType === 'CONCEPT' && (
                            <div className="border-t border-gray-200 pt-5">
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                    Специфични поими (Опционално)
                                </label>
                                
                                {!selectedTopic ? (
                                    <p className="text-sm text-gray-400 italic bg-white p-4 rounded-xl border border-gray-200 border-dashed text-center">Прво изберете тема за да видите листа на поими.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm max-h-48 overflow-y-auto">
                                        {filteredConcepts.map((c: Concept) => {
                                            const isSelected = selectedConcepts.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => toggleConcept(c.id)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                                        isSelected 
                                                        ? 'bg-brand-primary border-brand-primary text-white shadow-sm' 
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {isSelected && <span className="mr-1 inline-block">✓</span>}
                                                    {c.title}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {contextType === 'ACTIVITY' && (
                            <div className="border-t border-gray-200 pt-5 animate-fade-in">
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                    Активност од програмата
                                </label>
                                <select value={selectedActivity} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedActivity', value: e.target.value } })} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800 disabled:opacity-50" disabled={activitiesForContext.length === 0}>
                                    {activitiesForContext.length > 0 ? (
                                        activitiesForContext.map((act: string, i: number) => <option key={i} value={act}>{act.substring(0,150)}{act.length > 150 ? '...' : ''}</option>)
                                    ) : (
                                        <option>Прво изберете тема за да се прикажат активности.</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>
                )}
                
                {contextType === 'STANDARD' && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Национален стандард</label>
                        <select value={selectedStandard} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedStandard', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                            {allNationalStandards?.map((s: NationalStandard) => <option key={s.id} value={s.id}>{s.code} - {s.description}</option>)}
                        </select>
                    </div>
                )}
                
                {contextType === 'SCENARIO' && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Сценарио или наратив од часот</label>
                        <p className="text-xs text-gray-500 mb-3">Детално опишете ја идејата, проблемот или текот на часот за кој ви е потребен материјал.</p>
                        <textarea value={scenarioText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'scenarioText', value: e.target.value }})} rows={5} className="block w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm text-gray-800 resize-y" placeholder="Пр. Сакам да направам час каде што плоштината ја објаснуваме преку поплочување на дворот со плочки со различни димензии..."></textarea>
                    </div>
                )}
            </div>
            
            {shouldShowImageUpload && contextType === 'SCENARIO' && (
                <div className="pt-6 mt-6 border-t border-gray-100">
                    <ImageUploader imageFile={imageFile} dispatch={dispatch} />
                </div>
            )}
        </fieldset>
    );
};
