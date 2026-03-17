import React, { useState, useEffect } from 'react';
import { X, ClipboardList, CheckSquare, Square, Loader2 } from 'lucide-react';
import { firestoreService, type SchoolClass } from '../services/firestoreService';
import { precacheQuizContent } from '../services/indexedDBService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import type { AIGeneratedAssessment } from '../types';

interface Props {
  material: AIGeneratedAssessment;
  materialType: 'QUIZ' | 'ASSESSMENT';
  conceptId?: string;
  gradeLevel?: number;
  onClose: () => void;
}

export const AssignDialog: React.FC<Props> = ({ material, materialType, conceptId, gradeLevel, onClose }) => {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('sv-SE');
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    firestoreService.fetchClasses(firebaseUser.uid).then(setClasses);
  }, [firebaseUser?.uid]);

  const toggleClass = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === classes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(classes.map(c => c.id)));
    }
  };

  const handleSave = async () => {
    if (!firebaseUser?.uid) return;
    if (selectedIds.size === 0) {
      addNotification('Изберете барем едно одделение.', 'warning');
      return;
    }

    setSaving(true);
    try {
      // Save material content once, reuse cacheId for all assignments
      const cacheId = await firestoreService.saveAssignmentMaterial(material, {
        title: material.title,
        type: materialType,
        conceptId,
        gradeLevel,
        teacherUid: firebaseUser.uid,
      });

      const selectedClasses = classes.filter(c => selectedIds.has(c.id));

      await Promise.all(
        selectedClasses.map(cls =>
          firestoreService.saveAssignment({
            title: material.title,
            materialType,
            cacheId,
            teacherUid: firebaseUser.uid,
            classId: cls.id,
            classStudentNames: cls.studentNames,
            dueDate,
            completedBy: [],
          }),
        ),
      );

      // Pre-cache quiz content so students can play offline
      precacheQuizContent(cacheId, material).catch(() => {});

      const names = selectedClasses.map(c => `„${c.name}"`).join(', ');
      addNotification(`Задачата е зададена на ${names}! 📋`, 'success');
      onClose();
    } catch {
      addNotification('Грешка при задавање. Обидете се повторно.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-800">Задај на одделение</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Затвори">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Material title */}
          <div>
            <p className="text-sm text-gray-500 mb-1">Материјал</p>
            <p className="font-semibold text-gray-800 bg-gray-50 rounded-lg px-3 py-2 text-sm truncate">{material.title}</p>
          </div>

          {/* Class multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Одделенија *</label>
              {classes.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={saving}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold disabled:opacity-40"
                >
                  {selectedIds.size === classes.length ? 'Одчекирај сите' : 'Чекирај сите'}
                </button>
              )}
            </div>
            {classes.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Немате одделенија. Прво создадете одделение во табот „🏫 Одделенија" на Аналитиката.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggleClass(cls.id)}
                    disabled={saving}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    {selectedIds.has(cls.id)
                      ? <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                    <span className={selectedIds.has(cls.id) ? 'font-semibold text-gray-800' : 'text-gray-500'}>
                      {cls.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">{cls.studentNames.length} уч.</span>
                  </button>
                ))}
              </div>
            )}
            {classes.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{selectedIds.size} / {classes.length} избрани</p>
            )}
          </div>

          {/* Due date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Рок (deadline)</label>
            <input
              type="date"
              value={dueDate}
              min={new Date().toLocaleDateString('sv-SE')}
              onChange={e => setDueDate(e.target.value)}
              disabled={saving}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40"
            />
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Откажи
          </button>
          <button
            onClick={handleSave}
            disabled={saving || classes.length === 0 || selectedIds.size === 0}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Зачувувам…</>
              : `Задај${selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
