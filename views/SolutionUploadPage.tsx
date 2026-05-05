import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, Upload, RotateCcw, Send } from 'lucide-react';
import { getSolutionUploadDoc, completeSolutionUpload } from '../services/firestoreService.solutionUploads';
import { uploadSolutionImage } from '../services/storageService';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebaseConfig';

type Phase = 'loading' | 'ready' | 'preview' | 'uploading' | 'done' | 'error' | 'expired' | 'already_done';

interface SolutionUploadPageProps {
  token?: string;
}

// ─── Image compression ────────────────────────────────────────────────────────
// Resize to max 1600px on longest side, JPEG 85%.
// Modern browsers apply EXIF orientation before drawImage, so this also fixes
// landscape photos that arrive rotated 90° from iOS/Android cameras.
async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SolutionUploadPage({ token }: SolutionUploadPageProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalBytes, setOriginalBytes] = useState(0);
  const [compressedBytes, setCompressedBytes] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setPhase('error'); setErrorMsg('Невалиден линк.'); return; }
    const init = async () => {
      try {
        await signInAnonymously(auth).catch(() => {/* already signed in */});
        const doc = await getSolutionUploadDoc(token);
        if (!doc) { setPhase('error'); setErrorMsg('Токенот не постои или е избришан.'); return; }
        if (Date.now() > doc.expiresAt) { setPhase('expired'); return; }
        if (doc.imageUrl) { setPhase('already_done'); return; }
        setPhase('ready');
      } catch {
        setPhase('error');
        setErrorMsg('Не може да се провери токенот. Провери ја интернет конекцијата.');
      }
    };
    void init();
  }, [token]);

  // Cleanup object URL on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFileSelected = useCallback(async (file: File) => {
    setOriginalBytes(file.size);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Compress in background — update preview with compressed version
    const compressed = await compressImage(file);
    setCompressedBytes(compressed.size);
    setSelectedFile(compressed);

    // Replace preview URL with compressed version
    URL.revokeObjectURL(url);
    setPreviewUrl(URL.createObjectURL(compressed));
    setPhase('preview');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!token || !selectedFile) return;
    setPhase('uploading');
    try {
      const url = await uploadSolutionImage(selectedFile, token);
      await completeSolutionUpload(token, url);
      setPhase('done');
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : 'Грешка при прикачување. Обиди се повторно.');
    }
  }, [token, selectedFile]);

  const handleRetake = useCallback(() => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setSelectedFile(null);
    setPhase('ready');
    // Reset file input so same file can be reselected
    if (fileRef.current) fileRef.current.value = '';
  }, [previewUrl]);

  const openCamera = useCallback(() => {
    if (!fileRef.current) return;
    fileRef.current.setAttribute('capture', 'environment');
    fileRef.current.click();
  }, []);

  const openGallery = useCallback(() => {
    if (!fileRef.current) return;
    fileRef.current.removeAttribute('capture');
    fileRef.current.click();
  }, []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelected(file);
  }, [handleFileSelected]);

  const savingKB = Math.round((originalBytes - compressedBytes) / 1024);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">

        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Camera className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-1">Прикачи решение</h1>

        {/* Loading */}
        {phase === 'loading' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm text-gray-500">Се верификува...</p>
          </div>
        )}

        {/* Ready — pick source */}
        {phase === 'ready' && (
          <>
            <p className="text-sm text-gray-500 mb-6">Направи снимка на твоето решение или избери слика.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
            <button
              type="button"
              onClick={openCamera}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-base transition-colors mb-3"
            >
              <Camera className="w-5 h-5" />
              Сними со камера
            </button>
            <button
              type="button"
              onClick={openGallery}
              className="w-full py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-2xl border-2 border-gray-200 flex items-center justify-center gap-2 text-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              Избери од галерија
            </button>
          </>
        )}

        {/* Preview — confirm before upload */}
        {phase === 'preview' && previewUrl && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Дали сликата е јасна и читлива?</p>
            <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-100 bg-gray-50">
              <img
                src={previewUrl}
                alt="Преглед"
                className="w-full max-h-64 object-contain"
              />
              {savingKB > 0 && (
                <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                  {Math.round(compressedBytes / 1024)} KB
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Пресними
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                Прати
              </button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {phase === 'uploading' && (
          <div className="py-6 flex flex-col items-center gap-4">
            {previewUrl && (
              <img src={previewUrl} alt="Прикачување" className="w-full max-h-48 object-contain rounded-xl border border-gray-200" />
            )}
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-gray-500">Се прикачува...</p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="py-6 flex flex-col items-center gap-3">
            {previewUrl && (
              <img src={previewUrl} alt="Прикачено" className="w-full max-h-48 object-contain rounded-xl border border-green-200 mb-2" />
            )}
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <p className="text-lg font-bold text-green-700">Решението е прикачено!</p>
            <p className="text-sm text-gray-500">Компјутерот автоматски го прима. Можеш да го затвориш ова.</p>
          </div>
        )}

        {/* Already done */}
        {phase === 'already_done' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-14 h-14 text-indigo-400" />
            <p className="font-semibold text-gray-700">Решението веќе е прикачено.</p>
            <p className="text-sm text-gray-500">Овој QR код е искористен. За ново прикачување генерирај нов QR на компјутерот.</p>
          </div>
        )}

        {/* Expired */}
        {phase === 'expired' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <AlertCircle className="w-14 h-14 text-amber-400" />
            <p className="font-semibold text-amber-700">QR кодот е истечен</p>
            <p className="text-sm text-gray-500">Временскиот прозорец (10 минути) поминал. Побарај нов QR на компјутерот.</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <AlertCircle className="w-14 h-14 text-red-400" />
            <p className="font-semibold text-red-600">Грешка</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700"
            >
              Обиди се повторно
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
