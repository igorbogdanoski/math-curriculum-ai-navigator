import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { ModalContainer } from '../common/ModalContainer';

interface AcademyReflectionPromptProps {
  /** Existing reflection note for this lesson, if one was already saved — shown pre-filled and editable. */
  existingNote: string | undefined;
  onSave: (note: string) => void;
  onClose: () => void;
}

/**
 * Non-blocking reflection-on-action prompt (Schön), shown right after a
 * teacher generates a lesson from a pedagogical model — the only real signal
 * this app has for "the teacher is applying this model," since there's no
 * later trigger for "the class actually happened." Skipping is always fine;
 * markLessonAsApplied has already fired by the time this renders.
 */
export const AcademyReflectionPrompt: React.FC<AcademyReflectionPromptProps> = ({ existingNote, onSave, onClose }) => {
  const [note, setNote] = useState(existingNote ?? '');

  const handleSave = () => {
    const trimmed = note.trim();
    if (trimmed) onSave(trimmed);
    onClose();
  };

  return (
    <ModalContainer onClose={onClose}>
      <div className="max-w-md mx-auto p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-gray-900">Забележано за примена</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Затвори">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Откако ќе го одржиш часот со овој пристап, врати се тука и забележи како помина — ова е само за тебе.
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Дали методот функционираше? Што би променил следен пат?"
          rows={4}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Прескокни
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-brand-secondary transition-colors"
          >
            Зачувај
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};
