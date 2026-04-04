import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Globe, Lock, Trash2, Edit3, Check, X, RefreshCw, Search, Users, Sparkles, Archive, ArchiveRestore, Star, Loader2, Eye, Send } from 'lucide-react';
import { firestoreService, type CachedMaterial } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import { callEmbeddingProxy } from '../services/gemini/core';
import { bm25Score, cosineSimilarity, hybridScore } from '../utils/search';
import type { AIGeneratedAssessment } from '../types';

// Wave C1 — AI Tutor chat interface
interface TutorMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const GeneratedAssessment = React.lazy(() =>
  import('../components/ai/GeneratedAssessment').then(m => ({ default: m.GeneratedAssessment }))
);

// ── Wave C1 — AI Tutor Modal ────────────────────────────────────────────────
const AITutorModal: React.FC<{ 
  material: CachedMaterial; 
  onClose: () => void;
}> = ({ material, onClose }) => {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: TutorMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build material context
      const contentStr = typeof material.content === 'string' 
        ? material.content 
        : JSON.stringify(material.content, null, 2);
      
      const materialContext = `
Material Title: ${material.title || 'Untitled'}
Material Type: ${material.type}
Grade Level: ${material.gradeLevel}
Topic: ${material.topicId || 'N/A'}
Content: ${contentStr.substring(0, 2000)}${contentStr.length > 2000 ? '...' : ''}`;

      // Build conversation history for context
      const conversationHistory = messages
        .map(m => `${m.role === 'user' ? 'Teacher' : 'AI Tutor'}: ${m.content}`)
        .join('\n');

      const systemPrompt = `You are an expert pedagogical AI tutor assisting a teacher. You have access to the following material:

${materialContext}

Your role is to:
1. Answer questions about the material's content and context
2. Suggest pedagogical approaches for teaching this material
3. Provide assessment strategies and rubric ideas
4. Offer alternative explanations or examples
5. Help with pacing and learning objectives

Keep responses concise (2-3 sentences max), practical, and focused on teacher needs.`;

      // Call Gemini API for chat
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + import.meta.env.VITE_GEMINI_PUBLIC_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            {
              role: 'user',
              parts: [{ text: userMessage.content }],
            },
          ],
          generation_config: {
            temperature: 0.7,
            max_output_tokens: 500,
          },
        }),
      });

      const data = await response.json();
      const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Sorry, I could not generate a response. Please try again.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error connecting to AI. Please check your API key and try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-800">Ask AI Tutor</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Material: {material.title || 'Untitled'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition" title="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <Sparkles className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No questions yet</p>
              <p className="text-sm text-gray-400 mt-1">Ask about material content, teaching strategies, or assessment ideas</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl rounded-bl-none">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t bg-gray-50 px-4 py-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !loading && sendMessage()}
            placeholder="Ask about this material..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Preview Modal ────────────────────────────────────────────────────────────
const PreviewModal: React.FC<{ material: CachedMaterial; onClose: () => void }> = ({ material, onClose }) => {
  const content = material.content as any;
  const isAssessment = material.type === 'quiz' || material.type === 'assessment';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-6 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800 truncate">{material.title || 'Преглед на материјал'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{typeLabel[material.type] ?? material.type} · {material.gradeLevel > 0 ? `${material.gradeLevel}. одд.` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition" title="Затвори">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto p-4 md:p-6">
          {isAssessment && content ? (
            <React.Suspense fallback={<div className="text-center py-10 text-gray-400">Вчитувам преглед…</div>}>
              <GeneratedAssessment material={content as AIGeneratedAssessment} />
            </React.Suspense>
          ) : content ? (
            <GenericContentRenderer content={content} type={material.type} />
          ) : (
            <p className="text-gray-400 text-center py-10">Нема содржина за прикажување.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Generic renderer for non-assessment types (rubric, ideas, outline, etc.)
const GenericContentRenderer: React.FC<{ content: any; type: string }> = ({ content, type }) => {
  if (type === 'rubric') {
    const criteria: any[] = content?.criteria ?? content?.rubric ?? [];
    if (criteria.length > 0) {
      return (
        <div className="space-y-4">
          {criteria.map((c: any, i: number) => (
            <div key={i} className="border rounded-xl p-4">
              <p className="font-semibold text-gray-800 mb-2">{c.criterion ?? c.name ?? `Критериум ${i + 1}`}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(c.levels ?? []).map((l: any, j: number) => (
                  <div key={j} className="bg-gray-50 rounded-lg p-2 text-xs">
                    <p className="font-bold text-gray-700 mb-1">{l.level ?? l.name}</p>
                    <p className="text-gray-500">{l.description}</p>
                    {l.points != null && <p className="mt-1 font-semibold text-indigo-600">{l.points} поени</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  if (type === 'ideas') {
    const sections: [string, any][] = Object.entries(content ?? {}).filter(([, v]) => v);
    return (
      <div className="space-y-4">
        {sections.map(([key, val]) => (
          <div key={key}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">{key.replace(/_/g, ' ')}</h3>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {typeof val === 'string' ? val : Array.isArray(val) ? val.join('\n') : JSON.stringify(val, null, 2)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render all top-level string/array fields
  const entries = Object.entries(content ?? {}).filter(([k]) => !['embedding', 'id'].includes(k));
  return (
    <div className="space-y-4">
      {entries.map(([key, val]) => {
        if (!val || (Array.isArray(val) && val.length === 0)) return null;
        return (
          <div key={key}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">{key.replace(/_/g, ' ')}</h3>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {typeof val === 'string' ? val
                : Array.isArray(val) ? val.map((item: any, i: number) => (
                    <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-gray-200' : ''}>
                      {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                    </div>
                  ))
                : JSON.stringify(val, null, 2)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

type ScoredMaterial = CachedMaterial & { score: number };

// И3 helpers
const getAvgRating = (m: CachedMaterial): number | null => {
    const vals = m.ratingsByUid ? Object.values(m.ratingsByUid) : [];
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const toDateValue = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const extractMaterialDokLevels = (m: CachedMaterial): number[] => {
    const c: any = m.content ?? {};
    const values = new Set<number>();
    if (typeof c?.dokLevel === 'number') values.add(c.dokLevel);
    if (Array.isArray(c?.questions)) {
        for (const q of c.questions) {
            if (typeof q?.dokLevel === 'number') values.add(q.dokLevel);
        }
    }
    return [...values].filter(v => [1, 2, 3, 4].includes(v)).sort((a, b) => a - b);
};

const normalizeDifficulty = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null;
    const v = raw.trim().toLowerCase();
    if (!v) return null;
    if (['easy', 'лесно', 'basic', 'основно'].includes(v)) return 'easy';
    if (['medium', 'средно', 'intermediate'].includes(v)) return 'medium';
    if (['hard', 'тешко', 'advanced', 'напредно'].includes(v)) return 'hard';
    if (['support', 'поддршка'].includes(v)) return 'support';
    return v;
};

const extractMaterialDifficulties = (m: CachedMaterial): string[] => {
    const c: any = m.content ?? {};
    const values = new Set<string>();
    const top = normalizeDifficulty(c?.difficulty_level ?? c?.difficulty);
    if (top) values.add(top);
    if (Array.isArray(c?.questions)) {
        for (const q of c.questions) {
            const d = normalizeDifficulty(q?.difficulty_level ?? q?.difficulty);
            if (d) values.add(d);
        }
    }
    return [...values].sort();
};

const StarDisplay: React.FC<{ avg: number | null; count: number }> = ({ avg, count }) => {
    if (avg === null) return <span className="text-xs text-gray-400 italic">Без оценки</span>;
    return (
        <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= Math.round(avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
            <span className="text-xs text-gray-500 ml-0.5">{avg.toFixed(1)} ({count})</span>
        </span>
    );
};

const typeLabel: Record<string, string> = {
    quiz: 'Квиз', assessment: 'Тест', rubric: 'Рубрика',
    ideas: 'Идеи', analogy: 'Аналогија', outline: 'План',
    thematicplan: 'Тематски план', discussion: 'Дискусија',
    problems: 'Задачи', solver: 'Решенија',
};

const typeColor: Record<string, string> = {
    quiz: 'bg-blue-100 text-blue-700',
    assessment: 'bg-purple-100 text-purple-700',
    rubric: 'bg-orange-100 text-orange-700',
};

export const ContentLibraryView: React.FC = () => {
    const { firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const [materials, setMaterials] = useState<CachedMaterial[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [viewMode, setViewMode] = useState<'my' | 'national' | 'archive'>('my');
    const [searchQuery, setSearchQuery] = useState('');
    const [useSemanticSearch, setUseSemanticSearch] = useState(false);
    const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const embeddingCacheRef = useRef<Map<string, number[]>>(new Map());

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [previewMaterial, setPreviewMaterial] = useState<CachedMaterial | null>(null);

    // Wave C1 — AI Tutor state
    const [aiTutorMateriaId, setAiTutorMaterialId] = useState<string | null>(null);

    // И3 — rating + sort + fork
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'rating'>('newest');
    const [minRating, setMinRating] = useState(0);
    const [ratingState, setRatingState] = useState<Record<string, number>>({});
    const [ratingHover, setRatingHover] = useState<Record<string, number>>({});
    const [forkingId, setForkingId] = useState<string | null>(null);

    // Wave B1 — advanced library filters
    const [gradeFilter, setGradeFilter] = useState<'all' | number>('all');
    const [topicFilter, setTopicFilter] = useState('all');
    const [dokFilter, setDokFilter] = useState<'all' | number>('all');
    const [difficultyFilter, setDifficultyFilter] = useState('all');

    // Wave B2 — multi-select batch actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchLoading, setBatchLoading] = useState(false);

    // Wave B3 — sticky action row context
    const [hoveredMaterialId, setHoveredMaterialId] = useState<string | null>(null);

    const load = async () => {
        if (!firebaseUser?.uid) return;
        setLoading(true);
        try {
            let data: CachedMaterial[];
            if (viewMode === 'archive') {
                data = await firestoreService.fetchArchivedMaterials(firebaseUser.uid);
            } else if (viewMode === 'national') {
                data = await firestoreService.fetchGlobalLibraryMaterials();
            } else {
                data = (await firestoreService.fetchLibraryMaterials(firebaseUser.uid))
                    .filter(m => !m.archivedAt);
            }
            setMaterials(data);
            // И3: seed rating state from loaded materials
            if (firebaseUser.uid) {
                const seeds: Record<string, number> = {};
                data.forEach(m => {
                    const r = m.ratingsByUid?.[firebaseUser.uid];
                    if (r) seeds[m.id] = r;
                });
                setRatingState(prev => ({ ...prev, ...seeds }));
            }
        } catch {
            addNotification('Грешка при вчитување на библиотеката.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [firebaseUser?.uid, viewMode]);

    // Wave B2 — clear selection when view mode changes
    useEffect(() => {
        clearSelection();
    }, [viewMode]);

    // Generate query embedding when semantic search is toggled and query changes
    useEffect(() => {
        const getQueryEmbedding = async () => {
            if (!useSemanticSearch || !searchQuery.trim()) {
                setQueryEmbedding(null);
                return;
            }
            // Serve from cache to avoid redundant API calls when toggling mode
            const cached = embeddingCacheRef.current.get(searchQuery);
            if (cached) { setQueryEmbedding(cached); return; }
            setIsEmbedding(true);
            try {
                const emb = await callEmbeddingProxy(searchQuery);
                embeddingCacheRef.current.set(searchQuery, emb);
                setQueryEmbedding(emb);
            } catch (err) {
                console.error('Semantic search error:', err);
                addNotification('Проблем со семантичкото пребарување.', 'warning');
            } finally {
                setIsEmbedding(false);
            }
        };

        const timer = setTimeout(getQueryEmbedding, 500); // Debounce
        return () => clearTimeout(timer);
    }, [searchQuery, useSemanticSearch]);

    const filtered = useMemo(() => {
        let results = [...materials];

        // 1. Text or Semantic Filter
        if (searchQuery.trim()) {
            if (useSemanticSearch && queryEmbedding) {
                // Hybrid ranking: 60% cosine semantic + 40% BM25 keyword
                results = (results
                    .map(m => {
                        const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''}`;
                        const cosine = m.embedding ? cosineSimilarity(queryEmbedding, m.embedding) : 0;
                        const bm25 = bm25Score(searchQuery, docText);
                        const score = hybridScore(cosine, bm25);
                        return { ...m, score } as ScoredMaterial;
                    })
                    .filter((m: ScoredMaterial) => m.score > 0.15)
                    .sort((a: ScoredMaterial, b: ScoredMaterial) => b.score - a.score)) as CachedMaterial[];
            } else {
                // BM25 keyword ranking (exact + partial term matching)
                results = (results
                    .map(m => {
                        const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''}`;
                        return { ...m, score: bm25Score(searchQuery, docText) } as ScoredMaterial;
                    })
                    .filter((m: ScoredMaterial) => m.score > 0)
                    .sort((a: ScoredMaterial, b: ScoredMaterial) => b.score - a.score)) as CachedMaterial[];
            }
        }

        // 2. Status Filter (only for 'my' view)
        if (viewMode === 'my') {
            if (filter === 'draft') results = results.filter(m => m.status === 'draft' || !m.status);
            if (filter === 'published') results = results.filter(m => m.status === 'published');
        }

        // 3. Wave B1 advanced metadata filters
        if (gradeFilter !== 'all') {
            results = results.filter(m => m.gradeLevel === gradeFilter);
        }
        if (topicFilter !== 'all') {
            results = results.filter(m => (m.topicId || '').trim() === topicFilter);
        }
        if (dokFilter !== 'all') {
            results = results.filter(m => extractMaterialDokLevels(m).includes(dokFilter));
        }
        if (difficultyFilter !== 'all') {
            results = results.filter(m => extractMaterialDifficulties(m).includes(difficultyFilter));
        }

        // 4. И3: Min rating filter (national view)
        if (viewMode === 'national' && minRating > 0) {
            results = results.filter(m => {
                const avg = getAvgRating(m);
                return avg !== null && avg >= minRating;
            });
        }

        // 5. Sorting (if no explicit search ranking active)
        if (!searchQuery.trim()) {
            if (sortBy === 'rating' && viewMode === 'national') {
                results = [...results].sort((a, b) => (getAvgRating(b) ?? 0) - (getAvgRating(a) ?? 0));
            } else if (sortBy === 'oldest') {
                results = [...results].sort((a, b) => toDateValue(a.createdAt) - toDateValue(b.createdAt));
            } else if (sortBy === 'title') {
                results = [...results].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'mk'));
            } else {
                results = [...results].sort((a, b) => toDateValue(b.createdAt) - toDateValue(a.createdAt));
            }
        }

        return results;
    }, [
        materials,
        searchQuery,
        filter,
        viewMode,
        useSemanticSearch,
        queryEmbedding,
        sortBy,
        minRating,
        gradeFilter,
        topicFilter,
        dokFilter,
        difficultyFilter,
    ]);

    const handlePublish = async (m: CachedMaterial) => {
        try {
            const name = firebaseUser?.displayName || 'Наставник';
            await firestoreService.publishMaterialWithAttribution(m.id, firebaseUser!.uid, name);
            setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, status: 'published', publishedByName: name } : x));
            addNotification(`„${m.title || 'Материјал'}" е публикуван! Достапен за ученици. ✅`, 'success');
        } catch { addNotification('Грешка при публикување.', 'error'); }
    };

    const handleRate = async (materialId: string, rating: number) => {
        if (!firebaseUser?.uid) return;
        try {
            await firestoreService.rateMaterial(materialId, firebaseUser.uid, rating);
            setRatingState(prev => ({ ...prev, [materialId]: rating }));
            setMaterials(prev => prev.map(m => {
                if (m.id !== materialId) return m;
                const updated = { ...(m.ratingsByUid ?? {}), [firebaseUser.uid]: rating };
                return { ...m, ratingsByUid: updated };
            }));
        } catch { addNotification('Грешка при оценување.', 'error'); }
    };

    const handleFork = async (m: CachedMaterial) => {
        if (!firebaseUser?.uid) return;
        if (!confirm(`Форкај „${m.title || 'Материјал'}" во твоја библиотека (нацрт)?`)) return;
        setForkingId(m.id);
        try {
            await firestoreService.forkCachedMaterial(m.id, firebaseUser.uid);
            addNotification(`„${m.title || 'Материјал'}" е форкан во твоите материјали! 🍴`, 'success');
        } catch { addNotification('Грешка при форкање.', 'error'); }
        finally { setForkingId(null); }
    };

const handleUnpublish = async (m: CachedMaterial) => {
        try {
            await firestoreService.unpublishMaterial(m.id);
            setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, status: 'draft' } : x));
            addNotification('Материјалот е вратен на нацрт.', 'info');
        } catch { addNotification('Грешка.', 'error'); }
    };

    const handleArchive = async (m: CachedMaterial) => {
        try {
            await firestoreService.archiveMaterial(m.id);
            setMaterials(prev => prev.filter(x => x.id !== m.id));
            addNotification(`„${m.title || 'Материјал'}" е архивиран.`, 'info');
        } catch { addNotification('Грешка при архивирање.', 'error'); }
    };

    const handleRestore = async (m: CachedMaterial) => {
        try {
            await firestoreService.restoreMaterial(m.id);
            setMaterials(prev => prev.filter(x => x.id !== m.id));
            addNotification(`„${m.title || 'Материјал'}" е вратен во библиотеката.`, 'success');
        } catch { addNotification('Грешка при враќање.', 'error'); }
    };

    const handleDeleteForever = async (id: string) => {
        if (!confirm('Трајно бришење — ова не може да се врати. Продолжи?')) return;
        try {
            await firestoreService.deleteCachedMaterial(id);
            setMaterials(prev => prev.filter(m => m.id !== id));
            addNotification('Трајно избришано.', 'info');
        } catch { addNotification('Грешка при бришење.', 'error'); }
    };

    const handleSaveTitle = async (id: string) => {
        if (!editTitle.trim()) return;
        try {
            await firestoreService.updateMaterialTitle(id, editTitle.trim());
            setMaterials(prev => prev.map(m => m.id === id ? { ...m, title: editTitle.trim() } : m));
            setEditingId(null);
            addNotification('Насловот е ажуриран.', 'success');
        } catch { addNotification('Грешка.', 'error'); }
    };

    const formatDate = (ts: any) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const draftCount = materials.filter(m => m.status === 'draft' || !m.status).length;
    const publishedCount = materials.filter(m => m.status === 'published').length;

    const gradeOptions = useMemo(() => {
        const set = new Set<number>();
        materials.forEach(m => { if (m.gradeLevel > 0) set.add(m.gradeLevel); });
        return [...set].sort((a, b) => a - b);
    }, [materials]);

    const topicOptions = useMemo(() => {
        const set = new Set<string>();
        materials.forEach(m => {
            if (m.topicId && m.topicId.trim()) set.add(m.topicId.trim());
        });
        return [...set].sort((a, b) => a.localeCompare(b, 'mk'));
    }, [materials]);

    const dokOptions = useMemo(() => {
        const set = new Set<number>();
        materials.forEach(m => {
            extractMaterialDokLevels(m).forEach(v => set.add(v));
        });
        return [...set].sort((a, b) => a - b);
    }, [materials]);

    const difficultyOptions = useMemo(() => {
        const set = new Set<string>();
        materials.forEach(m => {
            extractMaterialDifficulties(m).forEach(v => set.add(v));
        });
        return [...set].sort((a, b) => a.localeCompare(b, 'mk'));
    }, [materials]);

    const formatDifficultyLabel = (value: string) => {
        if (value === 'easy') return 'Easy';
        if (value === 'medium') return 'Medium';
        if (value === 'hard') return 'Hard';
        if (value === 'support') return 'Support';
        return value;
    };

    // Wave B3 — Extract action rendering logic into reusable component
    const renderQuickActions = (m: CachedMaterial, isPublished: boolean) => (
        <div className="flex items-center gap-1.5 flex-wrap">
            {/* Wave C1 — AI Tutor button (always available) */}
            <button
                type="button"
                title="Ask AI Tutor about this material"
                onClick={() => setAiTutorMaterialId(m.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
            >
                <Sparkles className="w-3.5 h-3.5" />
                Tutor
            </button>

            {viewMode === 'national' ? (
                <>
                    {m.isApproved ? (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">✅ МОН</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                            <Users className="w-3.5 h-3.5" /> Заедница
                        </span>
                    )}
                    <button
                        type="button"
                        title="Форкај — копирај во твоја библиотека"
                        onClick={() => handleFork(m)}
                        disabled={forkingId === m.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
                    >
                        {forkingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🍴'}
                        Форкај
                    </button>
                </>
            ) : viewMode === 'archive' ? (
                <>
                    <button type="button" onClick={() => handleRestore(m)} title="Врати во библиотеката" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        <ArchiveRestore className="w-3.5 h-3.5" />Врати
                    </button>
                    <button type="button" onClick={() => handleDeleteForever(m.id)} title="Избриши засекогаш" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </>
            ) : (
                <>
                    {isPublished ? (
                        <button type="button" onClick={() => handleUnpublish(m)} title="Врати на нацрт" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                            <Lock className="w-3.5 h-3.5" />Нацрт
                        </button>
                    ) : (
                        <button type="button" onClick={() => handlePublish(m)} title="Публикувај за ученици" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700">
                            <Globe className="w-3.5 h-3.5" />Публикувај
                        </button>
                    )}
                    <button type="button" onClick={() => handleArchive(m)} title="Архивирај (скриј од библиотеката)" className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg">
                        <Archive className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );

    const resetAdvancedFilters = () => {
        setGradeFilter('all');
        setTopicFilter('all');
        setDokFilter('all');
        setDifficultyFilter('all');
        setSortBy('newest');
        setMinRating(0);
    };

    // Wave B2 — batch action handlers
    const toggleSelectId = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(filtered.map(m => m.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const batchPublish = async () => {
        if (selectedIds.size === 0 || !firebaseUser?.uid) return;
        setBatchLoading(true);
        try {
            const name = firebaseUser.displayName || 'Наставник';
            const ids = Array.from(selectedIds);
            await Promise.all(
                ids.map(id => firestoreService.publishMaterialWithAttribution(id, firebaseUser!.uid, name))
            );
            setMaterials(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, status: 'published', publishedByName: name } : m));
            addNotification(`${ids.length} материјалите публикувани! ✅`, 'success');
            clearSelection();
        } catch {
            addNotification('Грешка при массивно публикување.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    const batchUnpublish = async () => {
        if (selectedIds.size === 0) return;
        setBatchLoading(true);
        try {
            const ids = Array.from(selectedIds);
            await Promise.all(ids.map(id => firestoreService.unpublishMaterial(id)));
            setMaterials(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, status: 'draft' } : m));
            addNotification(`${ids.length} материјалите враќени на нацрт. 🔒`, 'info');
            clearSelection();
        } catch {
            addNotification('Грешка при враќање на нацрт.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    const batchArchive = async () => {
        if (selectedIds.size === 0 || !confirm(`Архивирај ${selectedIds.size} материјалите? Можете да ги вратите од архивата.`)) return;
        setBatchLoading(true);
        try {
            const ids = Array.from(selectedIds);
            await Promise.all(ids.map(id => firestoreService.archiveMaterial(id)));
            setMaterials(prev => prev.filter(m => !selectedIds.has(m.id)));
            addNotification(`${ids.length} материјалите архивирани. 📦`, 'info');
            clearSelection();
        } catch {
            addNotification('Грешка при архивирање.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    return (
        <>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    Библиотека на материјали
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Прегледај, едитирај и публикувај генерирани материјали. Само „Публикувани" се достапни за ученици.
                </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                    <button
                        type="button"
                        onClick={() => setViewMode('my')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'my' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Lock className="w-4 h-4" /> Мои материјали
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('national')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'national' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Globe className="w-4 h-4" /> Национална библиотека
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('archive')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'archive' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Archive className="w-4 h-4" /> Архива
                    </button>
                </div>

                {/* Search Bar */}
                <div className="flex flex-col gap-2 w-full md:w-80">
                    <div className="relative w-full">
                        <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isEmbedding ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                        <input 
                            type="text"
                            placeholder={useSemanticSearch ? "Опишете што барате..." : "Пребарај материјали..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setUseSemanticSearch(!useSemanticSearch)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            useSemanticSearch 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <Sparkles className={`w-3 h-3 ${useSemanticSearch ? 'fill-indigo-500' : ''}`} />
                        Семантичко пребарување (AI)
                        {useSemanticSearch && <span className="ml-auto bg-indigo-500 text-white px-1.5 py-0.5 rounded text-[10px]">PRO</span>}
                    </button>
                </div>
            </div>

            {/* Wave B1 — Advanced Filter Bar */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Advanced Filters</span>
                    <span className="text-[11px] text-slate-400">grade / topic / DoK / difficulty / sort</span>
                    <button
                        type="button"
                        onClick={resetAdvancedFilters}
                        className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                        Ресет
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                    <select
                        title="Филтер по одделение"
                        value={gradeFilter}
                        onChange={(e) => setGradeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Одделение: Сите</option>
                        {gradeOptions.map(g => <option key={g} value={g}>{g}. одд.</option>)}
                    </select>

                    <select
                        title="Филтер по тема"
                        value={topicFilter}
                        onChange={(e) => setTopicFilter(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Тема: Сите</option>
                        {topicOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                        title="Филтер по DoK"
                        value={dokFilter}
                        onChange={(e) => setDokFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">DoK: Сите</option>
                        {dokOptions.map(d => <option key={d} value={d}>DoK {d}</option>)}
                    </select>

                    <select
                        title="Филтер по тежина"
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Тежина: Сите</option>
                        {difficultyOptions.map(d => <option key={d} value={d}>{formatDifficultyLabel(d)}</option>)}
                    </select>

                    <select
                        title="Сортирај"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'title' | 'rating')}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="newest">Сортирај: Најнови</option>
                        <option value="oldest">Сортирај: Најстари</option>
                        <option value="title">Сортирај: Наслов A-Z</option>
                        {viewMode === 'national' && <option value="rating">Сортирај: Оценка</option>}
                    </select>

                    <div className="flex items-center gap-1 overflow-x-auto">
                        {viewMode === 'national' ? [0, 3, 4, 5].map(v => (
                            <button key={v} type="button" onClick={() => setMinRating(v)}
                                className={`px-2 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${minRating === v ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {v === 0 ? 'Оцена: Сите' : `${v}⭐+`}
                            </button>
                        )) : (
                            <span className="text-[11px] text-slate-400 px-1">Оценка филтер важи за национална библиотека</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats + Filter */}
            {viewMode === 'my' && (
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                        {([
                            { id: 'all', label: `Сите (${materials.length})` },
                            { id: 'draft', label: `🔒 Нацрт (${draftCount})` },
                            { id: 'published', label: `🌐 Публикувани (${publishedCount})` },
                        ] as const).map(f => (
                            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${filter === f.id ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={load}
                        className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Освежи
                    </button>
                </div>
            )}

            {viewMode === 'national' && (
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    <p className="text-sm text-gray-500">
                        Истражете материјали креирани од заедницата и ресурси официјално одобрени од МОН.
                    </p>
                    <button type="button" onClick={load}
                        className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Освежи
                    </button>
                </div>
            )}

            {viewMode === 'archive' && (
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    <p className="text-sm text-gray-500">
                        Архивираните материјали се скриени од главната библиотека. Можете да ги вратите или трајно да ги избришете.
                    </p>
                    <button type="button" onClick={load}
                        className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Освежи
                    </button>
                </div>
            )}

            {/* Wave B2 — Batch action toolbar (sticky) */}
            {viewMode === 'my' && selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-indigo-400 shadow-2xl z-40 px-4 md:px-6 py-3">
                    <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                title="Избери/одбери сите"
                                checked={selectedIds.size === filtered.length && filtered.length > 0}
                                onChange={() => selectedIds.size === filtered.length ? clearSelection() : selectAll()}
                                className="w-5 h-5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-700">{selectedIds.size} избрани</span>
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                            >
                                Очисти избор
                            </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={batchPublish}
                                disabled={batchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                            >
                                {batchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                Публикувај
                            </button>
                            <button
                                type="button"
                                onClick={batchUnpublish}
                                disabled={batchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                На нацрт
                            </button>
                            <button
                                type="button"
                                onClick={batchArchive}
                                disabled={batchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition"
                            >
                                <Archive className="w-3.5 h-3.5" />
                                Архивирај
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-gray-400">Вчитувам…</div>
            ) : filtered.length === 0 ? (
                <Card className="p-10 text-center">
                    {viewMode === 'archive'
                        ? <Archive className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        : <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />}
                    <p className="text-gray-500 font-medium">
                        {viewMode === 'archive'
                            ? 'Архивата е празна.'
                            : filter === 'all' ? 'Нема зачувани материјали.'
                            : filter === 'draft' ? 'Нема нацрти.'
                            : 'Нема публикувани материјали.'}
                    </p>
                    {viewMode !== 'archive' && filter === 'all' && (
                        <p className="text-sm text-gray-400 mt-1">
                            Генерирајте квиз или тест и кликнете „Зачувај" за да го зачувате овде.
                        </p>
                    )}
                </Card>
            ) : (
                <div className={`space-y-3 ${viewMode === 'my' && selectedIds.size > 0 ? 'pb-32' : ''}`}>
                    {filtered.map(m => {
                        const isPublished = m.status === 'published';
                        const isEditing = editingId === m.id;
                        const isSelected = selectedIds.has(m.id);

                        return (
                            <div 
                                key={m.id}
                                onMouseEnter={() => setHoveredMaterialId(m.id)}
                                onMouseLeave={() => setHoveredMaterialId(null)}
                                className="relative"
                            >
                                <Card className={`p-4 border-l-4 transition ${isPublished ? 'border-green-400' : 'border-amber-300'} ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : ''}`}>
                                <div className="flex items-start gap-3">
                                    {/* Wave B2 — checkbox for multi-select */}
                                    {viewMode === 'my' && (
                                        <input
                                            type="checkbox"
                                            title="Избери материјал"
                                            checked={isSelected}
                                            onChange={() => toggleSelectId(m.id)}
                                            className="mt-0.5 w-5 h-5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        {/* Title row */}
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    autoFocus
                                                    title="Наслов на материјал"
                                                    placeholder="Внеси наслов…"
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(m.id); if (e.key === 'Escape') setEditingId(null); }}
                                                    className="flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                                <button type="button" title="Зачувај наслов" onClick={() => handleSaveTitle(m.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                                <button type="button" title="Откажи" onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-gray-800 truncate">{m.title || 'Без наслов'}</p>
                                                {viewMode !== 'national' && (
                                                    <button type="button" title="Уреди наслов" onClick={() => { setEditingId(m.id); setEditTitle(m.title || ''); }}
                                                        className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 rounded">
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Meta */}
                                        <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500">
                                            <span className={`font-bold px-2 py-0.5 rounded-full ${typeColor[m.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {typeLabel[m.type] ?? m.type}
                                            </span>
                                            {m.gradeLevel > 0 && <span>{m.gradeLevel}. Одд.</span>}
                                            <span>{formatDate(m.createdAt)}</span>
                                            <span className={`flex items-center gap-0.5 font-semibold ${isPublished ? 'text-green-600' : 'text-amber-600'}`}>
                                                {isPublished ? <><Globe className="w-3 h-3" />Публикуван</> : <><Lock className="w-3 h-3" />Нацрт</>}
                                            </span>
                                            {m.isForked && m.sourceAuthor && (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-50 text-violet-600 font-semibold rounded-full border border-violet-100">
                                                    🍴 Форк од {m.sourceAuthor}
                                                </span>
                                            )}
                                            {useSemanticSearch && typeof (m as ScoredMaterial).score === 'number' && (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold rounded-full border border-indigo-100" title="Семантичка сличност">
                                                    <Sparkles className="w-2.5 h-2.5" />
                                                    {Math.round((m as ScoredMaterial).score * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        {/* И3: Rating row (national view) */}
                                        {viewMode === 'national' && (() => {
                                            const avg = getAvgRating(m);
                                            const cnt = m.ratingsByUid ? Object.keys(m.ratingsByUid).length : 0;
                                            const myR = ratingState[m.id] ?? 0;
                                            const hover = ratingHover[m.id] ?? 0;
                                            return (
                                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                    <StarDisplay avg={avg} count={cnt} />
                                                    <div className="flex items-center gap-0.5">
                                                        <span className="text-xs text-gray-400 mr-1">Твоја:</span>
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                title={`Оцени ${s} ⭐`}
                                                                onClick={() => handleRate(m.id, s)}
                                                                onMouseEnter={() => setRatingHover(p => ({ ...p, [m.id]: s }))}
                                                                onMouseLeave={() => setRatingHover(p => ({ ...p, [m.id]: 0 }))}
                                                                className="p-0.5 transition"
                                                            >
                                                                <Star className={`w-3.5 h-3.5 ${s <= (hover || myR) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'}`} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {m.publishedByName && (
                                                        <span className="text-xs text-gray-400">од <span className="font-semibold text-gray-600">{m.publishedByName}</span></span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                        {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* Preview button — always visible */}
                                        <button
                                            type="button"
                                            title="Прегледај содржина"
                                            onClick={() => setPreviewMaterial(m)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Прегледај
                                        </button>
                                    </div>

                                    {/* Wave B3 — Floating action toolbar (appears on hover) */}
                                    {hoveredMaterialId === m.id && (
                                        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-30 animate-in fade-in duration-150">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-gray-600">Опции:</span>
                                                {renderQuickActions(m, isPublished)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Preview Modal */}
        {previewMaterial && (
            <PreviewModal material={previewMaterial} onClose={() => setPreviewMaterial(null)} />
        )}

        {/* Wave C1 — AI Tutor Modal */}
        {aiTutorMateriaId && materials.find(m => m.id === aiTutorMateriaId) && (
            <AITutorModal
              material={materials.find(m => m.id === aiTutorMateriaId)!}
              onClose={() => setAiTutorMaterialId(null)}
            />
        )}
        </>
    );
};

