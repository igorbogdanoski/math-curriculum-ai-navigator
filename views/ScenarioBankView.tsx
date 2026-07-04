import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal, BookMarked, BadgeCheck, Shuffle, Plus, Sparkles, MessageSquare, Gamepad2, FileText, Upload, Loader2, ShieldCheck, Lock, Globe, Layers } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { PrintShell } from '../components/common/PrintShell';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import { ScenarioCard } from '../components/scenario-bank/ScenarioCard';
import { UploadScenarioModal } from '../components/scenario-bank/UploadScenarioModal';
import { ScenarioSelectionModal } from '../components/scenario-bank/ScenarioSelectionModal';
import { BatchImportModal } from '../components/scenario-bank/BatchImportModal';
import { saveUploadDraft, saveUploadDraftBatch } from '../services/uploadDraftService';
import { splitScenarios } from '../services/scenarioSplitter';
import type { ScenarioSegment } from '../services/scenarioSplitter';
import type { ScenarioBankEntry, ScenarioBankFilter, TeachingModel, EntryType } from '../services/firestoreService.scenarioBank';
import {
  fetchScenarios, fetchMyScenarios, rateScenario,
  forkScenario, toggleSaveScenario, recordUsage, setScenarioPublic, fetchAllAdmin,
} from '../services/firestoreService.scenarioBank';
import type { DocumentSnapshot } from 'firebase/firestore';
import type { ScenarioSearchResult } from '../services/ragService';
import type { LessonPlan } from '../types';

type TabMode = 'all' | 'mine' | 'saved' | 'bro' | 'admin';
type SortBy = 'date' | 'rating' | 'forks' | 'usage';

const GRADES = [1,2,3,4,5,6,7,8,9];
const MODELS: TeachingModel[] = ['5E','PBL','ZPD','Cooperative','Traditional'];
const DOK_LEVELS = [1,2,3,4];

export const ScenarioBankView: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();

  const [tab, setTab] = useState<TabMode>('all');
  const [entries, setEntries] = useState<ScenarioBankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [dokFilter, setDokFilter] = useState<number | null>(null);
  const [modelFilter, setModelFilter] = useState<TeachingModel | null>(null);
  const [typeFilter, setTypeFilter] = useState<EntryType | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('date');

  // Semantic search state
  const [semanticRanking, setSemanticRanking] = useState<ScenarioSearchResult[] | null>(null);
  const [isSemanticActive, setIsSemanticActive] = useState(false);
  const semanticDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (mode: TabMode) => {
    setIsLoading(true);
    try {
      if (mode === 'mine' && firebaseUser?.uid) {
        const data = await fetchMyScenarios(firebaseUser.uid);
        setEntries(data);
      } else {
        const filter: ScenarioBankFilter = {
          grade: gradeFilter,
          dokLevel: dokFilter,
          teachingModel: modelFilter,
          verifiedOnly: mode === 'bro',
          sortBy,
        };
        const data = await fetchScenarios(filter, 48);
        setEntries(data);
      }
    } catch {
      addNotification('Грешка при вчитување на сценаријата.', 'error');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gradeFilter, dokFilter, modelFilter, sortBy, firebaseUser?.uid]);

  useEffect(() => { load(tab); }, [load, tab]);

  // Debounced semantic search — triggers after 800ms of typing when query > 2 chars
  useEffect(() => {
    if (semanticDebounceRef.current) clearTimeout(semanticDebounceRef.current);
    const q = search.trim();

    if (q.length < 3) {
      setSemanticRanking(null);
      setIsSemanticActive(false);
      return;
    }

    semanticDebounceRef.current = setTimeout(async () => {
      const { searchScenarioBankSemantic } = await import('../services/ragService');
      const result = await searchScenarioBankSemantic(q, entries);
      if (result !== null) {
        setSemanticRanking(result);
        setIsSemanticActive(true);
      }
    }, 800);

    return () => {
      if (semanticDebounceRef.current) clearTimeout(semanticDebounceRef.current);
    };
  }, [search, entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = entries;
    if (tab === 'saved' && firebaseUser?.uid) {
      list = list.filter(e => (e.savedByUids ?? []).includes(firebaseUser.uid!));
    }
    if (typeFilter) {
      list = list.filter(e => (e.entryType ?? 'lesson_plan') === typeFilter);
    }

    // When semantic ranking is active, use it to reorder + filter
    if (semanticRanking !== null && q.length >= 3) {
      const idOrder = new Map(semanticRanking.map((r, i) => [r.id, i]));
      const semanticEntries = list
        .filter(e => idOrder.has(e.id))
        .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));
      // Fall back to text match if semantic returned 0 results
      if (semanticEntries.length > 0) return semanticEntries;
    }

    if (!q) return list;
    return list.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.topicTitle.toLowerCase().includes(q) ||
      e.authorName.toLowerCase().includes(q) ||
      e.objectives.some(o => o.toLowerCase().includes(q))
    );
  }, [entries, search, tab, firebaseUser?.uid, semanticRanking]);

  const sorted = useMemo(() => {
    if (sortBy !== 'rating') return filtered;
    return [...filtered].sort((a, b) => {
      const ra = a.ratingsByUid ? Object.values(a.ratingsByUid).reduce((s,v)=>s+v,0)/Object.keys(a.ratingsByUid).length : 0;
      const rb = b.ratingsByUid ? Object.values(b.ratingsByUid).reduce((s,v)=>s+v,0)/Object.keys(b.ratingsByUid).length : 0;
      return rb - ra;
    });
  }, [filtered, sortBy]);

  const handleRate = async (entryId: string, stars: number) => {
    if (!firebaseUser?.uid) { addNotification('Мора да сте најавени.', 'warning'); return; }
    await rateScenario(entryId, firebaseUser.uid, stars);
    setEntries(prev => prev.map(e => e.id !== entryId ? e : {
      ...e, ratingsByUid: { ...e.ratingsByUid, [firebaseUser.uid!]: stars },
    }));
  };

  /** Build a Partial<LessonPlan> from a ScenarioBankEntry (used when fullPlan is absent) */
  const entryToDraft = (entry: ScenarioBankEntry): Partial<LessonPlan> => {
    const base = {
      title: entry.title,
      grade: entry.grade,
      theme: entry.topicTitle,
      objectives: (entry.objectives ?? []).map(text => ({ text, bloomsLevel: 'Understanding' as const })),
    };
    // For non-lesson-plan entries (kahoot/extracted/generated), scenario fields are empty —
    // populate introductory text with a reference to the material so the editor is not blank.
    if (!entry.scenarioIntro && !entry.scenarioMain?.length) {
      const typeLabel: Record<string, string> = {
        kahoot: 'Kahoot квиз',
        extracted_material: 'извлечен материјал',
        generated_material: 'AI-генериран материјал',
      };
      const label = typeLabel[entry.entryType ?? ''] ?? 'материјал';
      return {
        ...base,
        scenario: {
          introductory: { text: `Воведна активност со ${label}: ${entry.title}`, duration: '' },
          main: [{ text: entry.topicTitle ? `Главна активност: ${entry.topicTitle} — работа со ${label}.` : `Главна активност — работа со ${label}.`, bloomsLevel: 'Applying' as const }],
          concluding: { text: 'Завршна дискусија и резиме.', duration: '' },
        },
      };
    }
    return {
      ...base,
      scenario: {
        introductory: { text: entry.scenarioIntro ?? '', duration: '' },
        main: (entry.scenarioMain ?? []).map(text => ({ text, bloomsLevel: 'Understanding' as const })),
        concluding: { text: entry.scenarioConcluding ?? '', duration: '' },
      },
    };
  };

  const handleEdit = async (entry: ScenarioBankEntry) => {
    if (!firebaseUser?.uid) { addNotification('Мора да сте најавени.', 'warning'); return; }
    if (entry.entryType === 'thematic_plan') {
      // Thematic plans are multi-lesson units, not a single LessonPlan — the lesson
      // draft/editor path below doesn't fit them. No dedicated "open a bank thematic
      // plan in the generator" flow exists yet, so surface it honestly instead of
      // showing garbled content in the wrong editor.
      addNotification('Тематскиот план е сочуван во Банката. Отвори „Тематски План" за да создадеш свој од истата тема.', 'info');
      return;
    }
    try {
      // Always go through draft path — fullPlan.id points to local storage which may not exist on other devices
      const draft = entry.fullPlan ?? entryToDraft(entry);
      await saveUploadDraft(firebaseUser.uid, draft, entry.title);
      navigate('/planner/lesson/new');
    } catch {
      addNotification('Грешка при вчитување на сценариото. Обидете се повторно.', 'error');
    }
  };

  const handleFork = async (entry: ScenarioBankEntry) => {
    if (!firebaseUser?.uid || !user) { addNotification('Мора да сте најавени.', 'warning'); return; }
    try {
      await forkScenario(entry, firebaseUser.uid, user.name ?? 'Наставник', user.schoolName);
      setEntries(prev => prev.map(e =>
        (e.id === (entry.originalId ?? entry.id)) ? { ...e, forkCount: e.forkCount + 1 } : e
      ));
      if (entry.entryType === 'thematic_plan') {
        addNotification('✅ Тематскиот план е форкан во твоите материјали (Мои).', 'success');
        return;
      }
      const draft = entry.fullPlan ?? entryToDraft(entry);
      await saveUploadDraft(firebaseUser.uid, draft, `Ремикс: ${entry.title}`);
      addNotification('✅ Ремиксот е подготвен — отвора во Уредувач.', 'success');
      navigate('/planner/lesson/new');
    } catch {
      addNotification('Грешка при ремиксирање.', 'error');
    }
  };

  const handleUse = async (entry: ScenarioBankEntry) => {
    if (!firebaseUser?.uid) { addNotification('Мора да сте најавени.', 'warning'); return; }
    if (entry.entryType === 'thematic_plan') {
      addNotification('Тематскиот план е сочуван во Банката. Отвори „Тематски План" за да создадеш свој од истата тема.', 'info');
      return;
    }
    try {
      await recordUsage(entry.id).catch(() => {});
      setEntries(prev => prev.map(e => e.id !== entry.id ? e : { ...e, usageCount: e.usageCount + 1 }));
      const draft = entry.fullPlan ?? entryToDraft(entry);
      await saveUploadDraft(firebaseUser.uid, draft, entry.title);
      navigate('/planner/lesson/new');
    } catch {
      addNotification('Грешка при вчитување на сценариото. Обидете се повторно.', 'error');
    }
  };

  const handleMakePublic = async (entryId: string, makePublic: boolean) => {
    await setScenarioPublic(entryId, makePublic);
    setEntries(prev => prev.map(e => e.id !== entryId ? e : { ...e, isPublic: makePublic }));
    addNotification(makePublic ? '✅ Сценариото е јавно!' : '🔒 Сценариото е приватно.', 'success');
  };

  const handleDiscuss = (entry: ScenarioBankEntry) => {
    try {
      sessionStorage.setItem('forum_new_thread_prefill', JSON.stringify({
        scenarioId: entry.id,
        scenarioTitle: entry.title,
        title: `📚 ${entry.title} — дискусија`,
        body: `Дискусија за сценариото „${entry.title}" (${entry.grade}. одделение, ${entry.topicTitle}).`,
        category: 'discussion',
      }));
    } catch { /* quota */ }
    navigate('/forum');
  };

  const [printEntry, setPrintEntry] = useState<ScenarioBankEntry | null>(null);
  const scenarioPrintRef = useRef<HTMLDivElement>(null);
  const handleScenarioPrint = useReactToPrint({
    contentRef: scenarioPrintRef,
    documentTitle: `Scenarijo_${printEntry?.title?.slice(0, 30) ?? 'plan'}`,
    pageStyle: '@page { size: A4 portrait; margin: 1.5cm 1.2cm; }',
  });
  const handlePrint = useCallback((entry: ScenarioBankEntry) => {
    setPrintEntry(entry);
    setTimeout(() => handleScenarioPrint(), 80);
  }, [handleScenarioPrint]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [pendingSegments, setPendingSegments] = useState<{ segments: ScenarioSegment[]; fileName: string } | null>(null);

  /** Parse one rawText + fileName and save draft to Firestore, then navigate */
  const parseSingleAndNavigate = useCallback(async (rawText: string, fileName: string) => {
    const { plansAPI } = await import('../services/gemini/plans');
    const parsed = await plansAPI.parseScenarioFromText(rawText, user ?? undefined);
    const hasUsableContent = parsed.title || parsed.scenario?.introductory?.text || (parsed.scenario?.main?.length ?? 0) > 0;
    if (!hasUsableContent) {
      addNotification('AI не успеа да препознае структура. Провери дали датотеката содржи текст и обиди се повторно.', 'error');
      return;
    }
    if (!firebaseUser?.uid) {
      addNotification('Мора да сте најавени.', 'warning');
      return;
    }
    // S106-Г — save to Firestore instead of sessionStorage
    await saveUploadDraft(firebaseUser.uid, parsed, fileName);
    const truncWarning = rawText.length > 13000 ? ' (анализиран само прв дел)' : '';
    addNotification(`✅ „${fileName}" е структурирано${truncWarning} — прегледај и уреди.`, 'success');
    navigate('/planner/lesson/new');
  }, [user, firebaseUser, navigate, addNotification]);

  const handleUploadExtracted = useCallback(async (rawText: string, fileName: string) => {
    setShowUploadModal(false);
    setIsParsingUpload(true);
    try {
      // S106-В — multi-scenario detection
      const segments = splitScenarios(rawText);
      if (segments.length >= 2) {
        setPendingSegments({ segments, fileName });
        return;
      }
      await parseSingleAndNavigate(rawText, fileName);
    } catch {
      addNotification('Грешка при анализа на документот. Пробајте повторно.', 'error');
    } finally {
      setIsParsingUpload(false);
    }
  }, [parseSingleAndNavigate, addNotification]);

  const handleSegmentsSelected = useCallback(async (selected: ScenarioSegment[]) => {
    if (!firebaseUser?.uid || selected.length === 0) return;
    setIsParsingUpload(true);
    const fileName = pendingSegments?.fileName ?? 'документ';
    try {
      if (selected.length === 1) {
        await parseSingleAndNavigate(selected[0].text, fileName);
      } else {
        // Multiple: parse all concurrently, save all to queue
        const { plansAPI } = await import('../services/gemini/plans');
        const results = await Promise.allSettled(
          selected.map(s => plansAPI.parseScenarioFromText(s.text, user ?? undefined))
        );
        const succeeded = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof plansAPI.parseScenarioFromText>>> => r.status === 'fulfilled').map(r => r.value);
        if (succeeded.length === 0) {
          addNotification('AI не успеа да структурира ниту едно сценарио.', 'error');
          return;
        }
        await saveUploadDraftBatch(
          firebaseUser.uid,
          succeeded.map((p, i) => ({ parsed: p, fileName: `${fileName} — Сценарио ${i + 1}` }))
        );
        addNotification(`✅ ${succeeded.length} сценарија во редица — секое ќе се отвори по ред.`, 'success');
        navigate('/planner/lesson/new');
      }
    } catch {
      addNotification('Грешка при структурирање на сценаријата.', 'error');
    } finally {
      setIsParsingUpload(false);
      setPendingSegments(null);
    }
  }, [firebaseUser, pendingSegments, parseSingleAndNavigate, user, navigate, addNotification]);

  const handleBatchImport = useCallback(async (files: Array<{ name: string; text: string }>) => {
    if (!firebaseUser?.uid || files.length === 0) return;
    setIsBatchImporting(true);
    try {
      const { plansAPI } = await import('../services/gemini/plans');
      const results = await Promise.allSettled(
        files.map(f => plansAPI.parseScenarioFromText(f.text, user ?? undefined).then(p => ({ ...p, _fileName: f.name })))
      );
      const succeeded = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof plansAPI.parseScenarioFromText>> & { _fileName: string }> => r.status === 'fulfilled').map(r => r.value);
      if (succeeded.length === 0) {
        addNotification('AI не успеа да структурира ниту еден фајл.', 'error');
        return;
      }
      await saveUploadDraftBatch(
        firebaseUser.uid,
        succeeded.map(p => ({ parsed: p, fileName: p._fileName }))
      );
      const queueMsg = succeeded.length > 1 ? ` — сите ${succeeded.length} во редица` : '';
      addNotification(`✅ ${succeeded.length}/${files.length} датотеки анализирани${queueMsg}. Прва е отворена.`, 'success');
      setShowBatchModal(false);
      navigate('/planner/lesson/new');
    } catch {
      addNotification('Грешка при групен увоз.', 'error');
    } finally {
      setIsBatchImporting(false);
    }
  }, [firebaseUser, user, navigate, addNotification]);

  const handleSave = async (entryId: string, saved: boolean) => {
    if (!firebaseUser?.uid) { addNotification('Мора да сте најавени.', 'warning'); return; }
    await toggleSaveScenario(entryId, firebaseUser.uid, saved);
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const base = e.savedByUids ?? [];
      return { ...e, savedByUids: saved ? [...base, firebaseUser.uid!] : base.filter(u => u !== firebaseUser.uid) };
    }));
  };

  // ── Admin: all-entries view with pagination ──────────────────────────────
  const isAdmin = user?.role === 'admin';
  const [adminEntries, setAdminEntries] = useState<ScenarioBankEntry[]>([]);
  const [adminCursor, setAdminCursor] = useState<DocumentSnapshot | null>(null);
  const [adminHasMore, setAdminHasMore] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const loadAdmin = useCallback(async (cursor?: DocumentSnapshot) => {
    setAdminLoading(true);
    try {
      const res = await fetchAllAdmin(30, cursor);
      setAdminEntries(prev => cursor ? [...prev, ...res.entries] : res.entries);
      setAdminCursor(res.lastDoc);
      setAdminHasMore(res.hasMore);
    } catch {
      addNotification('Грешка при вчитување (admin).', 'error');
    } finally {
      setAdminLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (tab === 'admin' && isAdmin) {
      setAdminEntries([]);
      setAdminCursor(null);
      loadAdmin();
    }
  }, [tab, isAdmin, loadAdmin]);

  const TABS: { key: TabMode; label: string; icon: React.ReactNode }[] = [
    { key: 'all',   label: 'Сите сценарија',   icon: <Search className="w-3.5 h-3.5" /> },
    { key: 'bro',   label: 'БРО Верификувани', icon: <BadgeCheck className="w-3.5 h-3.5" /> },
    { key: 'saved', label: 'Зачувани',          icon: <BookMarked className="w-3.5 h-3.5" /> },
    { key: 'mine',  label: 'Мои сценарија',     icon: <Shuffle className="w-3.5 h-3.5" /> },
    ...(isAdmin ? [{ key: 'admin' as TabMode, label: 'Администратор', icon: <ShieldCheck className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            📚 Банка на Сценарија
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Japanese Lesson Study Hub — наоѓај, оценувај и ремиксирај часови
          </p>
        </div>
        {user && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              title="Групен увоз — избери повеќе датотеки одеднаш"
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-semibold px-3 py-2 rounded-xl shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4" /> Групен увоз
            </button>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              disabled={isParsingUpload}
              title="Прикачи свое старо сценарио (PDF/DOCX/TXT) — AI ќе го структурира"
              className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {isParsingUpload ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isParsingUpload ? 'Се анализира...' : 'Прикачи старо сценарио'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/planner')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow transition-colors"
            >
              <Plus className="w-4 h-4" /> Додај сценарио
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-white shadow text-indigo-700'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Барај по наслов, тема, автор..."
            value={search}
            onChange={e => { setSearch(e.target.value); setIsSemanticActive(false); setSemanticRanking(null); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {isSemanticActive && (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-violet-50 border border-violet-200 text-violet-700 rounded-full">
            <Sparkles className="w-3 h-3" /> Семантичко
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border transition-colors ${
            showFilters || gradeFilter || dokFilter || modelFilter || typeFilter
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Филтри
          {(gradeFilter || dokFilter || modelFilter) && (
            <span className="w-4 h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {[gradeFilter, dokFilter, modelFilter, typeFilter].filter(Boolean).length}
            </span>
          )}
        </button>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          aria-label="Сортирај сценарија"
          title="Сортирај"
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="date">Најнови</option>
          <option value="rating">Највисока оценка</option>
          <option value="forks">Најмногу ремикси</option>
          <option value="usage">Најмногу употребено</option>
        </select>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <Card>
          <div className="flex flex-wrap gap-4 p-4">
            {/* Grade */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase">Одделение</p>
              <div className="flex flex-wrap gap-1">
                {GRADES.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${
                      gradeFilter === g
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* DoK */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase">Webb's DoK</p>
              <div className="flex gap-1">
                {DOK_LEVELS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDokFilter(dokFilter === d ? null : d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      dokFilter === d
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    DoK {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Teaching model */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase">Наставен модел</p>
              <div className="flex flex-wrap gap-1">
                {MODELS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModelFilter(modelFilter === m ? null : m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      modelFilter === m
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Entry type */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase">Тип</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { key: null,                  label: 'Сите',       icon: null },
                  { key: 'lesson_plan' as EntryType, label: 'Час',  icon: <FileText className="w-3 h-3" /> },
                  { key: 'kahoot' as EntryType,     label: 'Kahoot', icon: <Gamepad2 className="w-3 h-3" /> },
                  { key: 'extracted_material' as EntryType, label: 'Извлечени', icon: <Search className="w-3 h-3" /> },
                  { key: 'generated_material' as EntryType, label: 'AI Генерирани', icon: <Sparkles className="w-3 h-3" /> },
                  { key: 'thematic_plan' as EntryType, label: 'Тематски', icon: <Layers className="w-3 h-3" /> },
                ] as const).map(opt => (
                  <button
                    key={String(opt.key)}
                    type="button"
                    onClick={() => setTypeFilter(opt.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      typeFilter === opt.key
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-sky-300'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear */}
            {(gradeFilter || dokFilter || modelFilter || typeFilter) && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => { setGradeFilter(null); setDokFilter(null); setModelFilter(null); setTypeFilter(null); }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold underline"
                >
                  Исчисти филтри
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Results count */}
      {!isLoading && (
        <p className="text-xs text-gray-400">
          {sorted.length === 0 ? 'Нема резултати' : `${sorted.length} сценарија`}
          {search && ` за „${search}"`}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-4xl">📭</p>
          <p className="text-gray-500 font-semibold">
            {tab === 'mine' ? 'Немате уште сценарија. Создадете и споделете!' :
             tab === 'saved' ? 'Немате зачувани сценарија.' :
             'Нема сценарија за овие филтри.'}
          </p>
          {(tab === 'all' || tab === 'mine') && (
            <button
              type="button"
              onClick={() => navigate('/planner')}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Создади сценарио
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(entry => (
            <ScenarioCard
              key={entry.id}
              entry={entry}
              currentUid={firebaseUser?.uid}
              currentName={user?.name ?? 'Наставник'}
              currentSchool={user?.schoolName ?? ''}
              onRate={handleRate}
              onFork={handleFork}
              onUse={handleUse}
              onSave={handleSave}
              onEdit={handleEdit}
              onDiscuss={handleDiscuss}
              onPrint={handlePrint}
            />
          ))}
        </div>
      )}

      {/* Private drafts — shown only in "mine" tab */}
      {tab === 'mine' && (() => {
        const privateDrafts = entries.filter(e => !e.isPublic);
        if (privateDrafts.length === 0) return null;
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-500 uppercase tracking-wide">🔒 Приватни нацрти ({privateDrafts.length})</span>
              <span className="text-xs text-gray-400">— само ти ги гледаш</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {privateDrafts.map(entry => (
                <div key={entry.id} className="relative">
                  <ScenarioCard
                    entry={entry}
                    currentUid={firebaseUser?.uid}
                    currentName={user?.name ?? 'Наставник'}
                    currentSchool={user?.schoolName ?? ''}
                    onRate={handleRate}
                    onFork={handleFork}
                    onUse={handleUse}
                    onSave={handleSave}
                    onEdit={handleEdit}
                    onDiscuss={handleDiscuss}
                    onPrint={handlePrint}
                  />
                  <div className="mt-1.5 px-1">
                    <button
                      type="button"
                      onClick={() => handleMakePublic(entry.id, true)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold py-2 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Направи јавно во Банката
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Admin: all-entries panel ── */}
      {tab === 'admin' && isAdmin && (
        <div className="space-y-4">
          {/* Stats header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-black text-gray-800">
                Администраторски преглед — сите сценарија
              </h2>
              <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                {adminEntries.length}{adminHasMore ? '+' : ''} вкупно
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setAdminEntries([]); setAdminCursor(null); loadAdmin(); }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              disabled={adminLoading}
            >
              {adminLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↻'} Освежи
            </button>
          </div>

          {/* Column breakdown */}
          {adminEntries.length > 0 && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xl font-black text-emerald-600">
                  {adminEntries.filter(e => e.isPublic).length}
                </p>
                <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1 mt-0.5">
                  <Globe className="w-3 h-3" /> Јавни
                </p>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xl font-black text-amber-600">
                  {adminEntries.filter(e => !e.isPublic).length}
                </p>
                <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1 mt-0.5">
                  <Lock className="w-3 h-3" /> Приватни нацрти
                </p>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xl font-black text-indigo-600">
                  {adminEntries.filter(e => e.verifiedByBRO).length}
                </p>
                <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1 mt-0.5">
                  <BadgeCheck className="w-3 h-3" /> БРО Верифиц.
                </p>
              </div>
            </div>
          )}

          {adminLoading && adminEntries.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          )}

          {/* Admin table */}
          {adminEntries.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-bold text-gray-600">Наслов</th>
                    <th className="text-left px-3 py-2.5 font-bold text-gray-600">Автор</th>
                    <th className="text-left px-3 py-2.5 font-bold text-gray-600">Одд.</th>
                    <th className="text-left px-3 py-2.5 font-bold text-gray-600">Тема</th>
                    <th className="text-left px-3 py-2.5 font-bold text-gray-600">Статус</th>
                    <th className="text-right px-3 py-2.5 font-bold text-gray-600">Употреби</th>
                  </tr>
                </thead>
                <tbody>
                  {adminEntries.map((entry, i) => (
                    <tr key={entry.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                      <td className="px-3 py-2 max-w-[220px]">
                        <p className="font-semibold text-gray-800 truncate">{entry.title}</p>
                        {entry.forkDepth > 0 && (
                          <span className="text-[10px] text-indigo-500">↳ Ремикс (ниво {entry.forkDepth})</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-700 truncate max-w-[140px]">{entry.authorName}</p>
                        {entry.schoolName && <p className="text-gray-400 truncate max-w-[140px]">{entry.schoolName}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                          {entry.grade}. одд.
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[160px]">
                        <span className="truncate text-gray-600 block">{entry.topicTitle}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {entry.isPublic
                            ? <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold"><Globe className="w-2.5 h-2.5" /> Јавно</span>
                            : <span className="flex items-center gap-0.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold"><Lock className="w-2.5 h-2.5" /> Нацрт</span>
                          }
                          {entry.verifiedByBRO && <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold">БРО</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {entry.usageCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Load more */}
          {adminHasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => adminCursor && loadAdmin(adminCursor)}
                disabled={adminLoading}
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
              >
                {adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Вчитај уште 30 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      {tab !== 'admin' && sorted.length > 0 && (
        <p className="text-center text-xs text-gray-400 pb-4">
          🎓 Секое сценарио може да се ремиксира — создај своја верзија и автоматски влегува во Банката
        </p>
      )}

      {/* Hidden PrintShell — populated when user clicks print on a scenario card */}
      <div className="absolute -left-[9999px] top-0">
        <PrintShell
          ref={scenarioPrintRef}
          title={printEntry?.title ?? 'Сценарио за час'}
          subtitle={printEntry ? `${printEntry.grade}. одд. · ${printEntry.topicTitle ?? ''}` : ''}
          teacherName={printEntry?.authorName ?? ''}
          grade={printEntry?.grade}
          subject="Математика"
        >
          {printEntry && (
            <div className="space-y-4 text-sm">
              {/* Meta row */}
              <div className="flex flex-wrap gap-4 text-[10pt] border-b border-gray-300 pb-3">
                {printEntry.teachingModel && <span><strong>Модел:</strong> {printEntry.teachingModel}</span>}
                {printEntry.bloomLevels?.length ? <span><strong>Bloom:</strong> {printEntry.bloomLevels.join(', ')}</span> : null}
                {printEntry.dokLevel && <span><strong>DoK:</strong> {printEntry.dokLevel}</span>}
                {printEntry.authorName && <span><strong>Автор:</strong> {printEntry.authorName}</span>}
              </div>
              {/* Scenario phases */}
              {printEntry.objectives.length > 0 && (
                <div>
                  <p className="font-bold text-[10pt] mb-1">Цели на часот</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {printEntry.objectives.map((o, i) => <li key={i} className="text-[10pt]">{o}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <p className="font-bold text-[10pt] mb-1">Воведна активност</p>
                <p className="text-[10pt]">{printEntry.scenarioIntro}</p>
              </div>
              {printEntry.scenarioMain.length > 0 && (
                <div>
                  <p className="font-bold text-[10pt] mb-1">Главни активности</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    {printEntry.scenarioMain.map((m, i) => <li key={i} className="text-[10pt]">{m}</li>)}
                  </ol>
                </div>
              )}
              <div>
                <p className="font-bold text-[10pt] mb-1">Завршна активност</p>
                <p className="text-[10pt]">{printEntry.scenarioConcluding}</p>
              </div>
              {printEntry.assessmentStandards.length > 0 && (
                <div>
                  <p className="font-bold text-[10pt] mb-1">БРО Стандарди</p>
                  <p className="text-[10pt]">{printEntry.assessmentStandards.join(' · ')}</p>
                </div>
              )}
              {/* Signature */}
              <div className="mt-8 grid grid-cols-2 gap-8 text-[9pt]">
                <div>
                  <div className="border-b border-black w-48 mb-1" />
                  <span>Наставник/-чка: {printEntry.authorName || '_________________'}</span>
                </div>
                <div>
                  <div className="border-b border-black w-48 mb-1" />
                  <span>Директор/-ка · Потпис и Печат</span>
                </div>
              </div>
            </div>
          )}
        </PrintShell>
      </div>

      {showUploadModal && (
        <UploadScenarioModal
          onClose={() => setShowUploadModal(false)}
          onExtracted={handleUploadExtracted}
        />
      )}

      {/* S106-В — Multi-scenario selection modal */}
      {pendingSegments && (
        <ScenarioSelectionModal
          segments={pendingSegments.segments}
          fileName={pendingSegments.fileName}
          onImportSelected={handleSegmentsSelected}
          onClose={() => { setPendingSegments(null); setIsParsingUpload(false); }}
          isImporting={isParsingUpload}
        />
      )}

      {/* S106-Е — Batch import modal */}
      {showBatchModal && (
        <BatchImportModal
          onClose={() => setShowBatchModal(false)}
          onImportSelected={handleBatchImport}
          isImporting={isBatchImporting}
        />
      )}
    </div>
  );
};
