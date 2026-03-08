import React from 'react';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, Loader2, BarChart2 } from 'lucide-react';
import { type DailyBrief } from '../../hooks/useDailyBrief';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { useNavigation } from '../../contexts/NavigationContext';

interface DailyBriefCardProps {
  brief: DailyBrief | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const priorityConfig = {
  high:   { bg: 'bg-red-50 border-red-200',   icon: AlertTriangle, iconColor: 'text-red-500',   label: 'Потребна акција', labelColor: 'text-red-600 bg-red-100' },
  medium: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500', label: 'Внимание',       labelColor: 'text-amber-700 bg-amber-100' },
  low:    { bg: 'bg-green-50 border-green-200', icon: CheckCircle,   iconColor: 'text-green-500', label: 'Се е добро',     labelColor: 'text-green-700 bg-green-100' },
};

export const DailyBriefCard: React.FC<DailyBriefCardProps> = ({ brief, isLoading, onRefresh }) => {
  const { openGeneratorPanel } = useGeneratorPanel();
  const { navigate } = useNavigation();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-indigo-700">AI подготвува дневен брифинг...</p>
          <p className="text-xs text-indigo-500 mt-0.5">Анализирам резултати од последните 48 часа</p>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  const cfg = priorityConfig[brief.priority];
  const PriorityIcon = cfg.icon;

  const handlePrimaryAction = () => {
    if (brief.primaryAction?.conceptId) {
      openGeneratorPanel({
        selectedConcepts: [brief.primaryAction.conceptId],
        materialType: 'QUIZ',
        customInstruction: 'РЕМЕДИЈАЛНА ВЕЖБА: поедноставени прашања со чекор-по-чекор упатства.',
      });
    } else {
      navigate('/analytics');
    }
  };

  return (
    <div className={`rounded-2xl border ${cfg.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <PriorityIcon className={`w-5 h-5 ${cfg.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Дневен брифинг
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.labelColor}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{brief.summary}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {brief.primaryAction && (
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
              >
                {brief.primaryAction.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white/60 transition border border-gray-200"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Аналитика
            </button>
            <button
              type="button"
              onClick={onRefresh}
              title="Освежи"
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Освежи
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
