import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, BookMarked, BadgeCheck, Shuffle, Plus, FileText, Upload, Loader2, ShieldCheck } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { ScenarioCard } from '../components/scenario-bank/ScenarioCard';
import { UploadScenarioModal } from '../components/scenario-bank/UploadScenarioModal';
import { ScenarioSelectionModal } from '../components/scenario-bank/ScenarioSelectionModal';
import { BatchImportModal } from '../components/scenario-bank/BatchImportModal';
import { ScenarioFilterBar, type SortBy } from '../components/scenario-bank/ScenarioFilterBar';
import { ScenarioBankAdminPanel } from '../components/scenario-bank/ScenarioBankAdminPanel';
import { ScenarioPrintShell } from '../components/scenario-bank/ScenarioPrintShell';
import { saveUploadDraft, saveUploadDraftBatch } from '../services/uploadDraftService';
import { splitScenarios } from '../services/scenarioSplitter';
import type { ScenarioSegment } from '../services/scenarioSplitter';
import type { ScenarioBankEntry, ScenarioBankFilter, TeachingModel, EntryType } from '../services/firestoreService.scenarioBank';
import {
  fetchScenarios, fetchScenariosForSearch, fetchMyScenarios, rateScenario,
  forkScenario, toggleSaveScenario, recordUsage, setScenarioPublic,
} from '../services/firestoreService.scenarioBank';
import type { DocumentSnapshot } from 'firebase/firestore';
import type { ScenarioSearchResult } from '../services/ragService';
import type { LessonPlan } from '../types';
import { SCENARIO_BANK_CONCEPT_PREFILL_KEY } from '../components/concept/ConceptScenariosPreview';

type TabMode = 'all' | 'mine' | 'saved' | 'bro' | 'admin';

/** Reads and clears the one-shot concept prefill set by ConceptScenariosPreview — mirrors the existing `kahoot_gamma_prompt` sessionStorage prefill pattern. */
function readConceptPrefill(): string | null {
  try {
    const raw = sessionStorage.getItem(SCENARIO_BANK_CONCEPT_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SCENARIO_BANK_CONCEPT_PREFILL_KEY);
    const parsed = JSON.parse(raw) as { conceptId?: string };
    return parsed.conceptId ?? null;
  } catch {
    return null;
  }
}

export const ScenarioBankView: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();

  const [tab, setTab] = useState<TabMode>('all');
  const [entries, setEntries] = useState<ScenarioBankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [conceptPrefillActive] = useState(() => Boolean(sessionStorage.getItem(SCENARIO_BANK_CONCEPT_PREFILL_KEY)));
  const [showFilters, setShowFilters] = useState(() => conceptPrefillActive);

  // Filters
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [dokFilter, setDokFilter] = useState<number | null>(null);
  const [modelFilter, setModelFilter] = useState<TeachingModel | null>(null);
  const [typeFilter, setTypeFilter] = useState<EntryType | null>(null);
  const [conceptFilter, setConceptFilter] = useState<string | null>(readConceptPrefill);
  const [sortBy, setSortBy] = useState<SortBy>('date');

  // Browse pagination (all/bro tabs only — mine/admin have their own unbounded/paginated fetches)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Search state — a query re-fetches a much broader set directly from Firestore
  // (fetchScenariosForSearch) instead of just filtering the paginated `entries` page,
  // so search actually reaches the whole collection, not just whatever page is loaded.
  const [searchResults, setSearchResults] = useState<ScenarioBankEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [semanticRanking, setSemanticRanking] = useState<ScenarioSearchResult[] | null>(null);
  const [isSemanticActive, setIsSemanticActive] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (mode: TabMode) => {
    setIsLoading(true);
    setLastDoc(null);
    setHasMore(false);
    try {
      if (mode === 'mine' && firebaseUser?.uid) {
        const data = await fetchMyScenarios(firebaseUser.uid);
        setEntries(data);
      } else {
        const filter: ScenarioBankFilter = {
          grade: gradeFilter,
          dokLevel: dokFilter,
          teachingModel: modelFilter,
          conceptId: conceptFilter,
          verifiedOnly: mode === 'bro',
          sortBy,
        };
        const page = await fetchScenarios(filter, 48);
        setEntries(page.entries);
        setLastDoc(page.lastDoc);
        setHasMore(page.hasMore);
      }
    } catch {
      addNotification('Грешка при вчитување на сценаријата.', 'error');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gradeFilter, dokFilter, modelFilter, conceptFilter, sortBy, firebaseUser?.uid]);

  useEffect(() => { load(tab); }, [load, tab]);

  const loadMoreScenarios = useCallback(async () => {
    if (!lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const filter: ScenarioBankFilter = {
        grade: gradeFilter, dokLevel: dokFilter, teachingModel: modelFilter, conceptId: conceptFilter,
        verifiedOnly: tab === 'bro', sortBy,
      };
      const page = await fetchScenarios(filter, 48, lastDoc);
      setEntries(prev => [...prev, ...page.entries]);
      setLastDoc(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      addNotification('Грешка при вчитување.', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [lastDoc, isLoadingMore, gradeFilter, dokFilter, modelFilter, conceptFilter, tab, sortBy, addNotification]);

  // Debounced search — triggers after 800ms of typing when query >= 3 chars. For the
  // all/bro tabs (the ones with a paginated browse fetch) this also re-fetches a much
  // broader set from Firestore so the search actually covers the whole collection;
  // for mine/saved (already-unbounded per-teacher data) it just ranks the loaded `entries`.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = search.trim();

    if (q.length < 3) {
      setSearchResults(null);
      setSearchTruncated(false);
      setSemanticRanking(null);
      setIsSemanticActive(false);
      return;
    }

    const needsBroaderFetch = tab === 'all' || tab === 'bro';

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(needsBroaderFetch);
      try {
        let poolForSemantic = entries;
        if (needsBroaderFetch) {
          const filter: ScenarioBankFilter = {
            grade: gradeFilter, dokLevel: dokFilter, teachingModel: modelFilter, conceptId: conceptFilter,
            verifiedOnly: tab === 'bro', sortBy,
          };
          const page = await fetchScenariosForSearch(filter);
          setSearchResults(page.entries);
          setSearchTruncated(page.truncated);
          poolForSemantic = page.entries;
        } else {
          setSearchResults(null);
          setSearchTruncated(false);
        }

        const { searchScenarioBankSemantic } = await import('../services/ragService');
        const result = await searchScenarioBankSemantic(q, poolForSemantic);
        if (result !== null) {
          setSemanticRanking(result);
          setIsSemanticActive(true);
        } else {
          setSemanticRanking(null);
          setIsSemanticActive(false);
        }
      } catch {
        if (needsBroaderFetch) setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 800);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab, entries, gradeFilter, dokFilter, modelFilter, conceptFilter, sortBy]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = (q.length >= 3 && searchResults !== null) ? searchResults : entries;
    if (tab === 'saved' && firebaseUser?.uid) {
      list = list.filter(e => (e.savedByUids ?? []).includes(firebaseUser.uid!));
    }
    if (typeFilter) {
      list = list.filter(e => (e.entryType ?? 'lesson_plan') === typeFilter);
    }
    if (conceptFilter) {
      list = list.filter(e => e.conceptId === conceptFilter);
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
  }, [entries, search, tab, firebaseUser?.uid, semanticRanking, searchResults, typeFilter, conceptFilter]);

  const conceptOptions = useMemo(() => {
    const byId = new Map<string, string>();
    entries.forEach(e => {
      if (e.conceptId && e.conceptTitle) byId.set(e.conceptId, e.conceptTitle);
    });
    return [...byId.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'mk'));
  }, [entries]);

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

  // ── Admin: all-entries view with pagination ── extracted to ScenarioBankAdminPanel
  const isAdmin = user?.role === 'admin';

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

      <ScenarioFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setIsSemanticActive(false); setSemanticRanking(null); }}
        isSemanticActive={isSemanticActive}
        isSearching={isSearching}
        searchTruncated={searchTruncated}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        gradeFilter={gradeFilter}
        onGradeFilterChange={setGradeFilter}
        dokFilter={dokFilter}
        onDokFilterChange={setDokFilter}
        modelFilter={modelFilter}
        onModelFilterChange={setModelFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        conceptFilter={conceptFilter}
        onConceptFilterChange={setConceptFilter}
        conceptOptions={conceptOptions}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        onClearFilters={() => { setGradeFilter(null); setDokFilter(null); setModelFilter(null); setTypeFilter(null); setConceptFilter(null); }}
      />

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
              onNavigate={navigate}
            />
          ))}
        </div>
      )}

      {/* Load more — browse pagination for all/bro tabs. Hidden while a search query is
          active (search already fetches a much broader set via fetchScenariosForSearch,
          not the paginated `entries`), so there's nothing more for this button to add. */}
      {(tab === 'all' || tab === 'bro') && hasMore && search.trim().length < 3 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMoreScenarios}
            disabled={isLoadingMore}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Вчитај уште →
          </button>
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
                    onNavigate={navigate}
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
      {tab === 'admin' && isAdmin && <ScenarioBankAdminPanel />}

      {/* Footer hint */}
      {tab !== 'admin' && sorted.length > 0 && (
        <p className="text-center text-xs text-gray-400 pb-4">
          🎓 Секое сценарио може да се ремиксира — создај своја верзија и автоматски влегува во Банката
        </p>
      )}

      {/* Hidden PrintShell — populated when user clicks print on a scenario card */}
      <ScenarioPrintShell ref={scenarioPrintRef} entry={printEntry} />

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
