import React, { useState } from 'react';
import { Star, GitFork, Users, BadgeCheck, ChevronDown, ChevronUp, Shuffle, Lightbulb, Eye, MessageSquare, Printer, Pencil } from 'lucide-react';
import type { ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import { getAvgRating, getUserRating } from '../../services/firestoreService.scenarioBank';
import { DokBadge } from '../common/DokBadge';
import { SuggestRevisionModal } from './SuggestRevisionModal';
import { ObservationModal } from './ObservationModal';
import { AcademyBadgeRow } from '../academy/AcademyBadgeChip';
import { ContextualMathTools } from '../lesson-plan-editor/ContextualMathTools';
import { useLanguage } from '../../i18n/LanguageContext';

const BLOOM_LABEL_KEYS: Record<string, string> = {
  '1': 'scenarioBank.card.bloomRemember', '2': 'scenarioBank.card.bloomUnderstand', '3': 'scenarioBank.card.bloomApply',
  '4': 'scenarioBank.card.bloomAnalyze', '5': 'scenarioBank.card.bloomEvaluate', '6': 'scenarioBank.card.bloomCreate',
};
const BLOOM_COLORS: Record<string, string> = {
  '1': 'bg-blue-50 text-blue-700 border-blue-200',
  '2': 'bg-purple-50 text-purple-700 border-purple-200',
  '3': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  '4': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '5': 'bg-amber-50 text-amber-700 border-amber-200',
  '6': 'bg-red-50 text-red-700 border-red-200',
};

const MODEL_COLORS: Record<string, string> = {
  '5E': 'bg-indigo-100 text-indigo-700',
  'PBL': 'bg-emerald-100 text-emerald-700',
  'ZPD': 'bg-violet-100 text-violet-700',
  'Cooperative': 'bg-orange-100 text-orange-700',
  'Traditional': 'bg-gray-100 text-gray-600',
};

interface Props {
  entry: ScenarioBankEntry;
  currentUid?: string;
  currentName?: string;
  currentSchool?: string;
  onRate: (entryId: string, stars: number) => void;
  onFork: (entry: ScenarioBankEntry) => void;
  onUse: (entry: ScenarioBankEntry) => void;
  onSave: (entryId: string, saved: boolean) => void;
  onEdit?: (entry: ScenarioBankEntry) => void;
  onDiscuss?: (entry: ScenarioBankEntry) => void;
  onPrint?: (entry: ScenarioBankEntry) => void;
  onNavigate?: (path: string) => void;
}

export const ScenarioCard: React.FC<Props> = ({
  entry, currentUid, currentName, currentSchool = '',
  onRate, onFork, onUse, onSave, onEdit, onDiscuss, onPrint, onNavigate,
}) => {
  const { t } = useLanguage();
  const resolvedCurrentName = currentName ?? t('scenarioBank.card.defaultAuthorName');
  const [expanded, setExpanded] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showObserve, setShowObserve] = useState(false);

  const canSuggest = currentUid && currentUid !== entry.authorUid;

  const avg = getAvgRating(entry);
  const myRating = currentUid ? getUserRating(entry, currentUid) : null;
  const ratingCount = entry.ratingsByUid ? Object.keys(entry.ratingsByUid).length : 0;
  const isSaved = currentUid ? (entry.savedByUids ?? []).includes(currentUid) : false;

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col ${
      entry.isFeatured ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-100'
    }`}>
      {/* Header */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-[11px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                {entry.grade}. {t('scenarioBank.card.gradeSuffix')}
              </span>
              {entry.verifiedByBRO && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                  <BadgeCheck className="w-3 h-3" /> {t('scenarioBank.card.broBadge')}
                </span>
              )}
              {entry.isFeatured && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  {t('scenarioBank.card.featuredBadge')}
                </span>
              )}
              {entry.teachingModel && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${MODEL_COLORS[entry.teachingModel] ?? 'bg-gray-100 text-gray-600'}`}>
                  {entry.teachingModel}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">
              {entry.title}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {entry.topicTitle}
            </p>
          </div>
          {entry.dokLevel && (
            <div className="shrink-0">
              <DokBadge level={entry.dokLevel} size="compact" />
            </div>
          )}
        </div>

        {/* Bloom chips */}
        {entry.bloomLevels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.bloomLevels.map(lvl => (
              <span key={lvl} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${BLOOM_COLORS[lvl] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {BLOOM_LABEL_KEYS[lvl] ? t(BLOOM_LABEL_KEYS[lvl]) : `B${lvl}`}
              </span>
            ))}
          </div>
        )}

        {/* Scenario preview */}
        <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">
          {entry.scenarioIntro}
        </p>

        {expanded && (
          <div className="space-y-2 mt-2 border-t pt-2">
            {entry.objectives.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{t('scenarioBank.card.objectives')}</p>
                <ul className="space-y-0.5">
                  {entry.objectives.map((o, i) => (
                    <li key={i} className="text-[11px] text-gray-700 flex gap-1.5">
                      <span className="text-indigo-400 shrink-0">•</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {entry.scenarioMain.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{t('scenarioBank.card.mainActivities')}</p>
                <ol className="space-y-0.5 list-decimal list-outside ml-4">
                  {entry.scenarioMain.map((m, i) => (
                    <li key={i} className="text-[11px] text-gray-700">{m}</li>
                  ))}
                </ol>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{t('scenarioBank.card.concludingActivity')}</p>
              <p className="text-[11px] text-gray-700">{entry.scenarioConcluding}</p>
            </div>
            {entry.assessmentStandards.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.assessmentStandards.filter(s => /^III-[АA]\.\d+/.test(s)).map((s, i) => (
                  <span key={i} className="text-[9px] font-mono font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">
                    {s.split(' — ')[0]}
                  </span>
                ))}
              </div>
            )}
            {/* Wave 9.3 (audit_2026_07_18_full_app_review, 2026-07-19 post-closure): Scenario Bank
                previously had zero lab surfacing at all. */}
            {onNavigate && (
              <ContextualMathTools
                topicTitle={entry.topicTitle}
                gradeContext={{ grade: entry.grade, secondaryTrack: entry.secondaryTrack ?? undefined }}
                onNavigate={onNavigate}
              />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> {t('scenarioBank.card.collapse')}</> : <><ChevronDown className="w-3.5 h-3.5" /> {t('scenarioBank.card.expandScenario')}</>}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-gray-100 px-4 py-3 space-y-2">
        {/* Author + stats */}
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span className="truncate max-w-[60%]">
            {(entry.forkDepth > 0 || entry.originalAuthorName) && (
              <span className="text-indigo-400 mr-1">
                ↳ {entry.originalAuthorName ? t('scenarioBank.card.originalFrom').replace('{name}', entry.originalAuthorName) : t('scenarioBank.card.remix')}
              </span>
            )}
            {entry.authorName}
            {entry.schoolName ? ` · ${entry.schoolName}` : ''}
            {' '}
            <AcademyBadgeRow uid={entry.authorUid} />
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-0.5"><GitFork className="w-3 h-3" />{entry.forkCount}</span>
            <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{entry.usageCount}</span>
          </div>
        </div>

        {/* Star rating */}
        {currentUid && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onRate(entry.id, s)}
                onMouseEnter={() => setHoveredStar(s)}
                onMouseLeave={() => setHoveredStar(0)}
                className="p-0.5"
                aria-label={t('scenarioBank.card.rateStarsAria').replace('{n}', String(s))}
              >
                <Star
                  className="w-3.5 h-3.5"
                  fill={(hoveredStar || myRating || 0) >= s ? '#f59e0b' : 'none'}
                  stroke={(hoveredStar || myRating || 0) >= s ? '#f59e0b' : '#d1d5db'}
                />
              </button>
            ))}
            {avg && (
              <span className="text-[10px] text-amber-600 font-bold ml-1">
                {avg} ({ratingCount})
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => { onUse(entry); }}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-2 rounded-lg transition-colors"
          >
            {t('scenarioBank.card.use')}
          </button>
          {onEdit && currentUid === entry.authorUid && (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              title={t('scenarioBank.card.editOwnTitle')}
              aria-label={t('scenarioBank.card.edit')}
              className="flex items-center gap-1 bg-violet-50 hover:bg-violet-100 text-violet-700 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-violet-200 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> {t('scenarioBank.card.edit')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onFork(entry)}
            title={t('scenarioBank.card.forkTitle')}
            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-emerald-200 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" /> {t('scenarioBank.card.remix')}
          </button>
          {canSuggest && (
            <button
              type="button"
              onClick={() => setShowSuggest(true)}
              title={t('scenarioBank.card.suggestRevisionTitle')}
              aria-label={t('scenarioBank.card.suggestRevisionAria')}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-amber-200 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
          )}
          {currentUid && (
            <button
              type="button"
              onClick={() => setShowObserve(true)}
              title={t('scenarioBank.card.observeTitle')}
              aria-label={t('scenarioBank.card.observeAria')}
              className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-indigo-200 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(entry.id, !isSaved)}
            title={isSaved ? t('scenarioBank.card.unsave') : t('scenarioBank.card.save')}
            className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-colors ${
              isSaved
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {isSaved ? '★' : '☆'}
          </button>
          {onDiscuss && (
            <button
              type="button"
              onClick={() => onDiscuss(entry)}
              title={t('scenarioBank.card.discussTitle')}
              aria-label={t('scenarioBank.card.discussAria')}
              className="flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-sky-200 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={() => onPrint(entry)}
              title={t('scenarioBank.card.printTitle')}
              aria-label={t('scenarioBank.card.printAria')}
              className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-slate-200 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showSuggest && currentUid && (
        <SuggestRevisionModal
          scenario={entry}
          authorUid={currentUid}
          authorName={resolvedCurrentName}
          schoolName={currentSchool}
          onClose={() => setShowSuggest(false)}
          onSubmitted={() => setShowSuggest(false)}
        />
      )}
      {showObserve && currentUid && (
        <ObservationModal
          scenario={entry}
          authorUid={currentUid}
          authorName={resolvedCurrentName}
          schoolName={currentSchool}
          observedGrade={entry.grade}
          onClose={() => setShowObserve(false)}
        />
      )}
    </div>
  );
};
