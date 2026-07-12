import React, { useEffect, useState } from 'react';
import { BookMarked, ArrowRight } from 'lucide-react';
import { fetchScenarios, type ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import { DokBadge } from '../common/DokBadge';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { useNavigation } from '../../contexts/NavigationContext';
import { logger } from '../../utils/logger';

const MODEL_COLORS: Record<string, string> = {
  '5E': 'bg-indigo-100 text-indigo-700',
  'PBL': 'bg-emerald-100 text-emerald-700',
  'ZPD': 'bg-violet-100 text-violet-700',
  'Cooperative': 'bg-orange-100 text-orange-700',
  'Traditional': 'bg-gray-100 text-gray-600',
};

/** Prefill key read once by ScenarioBankView on mount — mirrors the existing `kahoot_gamma_prompt` sessionStorage prefill pattern used for KahootMaker. */
export const SCENARIO_BANK_CONCEPT_PREFILL_KEY = 'scenario_bank_concept_prefill';

interface ConceptScenariosPreviewProps {
  conceptId: string;
  conceptTitle: string;
}

/** Read-only preview of existing scenario_bank entries already tagged with this concept — Direction 1 phase 3: curriculum-linked generation entry point. */
export const ConceptScenariosPreview: React.FC<ConceptScenariosPreviewProps> = ({ conceptId, conceptTitle }) => {
  const { navigate } = useNavigation();
  const [entries, setEntries] = useState<ScenarioBankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchScenarios({ conceptId }, 6)
      .then(page => { if (!cancelled) setEntries(page.entries); })
      .catch(err => { logger.error('[ConceptScenariosPreview] failed to load scenarios', err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [conceptId]);

  const openInBank = () => {
    try {
      sessionStorage.setItem(SCENARIO_BANK_CONCEPT_PREFILL_KEY, JSON.stringify({ conceptId, conceptTitle }));
    } catch { /* storage unavailable — bank just opens unfiltered */ }
    navigate('/scenario-bank');
  };

  if (isLoading) return <SkeletonLoader type="paragraph" />;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BookMarked className="w-5 h-5 text-emerald-600" />
        <h3 className="font-black text-gray-800 text-sm">Сценарија за овој концепт</h3>
        {entries.length > 0 && (
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full ml-auto">
            {entries.length}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">Сè уште нема споделени сценарија за овој концепт во Банката.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {entries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={openInBank}
              className="w-full text-left border border-gray-100 rounded-xl p-2.5 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                  {entry.grade}. одд.
                </span>
                {entry.teachingModel && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${MODEL_COLORS[entry.teachingModel] ?? 'bg-gray-100 text-gray-600'}`}>
                    {entry.teachingModel}
                  </span>
                )}
                {entry.dokLevel && <DokBadge level={entry.dokLevel} size="compact" />}
              </div>
              <p className="text-xs font-bold text-gray-800 line-clamp-1">{entry.title}</p>
              <p className="text-[10px] text-gray-400 truncate">{entry.authorName}{entry.schoolName ? ` · ${entry.schoolName}` : ''}</p>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openInBank}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
      >
        Прегледај во Банката <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
