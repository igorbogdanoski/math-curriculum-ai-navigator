import React from 'react';
import { Search, SlidersHorizontal, Sparkles, Loader2, FileText, Gamepad2, Layers } from 'lucide-react';
import { Card } from '../common/Card';
import type { TeachingModel, EntryType } from '../../services/firestoreService.scenarioBank';
import { useLanguage } from '../../i18n/LanguageContext';

export type SortBy = 'date' | 'rating' | 'forks' | 'usage';

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MODELS: TeachingModel[] = ['5E', 'PBL', 'ZPD', 'Cooperative', 'Traditional'];
const DOK_LEVELS = [1, 2, 3, 4];

export interface ConceptOption { id: string; title: string; }

interface ScenarioFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  isSemanticActive: boolean;
  isSearching: boolean;
  searchTruncated: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  gradeFilter: number | null;
  onGradeFilterChange: (grade: number | null) => void;
  dokFilter: number | null;
  onDokFilterChange: (dok: number | null) => void;
  modelFilter: TeachingModel | null;
  onModelFilterChange: (model: TeachingModel | null) => void;
  typeFilter: EntryType | null;
  onTypeFilterChange: (type: EntryType | null) => void;
  conceptFilter: string | null;
  onConceptFilterChange: (conceptId: string | null) => void;
  conceptOptions: ConceptOption[];
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  onClearFilters: () => void;
}

/** Search bar + sort/type/grade/DoK/model filters for ScenarioBankView. */
export const ScenarioFilterBar: React.FC<ScenarioFilterBarProps> = ({
  search, onSearchChange, isSemanticActive, isSearching, searchTruncated,
  showFilters, onToggleFilters,
  gradeFilter, onGradeFilterChange,
  dokFilter, onDokFilterChange,
  modelFilter, onModelFilterChange,
  typeFilter, onTypeFilterChange,
  conceptFilter, onConceptFilterChange, conceptOptions,
  sortBy, onSortByChange,
  onClearFilters,
}) => {
  const { t } = useLanguage();
  const hasAnyFilter = Boolean(gradeFilter || dokFilter || modelFilter || typeFilter || conceptFilter);

  return (
    <>
      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('scenarioBank.filter.searchPlaceholder')}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {isSemanticActive && (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-violet-50 border border-violet-200 text-violet-700 rounded-full">
            <Sparkles className="w-3 h-3" /> {t('scenarioBank.filter.semantic')}
          </span>
        )}
        {isSearching && (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-gray-50 border border-gray-200 text-gray-500 rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" /> {t('scenarioBank.filter.searchingAll')}
          </span>
        )}
        {searchTruncated && !isSearching && (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700 rounded-full" title={t('scenarioBank.filter.truncatedTitle')}>
            {t('scenarioBank.filter.truncatedBadge')}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleFilters}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border transition-colors ${
            showFilters || hasAnyFilter
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t('scenarioBank.filter.filters')}
          {hasAnyFilter && (
            <span className="w-4 h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {[gradeFilter, dokFilter, modelFilter, typeFilter, conceptFilter].filter(Boolean).length}
            </span>
          )}
        </button>
        <select
          value={sortBy}
          onChange={e => onSortByChange(e.target.value as SortBy)}
          aria-label={t('scenarioBank.filter.sortAria')}
          title={t('scenarioBank.filter.sortTitle')}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="date">{t('scenarioBank.filter.sortNewest')}</option>
          <option value="rating">{t('scenarioBank.filter.sortTopRated')}</option>
          <option value="forks">{t('scenarioBank.filter.sortMostForks')}</option>
          <option value="usage">{t('scenarioBank.filter.sortMostUsed')}</option>
        </select>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <Card>
          <div className="flex flex-wrap gap-4 p-4">
            {/* Grade */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase">{t('scenarioBank.filter.gradeLabel')}</p>
              <div className="flex flex-wrap gap-1">
                {GRADES.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onGradeFilterChange(gradeFilter === g ? null : g)}
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
                    onClick={() => onDokFilterChange(dokFilter === d ? null : d)}
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
              <p className="text-xs font-bold text-gray-500 uppercase">{t('scenarioBank.filter.teachingModelLabel')}</p>
              <div className="flex flex-wrap gap-1">
                {MODELS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModelFilterChange(modelFilter === m ? null : m)}
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
              <p className="text-xs font-bold text-gray-500 uppercase">{t('scenarioBank.filter.typeLabel')}</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { key: null, label: t('scenarioBank.filter.typeAll'), icon: null },
                  { key: 'lesson_plan' as EntryType, label: t('scenarioBank.filter.typeLesson'), icon: <FileText className="w-3 h-3" /> },
                  { key: 'kahoot' as EntryType, label: 'Kahoot', icon: <Gamepad2 className="w-3 h-3" /> },
                  { key: 'extracted_material' as EntryType, label: t('scenarioBank.filter.typeExtracted'), icon: <Search className="w-3 h-3" /> },
                  { key: 'generated_material' as EntryType, label: t('scenarioBank.filter.typeAiGenerated'), icon: <Sparkles className="w-3 h-3" /> },
                  { key: 'thematic_plan' as EntryType, label: t('scenarioBank.filter.typeThematic'), icon: <Layers className="w-3 h-3" /> },
                ] as const).map(opt => (
                  <button
                    key={String(opt.key)}
                    type="button"
                    onClick={() => onTypeFilterChange(opt.key)}
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

            {/* Concept */}
            {conceptOptions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase">{t('scenarioBank.filter.conceptLabel')}</p>
                <select
                  value={conceptFilter ?? ''}
                  onChange={e => onConceptFilterChange(e.target.value || null)}
                  aria-label={t('scenarioBank.filter.filterByConceptAria')}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[220px]"
                >
                  <option value="">{t('scenarioBank.filter.allConcepts')}</option>
                  {conceptOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear */}
            {hasAnyFilter && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold underline"
                >
                  {t('scenarioBank.filter.clearFilters')}
                </button>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
};
