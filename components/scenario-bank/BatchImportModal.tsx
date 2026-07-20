import React, { useCallback, useState } from 'react';
import { Upload, X, Loader2, Sparkles, CheckSquare, Square, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseUploadedFile } from '../../services/documentParser';
import { CloudImportMenu } from '../common/CloudImportMenu';
import { useLanguage } from '../../i18n/LanguageContext';

interface ParseResult {
  name: string;
  text: string;
  error?: string;
}

interface Props {
  onClose: () => void;
  /** Called with an array of {name, text} for each selected file */
  onImportSelected: (files: Array<{ name: string; text: string }>) => void;
  isImporting: boolean;
}

const MAX_CONCURRENT = 5;

export const BatchImportModal: React.FC<Props> = ({ onClose, onImportSelected, isImporting }) => {
  const { t } = useLanguage();
  const [results, setResults] = useState<ParseResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isParsing, setIsParsing] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsParsing(true);
    setResults([]);
    setSelected(new Set());

    const all = Array.from(files);

    // Process in batches of MAX_CONCURRENT
    const parsed: ParseResult[] = [];
    for (let i = 0; i < all.length; i += MAX_CONCURRENT) {
      const batch = all.slice(i, i + MAX_CONCURRENT);
      const settled = await Promise.allSettled(
        batch.map(async (f) => {
          const doc = await parseUploadedFile(f);
          return { name: f.name, text: doc.text, error: doc.text.trim() ? undefined : t('scenarioBank.batch.noText') };
        }),
      );
      settled.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          parsed.push(r.value);
        } else {
          parsed.push({ name: batch[idx].name, text: '', error: t('scenarioBank.batch.readError') });
        }
      });
    }

    setResults(parsed);
    // Auto-select parseable ones
    setSelected(new Set(parsed.filter(r => !r.error).map((_, i) => i)));
    setIsParsing(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    await handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleCloudFile = useCallback(async (file: File) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    await handleFiles(dt.files);
  }, [handleFiles]);

  const handleCloudError = useCallback((message: string) => {
    setResults(prev => [...prev, { name: t('scenarioBank.batch.cloudImport'), text: '', error: message }]);
  }, [t]);

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    const parseable = results.map((r, i) => ({ r, i })).filter(({ r }) => !r.error).map(({ i }) => i);
    setSelected(prev => prev.size === parseable.length ? new Set() : new Set(parseable));
  };

  const handleImport = () => {
    const chosen = results
      .filter((_, i) => selected.has(i))
      .map(r => ({ name: r.name, text: r.text }));
    if (chosen.length > 0) onImportSelected(chosen);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              {t('scenarioBank.batch.title')}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('scenarioBank.batch.subtitle')}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            className="relative border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:border-indigo-300 transition-colors"
          >
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt,image/png,image/jpeg,image/webp"
              onChange={e => handleFiles(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label={t('scenarioBank.batch.selectFiles')}
            />
            {isParsing ? (
              <div className="flex items-center justify-center gap-2 text-indigo-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('scenarioBank.batch.readingFiles')}
              </div>
            ) : (
              <>
                <Upload className="w-7 h-7 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">{t('scenarioBank.batch.dragMultipleOrClick')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('scenarioBank.batch.fileTypesHintPerFile')}</p>
              </>
            )}
          </div>

          <div className="flex justify-center">
            <CloudImportMenu variant="light" disabled={isParsing || isImporting} onFileSelected={handleCloudFile} onError={handleCloudError} />
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">
                  {t('scenarioBank.batch.foundNFiles').replace('{n}', String(results.length))}
                </p>
                <button type="button" onClick={toggleAll} className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline">
                  {selected.size === results.filter(r => !r.error).length
                    ? <><CheckSquare className="w-3.5 h-3.5" /> {t('scenarioBank.sel.deselectAll')}</>
                    : <><Square className="w-3.5 h-3.5" /> {t('scenarioBank.sel.selectAll')}</>}
                </button>
              </div>
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!!r.error}
                  onClick={() => !r.error && toggle(i)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    r.error
                      ? 'border-red-100 bg-red-50 cursor-not-allowed'
                      : selected.has(i)
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {r.error
                        ? <AlertTriangle className="w-4 h-4 text-red-400" />
                        : selected.has(i)
                        ? <CheckSquare className="w-4 h-4 text-indigo-500" />
                        : <Square className="w-4 h-4 text-gray-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${r.error ? 'text-red-600' : 'text-gray-800'}`}>
                        {r.name}
                      </p>
                      {r.error
                        ? <p className="text-xs text-red-500">{r.error}</p>
                        : <p className="text-xs text-gray-400">{t('scenarioBank.sel.kChars').replace('{n}', String(Math.round(r.text.length / 100) / 10))}</p>}
                    </div>
                    {!r.error && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={selected.size === 0 || isImporting || isParsing}
            className="flex-2 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
          >
            {isImporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('scenarioBank.batch.analyzing')}</>
              : <><Sparkles className="w-4 h-4" /> {t('scenarioBank.batch.analyzeSelectedWithAI').replace('{n}', String(selected.size))}</>}
          </button>
        </div>
      </div>
    </div>
  );
};
