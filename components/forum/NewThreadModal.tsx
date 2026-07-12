import React, { useState } from 'react';
import { X, Sparkles, Box, Loader2, Send, MessageSquare } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { DOK_META } from '../../types';
import type { DokLevel } from '../../types';
import { uploadForumImage } from '../../services/storageService';
import { SHAPE_ORDER } from '../math/Shape3DViewer';
import {
  createForumThread, fetchForumThread, CATEGORY_CONFIG,
  type ThreadCategory, type ForumThread,
} from '../../services/firestoreService.forum';
import type { EnrichedConcept } from './forumHelpers';

type FormEv = React.FormEvent<HTMLFormElement>;

interface NewThreadModalProps {
  onClose: () => void;
  onCreated: (thread: ForumThread) => void;
  concepts: EnrichedConcept[];
  authorUid: string;
  authorName: string;
  initialImageDataUrl?: string | null;
  initialTitle?: string;
  initialBody?: string;
  initialScenarioId?: string;
  initialScenarioTitle?: string;
  skipModeration?: boolean;
}

export const NewThreadModal: React.FC<NewThreadModalProps> = ({
  onClose, onCreated, concepts, authorUid, authorName,
  initialImageDataUrl, initialTitle, initialBody,
  initialScenarioId, initialScenarioTitle, skipModeration,
}) => {
  const [title, setTitle] = useState(initialTitle ?? '');
  const [body, setBody] = useState(initialBody ?? '');
  const [conceptId, setConceptId] = useState('');
  const [category, setCategory] = useState<ThreadCategory>('question');
  const [saving, setSaving] = useState(false);
  const [dokLevel, setDokLevel] = useState<DokLevel | 0>(0);
  const [imageDataUrl] = useState<string | null>(initialImageDataUrl ?? null);
  const [show3d, setShow3d] = useState(false);
  const [shape3dShape, setShape3dShape] = useState<string>('cube');
  const [showBodyPreview, setShowBodyPreview] = useState(false);

  const selectedConcept = concepts.find(c => c.id === conceptId);

  const handleSubmit = async (e: FormEv) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      let forumImageUrl: string | null = null;
      if (imageDataUrl) forumImageUrl = await uploadForumImage(imageDataUrl, authorUid);
      const id = await createForumThread({
        authorUid,
        authorName,
        conceptId:    selectedConcept?.id,
        conceptTitle: selectedConcept?.title,
        category,
        title:  title.trim(),
        body:   body.trim(),
        skipModeration: skipModeration ?? false,
        ...(dokLevel ? { dokLevel } : {}),
        ...(forumImageUrl ? { forumImageUrl } : {}),
        ...(show3d ? { shape3dShape } : {}),
        ...(initialScenarioId ? { scenarioId: initialScenarioId, scenarioTitle: initialScenarioTitle } : {}),
      });
      const thread = await fetchForumThread(id);
      if (thread) onCreated(thread);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-800 text-lg">Ново прашање / пост</h2>
          <button type="button" aria-label="Затвори" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {initialScenarioTitle && (
            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-xs text-sky-700 font-semibold">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              Поврзано сценарио: <span className="font-black">{initialScenarioTitle}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Тип на пост *</label>
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Поврзи со поим (опционално)</label>
            <select
              title="Избери поим"
              value={conceptId}
              onChange={e => setConceptId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            >
              <option value="">— Без поврзан поим —</option>
              {concepts.map(c => (
                <option key={c.id} value={c.id}>{c.gradeLevel}. одд. · {c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Наслов *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Кратко и јасно опишете го прашањето..."
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Содржина *</label>
              {body.includes('$') && (
                <button type="button" onClick={() => setShowBodyPreview(v => !v)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {showBodyPreview ? 'Скрај преглед' : 'Преглед на математика'}
                </button>
              )}
            </div>
            <textarea
              required
              rows={5}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Детално опишете го прашањето... За математика: $x^2 + 3x + 2 = 0$"
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
            />
            {showBodyPreview && body.includes('$') && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800">
                <MathRenderer text={body} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Webb's DoK ниво (опционално)</label>
            <div className="flex gap-1.5 flex-wrap">
              {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
                const meta = DOK_META[lvl];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDokLevel(dokLevel === lvl ? 0 : lvl)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      dokLevel === lvl
                        ? `${meta.color} border-current ring-2 ring-offset-1 ring-current`
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    DoK {lvl} — {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {imageDataUrl && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Прикачена слика</label>
              <img src={imageDataUrl} alt="Алгебарски плочки" className="rounded-xl border border-gray-200 max-h-40 w-auto" />
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShow3d(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                show3d
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-700 ring-2 ring-offset-1 ring-cyan-300'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-cyan-300 hover:text-cyan-600'
              }`}
            >
              <Box className="w-3.5 h-3.5" /> Додај 3D тело
            </button>
            {show3d && (
              <div className="mt-2">
                <select
                  title="Избери 3D тело"
                  value={shape3dShape}
                  onChange={e => setShape3dShape(e.target.value)}
                  className="border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                >
                  {SHAPE_ORDER.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Откажи
            </button>
            <button type="submit" disabled={saving || !title.trim() || !body.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Објави
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
