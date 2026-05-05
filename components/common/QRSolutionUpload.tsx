import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, X, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { createSolutionToken, subscribeSolutionUpload } from '../../services/firestoreService.solutionUploads';

interface QRSolutionUploadProps {
  questionKey: string;
  onImageUrl: (url: string) => void;
  disabled?: boolean;
  existingUrl?: string;
}

const EXPIRY_MS = 10 * 60 * 1000;

export const QRSolutionUpload: React.FC<QRSolutionUploadProps> = ({
  questionKey,
  onImageUrl,
  disabled = false,
  existingUrl,
}) => {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [received, setReceived] = useState(false);
  const [secsLeft, setSecsLeft] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const openModal = useCallback(async () => {
    if (disabled) return;
    setOpen(true);
    setReceived(false);
    setGenerating(true);
    try {
      const t = await createSolutionToken(questionKey);
      setToken(t);
      const origin = window.location.origin;
      setQrUrl(`${origin}/#/upload/${t}`);
      setSecsLeft(EXPIRY_MS / 1000);

      timerRef.current = setInterval(() => {
        setSecsLeft(s => {
          if (s <= 1) {
            cleanup();
            return 0;
          }
          return s - 1;
        });
      }, 1000);

      unsubRef.current = subscribeSolutionUpload(t, url => {
        setReceived(true);
        cleanup();
        onImageUrl(url);
      });
    } finally {
      setGenerating(false);
    }
  }, [disabled, questionKey, onImageUrl, cleanup]);

  const closeModal = useCallback(() => {
    cleanup();
    setOpen(false);
    setToken(null);
    setQrUrl(null);
    setReceived(false);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const expiringSoon = secsLeft > 0 && secsLeft <= 60;
  const expired = token !== null && secsLeft === 0 && !received;

  if (existingUrl) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <a href={existingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-indigo-600 hover:underline">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <img src={existingUrl} alt="Решение" className="h-14 w-20 object-cover rounded-lg border border-gray-200" />
          <span>Прикачено решение</span>
        </a>
        {!disabled && (
          <button type="button" onClick={openModal} className="text-xs text-gray-400 hover:text-indigo-600 underline">
            Замени
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Camera className="w-3.5 h-3.5" />
        Прикачи решение (QR)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 text-gray-400"
              aria-label="Затвори"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-1">Прикачи решение</h3>
            <p className="text-sm text-gray-500 mb-4">
              Скенирај го QR кодот со телефонот и прикачи фотографија на твоето решение.
            </p>

            {generating && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            )}

            {!generating && received && (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <p className="font-bold text-green-700">Решението е прикачено!</p>
                <button type="button" onClick={closeModal}
                  className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">
                  Затвори
                </button>
              </div>
            )}

            {!generating && !received && expired && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Clock className="w-12 h-12 text-red-400" />
                <p className="font-semibold text-red-600">QR кодот е истечен</p>
                <button type="button" onClick={openModal}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">
                  Генерирај нов
                </button>
              </div>
            )}

            {!generating && !received && !expired && qrUrl && (
              <div className="flex flex-col items-center gap-4">
                <div className="p-3 bg-white border-2 border-indigo-200 rounded-xl">
                  <QRCodeSVG value={qrUrl} size={200} />
                </div>
                <div className={`flex items-center gap-1.5 text-sm font-medium ${expiringSoon ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
                  <Clock className="w-4 h-4" />
                  {mins}:{String(secs).padStart(2, '0')} до истек
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Откако ќе прикачиш слика, оваа прозорец автоматски ќе се ажурира.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
