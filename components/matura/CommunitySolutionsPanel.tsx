/**
 * М3: Community Solutions panel — collapsible, attaches to a matura question.
 * Shows submitted solutions sorted by upvotes. Authenticated users can submit + vote.
 */
import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, ThumbsUp, Send, Loader2, Users } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import {
  getCommunitySolutions,
  submitCommunitySolution,
  upvoteCommunitySolution,
  downvoteCommunitySolution,
  type CommunitySolution,
} from '../../services/firestoreService.community';

interface Props {
  questionDocId: string;
  currentUid: string | null;
  currentDisplayName: string;
}

export const CommunitySolutionsPanel: React.FC<Props> = ({
  questionDocId,
  currentUid,
  currentDisplayName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [solutions, setSolutions] = useState<CommunitySolution[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitText, setSubmitText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (loaded) return;
    setIsLoading(true);
    const data = await getCommunitySolutions(questionDocId);
    setSolutions(data);
    setLoaded(true);
    setIsLoading(false);
  }, [questionDocId, loaded]);

  const toggle = useCallback(() => {
    setIsOpen(v => {
      if (!v) load();
      return !v;
    });
  }, [load]);

  const submit = useCallback(async () => {
    if (!currentUid || !submitText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      await submitCommunitySolution(questionDocId, currentUid, currentDisplayName, submitText);
      setSubmitText('');
      // Reload to get the new solution with server timestamp
      setLoaded(false);
      const data = await getCommunitySolutions(questionDocId);
      setSolutions(data);
      setLoaded(true);
    } catch {
      setError('Грешка при испраќање. Обиди се пак.');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentUid, currentDisplayName, submitText, isSubmitting, questionDocId]);

  const toggleVote = useCallback(async (sol: CommunitySolution) => {
    if (!currentUid || votingId) return;
    const hasVoted = sol.upvoterUids.includes(currentUid);
    setVotingId(sol.id);
    // Optimistic update
    setSolutions(prev => prev.map(s => s.id !== sol.id ? s : {
      ...s,
      upvotes: s.upvotes + (hasVoted ? -1 : 1),
      upvoterUids: hasVoted
        ? s.upvoterUids.filter(u => u !== currentUid)
        : [...s.upvoterUids, currentUid],
    }));
    try {
      if (hasVoted) {
        await downvoteCommunitySolution(sol.id, currentUid);
      } else {
        await upvoteCommunitySolution(sol.id, currentUid);
      }
    } catch {
      // Revert on failure
      setSolutions(prev => prev.map(s => s.id !== sol.id ? s : {
        ...s,
        upvotes: s.upvotes + (hasVoted ? 1 : -1),
        upvoterUids: hasVoted
          ? [...s.upvoterUids, currentUid]
          : s.upvoterUids.filter(u => u !== currentUid),
      }));
    } finally {
      setVotingId(null);
    }
  }, [currentUid, votingId]);

  return (
    <div className="border-t border-gray-100 mt-2">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition text-left"
      >
        <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold text-gray-600">
          Решенија на заедницата
          {solutions.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black">
              {solutions.length}
            </span>
          )}
        </span>
        {isOpen
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
        }
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Submit form */}
          {currentUid ? (
            <div className="space-y-2">
              <textarea
                value={submitText}
                onChange={e => setSubmitText(e.target.value)}
                placeholder="Напиши го твоето решение (поддржан LaTeX со $...$)…"
                rows={3}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 placeholder:text-gray-400"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={!submitText.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-40 transition"
              >
                {isSubmitting
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Send className="w-3 h-3" />
                }
                Испрати решение
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">
              Влези со Google за да испратиш решение.
            </p>
          )}

          {/* Solutions list */}
          {isLoading && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
          )}

          {!isLoading && solutions.length === 0 && (
            <p className="text-[11px] text-gray-400 text-center py-2 italic">
              Уште нема решенија. Биди прв!
            </p>
          )}

          {solutions.map((sol, i) => {
            const hasVoted = !!currentUid && sol.upvoterUids.includes(currentUid);
            const isVoting = votingId === sol.id;
            return (
              <div key={sol.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-black text-indigo-500">#{i + 1}</span>
                    <span className="text-[11px] font-semibold text-gray-600 truncate">
                      {sol.authorName}
                    </span>
                    {sol.createdAt && (
                      <span className="text-[10px] text-gray-400 shrink-0">
                        · {sol.createdAt.toLocaleDateString('mk-MK')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleVote(sol)}
                    disabled={!currentUid || isVoting}
                    title={hasVoted ? 'Откажи гласање' : 'Гласај за ова решение'}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                      hasVoted
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300'
                    } disabled:opacity-50`}
                  >
                    {isVoting
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <ThumbsUp className="w-3 h-3" />
                    }
                    {sol.upvotes}
                  </button>
                </div>
                <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  <MathRenderer text={sol.text} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
