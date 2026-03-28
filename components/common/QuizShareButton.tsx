/**
 * Standalone share controls for quiz/assessment materials.
 * - Copy link: saves to cached_ai_materials once, then copies play URL
 * - QR Code: shows printable QR code modal so students can scan and play
 * Subsequent clicks reuse the same cacheId — no duplicate saves.
 */
import React, { useRef, useState } from 'react';
import { Link, Check, Loader2, QrCode, Printer, X, Copy, BookOpen, Lock, Globe } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { firestoreService } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import type { AIGeneratedAssessment } from '../../types';

interface Props {
  material: AIGeneratedAssessment;
  materialType: 'QUIZ' | 'ASSESSMENT';
  conceptId?: string;
  gradeLevel?: number;
}

export const QuizShareButton: React.FC<Props> = ({ material, materialType, conceptId, gradeLevel }) => {
  const { firebaseUser, user } = useAuth();
  const { addNotification } = useNotification();
  const [saving, setSaving] = useState(false);
  const [cacheId, setCacheId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'Unlimited';

  const makeShareUrl = (id: string) =>
    `${window.location.origin}${window.location.pathname}#/play/${id}`;

  /** Ensures material is saved and returns its id */
  const ensureSaved = async (): Promise<string | null> => {
    if (!firebaseUser?.uid) {
      addNotification('Мора да бидете логирани за да споделите.', 'warning');
      return null;
    }
    if (cacheId) return cacheId;

    setSaving(true);
    try {
      const id = await firestoreService.saveAssignmentMaterial(material, {
        title: (material as { title?: string }).title || 'Квиз',
        type: materialType,
        conceptId,
        gradeLevel,
        teacherUid: firebaseUser.uid,
        isPublic,
      });
      setCacheId(id);
      return id;
    } catch {
      addNotification('Грешка при генерирање на линк.', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const id = await ensureSaved();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(makeShareUrl(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addNotification('Не можев да копирам — линкот е генериран.', 'warning');
    }
  };

  const handleShowQR = async () => {
    const id = await ensureSaved();
    if (!id) return;
    setShowQR(true);
  };

  const handleShareToClassroom = async () => {
    const id = await ensureSaved();
    if (!id) return;
    const url = encodeURIComponent(makeShareUrl(id));
    const title = encodeURIComponent(quizTitle);
    window.open(`https://classroom.google.com/share?url=${url}&title=${title}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareToTeams = async () => {
    const id = await ensureSaved();
    if (!id) return;
    const url = encodeURIComponent(makeShareUrl(id));
    const title = encodeURIComponent(quizTitle);
    window.open(`https://teams.microsoft.com/share?href=${url}&msgText=${title}`, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const title = (material as { title?: string }).title || 'Квиз';
    win.document.write(
      `<html><head><title>QR — ${title}</title>` +
      `<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;` +
      `justify-content:center;height:100vh;margin:0;gap:8px}` +
      `h2{font-size:1.2rem;font-weight:700;color:#1e1b4b;text-align:center;margin:0}` +
      `p{font-size:0.8rem;color:#6b7280;text-align:center;margin:0}` +
      `svg{width:220px;height:220px}</style></head>` +
      `<body>${printRef.current.innerHTML}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const shareUrl = cacheId ? makeShareUrl(cacheId) : '';
  const quizTitle = (material as { title?: string }).title || 'Квиз';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* PRO privacy toggle */}
      {isPro && !cacheId && (
        <button
          type="button"
          onClick={() => setIsPublic(v => !v)}
          title={isPublic ? 'Материјалот ќе биде јавен во Библиотеката' : 'Материјалот е приватен — само за тебе (PRO)'}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
            isPublic
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {isPublic
            ? <><Globe className="w-3.5 h-3.5" /> Јавно</>
            : <><Lock className="w-3.5 h-3.5" /> Приватно (PRO)</>
          }
        </button>
      )}
      {/* Copy link button */}
      <button
        type="button"
        onClick={handleCopyLink}
        disabled={saving}
        title="Копирај директен линк за ученици"
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" />Генерирам…</>
          : copied
          ? <><Check className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">Копирано!</span></>
          : <><Link className="w-4 h-4" />Копирај линк</>}
      </button>

      {/* MS Teams button */}
      <button
        type="button"
        onClick={handleShareToTeams}
        disabled={saving}
        title="Испрати во Microsoft Teams"
        aria-label="Испрати во Microsoft Teams"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.625 6.75h-4.5v-.375A2.625 2.625 0 0 0 13.5 3.75h-3a2.625 2.625 0 0 0-2.625 2.625V6.75h-4.5A.375.375 0 0 0 3 7.125v9.75c0 .207.168.375.375.375h17.25A.375.375 0 0 0 21 16.875v-9.75a.375.375 0 0 0-.375-.375zM9.375 6.375A1.125 1.125 0 0 1 10.5 5.25h3a1.125 1.125 0 0 1 1.125 1.125V6.75h-5.25v-.375z"/>
        </svg>
        Teams
      </button>

      {/* Google Classroom button */}
      <button
        type="button"
        onClick={handleShareToClassroom}
        disabled={saving}
        title="Испрати во Google Classroom"
        aria-label="Испрати во Google Classroom"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        <BookOpen className="w-4 h-4" />
        Classroom
      </button>

      {/* QR Code button */}
      <button
        type="button"
        onClick={handleShowQR}
        disabled={saving}
        title="Прикажи QR код за ученици"
        aria-label="Прикажи QR код"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
      >
        <QrCode className="w-4 h-4" />
        QR Код
      </button>

      {/* QR Modal */}
      {showQR && shareUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between w-full">
              <h2 id="qr-modal-title" className="font-bold text-gray-800 text-base">QR Код за ученици</h2>
              <button
                type="button"
                aria-label="Затвори"
                onClick={() => setShowQR(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable QR area */}
            <div ref={printRef} className="flex flex-col items-center gap-3 py-2">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="M"
                includeMargin
                className="rounded-xl"
              />
              <h2 className="text-base font-bold text-indigo-900 text-center">{quizTitle}</h2>
              <p className="text-xs text-gray-500 text-center">Скенирај за да го играш квизот</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <Printer className="w-4 h-4" />
                Печати
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-bold rounded-xl transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Копирано!' : 'Копирај'}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Ученикот го скенира QR кодот и веднаш го стартува квизот без логирање
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
