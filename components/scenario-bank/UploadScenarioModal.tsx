import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { toBase64, detectImageMime } from '../../views/extractionHubHelpers';

type DocKind = 'pdf' | 'docx' | 'txt' | 'image';

interface UploadedDoc {
  name: string;
  size: number;
  kind: DocKind;
  text?: string;
  base64?: string;
  mimeType?: string;
}

interface Props {
  onClose: () => void;
  /** Called with the raw extracted text once the user confirms — parent runs the AI parse + navigation. */
  onExtracted: (rawText: string, fileName: string) => void;
}

const MAX_SIZE = 20 * 1024 * 1024;

export const UploadScenarioModal: React.FC<Props> = ({ onClose, onExtracted }) => {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      setError('Датотеката е поголема од 20 MB. Изберете помала датотека.');
      return;
    }
    setError(null);
    setDoc(null);
    setIsLoadingFile(true);
    try {
      const name = file.name;
      const size = file.size;
      const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx');
      const isTxt = file.type === 'text/plain' || name.endsWith('.txt');
      const imageMime = detectImageMime(name, file.type);

      if (imageMime) {
        const ab = await file.arrayBuffer();
        const base64 = toBase64(ab);
        setDoc({ name, size, kind: 'image', base64, mimeType: imageMime });
      } else if (isPdf) {
        const ab = await file.arrayBuffer();
        const base64 = toBase64(ab);
        setDoc({ name, size, kind: 'pdf', base64 });
      } else if (isDocx) {
        const ab = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab });
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        setDoc({ name, size, kind: 'docx', text });
      } else if (isTxt) {
        const text = await file.text();
        setDoc({ name, size, kind: 'txt', text });
      } else {
        setError('Поддржани формати: PDF, DOCX, TXT, PNG, JPG, WEBP.');
      }
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await loadFile(file);
  }, [loadFile]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadFile(file);
  }, [loadFile]);

  const handleContinue = useCallback(async () => {
    if (!doc) return;
    setError(null);
    try {
      let rawText = '';
      if (doc.kind === 'txt' || doc.kind === 'docx') {
        rawText = doc.text ?? '';
      } else if (doc.kind === 'pdf') {
        setIsExtractingPdf(true);
        const { extractTextFromDocument } = await import('../../services/gemini/visionContracts');
        rawText = await extractTextFromDocument(doc.base64 ?? '');
      } else if (doc.kind === 'image') {
        setIsExtractingPdf(true);
        const { extractTextFromImage } = await import('../../services/gemini/visionContracts');
        rawText = await extractTextFromImage(doc.base64 ?? '', doc.mimeType ?? 'image/png');
      }
      if (!rawText.trim()) {
        setError('Не успеа да се прочита текст од датотеката. Пробајте друга датотека.');
        return;
      }
      onExtracted(rawText, doc.name);
    } catch {
      setError('Грешка при читање на содржината. Пробајте повторно.');
    } finally {
      setIsExtractingPdf(false);
    }
  }, [doc, onExtracted]);

  const isBusy = isLoadingFile || isExtractingPdf;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              Прикачи старо сценарио
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              AI ќе ја структурира твојата постоечка подготовка — потоа можеш да ја збогатиш педагошки.
            </p>
          </div>
          <button type="button" onClick={onClose} title="Затвори" aria-label="Затвори" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <input
              type="file"
              accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              onChange={onFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Прикачи датотека"
            />
            {doc ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-gray-800 truncate max-w-[260px]">{doc.name}</span>
                <span className="text-gray-400">({(doc.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                Повлечи датотека тука или кликни за да избереш<br />
                <span className="text-xs">PDF, DOCX, TXT, PNG, JPG — до 20 MB</span>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <p className="text-xs text-gray-400">
            ⚠️ AI само ТРАНСКРИБИРА и СТРУКТУРИРА — не измислува содржина. Ќе можеш да прегледаш и уредиш сè пред да го објавиш во Банката.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
            >
              Откажи
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!doc || isBusy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isBusy ? 'Се обработува...' : 'Анализирај со AI'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
