
import React, { useMemo, useEffect } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import { ICONS } from '../../constants';
import type { GeneratorState, GeneratorAction } from '../../hooks/useGeneratorState';
import type { GenerationContextType, Grade, Topic, Concept, NationalStandard } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

const contextOptions: { id: GenerationContextType | 'ACTIVITY'; label: string }[] = [
    { id: 'CONCEPT', label: 'Од Поим/Тема' },
    { id: 'ACTIVITY', label: 'Од Активност' },
    { id: 'STANDARD', label: 'Според Стандард' },
    { id: 'SCENARIO', label: 'По твоја идеја' },
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

    return (
        <fieldset data-tour="generator-step-2" className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm">
            <legend className="text-xl font-bold text-gray-800 px-2 -ml-2 mb-2">2. Изберете извор на контекст</legend>
            <div className="flex w-full bg-gray-100 p-1.5 rounded-xl mb-6 overflow-x-auto">
                {contextOptions.map(({ id, label }) => (
                <button
                    type="button"
                    key={id}
                    onClick={() => dispatch({ type: 'SET_CONTEXT_TYPE', payload: id })}
                    className={`flex-1 min-w-[120px] py-2 px-3 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${contextType === id ? 'bg-white shadow-sm text-brand-primary border border-gray-200/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}`}
                >
                    {label}
                </button>
                ))}
            </div>
            
            <div className="pt-2">
                {(contextType === 'CONCEPT' || contextType === 'ACTIVITY') && (
                    <div className="flex flex-col gap-5 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Одделение</label>
                                <select value={selectedGrade} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_GRADE', payload: e.target.value })} className="block w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all shadow-sm">
                                    {curriculum?.grades.map((g: Grade) => <option key={g.id} value={g.id}>{g.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Тема</label>
                                <select value={selectedTopic} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_TOPIC', payload: e.target.value })} className="block w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all shadow-sm" disabled={!selectedGrade}>
                                    <option value="">-- Избери тема --</option>
                                    {filteredTopics.map((t: Topic) => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Поими (опционално)</label>
                            <select multiple value={selectedConcepts} onChange={handleConceptChange} className="block w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all shadow-sm h-36" disabled={!selectedTopic}>
                                {filteredConcepts.map((c: Concept) => <option key={c.id} value={c.id} className="py-1 px-2 my-0.5 rounded cursor-pointer hover:bg-brand-primary hover:text-white checked:bg-brand-primary checked:text-white">{c.title}</option>)}
                            </select>
                            <p className="text-xs text-brand-secondary mt-2 flex items-center bg-blue-50 p-2 rounded-md border border-blue-100">
                                ℹ️ Држете Ctrl (или Cmd на Mac) за да изберете повеќе поими.
                            </p>
                        </div>
                    </div>
                )}
                    {contextType === 'ACTIVITY' && (
                    <div className="animate-fade-in mt-5 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Активност од програмата</label>
                        <select value={selectedActivity} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedActivity', value: e.target.value } })} className="block w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none bg-white shadow-sm" disabled={activitiesForContext.length === 0}>
                            {activitiesForContext.length > 0 ? (
                                activitiesForContext.map((act: string, i: number) => <option key={i} value={act}>{act.substring(0,120)}...</option>)
                            ) : (
                                <option>Прво изберете тема за да се прикажат активности.</option>
                            )}
                        </select>
                    </div>
                    )}
                {contextType === 'STANDARD' && (<div className="animate-fade-in mt-5"><label className="block text-sm font-semibold text-gray-700 mb-1.5">Национален стандард</label><select value={selectedStandard} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedStandard', value: e.target.value }})} className="block w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none bg-gray-50 focus:bg-white shadow-sm">{allNationalStandards?.map((s: NationalStandard) => <option key={s.id} value={s.id}>{s.code} - {s.description}</option>)}</select></div>)}
                {contextType === 'SCENARIO' && (<div className="animate-fade-in mt-5"><label className="block text-sm font-semibold text-gray-700 mb-1.5">Сценарио или наратив од часот</label><textarea value={scenarioText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'scenarioText', value: e.target.value }})} rows={5} className="block w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none bg-gray-50 focus:bg-white shadow-sm" placeholder="Внесете опис на активностите од часот, клучна дискусија или проблем на кој сте работеле..."></textarea></div>)}
            </div>
            {shouldShowImageUpload && contextType === 'SCENARIO' && (
                <div className="pt-6 mt-6 border-t">
                    <ImageUploader imageFile={imageFile} dispatch={dispatch} />
                </div>
            )}
        </fieldset>
    );
};
