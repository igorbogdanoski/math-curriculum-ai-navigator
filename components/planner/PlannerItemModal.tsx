import { logger } from '../../utils/logger';

import React, { useState, useEffect } from 'react';
import type { PlannerItem, LessonPlan } from '../../types';
import { PlannerItemType, QuestionType } from '../../types';
import { HomeworkPanel } from './HomeworkPanel';
import { ICONS } from '../../constants';
import { usePlanner } from '../../contexts/PlannerContext';
import { useModal } from '../../contexts/ModalContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { geminiService } from '../../services/geminiService';
import { sanitizePromptInput } from '../../services/gemini/core';
import { firestoreService, type QuizResult } from '../../services/firestoreService';
import { Sparkles, TicketCheck, ExternalLink, Users, CheckCircle2, Copy, CheckCheck } from 'lucide-react';

interface PlannerItemModalProps {
  item?: Partial<PlannerItem>;
}

const getInitialFormData = (item?: Partial<PlannerItem>): Partial<PlannerItem> => {
  const isNewItem = !item?.id;

  const defaults = {
    title: isNewItem ? '' : '',
    type: PlannerItemType.EVENT,
    description: isNewItem ? '' : '',
    date: new Date().toISOString().split('T')[0],
  };

  return {
    ...defaults,
    ...item,
  };
};


declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const PlannerItemModal: React.FC<PlannerItemModalProps> = ({ item }) => {
  const { hideModal } = useModal();
  const { navigate } = useNavigation();
  const { lessonPlans, addItem, updateItem, deleteItem, getLessonPlan } = usePlanner();
  const { addNotification } = useNotification();
  const [formData, setFormData] = useState<Partial<PlannerItem>>(() => getInitialFormData(item));
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // Exit ticket state
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const [ticketResults, setTicketResults] = useState<QuizResult[] | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData(item));
    setIsConfirmingDelete(false);
    setTicketResults(null);
    // Load existing exit ticket results
    if (item?.exitTicketCacheId) {
      firestoreService.fetchQuizResultsByQuizId(item.exitTicketCacheId).then(setTicketResults).catch(() => {});
    }
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<PlannerItem>) => ({ ...prev, [name]: value }));
  };
  
  const isNew = !formData?.id;
  const ModalIcon = isNew ? ICONS.plus : ICONS.edit;

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        addNotification('Вашиот прелистувач не поддржува говорен внес.', 'error');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'mk-MK';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        const safeTranscript = sanitizePromptInput(transcript, 600);
        setIsListening(false);
        setIsProcessingVoice(true);
        
        try {
            const parsedData = await geminiService.parsePlannerInput(safeTranscript);
            setFormData((prev: Partial<PlannerItem>) => ({
                ...prev,
                title: parsedData.title || prev.title,
                date: parsedData.date || prev.date,
                type: (parsedData.type as PlannerItemType) || prev.type,
                description: parsedData.description || prev.description
            }));
            addNotification('Успешно препознаено!', 'success');
        } catch (error) {
            addNotification('Не успеав да го разберам говорот.', 'error');
        } finally {
            setIsProcessingVoice(false);
        }
    };

    recognition.onerror = (event: any) => {
        logger.error(event.error);
        setIsListening(false);
        setIsProcessingVoice(false);
        addNotification('Грешка при слушање.', 'error');
    };

    recognition.onend = () => {
        setIsListening(false);
    };

    recognition.start();
  };


  const handleGenerateExitTicket = async () => {
    const lessonPlan = formData.lessonPlanId ? getLessonPlan(formData.lessonPlanId) : null;
    if (!lessonPlan && !formData.title) return;

    setIsGeneratingTicket(true);
    try {
      const grade = lessonPlan?.grade ?? 6;
      const theme = lessonPlan?.theme ?? formData.title ?? '';
      const context = {
        type: 'SCENARIO' as const,
        grade: { id: `g${grade}`, level: grade, title: `${grade}. одделение`, topics: [] },
        scenario: `Час на тема "${theme}". ${lessonPlan?.title ?? ''}`,
      };
      const result = await geminiService.generateAssessment(
        'QUIZ',
        [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
        5,
        context,
        undefined,
        'standard',
        undefined,
        undefined,
        `EXIT TICKET: 5 кратки прашања за крај на час за да се провери разбирањето. Прашањата мора да бидат директно поврзани со темата: "${theme}".`
      );

      const ticketId = await firestoreService.saveExitTicketQuiz(result, {
        lessonTitle: formData.title ?? '',
        gradeLevel: grade,
        topicId: lessonPlan?.topicId,
        conceptId: lessonPlan?.conceptIds?.[0],
      });

      if (ticketId && formData.id) {
        const updatedItem = { ...formData, exitTicketCacheId: ticketId } as PlannerItem;
        await updateItem(updatedItem);
        setFormData(updatedItem);
        setTicketResults([]);
        addNotification('Exit ticket генериран и зачуван!', 'success');
      }
    } catch (err) {
      addNotification('Грешка при генерирање на exit ticket.', 'error');
      logger.error('Exit ticket generation error', err);
    } finally {
      setIsGeneratingTicket(false);
    }
  };

  const handleCopyTicketLink = () => {
    if (!formData.exitTicketCacheId) return;
    const url = `${window.location.origin}${window.location.pathname}#/play/${formData.exitTicketCacheId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.date || !formData.type) {
        return;
    }

    setIsSaving(true);
    try {
        if (isNew) {
          await addItem({
            title: formData.title,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            lessonPlanId: formData.lessonPlanId,
          });
          addNotification('Настанот е успешно креиран!', 'success');
        } else {
          await updateItem(formData as PlannerItem);
          addNotification('Настанот е успешно ажуриран!', 'success');
        }
        hideModal();
    } catch (error) {
        addNotification('Грешка при зачувување на настанот.', 'error');
        logger.error('Save planner item error', error);
    } finally {
        setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if(formData?.id) {
        try {
            await deleteItem(formData.id);
            addNotification('Настанот е избришан.', 'success');
            hideModal();
        } catch (error) {
            addNotification('Грешка при бришење на настанот.', 'error');
            logger.error('Delete planner item error', error);
        }
    } else {
        hideModal();
    }
  };

  const handleViewLessonPlan = () => {
    if (formData.lessonPlanId) {
        hideModal();
        navigate(`/planner/lesson/view/${formData.lessonPlanId}`);
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
        onClick={hideModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full transform transition-all animate-fade-in-up"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
            <div className="p-6 border-b">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-primary/10 p-2 rounded-full">
                            <ModalIcon className="w-6 h-6 text-brand-primary" />
                        </div>
                        <h2 id="modal-title" className="text-2xl font-bold text-brand-primary">{isNew ? 'Нов настан' : 'Уреди настан'}</h2>
                    </div>
                    <button type="button" onClick={hideModal} className="p-1 rounded-full hover:bg-gray-200" aria-label="Затвори модал">
                        <ICONS.close className="w-6 h-6 text-gray-600" />
                    </button>
                 </div>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto relative">
                {/* Loading overlay for voice processing */}
                {(isListening || isProcessingVoice) && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                        <div className={`p-4 rounded-full ${isListening ? 'bg-red-100 animate-pulse' : 'bg-blue-100'}`}>
                            {isListening ? <ICONS.microphone className="w-8 h-8 text-red-600" /> : <ICONS.sparkles className="w-8 h-8 text-blue-600 animate-spin" />}
                        </div>
                        <p className="mt-3 font-medium text-gray-700">{isListening ? 'Ве слушам...' : 'Ги обработувам податоците...'}</p>
                    </div>
                )}

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Наслов</label>
                        {isNew && (
                            <button 
                                type="button" 
                                onClick={handleVoiceInput} 
                                className="flex items-center text-xs text-brand-secondary hover:text-brand-primary bg-blue-50 px-2 py-1 rounded-full transition-colors"
                                title="Користи гласовен внес"
                            >
                                <ICONS.microphone className="w-3 h-3 mr-1" /> Говорен внес
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title || ''}
                        onChange={handleChange}
                        required
                        placeholder={isNew ? "Пр. Тест по математика" : ""}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700">Датум</label>
                        <input
                            type="date"
                            id="date"
                            name="date"
                            value={formData.date || ''}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="type" className="block text-sm font-medium text-gray-700">Тип</label>
                        <select
                            id="type"
                            name="type"
                            value={formData.type || PlannerItemType.EVENT}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value={PlannerItemType.LESSON}>Час</option>
                            <option value={PlannerItemType.EVENT}>Настан</option>
                            <option value={PlannerItemType.HOLIDAY}>Празник</option>
                        </select>
                    </div>
                </div>
                {formData.type === PlannerItemType.LESSON && (
                    <div className="animate-fade-in">
                        <label htmlFor="lessonPlanId" className="block text-sm font-medium text-gray-700">Поврзи со подготовка за час</label>
                        <select
                            id="lessonPlanId"
                            name="lessonPlanId"
                            value={formData.lessonPlanId || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="">-- Избери подготовка --</option>
                            {lessonPlans.map((lp: LessonPlan) => <option key={lp.id} value={lp.id}>{lp.title} ({lp.grade}. одд)</option>)}
                        </select>
                    </div>
                )}

                {/* ── Exit Ticket Section (only for saved lessons) ── */}
                {!isNew && formData.type === PlannerItemType.LESSON && (
                    <div className="animate-fade-in border border-indigo-100 bg-indigo-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <TicketCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            <span className="text-sm font-bold text-indigo-800">Exit Ticket</span>
                            {formData.exitTicketCacheId && (
                                <span className="ml-auto text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Генериран</span>
                            )}
                        </div>

                        {!formData.exitTicketCacheId ? (
                            <div>
                                <p className="text-xs text-indigo-700 mb-3">
                                    Генерирај 5-прашалник за крај на часот. Учениците го играат, ти го гледаш резултатот.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleGenerateExitTicket}
                                    disabled={isGeneratingTicket}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    {isGeneratingTicket
                                        ? <><ICONS.spinner className="w-3.5 h-3.5 animate-spin" /> Генерирам...</>
                                        : <><Sparkles className="w-3.5 h-3.5" /> Генерирај Exit Ticket</>}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Results summary */}
                                {ticketResults !== null && (
                                    <div className="flex items-center gap-4 text-xs font-semibold">
                                        <span className="flex items-center gap-1 text-slate-600">
                                            <Users className="w-3.5 h-3.5" />
                                            {ticketResults.length} {ticketResults.length === 1 ? 'ученик' : 'ученици'}
                                        </span>
                                        {ticketResults.length > 0 && (
                                            <span className="flex items-center gap-1 text-green-700">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                {Math.round(ticketResults.reduce((s, r) => s + r.percentage, 0) / ticketResults.length)}% просек
                                            </span>
                                        )}
                                    </div>
                                )}
                                {/* Link actions */}
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleCopyTicketLink}
                                        className="flex items-center gap-1.5 text-xs font-bold bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                                    >
                                        {copiedTicket ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedTicket ? 'Копирано!' : 'Копирај линк'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { window.open(`#/play/${formData.exitTicketCacheId}`, '_blank'); }}
                                        className="flex items-center gap-1.5 text-xs font-bold bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> Отвори квиз
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* ── Homework Tasks (only for saved lessons) ── */}
                {!isNew && formData.type === PlannerItemType.LESSON && (
                    <HomeworkPanel
                        tasks={formData.tasks ?? []}
                        onChange={(tasks) => setFormData(prev => ({ ...prev, tasks }))}
                    />
                )}
                 <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Опис (опционално)</label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description || ''}
                        onChange={handleChange}
                        rows={3}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    ></textarea>
                </div>
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-b-lg">
                <div className="flex items-center gap-2">
                    {!isNew && !isConfirmingDelete && (
                         <button
                            type="button"
                            onClick={() => setIsConfirmingDelete(true)}
                            className="flex items-center text-red-600 hover:text-red-800 font-medium px-3 py-2 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            <ICONS.trash className="w-5 h-5 mr-2"/>
                            Избриши
                        </button>
                    )}
                    {!isNew && isConfirmingDelete && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <span className="text-sm text-gray-700 font-medium">Дали сте сигурни?</span>
                            <button type="button" onClick={handleConfirmDelete} className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">Да, избриши</button>
                            <button type="button" onClick={() => setIsConfirmingDelete(false)} className="px-3 py-1 text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md">Не</button>
                        </div>
                    )}
                     {!isNew && formData.type === PlannerItemType.LESSON && formData.lessonPlanId && (
                        <button
                            type="button"
                            onClick={handleViewLessonPlan}
                            className="flex items-center text-brand-secondary hover:text-brand-primary font-medium px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <ICONS.bookOpen className="w-5 h-5 mr-2"/>
                            Види подготовка
                        </button>
                    )}
                </div>
                <div className="flex gap-3">
                     <button
                        type="button"
                        onClick={hideModal}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                    >
                        Откажи
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary font-semibold flex items-center gap-2 disabled:bg-gray-400"
                    >
                        {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                        {isSaving ? 'Зачувувам...' : 'Зачувај'}
                    </button>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
};
