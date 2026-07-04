import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { parseUploadedFile, type ParsedDocument } from '../../services/documentParser';
import { CloudImportMenu } from '../common/CloudImportMenu';

interface Props {
  onClose: () => void;
  /** Called with the raw extracted text once the user confirms — parent runs the AI parse + navigation. */
  onExtracted: (rawText: string, fileName: string) => void;
}

export const UploadScenarioModal: React.FC<Props> = ({ onClose, onExtracted }) => {
  const [doc, setDoc] = useState<ParsedDocument | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setIsBusy(true);
    setError(null);
    setDoc(null);
    try {
      const parsed = await parseUploadedFile(file);
      setDoc(parsed);
      setFileName(file.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Грешка при читање на датотеката.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  }, [handleFile]);

  const handleContinue = async () => {
    if (!doc) return;
    setError(null);
    setIsBusy(true);
    try {
      if (!doc.text.trim()) {
        setError('Не успеа да се прочита текст. Пробајте друга датотека.');
        return;
      }
      onExtracted(doc.text, fileName);
    } finally {
      setIsBusy(false);
    }
  };

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
              accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.zip" // future ZIP import
              onChange={onFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Прикачи датотека"
            />
            {doc ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-gray-800 truncate max-w-[260px]">{fileName}</span>
                <span className="text-gray-400">({Math.round(doc.charCount / 1000 * 10) / 10} K chars)</span>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                Повлечи датотека тука или кликни за да избереш<br />
                <span className="text-xs">PDF, DOCX, TXT, PNG, JPG — до 20 MB</span>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <CloudImportMenu variant="light" disabled={isBusy} onFileSelected={handleFile} onError={setError} />
          </div>

          {doc && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                {doc.kind}
              </span>
              {doc.truncated && (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Долг документ — само прв дел ќе биде анализиран
                </span>
              )}
              {doc.images.length > 0 && (
                <span className="text-emerald-700">📷 {doc.images.length} слика(и) детектирани</span>
              )}
            </div>
          )}

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
