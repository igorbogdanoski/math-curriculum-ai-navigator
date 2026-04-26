import React from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';
import type { DashboardAction, ActionPriority } from '../../hooks/useSmartDashboard';

const PRIORITY_CONFIG: Record<
  ActionPriority,
  {
    border: string;
    bg: string;
    badge: string;
    badgeText: string;
    btnClass: string;
    icon: React.ElementType;
    iconColor: string;
  }
> = {
  critical: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-700',
    badgeText: 'КРИТИЧНО',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
  },
  high: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    badgeText: 'ВНИМАНИЕ',
    btnClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    icon: AlertCircle,
    iconColor: 'text-orange-500',
  },
  medium: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    badgeText: 'СЛЕДИ',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    icon: Info,
    iconColor: 'text-amber-500',
  },
};

interface ActionablePriorityCardProps {
  action: DashboardAction;
}

export const ActionablePriorityCard: React.FC<ActionablePriorityCardProps> = ({ action }) => {
  const cfg = PRIORITY_CONFIG[action.priority];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${cfg.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.badge}`}
          >
            {cfg.badgeText}
          </span>
          <span className="text-xs font-semibold text-slate-500 truncate">{action.metric}</span>
        </div>

        <p className="text-sm font-bold text-slate-800 mb-1 leading-snug">{action.title}</p>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{action.description}</p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={action.ctaPrimary.handler}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition ${cfg.btnClass}`}
          >
            {action.ctaPrimary.label}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {action.ctaSecondary && (
            <button
              type="button"
              onClick={action.ctaSecondary.handler}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-white/70 transition border border-slate-200 bg-white/40"
            >
              {action.ctaSecondary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
