import React, { useState, useCallback } from 'react';
import { Plus, Search, Loader2, ClipboardList, BookOpen } from 'lucide-react';
import {
  deleteDuggaTest, updateDuggaTest,
} from '../services/firestoreService.dugga';
import type { DuggaTest } from '../services/firestoreService.dugga';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useDuggaLibraryData, type LibraryTab } from '../hooks/useDuggaLibraryData';
import { DuggaTestCard } from '../components/dugga/DuggaTestCard';
import { AssignDuggaModal } from '../components/dugga/AssignDuggaModal';
import { DuggaResultsPanel } from '../components/dugga/DuggaResultsPanel';
import { EmptyState } from '../components/common/EmptyState';
import { logger } from '../utils/logger';
import { useLanguage } from '../i18n/LanguageContext';

// ─── Main View ────────────────────────────────────────────────────────────────

export function DuggaLibraryView() {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();
  const { t } = useLanguage();

  const [tab, setTab] = useState<LibraryTab>('my');
  const {
    myTests, publicTests,
    loadingMy, loadingPublic, loadingMorePublic,
    publicHasMore, loadMorePublicTests,
  } = useDuggaLibraryData(firebaseUser?.uid, tab);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');
  const [onlyFinalExam, setOnlyFinalExam] = useState(false);
  const [selectedTest, setSelectedTest] = useState<DuggaTest | null>(null);
  const [assignTest, setAssignTest] = useState<DuggaTest | null>(null);

  const handleEdit = useCallback((id: string) => {
    navigate(`/dugga/build?edit=${id}`);
  }, [navigate]);

  const handleAdapt = useCallback((id: string) => {
    navigate(`/dugga/build?adapt=${id}`);
  }, [navigate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t('duggaLibrary.confirmDelete'))) return;
    try {
      await deleteDuggaTest(id);
      addNotification(t('duggaLibrary.deleted'), 'success');
    } catch (err) {
      logger.error('[DuggaLibraryView] failed to delete test', err);
      addNotification(t('duggaLibrary.deleteError'), 'error');
    }
  }, [addNotification, t]);

  const handleTogglePublic = useCallback(async (id: string, isPublic: boolean) => {
    try {
      await updateDuggaTest(id, { isPublic });
      addNotification(isPublic ? t('duggaLibrary.madePublic') : t('duggaLibrary.madePrivate'), 'success');
    } catch (err) {
      logger.error('[DuggaLibraryView] failed to toggle test visibility', err);
      addNotification(t('duggaLibrary.visibilityError'), 'error');
    }
  }, [addNotification, t]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      addNotification(t('duggaLibrary.codeCopied').replace('{code}', code), 'success');
    });
  }, [addNotification, t]);

  const sourceTests = tab === 'my' ? myTests : publicTests;

  // Build the dynamic track list from the visible source.
  const availableTracks = Array.from(
    new Set(sourceTests.map(t => (t.track ?? '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'mk'));

  const activeTests = sourceTests.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.topics.some(tp => tp.toLowerCase().includes(q)) || t.shareCode.toLowerCase().includes(q);
    const matchGrade = filterGrade === 'all' || t.grade === filterGrade;
    const matchTrack = filterTrack === 'all' || (t.track ?? '') === filterTrack;
    const matchType = filterTestType === 'all' || t.testType === filterTestType;
    const matchExam = !onlyFinalExam || t.finalExamMode === true;
    return matchSearch && matchGrade && matchTrack && matchType && matchExam;
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{t('duggaLibrary.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('duggaLibrary.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => navigate('/dugga/play')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:border-indigo-300 hover:text-indigo-700 transition-colors">
            <BookOpen className="w-4 h-4" />
            {t('duggaLibrary.playWithCode')}
          </button>
          <button type="button"
            onClick={() => navigate('/dugga/build')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            {t('duggaLibrary.newTest')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {([['my', t('duggaLibrary.tabMine')], ['public', t('duggaLibrary.tabPublic')]] as const).map(([tabId, label]) => (
          <button type="button" key={tabId} onClick={() => setTab(tabId)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === tabId ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
            {tabId === 'my' && myTests.length > 0 && (
              <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{myTests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('duggaLibrary.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
        </div>
        <select value={filterGrade === 'all' ? 'all' : String(filterGrade)}
          onChange={e => setFilterGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label={t('duggaLibrary.filterGrade')}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="all">{t('duggaLibrary.allGrades')}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
            <option key={g} value={g}>{g}{t('duggaLibrary.gradeSuffix')}</option>
          ))}
        </select>
        <select value={filterTrack}
          onChange={e => setFilterTrack(e.target.value)}
          aria-label={t('duggaLibrary.filterTrack')}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="all">{t('duggaLibrary.allTracks')}</option>
          {availableTracks.map(tr => (
            <option key={tr} value={tr}>{tr}</option>
          ))}
        </select>
        <select value={filterTestType}
          onChange={e => setFilterTestType(e.target.value)}
          aria-label={t('duggaLibrary.filterType')}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="all">{t('duggaLibrary.allTypes')}</option>
          <option value="topic">{t('duggaLibrary.typeTopic')}</option>
          <option value="midterm">{t('duggaLibrary.typeMidterm')}</option>
          <option value="annual">{t('duggaLibrary.typeAnnual')}</option>
          <option value="exam">{t('duggaLibrary.typeExam')}</option>
          <option value="custom">{t('duggaLibrary.typeCustom')}</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white cursor-pointer">
          <input type="checkbox" checked={onlyFinalExam}
            onChange={e => setOnlyFinalExam(e.target.checked)}
            className="accent-indigo-600" />
          {t('duggaLibrary.onlyFinalExams')}
        </label>
      </div>

      {/* Content */}
      {(tab === 'my' ? loadingMy : loadingPublic) ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : activeTests.length === 0 ? (
        tab === 'my' ? (
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            title={t('duggaLibrary.emptyMineTitle')}
            message={t('duggaLibrary.emptyMineMessage')}
          >
            <button type="button" onClick={() => navigate('/dugga/build')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" />
              {t('duggaLibrary.makeFirstTest')}
            </button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            title={t('duggaLibrary.emptyPublicTitle')}
            message={t('duggaLibrary.emptyPublicMessage')}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeTests.map(t => (
            <DuggaTestCard
              key={t.id}
              test={t}
              isOwner={t.teacherUid === firebaseUser?.uid}
              onDelete={handleDelete}
              onTogglePublic={handleTogglePublic}
              onViewResults={setSelectedTest}
              onCopyCode={handleCopyCode}
              onEdit={handleEdit}
              onAdapt={handleAdapt}
              onPlay={() => navigate(`/dugga/play?code=${t.shareCode}`)}
              onAssign={t.teacherUid === firebaseUser?.uid ? () => setAssignTest(t) : undefined}
            />
          ))}
        </div>
      )}

      {/* Load more — only the public tab is paginated; "my" tests stay a live subscription (bounded per-teacher) */}
      {tab === 'public' && publicHasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={loadMorePublicTests}
            disabled={loadingMorePublic}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loadingMorePublic ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('duggaLibrary.loadMore')}
          </button>
        </div>
      )}

      {/* Results panel modal */}
      {selectedTest && (
        <DuggaResultsPanel test={selectedTest} onClose={() => setSelectedTest(null)} />
      )}

      {/* Assign Dugga modal */}
      {assignTest && firebaseUser?.uid && (
        <AssignDuggaModal
          test={assignTest}
          teacherUid={firebaseUser.uid}
          onClose={() => setAssignTest(null)}
          onSuccess={() => {
            addNotification(`„${assignTest.title}" ${t('duggaLibrary.assignedToClass')}`, 'success');
            setAssignTest(null);
          }}
        />
      )}
    </div>
  );
}
