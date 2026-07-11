import React, { useState, useEffect } from 'react';
import { Loader2, X, Send } from 'lucide-react';
import { fetchClasses, createDuggaAssignment } from '../../services/firestoreService';
import type { SchoolClass } from '../../services/firestoreService.types';
import type { DuggaTest } from '../../services/firestoreService.dugga';

export function AssignDuggaModal({
  test,
  teacherUid,
  onClose,
  onSuccess,
}: {
  test: DuggaTest;
  teacherUid: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClasses(teacherUid).then(cls => {
      setClasses(cls);
      if (cls.length > 0) setSelectedClassId(cls[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teacherUid]);

  const handleAssign = async () => {
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls || !dueDate) return;
    setSaving(true);
    try {
      await createDuggaAssignment(
        teacherUid, cls.id, cls.studentNames ?? [], test.id, test.title, dueDate, instructions || undefined,
      );
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">Задај на класа</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <p className="text-sm text-gray-600 font-medium truncate">📝 {test.title}</p>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
        ) : classes.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">Нема класи. Прво создај класа во Класни книги.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Класа</label>
              <select
                title="Избери класа"
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.studentNames?.length ?? 0} ученици)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Рок за предавање</label>
              <input
                type="date"
                title="Рок за предавање"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Инструкции (опционално)</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Посебни упатства за учениците…"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAssign}
              disabled={saving || !selectedClassId || !dueDate}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Задај
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
