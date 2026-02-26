import React, { useState } from 'react';
import { Plus, Trash2, CheckSquare, Square, BookOpen } from 'lucide-react';
import type { HomeworkTask } from '../../types';

interface HomeworkPanelProps {
    tasks: HomeworkTask[];
    onChange: (tasks: HomeworkTask[]) => void;
}

export const HomeworkPanel: React.FC<HomeworkPanelProps> = ({ tasks, onChange }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDueDate, setNewDueDate] = useState('');

    const handleAddTask = () => {
        if (!newTitle.trim()) return;
        const task: HomeworkTask = {
            id: crypto.randomUUID(),
            title: newTitle.trim(),
            dueDate: newDueDate || undefined,
            done: false,
        };
        onChange([...tasks, task]);
        setNewTitle('');
        setNewDueDate('');
        setIsAdding(false);
    };

    const handleToggle = (id: string) => {
        onChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const handleDelete = (id: string) => {
        onChange(tasks.filter(t => t.id !== id));
    };

    const pending = tasks.filter(t => !t.done).length;

    return (
        <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-widest">Домашни задачи</h3>
                    {tasks.length > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            pending === 0 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {pending === 0 ? 'Сè завршено ✓' : `${pending} незавршени`}
                        </span>
                    )}
                </div>
                {!isAdding && (
                    <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Додај
                    </button>
                )}
            </div>

            {tasks.length === 0 && !isAdding && (
                <p className="text-xs text-blue-400 italic text-center py-2">
                    Нема задачи. Кликни „Додај" за да додадеш домашна задача.
                </p>
            )}

            {tasks.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                    {tasks.map(task => (
                        <li key={task.id} className="flex items-center gap-2 group">
                            <button
                                type="button"
                                onClick={() => handleToggle(task.id)}
                                className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition"
                            >
                                {task.done
                                    ? <CheckSquare className="w-4 h-4 text-green-500" />
                                    : <Square className="w-4 h-4" />}
                            </button>
                            <span className={`flex-1 text-sm ${task.done ? 'line-through text-gray-400' : 'text-slate-700'}`}>
                                {task.title}
                            </span>
                            {task.dueDate && (
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    до {new Date(task.dueDate).toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit' })}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleDelete(task.id)}
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {isAdding && (
                <div className="mt-2 space-y-2">
                    <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setIsAdding(false); }}
                        placeholder="Наслов на задачата..."
                        autoFocus
                        className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={newDueDate}
                            onChange={e => setNewDueDate(e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1"
                        />
                        <button
                            type="button"
                            onClick={handleAddTask}
                            disabled={!newTitle.trim()}
                            className="text-xs font-bold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
                        >
                            Зачувај
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsAdding(false); setNewTitle(''); setNewDueDate(''); }}
                            className="text-xs font-bold px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                        >
                            Откажи
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
