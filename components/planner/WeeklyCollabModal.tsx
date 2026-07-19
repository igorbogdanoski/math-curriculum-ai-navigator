/**
 * WeeklyCollabModal — S93-C
 * Share your weekly plan with colleagues OR enter a colleague's share code
 * to view their plan in real-time (read-only onSnapshot).
 *
 * Share flow: Teacher clicks "📡 Collab" → sees own share token → copies link
 * View flow:  Colleague pastes token → subscribes to owner's weekly plan onSnapshot
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Radio, Link2, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ensureCollabPlan,
  setPublicLink,
  findByShareToken,
  type CollabPlan,
} from '../../services/firestoreService.collabPlans';
import {
  subscribeSharedWeeklyPlan,
  type SavedWeeklyPlan,
} from '../../services/firestoreService.weeklyPlans';

interface Props {
  /** Owner's planId used as the collab key */
  planId: string;
  annualPlanId: string;
  weekNumber: number;
  ownerName: string;
  onViewShared: (plan: SavedWeeklyPlan, ownerName: string) => void;
  onClose: () => void;
}

const MK_DAYS = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет'];

export const WeeklyCollabModal: React.FC<Props> = ({
  planId, annualPlanId, weekNumber, ownerName, onViewShared, onClose,
}) => {
  const { firebaseUser, user } = useAuth();
  const [tab, setTab] = useState<'share' | 'view'>('share');

  // ── Share tab ───────────────────────────────────────────────────────────────
  const [collab, setCollab] = useState<CollabPlan | null>(null);
  const [isLoadingCollab, setIsLoadingCollab] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tab !== 'share' || !firebaseUser?.uid) return;
    setIsLoadingCollab(true);
    ensureCollabPlan('weekly', planId, firebaseUser.uid, user?.name ?? ownerName)
      .then(async plan => {
        // Weekly collab is always token-based (publicLink must be true for findByShareToken to work)
        if (!plan.publicLink) {
          await setPublicLink('weekly', planId, true).catch(() => {});
          setCollab({ ...plan, publicLink: true });
        } else {
          setCollab(plan);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingCollab(false));
  }, [tab, planId, firebaseUser?.uid, user?.name, ownerName]);

  const shareUrl = collab
    ? `${window.location.origin}/weekly-plan?collab=${collab.shareToken}&plan=${annualPlanId}&week=${weekNumber}&owner=${encodeURIComponent(ownerName)}`
    : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── View tab ────────────────────────────────────────────────────────────────
  const [tokenInput, setTokenInput] = useState('');
  const [sharedPlan, setSharedPlan] = useState<SavedWeeklyPlan | null>(null);
  const [sharedOwner, setSharedOwner] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Preload from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('collab');
    const ownerParam = params.get('owner');
    const planParam = params.get('plan');
    const weekParam = params.get('week');
    if (token && ownerParam && planParam && weekParam) {
      setTab('view');
      setTokenInput(token);
      handleFindByToken(token, ownerParam, planParam, parseInt(weekParam, 10));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFindByToken = async (
    token: string = tokenInput,
    ownerOverride?: string,
    planOverride?: string,
    weekOverride?: number,
  ) => {
    setIsSearching(true);
    setViewError(null);
    setSharedPlan(null);
    try {
      const found = await findByShareToken(token.trim().toUpperCase());
      if (!found || found.planType !== 'weekly') {
        setViewError('Кодот не е пронајден или не е за неделен план.');
        return;
      }
      // planId format: same as weekly plan docId which we need: uid_annualPlanId_wWeek
      // found.planId is the weekly_plans docId
      const [ownerUid, planIdPart, wPart] = found.planId.split('_');
      const wNum = weekOverride ?? parseInt(wPart?.replace('w', '') ?? '1', 10);
      const resolvedPlanId = planOverride ?? planIdPart;
      const resolvedOwner = ownerOverride ?? found.ownerName;
      setSharedOwner(resolvedOwner);

      if (unsubRef.current) unsubRef.current();
      unsubRef.current = subscribeSharedWeeklyPlan(ownerUid, resolvedPlanId, wNum, plan => {
        if (!plan) { setViewError('Планот сè уште не е зачуван.'); return; }
        setSharedPlan(plan);
        setViewError(null);
      });
    } catch {
      setViewError('Грешка при наоѓање на планот.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    return () => { unsubRef.current?.(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-black text-slate-900">Соработка — Неделен план</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 p-3 border-b bg-slate-50 flex-shrink-0">
          {([
            { id: 'share', label: '🔗 Сподели мој план', icon: Link2 },
            { id: 'view',  label: '👁 Гледај план на колега', icon: Eye },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                tab === t.id ? 'bg-white text-indigo-700 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {/* ── Share tab ── */}
          {tab === 'share' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Сподели го твојот неделен план со колеги. Тие ќе го гледаат во реално време (read-only).
              </p>

              {isLoadingCollab ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  Генерирам код за споделување...
                </div>
              ) : collab ? (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide mb-1">Твој код</p>
                    <p className="text-3xl font-black text-indigo-700 tracking-[0.3em]">{collab.shareToken}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-600 font-mono truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                        copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Копирано!' : 'Копирај'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Колегата го внесува кодот или го отвора линкот. Секој пат кога ќе го зачуваш планот, промените се видливи веднаш.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-500">Не може да се генерира код. Обиди се повторно.</p>
              )}
            </div>
          )}

          {/* ── View tab ── */}
          {tab === 'view' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Внеси го кодот на колегата за да го гледаш неговиот/нејзиниот неделен план.</p>

              <div className="flex gap-2">
                <input
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Пример: AB12CD"
                  maxLength={6}
                  className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => handleFindByToken()}
                  disabled={tokenInput.length < 6 || isSearching}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:bg-gray-300 hover:bg-indigo-700 transition"
                >
                  {isSearching ? '...' : 'Отвори'}
                </button>
              </div>

              {viewError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{viewError}</div>
              )}

              {sharedPlan && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs font-bold text-emerald-700">Live — план на {sharedOwner} · Нед. {sharedPlan.weekNumber}</p>
                  </div>

                  {/* Preview grid */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-2 py-1.5 text-slate-500 font-bold border-b border-r border-slate-200">Час</th>
                          {MK_DAYS.map(d => (
                            <th key={d} className="px-2 py-1.5 text-slate-500 font-bold border-b border-r border-slate-200 last:border-r-0">{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.max(...sharedPlan.periodsPerDay, 1) }, (_, pIdx) => (
                          <tr key={pIdx} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-2 py-1.5 font-bold text-slate-500 border-r border-slate-100 text-center">{pIdx + 1}</td>
                            {MK_DAYS.map((_, dIdx) => {
                              const slot = sharedPlan.slots.find(s => s.dayIdx === dIdx && s.periodIdx === pIdx);
                              return (
                                <td key={dIdx} className="px-2 py-1.5 border-r border-slate-100 last:border-r-0">
                                  {slot ? (
                                    <span className="text-indigo-700 font-semibold leading-tight block">{slot.topicTitle}</span>
                                  ) : (
                                    <span className="text-slate-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewShared(sharedPlan, sharedOwner)}
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                  >
                    Прикажи во мојот план →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} className="w-full py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Затвори
          </button>
        </div>
      </div>
    </div>
  );
};
