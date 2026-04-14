import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, CheckCircle, XCircle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/common/Card';
import { MathRenderer } from '../components/common/MathRenderer';
import { MaterialFeedbackModal } from '../components/analytics/MaterialFeedbackModal';
import { isFeedbackTaxonomyRolloutEnabled, logFeedbackTaxonomyRolloutEvent } from '../services/feedbackTaxonomyRollout';
import { firestoreService } from '../services/firestoreService';
import type { FeedbackReasonCode, SavedQuestion } from '../types';

export const ContentReviewView: React.FC = () => {
    const { user, firebaseUser } = useAuth();
    const { t } = useLanguage();
    const [questions, setQuestions] = useState<SavedQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedQuestion, setSelectedQuestion] = useState<SavedQuestion | null>(null);
    const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [feedbackTaxonomyEnabled, setFeedbackTaxonomyEnabled] = useState(() => isFeedbackTaxonomyRolloutEnabled());

    useEffect(() => {
        const syncRolloutFlag = () => setFeedbackTaxonomyEnabled(isFeedbackTaxonomyRolloutEnabled());

        syncRolloutFlag();
        window.addEventListener('storage', syncRolloutFlag);
        window.addEventListener('focus', syncRolloutFlag);
        document.addEventListener('visibilitychange', syncRolloutFlag);

        return () => {
            window.removeEventListener('storage', syncRolloutFlag);
            window.removeEventListener('focus', syncRolloutFlag);
            document.removeEventListener('visibilitychange', syncRolloutFlag);
        };
    }, []);

    const exportToCSV = () => {
        if (!questions.length) return;
        const headers = ['ID', 'Concept ID', 'Question Text', 'Type', 'Difficulty', 'Correct Answer'];
        const rows = questions.map(q => [
            q.id,
            q.conceptId,
            `"${(q.question || '').replace(/"/g, '""')}"`,
            q.type,
            q.difficulty_level,
            `"${(q.answer || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'unapproved_questions.csv';
        link.click();
    };

    useEffect(() => {
        const fetchPending = async () => {
            setIsLoading(true);
            try {
                // Here we fetch questions to review. 
                // In a production app, this would be a specific query: `isApproved == false`
                const allQs = await firestoreService.fetchUnapprovedQuestions();
                setQuestions(allQs);
            } catch (error) {
                logger.error("Error fetching content for review", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user && (user.role === 'admin' || user.role === 'school_admin')) {
            fetchPending();
        } else {
            setIsLoading(false);
        }
    }, [user]);

    const handleApprove = async (qId: string) => {
        if (!firebaseUser?.uid) return;
        try {
            if (feedbackTaxonomyEnabled) {
                await firestoreService.recordMaterialFeedback(firebaseUser.uid, qId, {
                    status: 'approved',
                    reasonCodes: [],
                    comments: 'Approved for publication.',
                });
                logFeedbackTaxonomyRolloutEvent('approved_logged');
            }
            await firestoreService.updateSavedQuestion(qId, { 
                isApproved: true, 
                isVerified: true, 
                isPublic: true,
                reviewStatus: 'approved',
                reviewedBy: firebaseUser.uid,
                reviewedAt: new Date(),
            });
            setQuestions(prev => prev.filter(q => q.id !== qId));
            setBanner({ type: 'success', message: 'Материјалот е одобрен и евидентиран во feedback analytics.' });
        } catch (e) {
            logger.error('Error approving', e);
            setBanner({ type: 'error', message: 'Не успеа одобрувањето на материјалот.' });
        }
    };

    const handleSubmitFeedback = async (feedback: {
        status: 'approved' | 'rejected' | 'revision_requested';
        reasonCodes: FeedbackReasonCode[];
        comments: string;
    }) => {
        if (!firebaseUser?.uid || !selectedQuestion?.id) return;

        const questionId = selectedQuestion.id;

        await firestoreService.recordMaterialFeedback(firebaseUser.uid, questionId, feedback);
        logFeedbackTaxonomyRolloutEvent(feedback.status === 'rejected' ? 'rejected' : 'revision_requested');

        if (feedback.status === 'rejected') {
            await firestoreService.deleteQuestion(questionId);
            setBanner({ type: 'success', message: 'Прашањето е отфрлено и причината е зачувана.' });
        } else {
            await firestoreService.updateSavedQuestion(questionId, {
                isApproved: false,
                isVerified: false,
                isPublic: false,
                reviewStatus: 'revision_requested',
                reviewReasonCodes: feedback.reasonCodes,
                reviewComments: feedback.comments,
                reviewedBy: firebaseUser.uid,
                reviewedAt: new Date(),
            });
            setBanner({ type: 'success', message: 'Барањето за ревизија е зачувано со структурирани reason codes.' });
        }

        setQuestions(prev => prev.filter(item => item.id !== questionId));
        setSelectedQuestion(null);
    };

    const handleLegacyReject = async (question: SavedQuestion) => {
        try {
            await firestoreService.deleteQuestion(question.id);
            setQuestions(prev => prev.filter(item => item.id !== question.id));
            setBanner({ type: 'success', message: 'Прашањето е отфрлено преку legacy path. Вклучи rollout за structured analytics.' });
            logFeedbackTaxonomyRolloutEvent('legacy_reject_fallback');
        } catch (error) {
            logger.error('Error rejecting question', error);
            setBanner({ type: 'error', message: 'Не успеа отфрлањето на прашањето.' });
        }
    };

    if (!user || (user.role !== 'admin' && user.role !== 'school_admin')) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <p className="text-gray-500">Немате привилегии за пристап до оваа страница.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-900">Училиштен Рецензентски Портал</h1>
            </div>
            
            <Card className="p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                        <span>Прашања за Рецензија</span>
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-bold">{questions.length}</span>
                    </h2>
                      <button
                          onClick={exportToCSV}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md text-sm font-medium transition-colors"
                      >
                          <Download className="w-4 h-4" />
                          Експорт CSV
                      </button>
                  </div>

                {banner && (
                    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                        banner.type === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}>
                        {banner.message}
                    </div>
                )}
                
                {isLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
                ) : questions.length === 0 ? (
                    <div className="text-center p-12 text-gray-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30 text-emerald-500" />
                        <p className="text-lg font-medium text-slate-600">Нема содржина која чека на рецензија.</p>
                        <p className="text-sm mt-1">Сите материјали се проверени и одобрени!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {questions.map(q => (
                            <div key={q.id} className="border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row gap-5 justify-between bg-white hover:border-indigo-300 transition-colors shadow-sm hover:shadow">
                                <div className="flex-1 space-y-4">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium border border-slate-200">{q.type}</span>
                                        {q.cognitiveLevel && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">{q.cognitiveLevel}</span>}
                                        {q.conceptTitle && <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-100 max-w-[300px] truncate" title={q.conceptTitle}>{q.conceptTitle}</span>}
                                        <span className="text-slate-400 ml-auto">Од наставник: {q.teacherUid.substring(0,6)}...</span>
                                    </div>
                                    <div className="text-gray-800 text-base">
                                        <MathRenderer text={q.question} />
                                    </div>
                                    <div className="bg-emerald-50 text-emerald-900 p-4 rounded-lg text-sm border border-emerald-100">
                                        <span className="font-bold flex items-center gap-1 block mb-2 text-emerald-800">
                                            <CheckCircle className="w-4 h-4" /> Точен Одговор:
                                        </span>
                                        <MathRenderer text={q.answer} />
                                    </div>
                                </div>
                                <div className="flex md:flex-col gap-3 items-center justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-5 md:pt-0 md:pl-5">
                                    <button 
                                        onClick={() => handleApprove(q.id)}
                                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium shadow-sm hover:shadow"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Одобри & Објави
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (!feedbackTaxonomyEnabled) {
                                                void handleLegacyReject(q);
                                                return;
                                            }
                                            logFeedbackTaxonomyRolloutEvent('modal_opened');
                                            setSelectedQuestion(q);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-lg transition-colors font-medium"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        {feedbackTaxonomyEnabled ? 'Feedback / Отфрли' : 'Отфрли'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {selectedQuestion && feedbackTaxonomyEnabled && (
                <MaterialFeedbackModal
                    materialId={selectedQuestion.id}
                    materialTitle={selectedQuestion.conceptTitle || selectedQuestion.question}
                    onSubmit={handleSubmitFeedback}
                    onClose={() => setSelectedQuestion(null)}
                />
            )}
        </div>
    );
};