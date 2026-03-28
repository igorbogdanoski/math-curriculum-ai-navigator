/**
 * ForumShareButton — share any AI-generated material to the Teacher Forum.
 *
 * Self-contained: renders a button + inline modal.
 * Props allow pre-filling the thread title, body, and category.
 *
 * Usage (anywhere in the app):
 *   <ForumShareButton
 *     prefillTitle="Квиз: Питагорова теорема — VI одд."
 *     prefillBody="Генерирав квиз со 10 прашања. Мислења?"
 *     prefillCategory="resource"
 *   />
 */
import React, { useState } from 'react';
import { Share2, Send, Loader2, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  createForumThread,
  fetchForumThread,
  CATEGORY_CONFIG,
  type ThreadCategory,
} from '../../services/firestoreService.forum';

interface Props {
  prefillTitle?: string;
  prefillBody?: string;
  prefillCategory?: ThreadCategory;
  /** Extra Tailwind classes on the trigger button */
  className?: string;
  /** Button label (default: "Сподели во Форум") */
  label?: string;
}

export const ForumShareButton: React.FC<Props> = ({
  prefillTitle = '',
  prefillBody = '',
  prefillCategory = 'resource',
  className = '',
  label = 'Сподели во Форум',
}) => {
  const { firebaseUser, user } = useAuth();
  const { addNotification } = useNotification();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(prefillTitle);
  const [body, setBody] = useState(prefillBody);
  const [category, setCategory] = useState<ThreadCategory>(prefillCategory);
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    // Sync prefill every time modal opens (in case parent updated)
    setTitle(prefillTitle);
    setBody(prefillBody);
    setCategory(prefillCategory);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser?.uid) {
      addNotification('Мора да бидете логирани за да споделите.', 'warning');
      return;
    }
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await createForumThread({
        authorUid:  firebaseUser.uid,
        authorName: user?.name ?? firebaseUser.email ?? 'Наставник',
        category,
        title: title.trim(),
        body:  body.trim(),
      });
      addNotification('Успешно споделено во Форумот! 🎉', 'success');
      setOpen(false);
    } catch {
      addNotification('Грешка при споделување во форумот.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="Сподели ја оваа содржина со колегите во Форумот"
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors ${className}`}
      >
        <MessageSquare className="w-4 h-4" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-gray-800 text-lg">Сподели во Форум</h2>
              </div>
              <button
                type="button"
                aria-label="Затвори"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Тип на пост</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as ThreadCategory[]).map(cat => {
                    const cfg = CATEGORY_CONFIG[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          category === cat
                            ? `${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <span>{cfg.emoji}</span> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Наслов *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Кратко опишете ја содржината..."
                  className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Опис / порака *</label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Опишете ја содржината, поставете прашање или поканете колеги да коментираат..."
                  className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Откажи
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !body.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Објави
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
