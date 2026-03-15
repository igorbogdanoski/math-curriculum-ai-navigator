import React, { useState, useEffect } from 'react';
import { X, ClipboardList } from 'lucide-react';
import { firestoreService, type SchoolClass } from '../services/firestoreService';
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
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    // Use sv-SE locale to get YYYY-MM-DD in local time (toISOString returns UTC which can be yesterday in UTC+N timezones)
    return d.toLocaleDateString('sv-SE');
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    firestoreService.fetchClasses(firebaseUser.uid).then(setClasses);
  }, [firebaseUser?.uid]);

  const handleSave = async () => {
    if (!firebaseUser?.uid) return;
    if (!selectedClassId) {
      addNotification('Изберете одделение.', 'warning');
      return;
    }
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return;

    setSaving(true);
    try {
      const cacheId = await firestoreService.saveAssignmentMaterial(material, {
        title: material.title,
        type: materialType,
        conceptId,
        gradeLevel,
        teacherUid: firebaseUser.uid,
      });

      await firestoreService.saveAssignment({
        title: material.title,
        materialType,
        cacheId,
        teacherUid: firebaseUser.uid,
        classId: selectedClassId,
        classStudentNames: cls.studentNames,
        dueDate,
        completedBy: [],
      });

      addNotification(`Задачата е зададена на „${cls.name}"! 📋`, 'success');
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
          <div>
            <p className="text-sm text-gray-500 mb-1">Материјал</p>
            <p className="font-semibold text-gray-800 bg-gray-50 rounded-lg px-3 py-2 text-sm truncate">{material.title}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Одделение *</label>
            {classes.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Немате одделенија. Прво создадете одделение во табот „🏫 Одделенија" на Аналитиката.
              </p>
            ) : (
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Изберете одделение —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.studentNames.length} ученици)</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Рок (deadline)</label>
            <input
              type="date"
              value={dueDate}
              min={new Date().toLocaleDateString('sv-SE')}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50">
            Откажи
          </button>
          <button
            onClick={handleSave}
            disabled={saving || classes.length === 0}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Зачувувам…' : 'Задај'}
          </button>
        </div>
      </div>
    </div>
  );
};
