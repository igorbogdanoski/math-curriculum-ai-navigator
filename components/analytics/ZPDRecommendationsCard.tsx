/**
 * ZPDRecommendationsCard — Ж1.2 UI
 *
 * Displays per-student adaptive difficulty recommendations based on
 * rolling-window ZPD tracking. Shows which students are ready to advance
 * to harder material and which need easier practice.
 *
 * Педагошка основа: Vygotsky ZPD, Bloom's Mastery Learning
 */

import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Card } from '../common/Card';
import { useAdaptiveDifficulty } from '../../hooks/useAdaptiveDifficulty';
import type { DifficultyLevel } from '../../services/firestoreService.adaptiveDifficulty';

interface Props {
    teacherUid: string;
    conceptLabels?: Record<string, string>;
    onGenerateForDifficulty?: (difficulty: DifficultyLevel, conceptId: string, conceptLabel: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_META: Record<DifficultyLevel, {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ReactNode;
    desc: string;
}> = {
    easy:   { label: 'Лесно',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: <TrendingDown className="w-3.5 h-3.5" />, desc: 'Зона на фрустрација — поедноставни прашања' },
    medium: { label: 'Средно',  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',   icon: <Minus className="w-3.5 h-3.5" />,         desc: 'ЗПД — оптимална зона на учење' },
    hard:   { label: 'Тешко',   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <TrendingUp className="w-3.5 h-3.5" />,   desc: 'Зона на досада — подготвени за предизвик' },
};

function DifficultyBadge({ level }: { level: DifficultyLevel }) {
    const m = LEVEL_META[level];
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${m.bg} ${m.color} ${m.border}`}>
            {m.icon}{m.label}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export const ZPDRecommendationsCard: React.FC<Props> = ({
    teacherUid,
    conceptLabels,
    onGenerateForDifficulty,
}) => {
    const { isLoading, conceptGroups, readyToAdvance, needingSupport, refetch } = useAdaptiveDifficulty(
        teacherUid,
        conceptLabels,
    );
    const [expanded, setExpanded] = useState(true);

    const totalStudents = new Set([
        ...readyToAdvance.map(s => s.studentKey),
        ...needingSupport.map(s => s.studentKey),
    ]).size;

    if (!isLoading && conceptGroups.length === 0) return null;

    return (
        <Card className="border-l-4 border-l-indigo-400">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm">Адаптивни ЗПД Препораки</h3>
                        <p className="text-xs text-gray-500">Препорачано ниво за следниот квиз по ученик</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={refetch}
                        aria-label="Освежи ЗПД препораки"
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setExpanded(e => !e)}
                        aria-label={expanded ? 'Собери' : 'Прошири'}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Summary pills */}
            {(readyToAdvance.length > 0 || needingSupport.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {readyToAdvance.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <TrendingUp className="w-3 h-3" />
                            {readyToAdvance.length} готови за потешко
                        </span>
                    )}
                    {needingSupport.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            <TrendingDown className="w-3 h-3" />
                            {needingSupport.length} треба полесно
                        </span>
                    )}
                </div>
            )}

            {isLoading && (
                <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Вчитување на ЗПД податоци…
                </div>
            )}

            {/* Expanded detail: per-concept groups */}
            {expanded && !isLoading && conceptGroups.length > 0 && (
                <div className="space-y-3 mt-1">
                    {conceptGroups.slice(0, 6).map(group => {
                        const label = group.conceptLabel || group.conceptId;
                        return (
                            <div key={group.conceptId} className="border border-gray-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold text-gray-700 truncate max-w-[60%]" title={label}>{label}</p>
                                    {onGenerateForDifficulty && (
                                        <div className="flex gap-1">
                                            {(['easy', 'medium', 'hard'] as DifficultyLevel[]).filter(lvl =>
                                                group[lvl].length > 0,
                                            ).map(lvl => (
                                                <button
                                                    key={lvl}
                                                    type="button"
                                                    onClick={() => onGenerateForDifficulty(lvl, group.conceptId, label)}
                                                    title={`Генерирај ${LEVEL_META[lvl].label} квиз`}
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all hover:opacity-80 ${LEVEL_META[lvl].bg} ${LEVEL_META[lvl].color} ${LEVEL_META[lvl].border}`}
                                                >
                                                    Gen {LEVEL_META[lvl].label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map(lvl =>
                                        group[lvl].length > 0 ? (
                                            <div key={lvl} className="flex items-center gap-1.5">
                                                <DifficultyBadge level={lvl} />
                                                <span className="text-xs text-gray-500">
                                                    {group[lvl].length} уч.
                                                </span>
                                            </div>
                                        ) : null,
                                    )}
                                </div>
                                {/* Student names (compact) */}
                                {group.easy.length > 0 && (
                                    <p className="text-[11px] text-amber-600 mt-1 truncate">
                                        ⬇ Лесно: {group.easy.join(', ')}
                                    </p>
                                )}
                                {group.hard.length > 0 && (
                                    <p className="text-[11px] text-emerald-600 mt-0.5 truncate">
                                        ⬆ Тешко: {group.hard.join(', ')}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                    {conceptGroups.length > 6 && (
                        <p className="text-xs text-gray-400 text-center">+{conceptGroups.length - 6} уште концепти</p>
                    )}
                </div>
            )}

            {!isLoading && conceptGroups.length === 0 && (
                <p className="text-xs text-gray-400 py-2">
                    Нема доволно историја. ЗПД профилите се гради автоматски по секој одигран квиз.
                </p>
            )}

            <p className="text-[10px] text-gray-300 mt-3">
                Базирано на последните 5 квиз обиди по ученик/концепт · ZPD (Виготски)
            </p>
        </Card>
    );
};
