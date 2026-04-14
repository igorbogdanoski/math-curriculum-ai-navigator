import { logger } from '../utils/logger';
import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { usePlanner } from '../contexts/PlannerContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { geminiService } from '../services/geminiService';
import type { CoverageAnalysisReport, GradeCoverageAnalysis, NationalStandard, PartiallyCoveredStandard } from '../types';
import { EmptyState } from '../components/common/EmptyState';
import { useNavigation } from '../contexts/NavigationContext';
import { AppError, ErrorCode } from '../utils/errors';

const CoverageDashboard: React.FC<{ reports: GradeCoverageAnalysis[] }> = ({ reports }) => {
    return (
        <Card className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <ICONS.chart className="w-6 h-6 text-brand-primary" />
                Визуелен Dashboard: Покриеност на Стандарди
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reports.map(gradeReport => {
                    const covered = gradeReport.coveredStandardIds.length;
                    const partial = gradeReport.partiallyCoveredStandards.length;
                    const uncovered = gradeReport.uncoveredStandardIds.length;
                    const total = covered + partial + uncovered;
                    
                    const pct = total === 0 ? 0 : Math.round(((covered + partial * 0.5) / total) * 100);
                    
                    // Tailwind colors based on percentage
                    let colorClass = "bg-red-500";
                    let textClass = "text-red-600";
                    if (pct >= 80) { colorClass = "bg-green-500"; textClass = "text-green-600"; }
                    else if (pct >= 50) { colorClass = "bg-yellow-500"; textClass = "text-yellow-600"; }
                    else if (pct >= 20) { colorClass = "bg-orange-500"; textClass = "text-orange-600"; }

                    return (
                        <div key={gradeReport.gradeLevel} className="flex flex-col items-center p-4 border rounded-xl bg-gray-50/50">
                            <div className="text-4xl font-black text-gray-800 mb-1">{gradeReport.gradeLevel}</div>
                            <div className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-widest">Одделение</div>
                            
                            <div className="relative w-24 h-24 mb-4">
                                {/* Background circle */}
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path
                                        className="text-gray-200"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                    />
                                    {/* Foreground circle */}
                                    <path
                                        className={`${textClass} transition-all duration-1000 ease-out`}
                                        strokeDasharray={`${pct}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-xl font-bold ${textClass}`}>{pct}%</span>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1 w-full text-xs">
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>Покриени:</span>
                                    <span className="font-bold text-green-600">{covered}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>Делумни:</span>
                                    <span className="font-bold text-yellow-600">{partial}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>Непокриени:</span>
                                    <span className="font-bold text-red-500">{uncovered}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const StandardItem: React.FC<{ standard: NationalStandard; reason?: string }> = ({ standard, reason }) => (
    <div className="p-2 border-b last:border-b-0">
        <p className="font-semibold text-sm text-gray-800">{standard.code}: {standard.description}</p>
        {reason && <p className="text-xs text-yellow-800 bg-yellow-100 p-1 mt-1 rounded">Причина: {reason}</p>}
    </div>
);

const GradeAnalysisCard: React.FC<{ analysis: GradeCoverageAnalysis }> = ({ analysis }) => {
    const { getStandardsByIds } = useCurriculum();
    const [activeTab, setActiveTab] = useState<'uncovered' | 'partial' | 'covered'>('uncovered');

    const covered = useMemo(() => getStandardsByIds(analysis.coveredStandardIds), [analysis.coveredStandardIds, getStandardsByIds]);
    const partial = useMemo(() => analysis.partiallyCoveredStandards, [analysis.partiallyCoveredStandards]);
    const partialStandards = useMemo(() => getStandardsByIds(partial.map((p: PartiallyCoveredStandard) => p.id)), [partial, getStandardsByIds]);
    const uncovered = useMemo(() => getStandardsByIds(analysis.uncoveredStandardIds), [analysis.uncoveredStandardIds, getStandardsByIds]);

    const TabButton: React.FC<{ tabId: 'covered' | 'partial' | 'uncovered'; label: string; count: number; color: string; }> = ({ tabId, label, count, color }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t-lg border-b-2 flex items-center gap-2 ${
                activeTab === tabId ? `${color} text-white` : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
        >
            {label} <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{count}</span>
        </button>
    );

    return (
        <Card>
            <h2 className="text-2xl font-bold text-brand-primary mb-2">{analysis.gradeLevel}. Одделение</h2>
            <p className="text-gray-600 mb-4">{analysis.summary}</p>
            
            <div className="border-b border-gray-200 mb-2">
                <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                    <TabButton tabId="uncovered" label="Непокриени" count={uncovered.length} color="bg-red-500" />
                    <TabButton tabId="partial" label="Делумно покриени" count={partial.length} color="bg-yellow-500" />
                    <TabButton tabId="covered" label="Покриени" count={covered.length} color="bg-green-600" />
                </nav>
            </div>

            <div className="max-h-60 overflow-y-auto">
                {activeTab === 'covered' && covered.map((std: NationalStandard) => <StandardItem key={std.id} standard={std} />)}
                {activeTab === 'partial' && partial.map((pStd: PartiallyCoveredStandard) => {
                    const standard = partialStandards.find((s: NationalStandard) => s.id === pStd.id);
                    return standard ? <StandardItem key={pStd.id} standard={standard} reason={pStd.reason} /> : null;
                })}
                {activeTab === 'uncovered' && uncovered.map((std: NationalStandard) => <StandardItem key={std.id} standard={std} />)}
            </div>
        </Card>
    );
};

export const CoverageAnalyzerView: React.FC = () => {
    const { navigate } = useNavigation();
    const { lessonPlans } = usePlanner();
    const { allNationalStandards, isLoading: isCurriculumLoading } = useCurriculum();
    const [report, setReport] = useState<CoverageAnalysisReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);

    const runAnalysis = async () => {
        if (isCurriculumLoading || lessonPlans.length === 0 || !allNationalStandards) return;
        
        setIsLoading(true);
        setHasStartedAnalysis(true);
        try {
            const analysisResult = await geminiService.analyzeCoverage(lessonPlans, allNationalStandards);
            if (analysisResult.error) {
                throw new AppError(
                    analysisResult.error,
                    ErrorCode.AI_PARSE_FAILED,
                    'Анализата на покриеност не успеа. Проверете ја врската и обидете се повторно.',
                    true,
                );
            }
            setReport(analysisResult);
        } catch (error) {
            logger.error("Failed to get coverage analysis:", error);
            setReport({ analysis: [], error: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        if (!hasStartedAnalysis) {
            return (
                <Card className="text-center py-12">
                    <div className="max-w-md mx-auto">
                        <ICONS.sparkles className="w-12 h-12 text-brand-accent mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-brand-primary mb-2">Стартувај AI Анализа</h2>
                        <p className="text-gray-600 mb-6">
                            Кликнете на копчето подолу за AI асистентот да ги анализира сите ваши подготовки наспроти националните стандарди.
                        </p>
                        <button
                            onClick={runAnalysis}
                            disabled={isCurriculumLoading || lessonPlans.length === 0}
                            className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-brand-secondary transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:transform-none"
                        >
                            {isCurriculumLoading ? 'Се вчитува...' : 'Анализирај покриеност'}
                        </button>
                    </div>
                </Card>
            );
        }

        if (isLoading || isCurriculumLoading) {
            return (
                <div className="space-y-6">
                    <Card><div className="animate-pulse h-48 bg-gray-200 rounded"></div></Card>
                    <Card><div className="animate-pulse h-48 bg-gray-200 rounded"></div></Card>
                </div>
            );
        }
        
        if (lessonPlans.length === 0) {
            return (
                <EmptyState
                    icon={<ICONS.chart className="w-12 h-12" />}
                    title="Нема доволно податоци за анализа"
                    message="За да може AI асистентот да направи анализа на покриеноста на стандардите, потребно е прво да креирате неколку подготовки за час."
                >
                    <button
                        onClick={() => navigate('/planner/lesson/new')}
                        className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors"
                    >
                        <ICONS.plus className="w-5 h-5 mr-2" />
                        Креирај подготовка
                    </button>
                </EmptyState>
            );
        }

        if (report?.error) {
             return (
                <Card className="text-center bg-red-50 border-red-200">
                    <h3 className="text-xl font-semibold text-red-700">Грешка при анализа</h3>
                    <p className="text-red-600 mt-2">{report.error}</p>
                </Card>
            );
        }

        if (report?.analysis && report.analysis.length > 0) {
            const sortedAnalysis = [...report.analysis].sort((a: GradeCoverageAnalysis, b: GradeCoverageAnalysis) => a.gradeLevel - b.gradeLevel);
            return (
                <div>
                    <CoverageDashboard reports={sortedAnalysis} />
                    <div className="space-y-6">
                        {sortedAnalysis.map((gradeAnalysis: GradeCoverageAnalysis) => (
                            <GradeAnalysisCard key={gradeAnalysis.gradeLevel} analysis={gradeAnalysis} />
                        ))}
                    </div>
                </div>
            );
        }

        return (
             <EmptyState
                icon={<ICONS.search className="w-12 h-12" />}
                title="Нема генериран извештај"
                message="Не можевме да генерираме извештај за покриеност. Ова може да се случи ако немате подготовки за одделенија кои имаат дефинирани национални стандарди."
            />
        );
    };

    return (
        <div className="p-8 animate-fade-in">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Анализатор на покриеност</h1>
                <p className="text-lg text-gray-600 mt-2">AI анализа на вашите подготовки наспроти националните стандарди.</p>
            </header>
            {renderContent()}
        </div>
    );
};
