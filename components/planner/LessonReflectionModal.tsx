import React, { useState, useEffect } from 'react';
import type { PlannerItem, LessonReflection } from '../../types';
import { ICONS } from '../../constants';
import { usePlanner } from '../../contexts/PlannerContext';
import { useModal } from '../../contexts/ModalContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { geminiService } from '../../services/geminiService';
import { MathRenderer } from '../common/MathRenderer';

interface LessonReflectionModalProps {
  item: PlannerItem;
}

const initialFormData: LessonReflection = {
    wentWell: '',
    challenges: '',
    nextSteps: '',
};

export const LessonReflectionModal: React.FC<LessonReflectionModalProps> = ({ item }) => {
  const { hideModal } = useModal();
  const { addOrUpdateReflection, getLessonPlan } = usePlanner();
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();

  const [formData, setFormData] = useState<LessonReflection>(item.reflection || initialFormData);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  useEffect(() => {
    setFormData(item.reflection || initialFormData);
    setAiSuggestion(null);
    setIsAnalyzing(false);
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: LessonReflection) => ({ ...prev, [name]: value }));
  };

  const handleAnalyzeReflection = async () => {
    if (!formData.wentWell || !formData.challenges) {
      addNotification('Ве молиме пополнете ги полињата за да добиете анализа.', 'info');
      return;
    }
    setIsAnalyzing(true);
    setAiSuggestion(null);
    try {
      const result = await geminiService.analyzeReflection(formData.wentWell, formData.challenges);
      setAiSuggestion(result);
    } catch (error) {
      addNotification((error as Error).message, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const SuggestionDisplay: React.FC<{ text: string }> = ({ text }) => {
    const match = text.match(/\[(.*?)\]/);
    if (!match) {
        return <MathRenderer text={text} />;
    }
    const actionText = match[1];
    const mainText = text.replace(match[0], '').trim();

    const handleActionClick = () => {
        const lessonPlan = item.lessonPlanId ? getLessonPlan(item.lessonPlanId) : null;
        if (!lessonPlan) {
            addNotification('Не може да се најде поврзана подготовка за да се генерира материјал.', 'error');
            return;
        }

        const params = new URLSearchParams({
            grade: String(lessonPlan.grade),
            topicId: lessonPlan.topicId,
            ...(lessonPlan.conceptIds.length > 0 && { conceptId: lessonPlan.conceptIds[0] }),
            contextType: 'SCENARIO', // Using SCENARIO to pass free text from reflection
            scenario: `Часот беше за "${item.title}". Потешкотиите беа: ${formData.challenges}`
        }).toString();
        
        navigate(`/generator?${params}`);
        hideModal();
    };

    return (
        <>
            <MathRenderer text={mainText} />
            <button
                type="button"
                onClick={handleActionClick}
                className="mt-3 text-sm font-semibold text-brand-secondary hover:text-brand-primary hover:underline not-prose"
            >
                {actionText} &rarr;
            </button>
        </>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        await addOrUpdateReflection(item.id, formData);
        addNotification('Рефлексијата е зачувана!', 'success');
        hideModal();
    } catch (error) {
        addNotification('Грешка при зачувување на рефлексијата.', 'error');
        console.error("Failed to save reflection:", error);
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
        onClick={hideModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflection-modal-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
            <div className="p-6 border-b">
                 <div className="flex justify-between items-center">
                    <div>
                        <h2 id="reflection-modal-title" className="text-2xl font-bold text-brand-primary">Рефлексија за час</h2>
                        <p className="text-sm text-gray-500">{item.title} - {new Date(item.date).toLocaleDateString('mk-MK')}</p>
                    </div>
                    <button type="button" onClick={hideModal} className="p-1 rounded-full hover:bg-gray-200" aria-label="Затвори модал">
                        <ICONS.close className="w-6 h-6 text-gray-600" />
                    </button>
                 </div>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                    <label htmlFor="wentWell" className="block text-sm font-medium text-gray-700">Што помина добро?</label>
                    <textarea
                        id="wentWell"
                        name="wentWell"
                        value={formData.wentWell}
                        onChange={handleChange}
                        rows={3}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                        placeholder="Опишете ги успешните моменти, активности или реакции од учениците..."
                    />
                </div>
                 <div>
                    <label htmlFor="challenges" className="block text-sm font-medium text-gray-700">Каде имаа учениците потешкотии?</label>
                    <textarea
                        id="challenges"
                        name="challenges"
                        value={formData.challenges}
                        onChange={handleChange}
                        rows={3}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        placeholder="Идентификувајте ги концептите или задачите кои беа предизвик..."
                    />
                </div>
                 <div>
                    <label htmlFor="nextSteps" className="block text-sm font-medium text-gray-700">Идеи и забелешки за следниот пат</label>
                    <textarea
                        id="nextSteps"
                        name="nextSteps"
                        value={formData.nextSteps}
                        onChange={handleChange}
                        rows={3}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        placeholder="Што би промениле? Кои ученици имаат потреба од дополнителна поддршка? Идеи за идни часови..."
                    ></textarea>
                </div>
                 <div className="pt-4">
                    {!aiSuggestion && !isAnalyzing && (
                        <button
                            type="button"
                            onClick={handleAnalyzeReflection}
                            disabled={!formData.wentWell || !formData.challenges}
                            className="w-full flex justify-center items-center gap-2 bg-brand-secondary text-white px-4 py-2 rounded-lg disabled:bg-gray-400 hover:bg-brand-primary transition-colors font-semibold"
                        >
                            <ICONS.sparkles className="w-5 h-5"/>
                            Добиј AI анализа и предлог
                        </button>
                    )}

                    {isAnalyzing && (
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
                            <p className="mt-2 text-sm text-gray-600">AI асистентот ја анализира вашата рефлексија...</p>
                        </div>
                    )}

                    {aiSuggestion && (
                        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg animate-fade-in">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <ICONS.lightbulb className="h-6 w-6 text-blue-500" />
                                </div>
                                <div className="ml-3 prose prose-sm max-w-none">
                                    <h3 className="text-md font-semibold text-blue-800 not-prose">AI Предлог</h3>
                                    <SuggestionDisplay text={aiSuggestion} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end items-center bg-gray-50 p-4 rounded-b-lg gap-3">
                 <button
                    type="button"
                    onClick={hideModal}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                    Откажи
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary"
                >
                    Зачувај рефлексија
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};