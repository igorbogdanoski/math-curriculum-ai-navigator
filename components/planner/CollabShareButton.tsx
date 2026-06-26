import React, { useState, useEffect } from 'react';
import { Users, Link2, Copy, Check, Lock, Unlock, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ensureCollabPlan, setPublicLink, subscribeCollabPlan,
  type CollabPlan, type CollabPlanType,
} from '../../services/firestoreService.collabPlans';

interface Props {
  planType: CollabPlanType;
  planId: string;
  ownerUid: string;
  ownerName: string;
  /** Only owner can change settings */
  isOwner: boolean;
}

const I18N = {
  mk: {
    share: 'Сподели',
    collab: 'Колаборација',
    publicLink: 'Јавна врска',
    publicLinkDesc: 'Секој со врската може да го прегледа планот',
    copyLink: 'Копирај врска',
    copied: 'Копирано!',
    sharedWith: 'Споделено со',
    nobody: 'Само ти',
    close: 'Затвори',
    lessonStudy: '🎌 Lesson Study: Сподели со тимот за заедничко планирање',
  },
  sq: {
    share: 'Shpërnda',
    collab: 'Bashkëpunim',
    publicLink: 'Lidhje publike',
    publicLinkDesc: 'Kushdo me lidhjen mund ta shikojë planin',
    copyLink: 'Kopjo lidhjen',
    copied: 'U kopjua!',
    sharedWith: 'Ndarë me',
    nobody: 'Vetëm ju',
    close: 'Mbyll',
    lessonStudy: '🎌 Lesson Study: Ndajeni me ekipin për planifikim të përbashkët',
  },
  tr: {
    share: 'Paylaş',
    collab: 'İşbirliği',
    publicLink: 'Genel bağlantı',
    publicLinkDesc: 'Bağlantıya sahip herkes planı görebilir',
    copyLink: 'Bağlantıyı kopyala',
    copied: 'Kopyalandı!',
    sharedWith: 'Paylaşıldı',
    nobody: 'Yalnızca siz',
    close: 'Kapat',
    lessonStudy: '🎌 Lesson Study: Ortak planlama için ekiple paylaşın',
  },
  en: {
    share: 'Share',
    collab: 'Collaboration',
    publicLink: 'Public link',
    publicLinkDesc: 'Anyone with the link can view the plan',
    copyLink: 'Copy link',
    copied: 'Copied!',
    sharedWith: 'Shared with',
    nobody: 'Only you',
    close: 'Close',
    lessonStudy: '🎌 Lesson Study: Share with your team for collaborative planning',
  },
};

export const CollabShareButton: React.FC<Props> = ({
  planType, planId, ownerUid, ownerName, isOwner,
}) => {
  const { language } = useLanguage();
  const lang = (language as string) in I18N ? (language as string) : 'mk';
  const s = I18N[lang as keyof typeof I18N];

  const [open, setOpen] = useState(false);
  const [collab, setCollab] = useState<CollabPlan | null>(null);
  const [copied, setCopied] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!open) return;
    let unsub: (() => void) | null = null;

    ensureCollabPlan(planType, planId, ownerUid, ownerName).then(c => {
      setCollab(c);
      unsub = subscribeCollabPlan(planType, planId, updated => {
        if (updated) setCollab(updated);
      });
    }).catch(() => {});

    return () => { unsub?.(); };
  }, [open, planType, planId, ownerUid, ownerName]);

  const shareUrl = collab
    ? `${window.location.origin}/shared-plan/${collab.shareToken}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePublic = async () => {
    if (!collab || !isOwner) return;
    setIsToggling(true);
    try {
      await setPublicLink(planType, planId, !collab.publicLink);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold transition-colors"
      >
        <Users className="w-4 h-4" />
        {s.share}
        {collab && collab.sharedWithUids.length > 0 && (
          <span className="w-4 h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">
            {collab.sharedWithUids.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> {s.collab}
            </h3>
            <button type="button" onClick={() => setOpen(false)} title={s.close} aria-label={s.close} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Lesson Study hint */}
          <p className="text-[11px] text-indigo-600 bg-indigo-50 rounded-lg p-2">{s.lessonStudy}</p>

          {/* Public link toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> {s.publicLink}
                </p>
                <p className="text-[11px] text-gray-500">{s.publicLinkDesc}</p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleTogglePublic}
                  disabled={isToggling || !collab}
                  aria-label={collab?.publicLink ? 'Оневозможи јавна врска' : 'Овозможи јавна врска'}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    collab?.publicLink ? 'bg-indigo-600' : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    collab?.publicLink ? 'translate-x-5' : ''
                  }`} />
                </button>
              )}
              {!isOwner && (
                collab?.publicLink
                  ? <Unlock className="w-4 h-4 text-emerald-500" />
                  : <Lock className="w-4 h-4 text-gray-400" />
              )}
            </div>

            {collab?.publicLink && (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  aria-label="Share URL"
                  className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  title={s.copyLink}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    copied
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? s.copied : s.copyLink}
                </button>
              </div>
            )}
          </div>

          {/* Shared with */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              {s.sharedWith} ({collab?.sharedWithUids.length ?? 0})
            </p>
            {(!collab || collab.sharedWithUids.length === 0) ? (
              <p className="text-xs text-gray-400 italic">{s.nobody}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {collab.sharedWithUids.map(uid => (
                  <span key={uid} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
                    {uid.slice(0, 8)}…
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Lock indicator */}
          {collab?.lockedByUid && (
            <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Некој уредува во моментов…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
