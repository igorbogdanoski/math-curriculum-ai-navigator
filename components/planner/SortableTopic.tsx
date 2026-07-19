import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TopicOverlay } from '../../services/firestoreService.curriculumOverlays';
import type { AIGeneratedAnnualPlanTopic } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';
import { getPedagogicalModelInfo } from '../../data/educationalModelsInfo';
import { ContextualMathTools } from '../lesson-plan-editor/ContextualMathTools';
import type { GradeContext } from '../../utils/mathDomainDetector';

interface SortableTopicProps {
    topic: AIGeneratedAnnualPlanTopic;
    id: string;
    idx: number;
    onGenerateLesson: () => void;
    onGenerateThematic: () => void;
    onUpdate: (updated: AIGeneratedAnnualPlanTopic) => void;
    exploreGradeId?: string;
    gradeContext?: GradeContext;
    overlayNote?: string;
    overlayColor?: TopicOverlay['color'];
    onNoteChange: (note: string, color: TopicOverlay['color']) => void;
    onNoteDelete: () => void;
    lessonCount?: number;
}

const NOTE_COLORS: { key: TopicOverlay['color']; bg: string; border: string; text: string }[] = [
    { key: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800' },
    { key: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-800' },
    { key: 'green',  bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' },
    { key: 'pink',   bg: 'bg-pink-50',   border: 'border-pink-300',   text: 'text-pink-800' },
];

export const SortableTopic: React.FC<SortableTopicProps> = ({
    topic, id, idx, onGenerateLesson, onGenerateThematic, onUpdate, exploreGradeId, gradeContext,
    overlayNote, overlayColor = 'yellow', onNoteChange, onNoteDelete, lessonCount,
}) => {
    const { navigate } = useNavigation();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editWeeks, setEditWeeks] = useState(1);
    const [editObjectives, setEditObjectives] = useState('');
    const [editActivities, setEditActivities] = useState('');
    const [showNote, setShowNote] = useState(false);
    const [noteText, setNoteText] = useState(overlayNote ?? '');
    const [noteColor, setNoteColor] = useState<TopicOverlay['color']>(overlayColor);

    // Sync when parent reloads overlays (e.g. grade change)
    useEffect(() => { setNoteText(overlayNote ?? ''); }, [overlayNote]);
    useEffect(() => { setNoteColor(overlayColor); }, [overlayColor]);

    const handleStartEdit = () => {
        setEditTitle(topic.title);
        setEditWeeks(topic.durationWeeks);
        setEditObjectives(topic.objectives.join('\n'));
        setEditActivities(topic.suggestedActivities.join('\n'));
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        onUpdate({
            ...topic,
            title: editTitle.trim() || topic.title,
            durationWeeks: Math.max(1, editWeeks),
            objectives: editObjectives.split('\n').map(s => s.trim()).filter(Boolean),
            suggestedActivities: editActivities.split('\n').map(s => s.trim()).filter(Boolean),
        });
        setIsEditing(false);
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: isDragging ? 'relative' as const : 'static' as const,
        opacity: isDragging ? 0.9 : 1,
        boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
    };

    return (
        <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-xl bg-gray-50 mb-6 bg-white overflow-hidden transition-all duration-200">
            <div
                className={`p-4 border-b border-gray-200 ${isEditing ? 'bg-blue-50' : 'bg-gray-100/50'}`}
                {...(!isEditing ? { ...attributes, ...listeners } : {})}
                style={!isEditing ? { cursor: 'grab' } : {}}
            >
                {/* Row 1: drag handle + number + full title */}
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-3 mb-2">
                    {!isEditing && (
                        <div className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </div>
                    )}
                    <span className="bg-white border text-gray-600 w-7 h-7 flex items-center justify-center rounded-full shadow-sm text-sm flex-shrink-0">
                        {idx + 1}
                    </span>
                    {isEditing ? (
                        <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                            autoFocus
                            title="Наслов на темата"
                            placeholder="Наслов на темата"
                            onPointerDown={e => e.stopPropagation()}
                        />
                    ) : (
                        <span className="leading-snug">{topic.title}</span>
                    )}
                </h3>
                {/* Row 2: action buttons */}
                <div className="flex items-center gap-2 flex-wrap pl-9" onPointerDown={e => e.stopPropagation()}>
                    {isEditing ? (
                        <>
                            <button type="button" onClick={handleSaveEdit}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 shadow-sm">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Зачувај
                            </button>
                            <button type="button" onClick={() => setIsEditing(false)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-400 text-white text-xs font-bold rounded-lg hover:bg-gray-500 shadow-sm">
                                Откажи
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onGenerateThematic}
                                title="Генерирај тематски план за оваа тема"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                                Тематски план
                            </button>
                            <button
                                type="button"
                                onClick={onGenerateLesson}
                                title="Генерирај план за час за оваа тема"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3L2 12h3v8h14v-8h3L12 3z"/></svg>
                                Генерирај Час
                            </button>
                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 flex items-center gap-1">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                {topic.durationWeeks} нед.
                            </span>
                            <button type="button" onClick={handleStartEdit}
                                title="Уреди ја темата"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 shadow-sm">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Уреди
                            </button>
                            {exploreGradeId && (
                                <button type="button"
                                    onClick={() => navigate(`/explore?gradeId=${exploreGradeId}`)}
                                    title="Виж ги целите и стандардите во Истражи програма"
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-indigo-200 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 shadow-sm">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                    Програма
                                </button>
                            )}
                            {lessonCount !== undefined && (
                                <span
                                    title={`${lessonCount} зачувани час${lessonCount === 1 ? '' : 'а'} за оваа тема`}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${lessonCount > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                                >
                                    {lessonCount > 0 ? '✅' : '○'} {lessonCount} ч.
                                </span>
                            )}
                            <button type="button"
                                onClick={() => setShowNote(v => !v)}
                                title={overlayNote ? 'Уреди белешка' : 'Додади белешка'}
                                className={`flex items-center gap-1 px-2.5 py-1.5 border text-xs font-medium rounded-lg shadow-sm transition-colors ${overlayNote ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                                📝{overlayNote ? ' Белешка' : ''}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4" onPointerDown={e => e.stopPropagation()}>
                    <div>
                        <label htmlFor={`edit-weeks-${id}`} className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Траење (недели)</label>
                        <input
                            id={`edit-weeks-${id}`}
                            type="number"
                            value={editWeeks}
                            onChange={e => setEditWeeks(Number(e.target.value))}
                            min={1} max={36}
                            title="Траење во недели"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label htmlFor={`edit-obj-${id}`} className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Цели / Очекувани резултати <span className="text-gray-400 font-normal">(по една на ред)</span></label>
                        <textarea
                            id={`edit-obj-${id}`}
                            value={editObjectives}
                            onChange={e => setEditObjectives(e.target.value)}
                            rows={6}
                            title="Цели и очекувани резултати"
                            placeholder="По една цел на секој ред"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label htmlFor={`edit-act-${id}`} className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Предложени активности <span className="text-gray-400 font-normal">(по една на ред)</span></label>
                        <textarea
                            id={`edit-act-${id}`}
                            value={editActivities}
                            onChange={e => setEditActivities(e.target.value)}
                            rows={6}
                            title="Предложени наставни активности"
                            placeholder="По една активност на секој ред"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                        />
                    </div>
                </div>
            ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-brand-primary text-sm mb-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Очекувани резултати / Цели
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
                        {topic.objectives.map((obj, i) => (
                            <li key={i} className="leading-snug">{obj}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-brand-accent text-sm mb-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 21v-8a2 2 0 0 1 2-2h8"></path><polygon points="16 7 20 11 16 15"></polygon><line x1="4" y1="11" x2="10" y2="11"></line></svg>
                        Предложени активности
                    </h4>
                    {topic.pedagogicalModel && (
                        <span
                            className="inline-block mb-2 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold"
                            title={getPedagogicalModelInfo(topic.pedagogicalModel)?.text ?? ''}
                        >
                            {getPedagogicalModelInfo(topic.pedagogicalModel)?.title ?? topic.pedagogicalModel}
                        </span>
                    )}
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
                        {topic.suggestedActivities.map((act, i) => (
                            <li key={i} className="leading-snug">{act}</li>
                        ))}
                    </ul>
                </div>
            </div>
            )}

            {/* Wave 9.3 (audit_2026_07_18_full_app_review, 2026-07-19 post-closure): Annual Plan
                previously had zero lab surfacing at all — reuses the same ContextualMathTools as
                the Lesson Plan Editor and Thematic Plan. */}
            {!isEditing && (
                <div className="px-4 pb-4">
                    <ContextualMathTools topicTitle={topic.title} gradeContext={gradeContext} onNavigate={navigate} />
                </div>
            )}

            {/* S93-D: Мои Бележки note overlay */}
            {showNote && (
                <div className={`border-t px-4 py-3 ${NOTE_COLORS.find(c => c.key === noteColor)?.bg ?? 'bg-yellow-50'} ${NOTE_COLORS.find(c => c.key === noteColor)?.border ?? 'border-yellow-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-black text-gray-600 uppercase tracking-wide">📝 Мои Бележки</span>
                        <div className="flex gap-1 ml-auto">
                            {NOTE_COLORS.map(c => (
                                <button
                                    key={c.key}
                                    type="button"
                                    aria-label={`Боја ${c.key}`}
                                    onClick={() => setNoteColor(c.key)}
                                    className={`w-5 h-5 rounded-full border-2 transition-transform ${c.bg} ${noteColor === c.key ? 'border-gray-600 scale-125' : 'border-gray-300'}`}
                                />
                            ))}
                        </div>
                    </div>
                    <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        rows={3}
                        placeholder="Лична белешка за оваа тема (видлива само за тебе)..."
                        className={`w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white/70 ${NOTE_COLORS.find(c => c.key === noteColor)?.text ?? 'text-yellow-800'}`}
                        onPointerDown={e => e.stopPropagation()}
                    />
                    <div className="flex gap-2 mt-2">
                        <button
                            type="button"
                            onClick={() => { onNoteChange(noteText, noteColor); setShowNote(false); }}
                            className="px-3 py-1 bg-gray-700 text-white text-xs font-bold rounded-lg hover:bg-gray-800"
                        >
                            Зачувај
                        </button>
                        {overlayNote && (
                            <button
                                type="button"
                                onClick={() => { onNoteDelete(); setNoteText(''); setShowNote(false); }}
                                className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200"
                            >
                                Избриши
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowNote(false)}
                            className="px-3 py-1 bg-white border border-gray-300 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50"
                        >
                            Откажи
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
