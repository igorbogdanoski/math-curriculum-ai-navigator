/**
 * Standalone "Copy share link" button for quiz/assessment materials.
 * Saves the material to cached_ai_materials on first click (lazy),
 * then copies the direct play URL to clipboard.
 * Subsequent clicks reuse the same cacheId — no duplicate saves.
 */
import React, { useState } from 'react';
import { Link, Copy, Check, Loader2 } from 'lucide-react';
import { firestoreService } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import type { AIGeneratedAssessment } from '../../types';

interface Props {
  material: AIGeneratedAssessment;
  materialType: 'QUIZ' | 'ASSESSMENT';
  conceptId?: string;
  gradeLevel?: number;
}

export const QuizShareButton: React.FC<Props> = ({ material, materialType, conceptId, gradeLevel }) => {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();
  const [saving, setSaving] = useState(false);
  const [cacheId, setCacheId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const makeShareUrl = (id: string) =>
    `${window.location.origin}${window.location.pathname}#/play/${id}`;

  const handleClick = async () => {
    if (!firebaseUser?.uid) {
      addNotification('Мора да бидете логирани за да споделите.', 'warning');
      return;
    }

    let id = cacheId;

    // Save once; reuse on subsequent clicks
    if (!id) {
      setSaving(true);
      try {
        id = await firestoreService.saveAssignmentMaterial(material, {
          title: (material as { title?: string }).title || 'Квиз',
          type: materialType,
          conceptId,
          gradeLevel,
          teacherUid: firebaseUser.uid,
        });
        setCacheId(id);
      } catch {
        addNotification('Грешка при генерирање на линк.', 'error');
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    try {
      await navigator.clipboard.writeText(makeShareUrl(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addNotification('Не можев да копирам — линкот е генериран.', 'warning');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      title="Копирај директен линк за ученици"
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
    >
      {saving
        ? <><Loader2 className="w-4 h-4 animate-spin" />Генерирам…</>
        : copied
        ? <><Check className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">Копирано!</span></>
        : <><Link className="w-4 h-4" />Копирај линк</>}
    </button>
  );
};
